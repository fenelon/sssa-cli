# Combine Interface — Card-Based Redesign

## Summary

Replace the current combine interface (stacked share slots with visible inputs and an "Add Share" button) with a flex-wrap card grid. Filled shares display as compact preview cards. A trailing "Add Share" card provides three entry methods: Scan QR, Upload QR Code Image, and Paste Text.

## Layout & Structure

- Replace `#share-inputs` with a flex-wrap card grid: `display: flex; flex-wrap: wrap; gap: 16px`.
- All cards are **equal width and equal height**. Width is sized so "Upload QR Code Image" button text never wraps (`white-space: nowrap`). Height is uniform via `align-items: stretch` (flex default) — all cards in a row match the tallest.
- Cards wrap naturally: ~3 across on desktop, 2 on tablet, 1 on narrow mobile.
- The **Add Share card** is always the last child in the container (dashed border).
- The **Combine button** stays below the grid in the existing `.actions` row.
- Remove the separate "Add Share" button from `.actions` — the card replaces it.

## Card States

### Filled Card

- Solid 1px border (`--color-light-border`).
- Label ("Share 1", "Share 2", etc.) — 10px uppercase, grey.
- Truncated share text — monospace, 14px, dark (`#333`). Fills available vertical space.
- X button in top-right corner to remove the card.
- Read-only. No click interaction beyond the X button.
- Only valid shares become filled cards. Invalid input stays in the Add Share card with an inline error.

### Add Share Card

- Dashed 2px border (`--color-light-border`).
- "Add Share" label centered at top.
- Three stacked buttons, full width: "Scan QR", "Upload QR Code Image", "Paste Text".
- All buttons use `white-space: nowrap`.

## Interaction Flow

1. User enters Combine mode — sees a single Add Share card.
2. **Scan QR**: Camera modal opens (existing `openCamera` behavior). On successful scan, a filled card is created and the Add Share card remains at the end.
3. **Upload QR Code Image**: File picker opens (existing `SSS.Scanner.scanImage` behavior). On successful decode, a filled card is created.
4. **Paste Text**: The three buttons are replaced by a text input field + confirmation mechanism. User pastes share text. On valid share (`SSS.isValidShare`), a filled card is created and the Add Share card resets to its 3-button state. On invalid input, show inline error text below the input.
5. Repeat until user has enough shares.
6. **Combine button** enables when there are >= 2 filled cards.
7. **Removing a card** (X button) removes the filled card and renumbers remaining cards. If fewer than 2 filled cards remain, Combine button disables. Minimum 0 filled cards (no minimum slot count unlike current design).

## Code Changes

### `index.html`

- Remove `#btn-add-share` from the `.actions` div in `#section-combine`.
- `#share-inputs` becomes the flex container for the card grid.

### `style.css`

- Remove `.share-slot`, `.share-slot-header`, `.share-slot-label`, `.share-slot-status`, `.share-slot-body`, `.share-slot-input`, `.share-slot-actions` styles.
- Add new styles:
  - `.combine-card-grid` — flex container with wrap and gap.
  - `.combine-card` — base card style (equal width, padding, box model).
  - `.combine-card-filled` — solid border variant.
  - `.combine-card-add` — dashed border variant.
  - `.combine-card-label` — uppercase label.
  - `.combine-card-preview` — monospace share text, `flex: 1` to fill height.
  - `.combine-card-remove` — positioned X button.
  - `.combine-card-actions` — stacked button layout inside Add Share card.
  - `.combine-card-input` — text input shown in Paste Text sub-state.
  - `.combine-card-error` — inline error text.
- All button text gets `white-space: nowrap`.
- Print styles: hide `.combine-card-grid` (already hidden via `#section-combine` in print).

### `app.js`

- Remove `createShareSlot()`, `renumberSlots()` (current slot-based functions).
- Remove `slotCount` variable and `btnAddShare` listener.
- Add `createFilledCard(shareData)`: creates a filled card DOM element, appends it before the Add Share card, calls `renumberCards()` and `validateCombine()`.
- Add `createAddShareCard()`: creates the Add Share card with 3 buttons. Manages internal sub-state for "Paste Text" mode (buttons vs input field). Wires up Scan QR to `openCamera()`, Upload to file input + `SSS.Scanner.scanImage`, Paste to inline text input.
- Add `renumberCards()`: updates filled card labels based on DOM order.
- Update `getValidShares()`: collect share data from filled cards (store share data as `dataset.share` on each card).
- Update `validateCombine()`: enable Combine button when >= 2 filled cards.
- Camera callback (`activeCameraSlot`): instead of setting a slot's input value, call `createFilledCard(scannedText)` directly.

### No changes

- `sss.js`, `scanner.js`, `qr-generate.js`, `bundler.js` — untouched.
