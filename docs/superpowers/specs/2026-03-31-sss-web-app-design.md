# SSS Web App — Design Spec

A standalone, static HTML application for Shamir's Secret Sharing with QR code support. Designed for personal secret splitting and long-term archival cold storage. Must work both hosted on static site infrastructure and downloaded as a single offline HTML file.

## Goals

- **Portable:** Works from `file://` and any static host (GitHub Pages, Netlify, S3)
- **Durable:** No build step, no CDN, no external dependencies. Must function in 50 years if browsers still render HTML
- **Interoperable:** Shares are cross-compatible with the existing Ruby CLI (`sssa-cli`)
- **Minimal:** Swiss-style visual design. Single-purpose tool, no feature creep

## Architecture

### File Structure

```
sssa-web/
├── index.html          # App shell — layout, sections, script/link tags
├── css/
│   └── style.css       # All styles, CSS variables, print styles
├── js/
│   ├── sss.js          # SSS algorithm (port of Ruby lib/sssa.rb + lib/utils.rb)
│   ├── qr-generate.js  # Vendored QR code generation library (~5-10KB)
│   ├── scanner.js      # BarcodeDetector + camera + file upload logic
│   ├── app.js          # UI state, event handlers, orchestration
│   └── bundler.js      # Self-bundling: inlines all files, triggers download
└── bundle.sh           # Offline bundler: shell script producing same output
```

### Module Namespace

Each module attaches to `window.SSS.*`. No ES modules — classic `<script>` tags for `file://` compatibility.

- `window.SSS.create(minimum, total, secret)` → string[] (base64-encoded shares)
- `window.SSS.combine(shares[])` → string (recovered secret)
- `window.SSS.isValidShare(share)` → boolean
- `window.SSS.QR.generate(data, canvas)` → renders QR to canvas
- `window.SSS.QR.toDataURL(data)` → PNG data URL
- `window.SSS.Scanner` — camera/upload controller
- `window.SSS.App` — UI orchestration
- `window.SSS.Bundler.download()` — self-bundle trigger

### Script Loading Order

`sss.js` → `qr-generate.js` → `scanner.js` → `app.js` → `bundler.js`

## App Flow

Single page, two modes toggled at the top.

### Split Mode (default)

1. **Input**
   - Threshold fields: M (minimum) and N (total shares), numeric inputs
   - Secret textarea with byte counter (max 512 bytes, counted via `TextEncoder`)
   - Split button disabled until: M ≥ 2, N ≥ M, secret is non-empty and ≤ 512 bytes

2. **Output** (after splitting)
   - List of shares, each displayed as a card:
     - Share label: "Share 1 of 5"
     - QR code rendered on canvas
     - Base64 share text below (copyable, click-to-copy)
   - "Print shares" button — triggers `window.print()` with print-optimized layout

3. **Print layout**
   - One share per page
   - Each page: share label, QR code, base64 text underneath
   - No UI chrome — just the share content
   - High contrast black-on-white

### Combine Mode

1. **Input**
   - Multiple share input slots, starting with 2
   - Each slot provides:
     - Text input (always available) — paste or type base64 share
     - "Scan QR" button (shown only if BarcodeDetector + secure context available) — opens camera viewfinder modal
     - "Upload image" button (shown only if BarcodeDetector available) — file input for QR photo
   - Inline validation on each slot via `SSS.isValidShare()` — checkmark or error indicator
   - "Add share" button to add more slots
   - Remove button on each slot (except when only 2 remain)

2. **Output** (after combining)
   - Recovered secret in a read-only copyable field
   - "Combine" button enabled once 2+ valid shares are entered

### Download Local Copy

Positioned prominently near the top header — not an export option, but a security/trust action.

- Subtle banner or link: "For maximum security, download and run offline"
- Clicking triggers `SSS.Bundler.download()`, which produces `sss-offline.html`
- Always visible in the hosted version
- Hidden in the already-bundled offline version

## SSS Algorithm (js/sss.js)

Direct port of the Ruby implementation in `lib/sssa.rb` and `lib/utils.rb`.

### Math Foundation

- All arithmetic uses native `BigInt`
- Prime: `2n ** 256n - 189n` (same as Ruby implementation)
- Cryptographic randomness: `crypto.getRandomValues(new Uint8Array(32))` → BigInt

### Functions (mirroring Ruby)

| JS Function | Ruby Origin | Purpose |
|---|---|---|
| `random()` | `Utils.random` | Crypto-random BigInt in [0, prime) |
| `splitInts(secret)` | `Utils.split_ints` | UTF-8 string → 256-bit BigInt array (32-byte chunks, right-padded) |
| `mergeInts(ints)` | `Utils.merge_ints` | BigInt array → UTF-8 string |
| `evaluatePolynomial(coefficients, x)` | `Utils.evaluate_polynomial` | Horner's method, mod prime |
| `modInverse(n)` | `Utils.mod_inverse` | Extended Euclidean algorithm |
| `toBase64(bigint)` | `Utils.to_base64` | 256-bit BigInt → 44-char URL-safe base64 |
| `fromBase64(str)` | `Utils.from_base64` | 44-char URL-safe base64 → BigInt |
| `create(minimum, total, secret)` | `SSSA.create` | Split secret into shares |
| `combine(shares)` | `SSSA.combine` | Lagrange interpolation to recover secret |
| `gcd(a, b)` | `Utils.gcd` | Extended Euclidean algorithm, used by `modInverse` |
| `isValidShare(share)` | `SSSA.isValidShare?` | Validate share format (length multiple of 88, valid base64) |

### Interoperability

Base64 encoding uses the same URL-safe base64 **with** `=` padding (matching Ruby's `Base64.urlsafe_encode64` default). Shares produced by the CLI can be combined in the web app and vice versa. This will be validated with cross-compatibility tests.

### Porting Notes (Ruby quirks)

The JS port must account for these Ruby implementation details:

1. **`split_ints` uses right-padding.** Ruby pads hex chunks with trailing zeros: `segment + "0"*(64 - segment.size)`. The JS port must match this exactly — left-padding would break interoperability.
2. **`isValidShare?` loop bound.** Ruby uses `for j in 0..count` (inclusive range), iterating one past the end. The JS port must use `j < count` (exclusive) to avoid indexing past the data.
3. **`combine` slice semantics.** Ruby's `share[i*88, (i+1)*88]` uses `(start, length)` — the second arg is accidentally too large but only the first 88 chars are used downstream. The JS port should use `share.substring(i*88, (i+1)*88)` which has `(start, end)` semantics and produces the correct 88-char slice.
4. **Coefficient/x-value uniqueness.** The Ruby `create` function checks that random polynomial coefficients and share x-values are unique. The JS port should match this check for fidelity, even though collisions in 256-bit space are astronomically unlikely.

### Secret Length Limit

Maximum 512 **bytes** (not characters). A single UTF-8 character can be 1-4 bytes, so the UI must count bytes using `new TextEncoder().encode(secret).length`, not `string.length`. Enforced in the UI (byte counter, disabled button) and in `SSS.create()` (throws if exceeded). This guarantees every share fits in a single QR code.

Note: M ≥ 2 is an intentional tightening versus the Ruby CLI (which allows M > 0). A threshold of 1 is mathematically valid but defeats the purpose of secret sharing.

## QR Code Generation (js/qr-generate.js)

### Library

A small vendored QR generation library inlined in the source (~5-10KB). The QR spec is frozen (ISO/IEC 18004), so this code will not need updates.

### Encoding

- Byte mode (supports full base64 character set)
- Error correction level M (15% recovery — good for printed codes that may degrade)
- Auto-version: smallest QR version that fits the data
- Quiet zone (white border) included for reliable scanning

### Rendering

- Draws to `<canvas>` element
- Extracts as PNG data URL for print view
- If share data somehow exceeds QR capacity, show warning and display text-only share

### Capacity

Share size = 88 × ceil(secret_bytes / 32) characters of base64:
- 32-byte password → 1 chunk → 88 chars per share (QR version 6, trivial)
- 240-byte seed phrase → 8 chunks → 704 chars per share (QR version ~22, comfortable)
- 512-byte max → 16 chunks → 1,408 chars per share (QR version ~34, dense but scannable)

QR byte-mode capacity at ECC M: v6=106, v15=520, v20=858, v25=1182, v30=1531, v40=2331 bytes. All shares from secrets up to 512 bytes fit within QR v40. Larger secrets produce denser QR codes that may be harder to scan from aged or low-resolution prints. The UI should warn when share size exceeds ~700 chars that printing at higher resolution is recommended. Print layout should render QR codes at minimum 3cm/1.2in per side for reliable scanning.

## QR Scanning (js/scanner.js)

### Native BarcodeDetector API Only

No vendored scanning library. Uses the browser-native `BarcodeDetector` API (Chrome 83+, Safari 17.2+). Firefox does not currently support it — manual text input serves as the universal fallback.

### Camera Scanning

- Available when: `BarcodeDetector` exists AND `navigator.mediaDevices.getUserMedia` exists AND not on `file://` protocol (Chrome blocks `getUserMedia` on `file://` as a policy, even though `file://` is technically a secure context)
- Opens a modal overlay with live camera viewfinder
- Auto-detects QR code and closes modal on success
- Populates the share text field with decoded content
- Use try/catch at scan time as final guard — capability detection is best-effort

### Image Upload Scanning

- Available when: `BarcodeDetector` exists (does not require secure context)
- File input or drag-and-drop
- Creates `ImageBitmap`, passes to `BarcodeDetector.detect()`
- Populates share text field on success

### Manual Text Fallback

- Always available in every share slot
- Paste or type base64 share text directly
- No scanning required — works in every browser, every context

### Capability Detection

On page load, detect available scanning features:
- `typeof BarcodeDetector !== 'undefined'` → image upload available
- Above + `navigator.mediaDevices?.getUserMedia` + `location.protocol !== 'file:'` → camera available
- Show/hide scan and upload buttons per slot accordingly

## Self-Bundling (js/bundler.js + bundle.sh)

### In-Browser Bundler

**Note:** `fetch()` does not work on `file://` URLs (blocked by CORS). The bundler only works in the hosted version. The bundled offline version omits the bundler entirely since it already has everything inlined.

1. Fetches all app files via relative URLs: `fetch('css/style.css')`, `fetch('js/sss.js')`, etc.
2. Inlines CSS into `<style>` tags, JS into `<script>` tags
3. Removes the download banner and bundler script from output (not needed offline)
4. Assembles a complete `<!DOCTYPE html>` document
5. Triggers download as `sss-offline.html` via blob URL

### Offline Shell Script (bundle.sh)

- Simple `cat`-based concatenation
- No dependencies beyond a POSIX shell
- Produces the same single-file output for releases or manual distribution

### Bundled File Differences

The offline version is identical to the hosted version except:
- All CSS/JS inlined
- Download banner hidden (CSS or removed from DOM)
- `bundler.js` excluded

## Visual Design

**Style:** Swiss / International Typographic Style

### Typography
- Font stack: `'Helvetica Neue', Helvetica, sans-serif` — no web fonts, no CDN
- Weights: 300 (light) for headings, 400 (regular) for body, 700 (bold) for labels
- Small uppercase labels with letter-spacing for field labels

### Color
- Background: `#ffffff`
- Text: `#111111`
- Accent: `#e00000` (red) — used for the horizontal rule motif and primary action hover states
- Secondary text: `#999999`
- Borders/inputs: `#111111`
- CSS variables for all colors at `:root`

### Layout
- Single centered column, `max-width: 640px`
- Generous vertical spacing between sections
- Red horizontal bar motif (4px × 24px) as a section marker

### Inputs
- Bottom-border-only text fields (no full box borders), 2px solid black underline
- Clean numeric inputs for threshold

### Buttons
- Primary: solid black background, white text, uppercase, letter-spacing
- Secondary: outlined, black border, black text

### QR Output Cards
- White background, subtle shadow
- Share label above, QR canvas centered, base64 text below
- Click-to-copy on the text

### Print Styles (`@media print`)
- One share per page (`page-break-after: always`)
- No UI chrome (hide mode toggle, buttons, inputs)
- Share label + QR code + base64 text only
- High contrast, no shadows or decorative elements

### Mode Toggle
- Two text links at top: "Split" | "Combine"
- Active mode indicated by black underline, inactive in gray
- Not tabs, not pills — just text

## Error Handling

- **Invalid secret length:** Byte counter turns red at 512 bytes, split button disabled
- **Invalid threshold:** M must be ≥ 2, N must be ≥ M. Inline validation messages
- **Invalid shares on combine:** Per-slot validation indicator (checkmark / X). Combine button disabled until ≥ 2 valid shares
- **QR capacity exceeded:** Warning shown, share displayed as text-only (should not happen with 512 char limit)
- **Camera denied/unavailable:** Graceful degradation — scan button hidden, upload and text input remain
- **Combine produces garbage:** If shares are wrong/mismatched, the output will be garbled UTF-8. Display a note: "If this doesn't look right, check that you're using the correct shares"

## Testing Strategy

- **Unit tests for sss.js:** Port the Ruby test suite. Test create/combine round-trips, edge cases (special characters, unicode), boundary conditions (1-chunk vs multi-chunk secrets)
- **Cross-compatibility test:** Generate shares with Ruby CLI, combine in JS (and vice versa)
- **QR round-trip test:** Generate QR → scan QR → compare to original share text
- **Bundle test:** Verify bundled HTML produces identical behavior to modular version
- **Manual browser test:** Verify camera scanning, file upload, print layout in Chrome and Safari
