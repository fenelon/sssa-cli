# Combine Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked share-slot combine interface with a flex-wrap card grid where filled shares are compact preview cards and a trailing "Add Share" card provides three entry methods.

**Architecture:** Pure CSS + vanilla JS changes to three files. The card grid uses `display: flex; flex-wrap: wrap` with equal-width cards. The Add Share card manages an internal sub-state (3 buttons vs paste input). Filled cards store share data in `dataset.share` and are read-only.

**Tech Stack:** Vanilla JS, CSS, HTML (no build tools, no frameworks)

---

## File Map

- **Modify:** `sssa-web/css/style.css` — remove `.share-slot*` styles (lines 470–541), add `.combine-card*` styles
- **Modify:** `sssa-web/index.html` — remove `#btn-add-share` from combine section `.actions`
- **Modify:** `sssa-web/js/app.js` — replace section 6 (combine share slots, lines 270–437) with card-based functions; update camera callback (section 7, lines 442–457); update `getValidShares` and `validateCombine`

---

### Task 1: Replace share-slot CSS with combine-card CSS

**Files:**
- Modify: `sssa-web/css/style.css:467-541`

- [ ] **Step 1: Remove old share-slot styles**

In `sssa-web/css/style.css`, delete the entire "Share Slots (Combine mode)" section (from the section comment through `.share-slot-actions`). This is lines 467–541, covering these selectors:
- `.share-slot`
- `.share-slot-header`
- `.share-slot-label`
- `.share-slot-status`
- `.share-slot-status.valid`
- `.share-slot-status.invalid`
- `.share-slot-body`
- `.share-slot-input`
- `.share-slot-input:focus`
- `.share-slot-input::placeholder`
- `.share-slot-actions`

- [ ] **Step 2: Add combine-card styles in their place**

Insert the following CSS where the share-slot section was removed:

```css
/* ============================================================
   Combine Cards (Combine mode)
   ============================================================ */

.combine-card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.combine-card {
  width: 240px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.combine-card-filled {
  border: 1px solid var(--color-light-border);
  position: relative;
}

.combine-card-add {
  border: 2px dashed var(--color-light-border);
  align-items: center;
  justify-content: center;
}

.combine-card-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-secondary);
  margin-bottom: 12px;
}

.combine-card-add .combine-card-label {
  text-align: center;
}

.combine-card-preview {
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  color: #333;
  word-break: break-all;
  line-height: 1.5;
  flex: 1;
}

.combine-card-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: var(--color-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.combine-card-remove:hover {
  color: var(--color-text);
}

.combine-card-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.combine-card-actions button {
  white-space: nowrap;
}

.combine-card-input {
  display: block;
  width: 100%;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  color: var(--color-text);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-light-border);
  padding: 6px 0;
  outline: none;
}

.combine-card-input:focus {
  border-bottom-color: var(--color-accent);
}

.combine-card-input::placeholder {
  color: var(--color-secondary);
  font-family: var(--font-stack);
  font-size: 12px;
}

.combine-card-error {
  font-size: 11px;
  color: var(--color-accent);
  margin-top: 6px;
}

.combine-card-paste-back {
  margin-top: 8px;
  align-self: flex-start;
}
```

- [ ] **Step 3: Verify CSS parses cleanly**

Open `sssa-web/index.html` in a browser. The combine section will look broken (JS still creates old slots), but there should be no CSS parse errors in the console.

- [ ] **Step 4: Commit**

```bash
git add sssa-web/css/style.css
git commit -m "refactor(web): replace share-slot CSS with combine-card styles"
```

---

### Task 2: Update HTML — remove Add Share button

**Files:**
- Modify: `sssa-web/index.html:63-69`

- [ ] **Step 1: Remove btn-add-share from the actions div**

In `sssa-web/index.html`, find the combine section's `.actions` div (around line 66):

```html
      <div class="actions">
        <button id="btn-add-share" class="btn-secondary">Add Share</button>
        <button id="btn-combine" class="btn-primary" disabled>Combine</button>
      </div>
```

Replace it with:

```html
      <div class="actions">
        <button id="btn-combine" class="btn-primary" disabled>Combine</button>
      </div>
```

- [ ] **Step 2: Add combine-card-grid class to share-inputs**

In the same file, find:

```html
      <div id="share-inputs"></div>
```

Replace with:

```html
      <div id="share-inputs" class="combine-card-grid"></div>
```

- [ ] **Step 3: Commit**

```bash
git add sssa-web/index.html
git commit -m "refactor(web): remove Add Share button, add card grid class to combine container"
```

---

### Task 3: Replace JS combine slot code with card functions

**Files:**
- Modify: `sssa-web/js/app.js:16-30` (DOM references)
- Modify: `sssa-web/js/app.js:270-437` (section 6 — combine share slots)
- Modify: `sssa-web/js/app.js:442-478` (section 7 — camera)

- [ ] **Step 1: Remove btnAddShare DOM reference**

In `sssa-web/js/app.js`, find and delete this line from the DOM references section (around line 30):

```js
  var btnAddShare    = document.getElementById('btn-add-share');
```

- [ ] **Step 2: Replace section 6 (combine share slots)**

Delete everything from the section 6 comment through the `btnAddShare` listener (lines 270–437). This removes:
- `slotCount` variable
- `cameraController` and `activeCameraSlot` variables
- `createShareSlot()` function
- `renumberSlots()` function
- `getValidShares()` function
- `validateCombine()` function
- The two initial `createShareSlot()` calls
- The `btnAddShare.addEventListener` block

Replace with:

```js
  // ---------------------------------------------------------------------------
  // 6. Combine cards
  // ---------------------------------------------------------------------------
  var cameraController = null;
  var activeCameraSlot = null;

  /**
   * Creates a filled (read-only) share card and inserts it before the Add Share card.
   */
  function createFilledCard(shareData) {
    var card = document.createElement('div');
    card.className = 'combine-card combine-card-filled';
    card.dataset.share = shareData;

    var label = document.createElement('div');
    label.className = 'combine-card-label';
    label.textContent = 'Share';
    card.appendChild(label);

    var preview = document.createElement('div');
    preview.className = 'combine-card-preview';
    preview.textContent = shareData.substring(0, 20) + '...';
    card.appendChild(preview);

    var btnRemove = document.createElement('button');
    btnRemove.className = 'combine-card-remove';
    btnRemove.textContent = '\u00d7';
    btnRemove.addEventListener('click', function () {
      shareInputs.removeChild(card);
      renumberCards();
      validateCombine();
    });
    card.appendChild(btnRemove);

    // Insert before the Add Share card (always last child)
    var addCard = shareInputs.querySelector('.combine-card-add');
    shareInputs.insertBefore(card, addCard);
    renumberCards();
    validateCombine();
  }

  /**
   * Resets the Add Share card back to its 3-button state.
   */
  function resetAddCard() {
    var addCard = shareInputs.querySelector('.combine-card-add');
    if (!addCard) return;

    // Clear everything after the label
    while (addCard.children.length > 1) {
      addCard.removeChild(addCard.lastChild);
    }

    var actions = document.createElement('div');
    actions.className = 'combine-card-actions';

    // Scan QR button
    if (SSS.Scanner.hasCamera) {
      var btnScan = document.createElement('button');
      btnScan.className = 'btn-secondary';
      btnScan.textContent = 'Scan QR';
      btnScan.addEventListener('click', function () {
        activeCameraSlot = { callback: createFilledCard };
        openCamera();
      });
      actions.appendChild(btnScan);
    }

    // Upload QR Code Image button
    if (SSS.Scanner.hasBarcodeDetector) {
      var btnUpload = document.createElement('button');
      btnUpload.className = 'btn-secondary';
      btnUpload.textContent = 'Upload QR Code Image';

      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        if (!file) return;
        SSS.Scanner.scanImage(file).then(function (text) {
          if (SSS.isValidShare(text)) {
            createFilledCard(text);
          } else {
            showPasteMode(text);
          }
        }).catch(function (err) {
          alert('Could not read QR code from image: ' + err.message);
        });
        fileInput.value = '';
      });

      btnUpload.addEventListener('click', function () {
        fileInput.click();
      });

      actions.appendChild(btnUpload);
      addCard.appendChild(fileInput);
    }

    // Paste Text button
    var btnPaste = document.createElement('button');
    btnPaste.className = 'btn-secondary';
    btnPaste.textContent = 'Paste Text';
    btnPaste.addEventListener('click', function () {
      showPasteMode('');
    });
    actions.appendChild(btnPaste);

    addCard.appendChild(actions);
  }

  /**
   * Switches the Add Share card into paste-text input mode.
   * @param {string} prefill — optional text to pre-fill the input with
   */
  function showPasteMode(prefill) {
    var addCard = shareInputs.querySelector('.combine-card-add');
    if (!addCard) return;

    // Clear everything after the label
    while (addCard.children.length > 1) {
      addCard.removeChild(addCard.lastChild);
    }

    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'combine-card-input';
    textInput.placeholder = 'Paste share here\u2026';
    textInput.setAttribute('autocomplete', 'off');
    textInput.setAttribute('spellcheck', 'false');
    if (prefill) textInput.value = prefill;

    var errorMsg = document.createElement('div');
    errorMsg.className = 'combine-card-error';
    errorMsg.setAttribute('hidden', '');

    textInput.addEventListener('input', function () {
      var val = textInput.value.trim();
      if (val === '') {
        errorMsg.setAttribute('hidden', '');
      } else if (SSS.isValidShare(val)) {
        errorMsg.setAttribute('hidden', '');
        createFilledCard(val);
        resetAddCard();
      } else {
        errorMsg.textContent = 'Invalid share format';
        errorMsg.removeAttribute('hidden');
      }
    });

    addCard.appendChild(textInput);
    addCard.appendChild(errorMsg);

    // Back button to return to 3-button mode
    var btnBack = document.createElement('button');
    btnBack.className = 'btn-small combine-card-paste-back';
    btnBack.textContent = 'Back';
    btnBack.addEventListener('click', function () {
      resetAddCard();
    });
    addCard.appendChild(btnBack);

    textInput.focus();

    // Trigger validation if prefilled
    if (prefill) {
      textInput.dispatchEvent(new Event('input'));
    }
  }

  /**
   * Creates the Add Share card and appends it to shareInputs.
   */
  function createAddShareCard() {
    var card = document.createElement('div');
    card.className = 'combine-card combine-card-add';

    var label = document.createElement('div');
    label.className = 'combine-card-label';
    label.textContent = 'Add Share';
    card.appendChild(label);

    shareInputs.appendChild(card);
    resetAddCard();
  }

  /**
   * Updates filled card labels to reflect current order.
   */
  function renumberCards() {
    var cards = shareInputs.querySelectorAll('.combine-card-filled');
    cards.forEach(function (c, i) {
      var lbl = c.querySelector('.combine-card-label');
      if (lbl) {
        lbl.textContent = 'Share ' + (i + 1);
      }
    });
  }

  /**
   * Returns an array of share strings from filled cards.
   */
  function getValidShares() {
    var result = [];
    var cards = shareInputs.querySelectorAll('.combine-card-filled');
    cards.forEach(function (c) {
      result.push(c.dataset.share);
    });
    return result;
  }

  /**
   * Enables btn-combine when there are >= 2 filled cards.
   */
  function validateCombine() {
    btnCombine.disabled = getValidShares().length < 2;
  }

  // Initialise with the Add Share card
  createAddShareCard();
```

- [ ] **Step 3: Update camera callback in section 7**

Find the `openCamera` function. Replace the camera success callback to use `activeCameraSlot.callback` instead of setting a slot input value.

Replace the existing `openCamera` function:

```js
  function openCamera() {
    cameraModal.removeAttribute('hidden');
    try {
      cameraController = SSS.Scanner.startCamera(cameraVideo, function (text) {
        var slot = activeCameraSlot;
        closeCamera();
        if (slot) {
          slot.input.value = text;
          slot.input.dispatchEvent(new Event('input'));
        }
      });
    } catch (err) {
      closeCamera();
      alert('Could not start camera: ' + err.message);
    }
  }
```

With:

```js
  function openCamera() {
    cameraModal.removeAttribute('hidden');
    try {
      cameraController = SSS.Scanner.startCamera(cameraVideo, function (text) {
        var callback = activeCameraSlot && activeCameraSlot.callback;
        closeCamera();
        if (callback && SSS.isValidShare(text)) {
          callback(text);
        }
      });
    } catch (err) {
      closeCamera();
      alert('Could not start camera: ' + err.message);
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add sssa-web/js/app.js
git commit -m "feat(web): replace combine share slots with card-based UI"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Verify initial state**

Open `sssa-web/index.html` in a browser. Switch to Combine mode. You should see a single "Add Share" card with dashed border and three buttons: "Scan QR", "Upload QR Code Image", "Paste Text". The Combine button should be disabled.

- [ ] **Step 2: Verify paste flow**

Click "Paste Text". The buttons should be replaced by a text input and a "Back" button. Paste an invalid string — "Invalid share format" error should appear below the input. Click "Back" — the 3-button state should return.

- [ ] **Step 3: Verify valid share flow**

Split a secret (e.g., "hello" with 2-of-3) in Split mode. Copy a share. Switch to Combine mode. Click "Paste Text" and paste the share. The input should automatically convert to a filled card labeled "Share 1" with a truncated preview. The Add Share card should reset to 3-button state.

- [ ] **Step 4: Verify combine works**

Add a second share the same way. Combine button should enable. Click Combine — the recovered secret should appear. Verify the X button removes a card and disables Combine when fewer than 2 cards remain.

- [ ] **Step 5: Verify responsive layout**

Resize the browser window. Cards should wrap: 3 across on wide screens, 2 on medium, 1 on narrow. All cards in a row should be the same height.

- [ ] **Step 6: Commit any fixes**

If any issues are found during verification, fix and commit:

```bash
git add -A
git commit -m "fix(web): address combine card UI issues from manual testing"
```
