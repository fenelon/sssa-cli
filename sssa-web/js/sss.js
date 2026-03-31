/**
 * sss.js — Shamir's Secret Sharing core math utilities
 *
 * Port of lib/utils.rb. Attaches to window.SSS for file:// compatibility.
 * Requires a browser with BigInt and crypto.getRandomValues support.
 */
(function (global) {
  'use strict';

  // 2^256 - 189  (matches Ruby default prime)
  var PRIME = 2n ** 256n - 189n;

  /**
   * Returns a cryptographically random BigInt in [0, PRIME).
   */
  function random() {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return BigInt('0x' + hex) % PRIME;
  }

  /**
   * Converts a UTF-8 string to an array of BigInts.
   *
   * Each character is hex-encoded, the hex string is split into 64-char chunks,
   * each chunk is RIGHT-padded with zeros to 64 chars, then parsed as a BigInt.
   * This matches Ruby: (segment + "0"*(64-segment.size)).hex
   */
  function splitInts(secret) {
    var encoder = new TextEncoder();
    var bytes = encoder.encode(secret);

    // Convert each byte to a 2-char hex string, concatenate all
    var hexStr = '';
    for (var i = 0; i < bytes.length; i++) {
      hexStr += bytes[i].toString(16).padStart(2, '0');
    }

    // Split into 64-char chunks and right-pad each to 64 chars
    var result = [];
    for (var pos = 0; pos < hexStr.length; pos += 64) {
      var segment = hexStr.slice(pos, pos + 64);
      // Right-pad with zeros to reach 64 chars
      var padded = segment + '0'.repeat(64 - segment.length);
      result.push(BigInt('0x' + padded));
    }

    return result;
  }

  /**
   * Converts an array of BigInts back to a UTF-8 string.
   *
   * Each BigInt is left-padded to 64 hex chars, split into byte pairs,
   * parsed to bytes, trailing null bytes are trimmed, then decoded as UTF-8.
   * This matches Ruby: int.to_s(16) left-padded to 64, scan(/../) → bytes.
   */
  function mergeInts(secrets) {
    var byteArr = [];

    for (var i = 0; i < secrets.length; i++) {
      var hexStr = secrets[i].toString(16).padStart(64, '0');
      // Split into byte pairs (each 2 hex chars = 1 byte)
      for (var pos = 0; pos < hexStr.length; pos += 2) {
        byteArr.push(parseInt(hexStr.slice(pos, pos + 2), 16));
      }
    }

    // Trim trailing null bytes (matching Ruby's gsub(/\u0000*$/, ''))
    var end = byteArr.length;
    while (end > 0 && byteArr[end - 1] === 0) {
      end--;
    }

    var trimmed = new Uint8Array(byteArr.slice(0, end));
    var decoder = new TextDecoder('utf-8');
    return decoder.decode(trimmed);
  }

  /**
   * Evaluates a polynomial using Horner's method.
   *
   * Given coefficients [a, b, c] and value x, computes a + bx + cx^2 (mod PRIME).
   * Matches Ruby: iterate reverse, result = result*value + coefficient (mod prime).
   */
  function evaluatePolynomial(coefficients, value) {
    var result = 0n;
    for (var i = coefficients.length - 1; i >= 0; i--) {
      result = (result * value + BigInt(coefficients[i])) % PRIME;
    }
    return result;
  }

  /**
   * Extended Euclidean algorithm.
   * Returns [gcd, x, y] such that gcd = a*x + b*y.
   *
   * Matches Ruby exactly:
   *   if b===0 return [a,1,0]
   *   else n=floor(a/b), c=a%b, r=gcd(b,c), return [r[0], r[2], r[1]-r[2]*n]
   */
  function gcd(a, b) {
    if (b === 0n) {
      return [a, 1n, 0n];
    } else {
      var n = a / b; // BigInt division truncates (floors for positive values)
      var c = a % b;
      var r = gcd(b, c);
      return [r[0], r[2], r[1] - r[2] * n];
    }
  }

  /**
   * Computes the multiplicative inverse of number in the prime field.
   *
   * Matches Ruby exactly:
   *   remainder = gcd(prime, number % prime)[2]
   *   if number < 0: remainder *= -1
   *   return (prime + remainder) % prime
   */
  function modInverse(number) {
    var num = BigInt(number);
    var remainder = gcd(PRIME, num % PRIME)[2];
    if (num < 0n) {
      remainder = remainder * -1n;
    }
    return (PRIME + remainder) % PRIME;
  }

  /**
   * Converts a BigInt to a 44-character URL-safe base64 string.
   *
   * Left-pads hex to 64 chars, converts to binary string, btoa encodes,
   * then substitutes + → - and / → _ (URL-safe alphabet, with = padding).
   * Matches Ruby: Base64.urlsafe_encode64(...)
   */
  function toBase64(number) {
    var num = BigInt(number);
    var hexStr = num.toString(16).padStart(64, '0');

    // Convert hex pairs to a binary string (each pair is one byte / char code)
    var binaryStr = '';
    for (var i = 0; i < hexStr.length; i += 2) {
      binaryStr += String.fromCharCode(parseInt(hexStr.slice(i, i + 2), 16));
    }

    // Standard base64, then make URL-safe
    var b64 = btoa(binaryStr);
    return b64.replace(/\+/g, '-').replace(/\//g, '_');
  }

  /**
   * Converts a 44-character URL-safe base64 string to a BigInt.
   *
   * Reverses URL-safe substitution, atob decodes, hex-encodes each char,
   * right-pads the resulting hex to 64 chars, then parses as BigInt.
   *
   * Matches Ruby:
   *   segment = decoded bytes as hex pairs
   *   (segment + ["00"]*(32-segment.size)).join.hex
   *
   * The right-padding ensures truncated base64 payloads (e.g. for small
   * numbers) are expanded back to their original 32-byte width.
   */
  function fromBase64(str) {
    // Restore standard base64 alphabet
    var standard = str.replace(/-/g, '+').replace(/_/g, '/');
    var binaryStr = atob(standard);

    // Hex-encode each character (byte)
    var hexPairs = [];
    for (var i = 0; i < binaryStr.length; i++) {
      hexPairs.push(binaryStr.charCodeAt(i).toString(16).padStart(2, '0'));
    }

    // Right-pad with "00" pairs to reach 32 bytes (64 hex chars)
    while (hexPairs.length < 32) {
      hexPairs.push('00');
    }

    return BigInt('0x' + hexPairs.join(''));
  }

  /**
   * Creates Shamir secret shares.
   *
   * @param {number} minimum  - Minimum shares needed to reconstruct the secret.
   * @param {number} total    - Total number of shares to generate.
   * @param {string} raw      - The secret string (UTF-8, max 512 bytes).
   * @returns {string[]}      - Array of `total` base64-encoded share strings.
   *
   * Each share is a concatenation of base64(x) + base64(y) pairs, one per
   * secret chunk (44 chars each), giving a total length of chunks * 88 chars.
   */
  function create(minimum, total, raw) {
    if (minimum < 2) {
      throw new Error('minimum must be >= 2');
    }
    if (total < minimum) {
      throw new Error('total must be >= minimum');
    }
    var encoder = new TextEncoder();
    var byteLen = encoder.encode(raw).length;
    if (byteLen > 512) {
      throw new Error('secret exceeds 512 bytes');
    }

    var secrets = splitInts(raw);
    var shares = [];

    // Pre-generate unique random x-values for each share
    var xValues = [];
    for (var s = 0; s < total; s++) {
      var x;
      do {
        x = random();
      } while (xValues.some(function (v) { return v === x; }));
      xValues.push(x);
    }

    // Build polynomial for each secret chunk and evaluate at each x
    // Start by initialising share strings to empty
    for (var s2 = 0; s2 < total; s2++) {
      shares.push('');
    }

    for (var i = 0; i < secrets.length; i++) {
      // Build polynomial coefficients: [secret[i], r1, r2, ..., r_{minimum-1}]
      var coefficients = [secrets[i]];
      for (var k = 1; k < minimum; k++) {
        var coeff;
        do {
          coeff = random();
        } while (coefficients.some(function (v) { return v === coeff; }));
        coefficients.push(coeff);
      }

      // Evaluate polynomial at each x and append x+y pair to the share string
      for (var s3 = 0; s3 < total; s3++) {
        var y = evaluatePolynomial(coefficients, xValues[s3]);
        shares[s3] += toBase64(xValues[s3]) + toBase64(y);
      }
    }

    return shares;
  }

  /**
   * Combines Shamir secret shares to recover the original secret.
   *
   * @param {string[]} shares - Array of share strings (as produced by create).
   * @returns {string}        - The recovered secret string.
   *
   * Uses Lagrange interpolation over the prime field to recover each secret
   * chunk at x=0.
   */
  function combine(shares) {
    // Maps any BigInt to its canonical representative in [0, PRIME)
    function modPos(v) { return ((v % PRIME) + PRIME) % PRIME; }

    // Determine how many secret chunks each share encodes
    var count = shares[0].length / 88;

    var secrets = [];
    for (var i = 0; i < count; i++) {
      // Parse x and y for each share for this chunk
      var points = [];
      for (var j = 0; j < shares.length; j++) {
        var xStr = shares[j].substring(i * 88, i * 88 + 44);
        var yStr = shares[j].substring(i * 88 + 44, i * 88 + 88);
        points.push([fromBase64(xStr), fromBase64(yStr)]);
      }

      // Lagrange interpolation at x=0
      var secret = 0n;
      for (var a = 0; a < points.length; a++) {
        var numerator = 1n;
        var denominator = 1n;
        for (var b = 0; b < points.length; b++) {
          if (a !== b) {
            numerator = modPos(numerator * modPos(0n - points[b][0]));
            denominator = modPos(denominator * modPos(points[a][0] - points[b][0]));
          }
        }
        // Compute contribution: y_a * numerator * modInverse(denominator)
        var contribution = modPos(points[a][1] * numerator * modInverse(denominator));
        secret = modPos(secret + contribution);
      }

      secrets.push(secret);
    }

    return mergeInts(secrets);
  }

  /**
   * Returns true if candidate is a syntactically valid share string.
   *
   * A valid share has length > 0, length divisible by 88, and every 44-char
   * block decodes (via fromBase64) to a value in [0, PRIME].
   *
   * @param {string} candidate
   * @returns {boolean}
   */
  function isValidShare(candidate) {
    if (!candidate || candidate.length === 0 || candidate.length % 88 !== 0) {
      return false;
    }
    var count = candidate.length / 88;
    for (var j = 0; j < count; j++) {
      var xStr = candidate.substring(j * 88, j * 88 + 44);
      var yStr = candidate.substring(j * 88 + 44, j * 88 + 88);
      try {
        var x = fromBase64(xStr);
        var y = fromBase64(yStr);
        if (x < 0n || x > PRIME || y < 0n || y > PRIME) {
          return false;
        }
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  // Attach to global namespace
  global.SSS = {
    _prime: PRIME,
    random: random,
    splitInts: splitInts,
    mergeInts: mergeInts,
    evaluatePolynomial: evaluatePolynomial,
    gcd: gcd,
    modInverse: modInverse,
    toBase64: toBase64,
    fromBase64: fromBase64,
    create: create,
    combine: combine,
    isValidShare: isValidShare,
  };
})(typeof window !== 'undefined' ? window : this);
