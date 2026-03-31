# SSS Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone static HTML application for Shamir's Secret Sharing with QR code generation/scanning, compatible with the existing Ruby CLI.

**Architecture:** Single-page app with modular JS files using `window.SSS.*` namespace (no ES modules). Classic `<script>` tags for `file://` compatibility. A vendored QR generation library and native BarcodeDetector for scanning. Self-bundling download produces a single offline HTML file.

**Tech Stack:** Vanilla HTML/CSS/JS, BigInt for cryptographic math, Canvas API for QR rendering, BarcodeDetector API for scanning, no build tools.

**Spec:** `docs/superpowers/specs/2026-03-31-sss-web-app-design.md`

---

### Task 1: SSS Algorithm — Core Math Utilities

Port `lib/utils.rb` to JavaScript. This is the cryptographic foundation everything else depends on.

**Files:**
- Create: `sssa-web/js/sss.js`
- Create: `sssa-web/tests/sss.test.html` (browser-based test runner)

- [ ] **Step 1: Create the test harness**

Create a minimal browser-based test runner. No framework — just a self-contained HTML file.

```html
<!-- sssa-web/tests/sss.test.html -->
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SSS Tests</title>
<style>
  body { font-family: monospace; margin: 2em; }
  .pass { color: green; } .fail { color: red; }
  #results { white-space: pre-wrap; }
</style>
</head><body>
<h1>SSS Tests</h1>
<div id="results"></div>
<script src="../js/sss.js"></script>
<script>
const results = document.getElementById('results');
let passed = 0, failed = 0;

function appendResult(className, message) {
  var span = document.createElement('span');
  span.className = className;
  span.textContent = (className === 'pass' ? '\u2713 ' : '\u2717 ') + message;
  results.appendChild(span);
  results.appendChild(document.createTextNode('\n'));
}

function assert(condition, message) {
  if (condition) {
    appendResult('pass', message);
    passed++;
  } else {
    appendResult('fail', message);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, message + ' (got: ' + actual + ', expected: ' + expected + ')');
}

function summary() {
  var text = '\n' + passed + ' passed, ' + failed + ' failed\n';
  results.appendChild(document.createTextNode(text));
  document.title = failed === 0 ? '\u2713 All tests passed' : '\u2717 ' + failed + ' failed';
}

// Tests will be added in subsequent steps
</script>
</body></html>
```

- [ ] **Step 2: Write failing tests for core math utilities**

Add these tests in `sss.test.html` before the closing `</script>` tag, before `summary()`:

```javascript
// --- toBase64 / fromBase64 round-trip ---
(function testBase64RoundTrip() {
  var SSS = window.SSS;
  var values = [0n, 1n, 255n, 2n**128n, SSS._prime - 1n];
  values.forEach(function(v, i) {
    var encoded = SSS.toBase64(v);
    assertEqual(encoded.length, 44, 'toBase64 output length for value ' + i);
    var decoded = SSS.fromBase64(encoded);
    assertEqual(decoded, v, 'fromBase64(toBase64(' + v + '))');
  });
})();

// --- splitInts / mergeInts round-trip ---
(function testSplitMergeInts() {
  var SSS = window.SSS;
  var testStrings = ['hello', 'a', 'x'.repeat(64)];
  testStrings.forEach(function(s) {
    var ints = SSS.splitInts(s);
    assert(ints.length > 0, 'splitInts produces chunks for "' + s.substring(0, 10) + '"');
    var recovered = SSS.mergeInts(ints);
    assertEqual(recovered, s, 'mergeInts(splitInts("' + s.substring(0, 10) + '"))');
  });
})();

// --- evaluatePolynomial ---
(function testEvaluatePolynomial() {
  var SSS = window.SSS;
  // f(x) = 3 + 2x + x^2, evaluate at x=2: 3 + 4 + 4 = 11
  var result = SSS.evaluatePolynomial([3n, 2n, 1n], 2n);
  assertEqual(result, 11n, 'evaluatePolynomial([3,2,1], 2) = 11');
})();

// --- modInverse ---
(function testModInverse() {
  var SSS = window.SSS;
  var testValues = [1n, 2n, 12345n, SSS._prime - 1n];
  testValues.forEach(function(v) {
    var inv = SSS.modInverse(v);
    var product = (v * inv) % SSS._prime;
    assertEqual(product, 1n, 'modInverse(' + v + ') * ' + v + ' mod prime = 1');
  });
})();

// --- random ---
(function testRandom() {
  var SSS = window.SSS;
  var r1 = SSS.random();
  var r2 = SSS.random();
  assert(r1 >= 0n && r1 < SSS._prime, 'random() in range');
  assert(r1 !== r2, 'random() produces different values');
})();

summary();
```

- [ ] **Step 3: Run tests to verify they fail**

Open `sssa-web/tests/sss.test.html` in a browser. Expected: all tests fail because `window.SSS` is undefined.

- [ ] **Step 4: Implement sss.js — core math utilities**

```javascript
// sssa-web/js/sss.js
// Shamir's Secret Sharing — JavaScript port of sssa-cli Ruby implementation
// Uses BigInt for 256-bit finite field arithmetic

(function() {
  'use strict';

  var PRIME = 2n ** 256n - 189n;
  var SSS = {};

  // Expose prime for tests
  SSS._prime = PRIME;

  // Crypto-random BigInt in [0, PRIME)
  SSS.random = function() {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    var n = BigInt('0x' + hex);
    return n % PRIME;
  };

  // UTF-8 string -> array of 256-bit BigInts (32-byte chunks, right-padded)
  // Matches Ruby: split_ints
  SSS.splitInts = function(secret) {
    var encoder = new TextEncoder();
    var bytes = encoder.encode(secret);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    var result = [];
    for (var i = 0; i < hex.length; i += 64) {
      var segment = hex.substring(i, i + 64);
      segment = segment + '0'.repeat(64 - segment.length);
      result.push(BigInt('0x' + segment));
    }
    return result;
  };

  // Array of 256-bit BigInts -> UTF-8 string
  // Matches Ruby: merge_ints
  SSS.mergeInts = function(secrets) {
    var bytes = [];
    for (var s = 0; s < secrets.length; s++) {
      var hex = secrets[s].toString(16).padStart(64, '0');
      for (var i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
      }
    }
    while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
      bytes.pop();
    }
    var decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(new Uint8Array(bytes));
  };

  // Evaluate polynomial at value using Horner's method, mod PRIME
  // coefficients = [a0, a1, a2, ...] -> a0 + a1*x + a2*x^2 + ...
  SSS.evaluatePolynomial = function(coefficients, value) {
    var result = 0n;
    for (var i = coefficients.length - 1; i >= 0; i--) {
      result = ((result * value) + coefficients[i]) % PRIME;
    }
    return result;
  };

  // Extended Euclidean Algorithm — returns [gcd, x, y]
  SSS.gcd = function(a, b) {
    if (b === 0n) {
      return [a, 1n, 0n];
    }
    var n = a / b;
    var c = a % b;
    var r = SSS.gcd(b, c);
    return [r[0], r[2], r[1] - r[2] * n];
  };

  // Multiplicative inverse on the finite field
  SSS.modInverse = function(number) {
    var num = ((number % PRIME) + PRIME) % PRIME;
    var remainder = SSS.gcd(PRIME, num)[2];
    if (number < 0n) {
      remainder = remainder * -1n;
    }
    return ((PRIME + remainder) % PRIME);
  };

  // BigInt -> 44-char URL-safe base64 (with = padding)
  SSS.toBase64 = function(number) {
    var hex = number.toString(16).padStart(64, '0');
    var binary = '';
    for (var i = 0; i < hex.length; i += 2) {
      binary += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
  };

  // 44-char URL-safe base64 -> BigInt
  SSS.fromBase64 = function(str) {
    var standard = str.replace(/-/g, '+').replace(/_/g, '/');
    var binary = atob(standard);
    var hex = '';
    for (var i = 0; i < binary.length; i++) {
      hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
    }
    // Right-pad to 64 hex chars if short (matches Ruby from_base64)
    hex = (hex + '00'.repeat(32)).substring(0, 64);
    return BigInt('0x' + hex);
  };

  window.SSS = SSS;
})();
```

- [ ] **Step 5: Run tests to verify they pass**

Open `sssa-web/tests/sss.test.html` in a browser. Expected: all tests pass (green checkmarks).

- [ ] **Step 6: Commit**

```bash
git add sssa-web/js/sss.js sssa-web/tests/sss.test.html
git commit -m "feat(web): add SSS core math utilities (BigInt port of Ruby)"
```

---

### Task 2: SSS Algorithm — Create and Combine

Implement `create`, `combine`, and `isValidShare` on top of the math utilities.

**Files:**
- Modify: `sssa-web/js/sss.js`
- Modify: `sssa-web/tests/sss.test.html`

- [ ] **Step 1: Write failing tests for create/combine/isValidShare**

Add these tests in `sss.test.html` before `summary()`:

```javascript
// --- create + combine round-trip ---
(function testCreateCombine() {
  var SSS = window.SSS;
  var secrets = [
    'hello world',
    'N17FigASkL6p1EOgJhRaIquQLGvYV0',
    '0y10VAfmyH7GLQY6QccCSLKJi8iFgpcSBTLyYOGbiYPqOpStAf1OYuzEBzZR'
  ];
  var configs = [
    [2, 3],
    [4, 5],
    [3, 6]
  ];
  secrets.forEach(function(secret, i) {
    var shares = SSS.create(configs[i][0], configs[i][1], secret);
    assertEqual(shares.length, configs[i][1], 'create produces ' + configs[i][1] + ' shares');
    var subset = shares.slice(0, configs[i][0]);
    var recovered = SSS.combine(subset);
    assertEqual(recovered, secret, 'combine recovers "' + secret.substring(0, 20) + '" with ' + configs[i][0] + ' shares');
  });
})();

// --- cross-compatibility with Ruby CLI ---
(function testRubyCLICompatibility() {
  var SSS = window.SSS;
  // These shares were generated by the Ruby CLI for secret "test-pass" with minimum=3, total=5
  var rubyShares = [
    'U1k9koNN67-og3ZY3Mmikeyj4gEFwK4HXDSglM8i_xc=yA3eU4_XYcJP0ijD63Tvqu1gklhBV32tu8cHPZXP-bk=',
    'O7c_iMBaGmQQE_uU0XRCPQwhfLBdlc6jseTzK_qN-1s=ICDGdloemG50X5GxteWWVZD3EGuxXST4UfZcek_teng=',
    '8qzYpjk7lmB7cRkOl6-7srVTKNYHuqUO2WO31Y0j1Tw=-g6srNoWkZTBqrKA2cMCA-6jxZiZv25rvbrCUWVHb5g='
  ];
  var recovered = SSS.combine(rubyShares);
  assertEqual(recovered, 'test-pass', 'combine Ruby CLI shares recovers "test-pass"');
})();

// --- isValidShare ---
(function testIsValidShare() {
  var SSS = window.SSS;
  var validShares = [
    'U1k9koNN67-og3ZY3Mmikeyj4gEFwK4HXDSglM8i_xc=yA3eU4_XYcJP0ijD63Tvqu1gklhBV32tu8cHPZXP-bk=',
    'O7c_iMBaGmQQE_uU0XRCPQwhfLBdlc6jseTzK_qN-1s=ICDGdloemG50X5GxteWWVZD3EGuxXST4UfZcek_teng='
  ];
  validShares.forEach(function(share, i) {
    assertEqual(SSS.isValidShare(share), true, 'isValidShare returns true for valid share ' + i);
  });
  assertEqual(SSS.isValidShare('Hello world'), false, 'isValidShare returns false for garbage');
  assertEqual(SSS.isValidShare(''), false, 'isValidShare returns false for empty string');
  assertEqual(SSS.isValidShare('abc'), false, 'isValidShare returns false for wrong length');
})();

// --- secret length limit ---
(function testSecretLengthLimit() {
  var SSS = window.SSS;
  var longSecret = 'x'.repeat(513);
  var threw = false;
  try { SSS.create(2, 3, longSecret); } catch(e) { threw = true; }
  assert(threw, 'create throws for secret > 512 bytes');

  var okSecret = 'x'.repeat(512);
  var shares = SSS.create(2, 3, okSecret);
  assert(shares.length === 3, 'create succeeds for 512-byte secret');
})();
```

- [ ] **Step 2: Run tests to verify they fail**

Open in browser. Expected: create/combine/isValidShare tests fail (functions undefined).

- [ ] **Step 3: Implement create, combine, isValidShare**

Add to `sss.js`, inside the IIFE, before `window.SSS = SSS;`:

```javascript
  var MAX_SECRET_BYTES = 512;

  // Split secret into shares using Shamir's Secret Sharing
  SSS.create = function(minimum, total, raw) {
    if (minimum < 2) throw new Error('Minimum must be at least 2');
    if (total < minimum) throw new Error('Total must be >= minimum');
    var encoder = new TextEncoder();
    if (encoder.encode(raw).length > MAX_SECRET_BYTES) {
      throw new Error('Secret exceeds ' + MAX_SECRET_BYTES + ' bytes');
    }

    var secret = SSS.splitInts(raw);
    var numbers = [0n];
    var polynomial = [];

    for (var i = 0; i < secret.length; i++) {
      polynomial.push([secret[i]]);
      for (var j = 1; j < minimum; j++) {
        var value = SSS.random();
        while (numbers.indexOf(value) !== -1) {
          value = SSS.random();
        }
        numbers.push(value);
        polynomial[i].push(value);
      }
    }

    var result = [];
    for (var i = 0; i < total; i++) {
      result.push('');
    }

    for (var i = 0; i < total; i++) {
      for (var j = 0; j < secret.length; j++) {
        var value = SSS.random();
        while (numbers.indexOf(value) !== -1) {
          value = SSS.random();
        }
        numbers.push(value);

        var y = SSS.evaluatePolynomial(polynomial[j], value);
        result[i] += SSS.toBase64(value);
        result[i] += SSS.toBase64(y);
      }
    }

    return result;
  };

  // Combine shares to recover the secret using Lagrange interpolation
  SSS.combine = function(shares) {
    var secrets = [];

    for (var index = 0; index < shares.length; index++) {
      var share = shares[index];
      if (share.length % 88 !== 0) return '';
      var count = share.length / 88;
      secrets.push([]);
      for (var i = 0; i < count; i++) {
        var cshare = share.substring(i * 88, (i + 1) * 88);
        secrets[index][i] = [
          SSS.fromBase64(cshare.substring(0, 44)),
          SSS.fromBase64(cshare.substring(44, 88))
        ];
      }
    }

    var secret = [];
    for (var i = 0; i < secrets[0].length; i++) {
      secret.push(0n);
    }

    for (var partIndex = 0; partIndex < secret.length; partIndex++) {
      for (var shareIndex = 0; shareIndex < secrets.length; shareIndex++) {
        var origin = secrets[shareIndex][partIndex][0];
        var originy = secrets[shareIndex][partIndex][1];
        var numerator = 1n;
        var denominator = 1n;

        for (var productIndex = 0; productIndex < secrets.length; productIndex++) {
          if (productIndex !== shareIndex) {
            var current = secrets[productIndex][partIndex][0];
            numerator = (numerator * ((-1n * current) % PRIME + PRIME)) % PRIME;
            denominator = (denominator * ((origin - current) % PRIME + PRIME)) % PRIME;
          }
        }

        var working = (originy * numerator % PRIME * SSS.modInverse(denominator)) % PRIME;
        secret[partIndex] = (secret[partIndex] + working) % PRIME;
      }
    }

    return SSS.mergeInts(secret);
  };

  // Validate that a string is a properly formatted share
  SSS.isValidShare = function(candidate) {
    if (!candidate || candidate.length === 0 || candidate.length % 88 !== 0) {
      return false;
    }
    var count = candidate.length / 44;
    for (var j = 0; j < count; j++) {
      var part = candidate.substring(j * 44, (j + 1) * 44);
      try {
        var decoded = SSS.fromBase64(part);
        if (decoded < 0n || decoded > PRIME) return false;
      } catch(e) {
        return false;
      }
    }
    return true;
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Open in browser. Expected: all tests pass including the Ruby CLI cross-compatibility test.

- [ ] **Step 5: Commit**

```bash
git add sssa-web/js/sss.js sssa-web/tests/sss.test.html
git commit -m "feat(web): add SSS create/combine/isValidShare with CLI interop"
```

---

### Task 3: QR Code Generation

Vendor a minimal QR code generation library and wrap it in the `SSS.QR` namespace.

**Files:**
- Create: `sssa-web/js/qr-generate.js`
- Modify: `sssa-web/tests/sss.test.html`

- [ ] **Step 1: Find and vendor a QR generation library**

Download `qrcode-generator` by Kazuhiko Arase (MIT license, ~12KB minified, widely used). Get the single-file browser version from https://github.com/kazuhikoarase/qrcode-generator — the file is `qrcode.js`. Save the library code as the first part of `sssa-web/js/qr-generate.js`, then append the `SSS.QR` wrapper below.

- [ ] **Step 2: Write failing tests for QR generation**

In `sss.test.html`, add `<canvas id="test-canvas" width="200" height="200" style="display:none"></canvas>` to the body, add `<script src="../js/qr-generate.js"></script>` after the sss.js script tag, and add these tests before `summary()`:

```javascript
// --- QR generation ---
(function testQRGenerate() {
  var canvas = document.getElementById('test-canvas');
  var testData = 'U1k9koNN67-og3ZY3Mmikeyj4gEFwK4HXDSglM8i_xc=yA3eU4_XYcJP0ijD63Tvqu1gklhBV32tu8cHPZXP-bk=';

  SSS.QR.generate(testData, canvas);
  var ctx = canvas.getContext('2d');
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  assert(imageData.data.some(function(v) { return v !== 0; }), 'QR.generate draws something to canvas');

  var dataUrl = SSS.QR.toDataURL(testData);
  assert(dataUrl.indexOf('data:image/png') === 0, 'QR.toDataURL returns a PNG data URL');
  assert(dataUrl.length > 100, 'QR.toDataURL produces non-trivial output');
})();
```

- [ ] **Step 3: Run tests to verify they fail**

Expected: `SSS.QR` is undefined.

- [ ] **Step 4: Write the SSS.QR wrapper**

Append to the end of `sssa-web/js/qr-generate.js` (after the vendored library code):

```javascript
// SSS.QR wrapper around vendored qrcode-generator
(function() {
  'use strict';

  if (!window.SSS) window.SSS = {};
  var QR = {};

  // Render QR code to a canvas element
  QR.generate = function(data, canvas, options) {
    options = options || {};
    var size = options.size || 256;

    // Type 0 = auto-detect version, error correction M
    var qr = qrcode(0, 'M');
    qr.addData(data);
    qr.make();

    var moduleCount = qr.getModuleCount();
    var quietZone = options.quietZone !== undefined ? options.quietZone : 4;
    var totalModules = moduleCount + quietZone * 2;
    var cellSize = size / totalModules;

    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#000000';
    for (var row = 0; row < moduleCount; row++) {
      for (var col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(
            (col + quietZone) * cellSize,
            (row + quietZone) * cellSize,
            cellSize + 0.5,
            cellSize + 0.5
          );
        }
      }
    }
  };

  // Generate QR code and return as PNG data URL
  QR.toDataURL = function(data, options) {
    var canvas = document.createElement('canvas');
    QR.generate(data, canvas, options);
    return canvas.toDataURL('image/png');
  };

  window.SSS.QR = QR;
})();
```

- [ ] **Step 5: Run tests to verify they pass**

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add sssa-web/js/qr-generate.js sssa-web/tests/sss.test.html
git commit -m "feat(web): add vendored QR code generation with SSS.QR wrapper"
```

---

### Task 4: QR Scanner (BarcodeDetector + Camera + File Upload)

**Files:**
- Create: `sssa-web/js/scanner.js`

- [ ] **Step 1: Implement scanner.js**

```javascript
// sssa-web/js/scanner.js
// QR code scanning via native BarcodeDetector API
// Camera + file upload + manual text input

(function() {
  'use strict';

  if (!window.SSS) window.SSS = {};

  var Scanner = {};

  // Feature detection
  Scanner.hasBarcodeDetector = typeof BarcodeDetector !== 'undefined';
  Scanner.hasCamera = Scanner.hasBarcodeDetector &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia &&
    location.protocol !== 'file:';

  // Scan a QR code from an image file (File or Blob)
  // Returns: Promise<string> -- decoded text, or rejects
  Scanner.scanImage = function(file) {
    if (!Scanner.hasBarcodeDetector) {
      return Promise.reject(new Error('BarcodeDetector not available'));
    }
    var detector = new BarcodeDetector({ formats: ['qr_code'] });
    return createImageBitmap(file).then(function(bitmap) {
      return detector.detect(bitmap);
    }).then(function(barcodes) {
      if (barcodes.length === 0) throw new Error('No QR code found in image');
      return barcodes[0].rawValue;
    });
  };

  // Start camera scanning
  // videoElement: HTMLVideoElement to show the feed
  // onDetect: function(text) called when a QR code is detected
  // Returns: { stop: function() } to stop scanning
  Scanner.startCamera = function(videoElement, onDetect) {
    if (!Scanner.hasCamera) {
      throw new Error('Camera scanning not available');
    }

    var detector = new BarcodeDetector({ formats: ['qr_code'] });
    var stream = null;
    var animationId = null;
    var stopped = false;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    }).then(function(mediaStream) {
      if (stopped) {
        mediaStream.getTracks().forEach(function(t) { t.stop(); });
        return;
      }
      stream = mediaStream;
      videoElement.srcObject = stream;
      videoElement.play();

      function scan() {
        if (stopped) return;
        detector.detect(videoElement).then(function(barcodes) {
          if (stopped) return;
          if (barcodes.length > 0) {
            onDetect(barcodes[0].rawValue);
          } else {
            animationId = requestAnimationFrame(scan);
          }
        }).catch(function() {
          if (!stopped) animationId = requestAnimationFrame(scan);
        });
      }
      videoElement.onloadedmetadata = function() {
        scan();
      };
    }).catch(function(err) {
      if (!stopped) throw err;
    });

    return {
      stop: function() {
        stopped = true;
        if (animationId) cancelAnimationFrame(animationId);
        if (stream) stream.getTracks().forEach(function(t) { t.stop(); });
        videoElement.srcObject = null;
      }
    };
  };

  window.SSS.Scanner = Scanner;
})();
```

- [ ] **Step 2: Commit**

No automated tests for camera/BarcodeDetector — these require browser APIs that vary by environment. Manual testing in Task 8.

```bash
git add sssa-web/js/scanner.js
git commit -m "feat(web): add QR scanner with BarcodeDetector, camera, file upload"
```

---

### Task 5: HTML Shell & CSS

Build the complete page structure and all styles.

**Files:**
- Create: `sssa-web/index.html`
- Create: `sssa-web/css/style.css`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shamir's Secret Sharing</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <!-- Download banner (hosted version only) -->
  <div id="download-banner" class="download-banner">
    <div class="download-banner-inner">
      For maximum security, <a href="#" id="download-link">download and run offline</a>
    </div>
  </div>

  <main>
    <header>
      <div class="accent-bar"></div>
      <h1>Secret Sharing</h1>
      <p class="subtitle">Split secrets with Shamir's algorithm. Recover with a threshold of shares.</p>
    </header>

    <!-- Mode toggle -->
    <nav class="mode-toggle">
      <a href="#" id="mode-split" class="mode-link active">Split</a>
      <a href="#" id="mode-combine" class="mode-link">Combine</a>
    </nav>

    <!-- Split mode -->
    <section id="section-split">
      <div class="field-group">
        <label class="label">Threshold</label>
        <div class="threshold-row">
          <input type="number" id="input-minimum" min="2" max="255" value="3" class="threshold-input">
          <span class="threshold-of">of</span>
          <input type="number" id="input-total" min="2" max="255" value="5" class="threshold-input">
        </div>
      </div>

      <div class="field-group">
        <label class="label" for="input-secret">Secret</label>
        <textarea id="input-secret" rows="4" placeholder="Enter your secret..."></textarea>
        <div class="byte-counter">
          <span id="byte-count">0</span> / 512 bytes
        </div>
      </div>

      <div class="actions">
        <button id="btn-split" class="btn-primary" disabled>Split</button>
      </div>

      <div id="split-output" class="output" hidden>
        <div class="output-header">
          <h2>Shares</h2>
          <button id="btn-print" class="btn-secondary">Print</button>
        </div>
        <div id="shares-list"></div>
      </div>
    </section>

    <!-- Combine mode -->
    <section id="section-combine" hidden>
      <div id="share-inputs">
        <!-- Share slots added by JS -->
      </div>

      <div class="actions">
        <button id="btn-add-share" class="btn-secondary">Add Share</button>
        <button id="btn-combine" class="btn-primary" disabled>Combine</button>
      </div>

      <div id="combine-output" class="output" hidden>
        <h2>Recovered Secret</h2>
        <div class="recovered-secret">
          <textarea id="recovered-text" readonly rows="4"></textarea>
          <button id="btn-copy-secret" class="btn-secondary">Copy</button>
        </div>
        <p class="hint">If this doesn't look right, check that you're using the correct shares.</p>
      </div>
    </section>

    <footer>
      <p>Shamir's Secret Sharing splits a secret into N shares, of which any M are sufficient to reconstruct the original. Fewer than M shares reveal nothing about the secret.</p>
    </footer>
  </main>

  <!-- Camera modal -->
  <div id="camera-modal" class="modal" hidden>
    <div class="modal-content">
      <div class="modal-header">
        <span>Scan QR Code</span>
        <button id="btn-close-camera" class="btn-close">&times;</button>
      </div>
      <video id="camera-video" autoplay playsinline></video>
    </div>
  </div>

  <script src="js/sss.js"></script>
  <script src="js/qr-generate.js"></script>
  <script src="js/scanner.js"></script>
  <script src="js/app.js"></script>
  <script src="js/bundler.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css**

```css
/* sssa-web/css/style.css */
/* Swiss / International Typographic Style */

:root {
  --color-bg: #ffffff;
  --color-text: #111111;
  --color-accent: #e00000;
  --color-secondary: #999999;
  --color-border: #111111;
  --color-light-border: #e0e0e0;
  --font-stack: 'Helvetica Neue', Helvetica, sans-serif;
  --max-width: 640px;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: var(--font-stack);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--color-text);
  background: var(--color-bg);
  margin: 0;
  padding: 0;
}

main {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

/* Download banner */
.download-banner {
  background: #f8f8f8;
  border-bottom: 1px solid var(--color-light-border);
  padding: 0.5rem 1rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--color-secondary);
}
.download-banner a {
  color: var(--color-text);
  text-decoration: underline;
}
.download-banner a:hover { color: var(--color-accent); }

/* Header */
.accent-bar {
  width: 24px;
  height: 4px;
  background: var(--color-accent);
  margin-bottom: 1rem;
}
h1 {
  font-size: 1.75rem;
  font-weight: 300;
  letter-spacing: -0.5px;
  margin: 0 0 0.25rem;
}
h2 {
  font-size: 1.1rem;
  font-weight: 300;
  margin: 0;
}
.subtitle {
  font-size: 0.875rem;
  color: var(--color-secondary);
  margin: 0 0 2rem;
}

/* Mode toggle */
.mode-toggle {
  margin-bottom: 2rem;
  display: flex;
  gap: 1.5rem;
}
.mode-link {
  text-decoration: none;
  color: var(--color-secondary);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid transparent;
}
.mode-link.active {
  color: var(--color-text);
  border-bottom-color: var(--color-text);
}
.mode-link:hover { color: var(--color-text); }

/* Labels */
.label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--color-secondary);
  margin-bottom: 0.5rem;
}

/* Field groups */
.field-group { margin-bottom: 1.5rem; }

/* Threshold inputs */
.threshold-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.threshold-input {
  width: 64px;
  height: 40px;
  font-family: var(--font-stack);
  font-size: 1rem;
  font-weight: 500;
  text-align: center;
  border: none;
  border-bottom: 2px solid var(--color-border);
  background: transparent;
  outline: none;
}
.threshold-input:focus { border-bottom-color: var(--color-accent); }
.threshold-of {
  color: var(--color-secondary);
  font-size: 0.875rem;
}

/* Textarea */
textarea {
  width: 100%;
  font-family: var(--font-stack);
  font-size: 0.9375rem;
  border: none;
  border-bottom: 2px solid var(--color-border);
  padding: 0.5rem 0;
  outline: none;
  resize: vertical;
  background: transparent;
}
textarea:focus { border-bottom-color: var(--color-accent); }

/* Byte counter */
.byte-counter {
  text-align: right;
  font-size: 0.75rem;
  color: var(--color-secondary);
  margin-top: 0.25rem;
}
.byte-counter.over-limit {
  color: var(--color-accent);
  font-weight: 700;
}
.byte-counter.warning { color: #b35900; }

/* Buttons */
.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-bottom: 2rem;
}
.btn-primary {
  font-family: var(--font-stack);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 0.625rem 1.5rem;
  background: var(--color-text);
  color: var(--color-bg);
  border: 2px solid var(--color-text);
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--color-accent);
  border-color: var(--color-accent);
}
.btn-primary:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.btn-primary:disabled:hover {
  background: var(--color-text);
  border-color: var(--color-text);
}
.btn-secondary {
  font-family: var(--font-stack);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 0.625rem 1.5rem;
  background: transparent;
  color: var(--color-text);
  border: 2px solid var(--color-text);
  cursor: pointer;
}
.btn-secondary:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* Output section */
.output { margin-top: 2rem; }
.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

/* Share cards */
.share-card {
  border: 1px solid var(--color-light-border);
  padding: 1.5rem;
  margin-bottom: 1rem;
}
.share-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--color-secondary);
  margin-bottom: 1rem;
}
.share-qr {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}
.share-qr canvas { max-width: 200px; height: auto; }
.share-text {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.6875rem;
  word-break: break-all;
  color: var(--color-secondary);
  cursor: pointer;
  padding: 0.5rem;
  background: #f8f8f8;
  position: relative;
}
.share-text:hover { color: var(--color-text); }
.share-text .copied-tooltip {
  position: absolute;
  top: -1.5rem;
  right: 0;
  font-size: 0.625rem;
  color: var(--color-accent);
  font-family: var(--font-stack);
}
.share-text .qr-warning {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.625rem;
  color: #b35900;
  font-family: var(--font-stack);
  font-style: italic;
}

/* Combine mode - share input slots */
.share-slot {
  margin-bottom: 1rem;
  border: 1px solid var(--color-light-border);
  padding: 1rem;
}
.share-slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.share-slot-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--color-secondary);
}
.share-slot-status { font-size: 0.875rem; }
.share-slot-status.valid { color: #1a7f37; }
.share-slot-status.invalid { color: var(--color-accent); }
.share-slot input[type="text"] {
  width: 100%;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.75rem;
  border: none;
  border-bottom: 2px solid var(--color-border);
  padding: 0.5rem 0;
  outline: none;
  background: transparent;
}
.share-slot input[type="text"]:focus { border-bottom-color: var(--color-accent); }
.share-slot-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.btn-small {
  font-family: var(--font-stack);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 0.375rem 0.75rem;
  background: transparent;
  color: var(--color-secondary);
  border: 1px solid var(--color-light-border);
  cursor: pointer;
}
.btn-small:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}
.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-secondary);
  line-height: 1;
}
.btn-close:hover { color: var(--color-text); }

/* Recovered secret */
.recovered-secret { margin-top: 1rem; }
.recovered-secret textarea {
  border: 2px solid var(--color-text);
  padding: 0.75rem;
  background: #f8f8f8;
}
.recovered-secret .btn-secondary { margin-top: 0.5rem; }
.hint {
  font-size: 0.75rem;
  color: var(--color-secondary);
  margin-top: 0.5rem;
  font-style: italic;
}

/* Camera modal */
.modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-content {
  background: var(--color-bg);
  width: 90%;
  max-width: 480px;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.modal-content video { width: 100%; display: block; }

/* Footer */
footer {
  margin-top: 4rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-light-border);
}
footer p {
  font-size: 0.75rem;
  color: var(--color-secondary);
  line-height: 1.6;
}

/* Print styles */
@media print {
  body { margin: 0; padding: 0; }
  .download-banner, .mode-toggle, #section-combine, .actions,
  .output-header .btn-secondary, .subtitle, footer, .modal {
    display: none !important;
  }
  main { max-width: none; padding: 0; }
  .share-card {
    page-break-after: always;
    border: none;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 90vh;
  }
  .share-label { font-size: 1rem; margin-bottom: 2rem; }
  .share-qr canvas {
    max-width: none;
    width: 3cm; height: 3cm;
    min-width: 3cm; min-height: 3cm;
  }
  .share-text {
    font-size: 0.75rem;
    background: none;
    padding: 1rem 0;
    max-width: 80%;
    text-align: center;
  }
  .share-text .copied-tooltip,
  .share-text .qr-warning { display: none; }
}
```

- [ ] **Step 3: Verify the page loads**

Open `sssa-web/index.html` in a browser (via local server). Expected: the page renders with the Swiss design — accent bar, heading, threshold inputs, textarea, disabled Split button. No JS errors in console.

- [ ] **Step 4: Commit**

```bash
git add sssa-web/index.html sssa-web/css/style.css
git commit -m "feat(web): add HTML shell and Swiss-style CSS"
```

---

### Task 6: App Logic (app.js)

Wire up all UI interactions — mode toggle, split, combine, share slots, validation, copy, print.

**Files:**
- Create: `sssa-web/js/app.js`

- [ ] **Step 1: Implement app.js**

```javascript
// sssa-web/js/app.js
// UI orchestration for the SSS web app

(function() {
  'use strict';

  var App = {};
  var encoder = new TextEncoder();

  // --- DOM references ---
  var modeSplit = document.getElementById('mode-split');
  var modeCombine = document.getElementById('mode-combine');
  var sectionSplit = document.getElementById('section-split');
  var sectionCombine = document.getElementById('section-combine');
  var inputMinimum = document.getElementById('input-minimum');
  var inputTotal = document.getElementById('input-total');
  var inputSecret = document.getElementById('input-secret');
  var byteCountEl = document.getElementById('byte-count');
  var byteCounter = inputSecret.parentElement.querySelector('.byte-counter');
  var btnSplit = document.getElementById('btn-split');
  var btnPrint = document.getElementById('btn-print');
  var splitOutput = document.getElementById('split-output');
  var sharesList = document.getElementById('shares-list');
  var shareInputs = document.getElementById('share-inputs');
  var btnAddShare = document.getElementById('btn-add-share');
  var btnCombine = document.getElementById('btn-combine');
  var combineOutput = document.getElementById('combine-output');
  var recoveredText = document.getElementById('recovered-text');
  var btnCopySecret = document.getElementById('btn-copy-secret');
  var cameraModal = document.getElementById('camera-modal');
  var cameraVideo = document.getElementById('camera-video');
  var btnCloseCamera = document.getElementById('btn-close-camera');
  var downloadLink = document.getElementById('download-link');

  var activeScanner = null;

  // --- Mode toggle ---
  modeSplit.addEventListener('click', function(e) {
    e.preventDefault();
    modeSplit.classList.add('active');
    modeCombine.classList.remove('active');
    sectionSplit.hidden = false;
    sectionCombine.hidden = true;
  });

  modeCombine.addEventListener('click', function(e) {
    e.preventDefault();
    modeCombine.classList.add('active');
    modeSplit.classList.remove('active');
    sectionCombine.hidden = false;
    sectionSplit.hidden = true;
  });

  // --- Byte counter & validation ---
  function getByteLength(str) {
    return encoder.encode(str).length;
  }

  function validateSplit() {
    var min = parseInt(inputMinimum.value) || 0;
    var total = parseInt(inputTotal.value) || 0;
    var secret = inputSecret.value;
    var bytes = getByteLength(secret);

    byteCountEl.textContent = bytes;
    byteCounter.classList.remove('over-limit', 'warning');
    if (bytes > 512) {
      byteCounter.classList.add('over-limit');
    } else if (bytes > 0) {
      var shareChars = 88 * Math.ceil(bytes / 32);
      if (shareChars > 700) {
        byteCounter.classList.add('warning');
      }
    }

    btnSplit.disabled = !(min >= 2 && total >= min && total <= 255 && secret.length > 0 && bytes <= 512);
  }

  inputMinimum.addEventListener('input', validateSplit);
  inputTotal.addEventListener('input', validateSplit);
  inputSecret.addEventListener('input', validateSplit);

  // --- Split ---
  btnSplit.addEventListener('click', function() {
    var min = parseInt(inputMinimum.value);
    var total = parseInt(inputTotal.value);
    var secret = inputSecret.value;

    var shares;
    try {
      shares = SSS.create(min, total, secret);
    } catch(e) {
      return;
    }

    // Clear previous output
    while (sharesList.firstChild) {
      sharesList.removeChild(sharesList.firstChild);
    }

    shares.forEach(function(share, i) {
      var card = document.createElement('div');
      card.className = 'share-card';

      var label = document.createElement('div');
      label.className = 'share-label';
      label.textContent = 'Share ' + (i + 1) + ' of ' + total;

      var qrDiv = document.createElement('div');
      qrDiv.className = 'share-qr';
      var canvas = document.createElement('canvas');
      try {
        SSS.QR.generate(share, canvas, { size: 200 });
      } catch(e) {
        // QR generation failed -- too much data
      }
      qrDiv.appendChild(canvas);

      var textDiv = document.createElement('div');
      textDiv.className = 'share-text';
      textDiv.textContent = share;
      textDiv.title = 'Click to copy';
      textDiv.addEventListener('click', function() {
        navigator.clipboard.writeText(share).then(function() {
          var tip = document.createElement('span');
          tip.className = 'copied-tooltip';
          tip.textContent = 'Copied';
          textDiv.appendChild(tip);
          setTimeout(function() { tip.remove(); }, 1500);
        });
      });

      if (share.length > 700) {
        var warning = document.createElement('span');
        warning.className = 'qr-warning';
        warning.textContent = 'Large QR code \u2014 print at high resolution for reliable scanning';
        textDiv.appendChild(warning);
      }

      card.appendChild(label);
      card.appendChild(qrDiv);
      card.appendChild(textDiv);
      sharesList.appendChild(card);
    });

    splitOutput.hidden = false;
  });

  // --- Print ---
  btnPrint.addEventListener('click', function() {
    window.print();
  });

  // --- Combine: share slots ---
  var shareSlotCount = 0;

  function createShareSlot() {
    shareSlotCount++;
    var slot = document.createElement('div');
    slot.className = 'share-slot';

    var header = document.createElement('div');
    header.className = 'share-slot-header';

    var label = document.createElement('span');
    label.className = 'share-slot-label';
    label.textContent = 'Share ' + shareSlotCount;

    var statusSpan = document.createElement('span');
    statusSpan.className = 'share-slot-status';

    header.appendChild(label);
    header.appendChild(statusSpan);

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Paste share text or scan QR code...';
    input.addEventListener('input', function() {
      var value = input.value.trim();
      if (value === '') {
        statusSpan.textContent = '';
        statusSpan.className = 'share-slot-status';
      } else if (SSS.isValidShare(value)) {
        statusSpan.textContent = '\u2713';
        statusSpan.className = 'share-slot-status valid';
      } else {
        statusSpan.textContent = '\u2717';
        statusSpan.className = 'share-slot-status invalid';
      }
      validateCombine();
    });

    var actions = document.createElement('div');
    actions.className = 'share-slot-actions';

    // Camera scan button
    if (SSS.Scanner.hasCamera) {
      var scanBtn = document.createElement('button');
      scanBtn.className = 'btn-small';
      scanBtn.textContent = 'Scan QR';
      scanBtn.addEventListener('click', function() {
        openCamera(input, statusSpan);
      });
      actions.appendChild(scanBtn);
    }

    // Image upload button
    if (SSS.Scanner.hasBarcodeDetector) {
      var uploadBtn = document.createElement('button');
      uploadBtn.className = 'btn-small';
      uploadBtn.textContent = 'Upload Image';
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
          SSS.Scanner.scanImage(fileInput.files[0]).then(function(text) {
            input.value = text;
            input.dispatchEvent(new Event('input'));
          }).catch(function() {
            statusSpan.textContent = 'No QR found';
            statusSpan.className = 'share-slot-status invalid';
          });
        }
      });
      uploadBtn.addEventListener('click', function() { fileInput.click(); });
      actions.appendChild(uploadBtn);
      slot.appendChild(fileInput);
    }

    // Remove button
    var removeBtn = document.createElement('button');
    removeBtn.className = 'btn-small';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function() {
      if (shareInputs.children.length > 2) {
        slot.remove();
        renumberSlots();
        validateCombine();
      }
    });
    actions.appendChild(removeBtn);

    slot.appendChild(header);
    slot.appendChild(input);
    slot.appendChild(actions);
    shareInputs.appendChild(slot);
    return slot;
  }

  function renumberSlots() {
    var slots = shareInputs.querySelectorAll('.share-slot');
    slots.forEach(function(slot, i) {
      slot.querySelector('.share-slot-label').textContent = 'Share ' + (i + 1);
    });
    shareSlotCount = slots.length;
  }

  function getValidShares() {
    var shares = [];
    shareInputs.querySelectorAll('.share-slot input[type="text"]').forEach(function(input) {
      var value = input.value.trim();
      if (value && SSS.isValidShare(value)) {
        shares.push(value);
      }
    });
    return shares;
  }

  function validateCombine() {
    btnCombine.disabled = getValidShares().length < 2;
  }

  // Initialize with 2 slots
  createShareSlot();
  createShareSlot();

  btnAddShare.addEventListener('click', function() {
    createShareSlot();
  });

  // --- Camera ---
  function openCamera(targetInput, targetStatus) {
    cameraModal.hidden = false;
    try {
      activeScanner = SSS.Scanner.startCamera(cameraVideo, function(text) {
        targetInput.value = text;
        targetInput.dispatchEvent(new Event('input'));
        closeCamera();
      });
    } catch(e) {
      closeCamera();
    }
  }

  function closeCamera() {
    if (activeScanner) {
      activeScanner.stop();
      activeScanner = null;
    }
    cameraModal.hidden = true;
  }

  btnCloseCamera.addEventListener('click', closeCamera);
  cameraModal.addEventListener('click', function(e) {
    if (e.target === cameraModal) closeCamera();
  });

  // --- Combine ---
  btnCombine.addEventListener('click', function() {
    var shares = getValidShares();
    var secret = SSS.combine(shares);
    recoveredText.value = secret;
    combineOutput.hidden = false;
  });

  // --- Copy recovered secret ---
  btnCopySecret.addEventListener('click', function() {
    navigator.clipboard.writeText(recoveredText.value);
  });

  // --- Download link ---
  if (downloadLink) {
    downloadLink.addEventListener('click', function(e) {
      e.preventDefault();
      if (SSS.Bundler && SSS.Bundler.download) {
        SSS.Bundler.download();
      }
    });
  }

  window.SSS.App = App;
})();
```

- [ ] **Step 2: Test in browser**

Open `sssa-web/index.html` via local server. Test:
1. Type a secret, set threshold, click Split -- shares appear with QR codes
2. Click a share text -- copies to clipboard
3. Switch to Combine mode -- paste shares -- checkmarks appear -- Combine -- secret recovered
4. Print button opens print dialog with one share per page

- [ ] **Step 3: Commit**

```bash
git add sssa-web/js/app.js
git commit -m "feat(web): add app logic - split, combine, QR, copy, print"
```

---

### Task 7: Self-Bundling (bundler.js + bundle.sh)

**Files:**
- Create: `sssa-web/js/bundler.js`
- Create: `sssa-web/bundle.sh`

- [ ] **Step 1: Implement bundler.js**

```javascript
// sssa-web/js/bundler.js
// Self-bundling: fetches all app files, inlines into a single HTML file, triggers download
// Only works in hosted version (fetch doesn't work on file://)

(function() {
  'use strict';

  if (!window.SSS) window.SSS = {};

  var Bundler = {};

  var CSS_FILES = ['css/style.css'];
  var JS_FILES = ['js/sss.js', 'js/qr-generate.js', 'js/scanner.js', 'js/app.js'];

  Bundler.download = function() {
    var allPaths = CSS_FILES.concat(JS_FILES);
    var fetches = allPaths.map(function(path) {
      return fetch(path).then(function(r) { return r.text(); }).then(function(text) {
        return { path: path, content: text };
      });
    });

    Promise.all(fetches).then(function(results) {
      var cssContent = '';
      var jsContent = '';

      results.forEach(function(file) {
        if (file.path.endsWith('.css')) {
          cssContent += file.content + '\n';
        } else {
          jsContent += file.content + '\n';
        }
      });

      // Build the offline HTML document
      var parts = [];
      parts.push('<!DOCTYPE html>');
      parts.push('<html lang="en">');
      parts.push('<head>');
      parts.push('  <meta charset="utf-8">');
      parts.push('  <meta name="viewport" content="width=device-width, initial-scale=1">');
      parts.push('  <title>Shamir\'s Secret Sharing (Offline)</title>');
      parts.push('  <style>');
      parts.push(cssContent);
      parts.push('  </style>');
      parts.push('  <style>.download-banner { display: none !important; }</style>');
      parts.push('</head>');
      parts.push('<body>');

      // Clone the main content and camera modal
      parts.push(document.querySelector('main').outerHTML);
      parts.push(document.getElementById('camera-modal').outerHTML);

      parts.push('  <script>');
      parts.push(jsContent);
      parts.push('  <\/script>');
      parts.push('</body>');
      parts.push('</html>');

      var html = parts.join('\n');

      // Trigger download
      var blob = new Blob([html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'sss-offline.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }).catch(function(err) {
      console.error('Bundling failed:', err);
    });
  };

  window.SSS.Bundler = Bundler;
})();
```

- [ ] **Step 2: Implement bundle.sh**

```bash
#!/bin/sh
# bundle.sh -- produces a single self-contained HTML file from the modular sources
# Usage: ./bundle.sh > sss-offline.html
# No dependencies beyond a POSIX shell

set -e
cd "$(dirname "$0")"

cat <<'HEADER'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shamir's Secret Sharing (Offline)</title>
  <style>
HEADER

cat css/style.css

cat <<'MID1'
  </style>
  <style>.download-banner { display: none !important; }</style>
</head>
<body>
MID1

# Extract body content: everything between <body> and </body>, excluding script/link tags
sed -n '/<body>/,/<\/body>/p' index.html | \
  grep -v '<body>' | \
  grep -v '</body>' | \
  grep -v '<script' | \
  grep -v '</script>' | \
  grep -v '<link '

cat <<'MID2'
  <script>
MID2

cat js/sss.js
cat js/qr-generate.js
cat js/scanner.js
cat js/app.js

cat <<'FOOTER'
  </script>
</body>
</html>
FOOTER
```

- [ ] **Step 3: Make bundle.sh executable and test**

```bash
chmod +x sssa-web/bundle.sh
cd sssa-web && ./bundle.sh > /tmp/sss-offline-test.html
```

Open `/tmp/sss-offline-test.html` from `file://` in browser. Verify split + combine work and download banner is hidden.

- [ ] **Step 4: Test the in-browser bundler**

From a local server (`python3 -m http.server 8000` in `sssa-web/`), open in browser, click "download and run offline". Open the downloaded `sss-offline.html` from `file://` and verify it works.

- [ ] **Step 5: Commit**

```bash
git add sssa-web/js/bundler.js sssa-web/bundle.sh
git commit -m "feat(web): add self-bundling download and offline shell bundler"
```

---

### Task 8: Integration Testing & Polish

Manual verification of the complete app across all flows.

**Files:**
- Possibly modify: any file for bug fixes found during testing

- [ ] **Step 1: Test split flow end-to-end**

Open `sssa-web/index.html` via a local server. Test:
1. Enter secret "my seed phrase test", minimum 3 of 5, click Split
2. Verify 5 share cards appear with QR codes and text
3. Click share text -- verify clipboard copy works
4. Click Print -- verify one share per page, QR + text visible
5. Verify byte counter shows correct count
6. Try secret > 512 bytes -- verify Split button stays disabled

- [ ] **Step 2: Test combine flow end-to-end**

1. Copy 3 shares from the split output
2. Switch to Combine mode
3. Paste shares into slots -- verify green checkmarks
4. Paste garbage -- verify red X
5. Click Combine -- verify original secret recovered
6. Test "Add Share" and "Remove" buttons
7. Try combining with only 2 of 3-minimum shares -- verify garbled output + hint text

- [ ] **Step 3: Test Ruby CLI cross-compatibility**

```bash
cd /Users/ellin/code/sssa-cli
ruby sss.rb create 3 5 "cross-compat test"
```

Copy the output shares, paste into the web app's combine mode. Verify "cross-compat test" is recovered.

Also: create shares in the web app, combine them via `ruby sss.rb combine "share1" "share2" "share3"`.

- [ ] **Step 4: Test offline version**

1. Click "download and run offline" in hosted version
2. Open `sss-offline.html` from `file://`
3. Verify split + combine work
4. Verify download banner is hidden
5. Verify no console errors

- [ ] **Step 5: Test camera scanning (if available)**

1. Open hosted version on HTTPS or localhost
2. In Combine mode, click "Scan QR"
3. Point camera at a QR code from the split output
4. Verify auto-detection and slot population

- [ ] **Step 6: Test image upload scanning**

1. Save/screenshot a QR code from split output
2. In Combine mode, click "Upload Image"
3. Select the screenshot
4. Verify share text is populated

- [ ] **Step 7: Fix any issues found, commit**

```bash
git add -A sssa-web/
git commit -m "fix(web): address integration testing issues"
```

---

### Task 9: Final Cleanup

- [ ] **Step 1: Add .gitignore entry for .superpowers**

Check if `.superpowers/` is in `.gitignore`. If not, add it:

```
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```
