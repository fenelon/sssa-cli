/**
 * app.js — UI logic for the Shamir Secret Sharing web app.
 *
 * Wires up all interactions: mode toggle, split, combine cards,
 * validation, copy, and print.
 *
 * SECURITY: Never uses innerHTML. All DOM construction uses createElement,
 * textContent, and appendChild.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. DOM references
  // ---------------------------------------------------------------------------
  var modeSplit      = document.getElementById('mode-split');
  var modeCombine    = document.getElementById('mode-combine');
  var sectionSplit   = document.getElementById('section-split');
  var sectionCombine = document.getElementById('section-combine');
  var inputMinimum   = document.getElementById('input-minimum');
  var inputTotal     = document.getElementById('input-total');
  var inputSecret    = document.getElementById('input-secret');
  var byteCount      = document.getElementById('byte-count');
  var byteCounter    = document.querySelector('.byte-counter');
  var btnSplit       = document.getElementById('btn-split');
  var btnPrint       = document.getElementById('btn-print');
  var splitOutput    = document.getElementById('split-output');
  var sharesList     = document.getElementById('shares-list');
  var shareInputs    = document.getElementById('share-inputs');
  var btnCombine     = document.getElementById('btn-combine');
  var combineOutput  = document.getElementById('combine-output');
  var recoveredText  = document.getElementById('recovered-text');
  var btnCopySecret  = document.getElementById('btn-copy-secret');
  var cameraModal    = document.getElementById('camera-modal');
  var cameraVideo    = document.getElementById('camera-video');
  var btnCloseCamera = document.getElementById('btn-close-camera');
  var downloadLink   = document.getElementById('download-link');

  // ---------------------------------------------------------------------------
  // 2. Mode toggle
  // ---------------------------------------------------------------------------
  modeSplit.addEventListener('click', function (e) {
    e.preventDefault();
    modeSplit.classList.add('active');
    modeCombine.classList.remove('active');
    sectionSplit.removeAttribute('hidden');
    sectionCombine.setAttribute('hidden', '');
  });

  modeCombine.addEventListener('click', function (e) {
    e.preventDefault();
    modeCombine.classList.add('active');
    modeSplit.classList.remove('active');
    sectionCombine.removeAttribute('hidden');
    sectionSplit.setAttribute('hidden', '');
  });

  // ---------------------------------------------------------------------------
  // 3. Byte counter & validation
  // ---------------------------------------------------------------------------
  function updateByteCounter() {
    var secret = inputSecret.value;
    var bytes = new TextEncoder().encode(secret).length;
    byteCount.textContent = bytes;

    var qrWarning = document.getElementById('qr-warning');
    var overLimitMsg = document.getElementById('over-limit-msg');

    if (bytes > 512) {
      byteCounter.classList.add('over-limit');
      overLimitMsg.removeAttribute('hidden');
      qrWarning.setAttribute('hidden', '');
    } else {
      byteCounter.classList.remove('over-limit');
      overLimitMsg.setAttribute('hidden', '');
      // Show QR warning only when under limit but shares would be large
      if (bytes > 0) {
        var chunks = Math.ceil(bytes / 32);
        var shareLen = chunks * 88;
        if (shareLen > 700) {
          qrWarning.removeAttribute('hidden');
        } else {
          qrWarning.setAttribute('hidden', '');
        }
      } else {
        qrWarning.setAttribute('hidden', '');
      }
    }

    validateSplit();
  }

  function validateSplit() {
    var min     = parseInt(inputMinimum.value, 10);
    var total   = parseInt(inputTotal.value, 10);
    var secret  = inputSecret.value;
    var bytes   = new TextEncoder().encode(secret).length;

    var ok = (
      min >= 2 &&
      total >= min &&
      total <= 255 &&
      secret.length > 0 &&
      bytes <= 512
    );
    btnSplit.disabled = !ok;
  }

  inputMinimum.addEventListener('input', updateByteCounter);
  inputTotal.addEventListener('input', updateByteCounter);
  inputSecret.addEventListener('input', updateByteCounter);

  // Run once on load so the button state matches default values
  updateByteCounter();

  // ---------------------------------------------------------------------------
  // 4. Split handler
  // ---------------------------------------------------------------------------
  btnSplit.addEventListener('click', function () {
    var min    = parseInt(inputMinimum.value, 10);
    var total  = parseInt(inputTotal.value, 10);
    var secret = inputSecret.value;

    var shares;
    try {
      shares = SSS.create(min, total, secret);
    } catch (err) {
      alert('Error creating shares: ' + err.message);
      return;
    }

    // Clear existing shares with safe DOM removal
    while (sharesList.firstChild) {
      sharesList.removeChild(sharesList.firstChild);
    }

    shares.forEach(function (share, idx) {
      var card = document.createElement('div');
      card.className = 'share-card';

      // Label
      var label = document.createElement('div');
      label.className = 'share-label';
      label.textContent = 'Share ' + (idx + 1) + ' of ' + total;
      card.appendChild(label);

      // QR code canvas
      var qrDiv = document.createElement('div');
      qrDiv.className = 'share-qr';
      var canvas = document.createElement('canvas');
      try {
        SSS.QR.generate(share, canvas, { size: 200 });
      } catch (e) {
        // QR generation failed (share too large) — canvas remains blank
      }
      qrDiv.appendChild(canvas);
      card.appendChild(qrDiv);

      // Share text — click to copy
      var shareText = document.createElement('div');
      shareText.className = 'share-text';
      shareText.textContent = share;
      shareText.addEventListener('click', function () {
        navigator.clipboard.writeText(share).then(function () {
          showTooltip(shareText, 'Copied');
        }).catch(function () {
          // Clipboard unavailable — silently ignore
        });
      });
      card.appendChild(shareText);

      // Print single share button
      var btnPdf = document.createElement('button');
      btnPdf.className = 'btn-small share-card-print';
      btnPdf.textContent = 'Print Share ' + (idx + 1);
      btnPdf.addEventListener('click', (function (shareIdx, shareData, shareCanvas) {
        return function () {
          saveSingleSharePDF(shareIdx + 1, total, shareData, shareCanvas);
        };
      })(idx, share, canvas));
      card.appendChild(btnPdf);

      sharesList.appendChild(card);
    });

    splitOutput.removeAttribute('hidden');
  });

  /**
   * Shows a temporary tooltip message above an element, then removes it.
   */
  function showTooltip(anchor, message) {
    var tip = document.createElement('span');
    tip.className = 'copied-tooltip';
    tip.textContent = message;
    anchor.appendChild(tip);
    setTimeout(function () {
      if (tip.parentNode) {
        tip.parentNode.removeChild(tip);
      }
    }, 1500);
  }

  // ---------------------------------------------------------------------------
  // 5a. Save single share as PDF
  // ---------------------------------------------------------------------------
  function generateTimestampedName(prefix) {
    var now = new Date();
    var ts = now.getFullYear()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0')
      + '-' + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0')
      + String(now.getSeconds()).padStart(2, '0');
    var rand = Math.random().toString(36).substring(2, 8);
    return prefix + ts + '-' + rand;
  }

  function saveSingleSharePDF(num, total, shareData, shareCanvas) {
    var qrDataURL = shareCanvas.toDataURL('image/png');
    var title = generateTimestampedName('sss-share-' + num + 'of' + total + '-');

    var w = window.open('', '_blank');
    if (!w) return;

    var doc = w.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8">');
    doc.write('<title>' + title + '</title>');
    doc.write('<style>');
    doc.write('body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: "Helvetica Neue", Helvetica, sans-serif; }');
    doc.write('.label { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #555; margin-bottom: 12px; }');
    doc.write('img { width: 6cm; height: 6cm; image-rendering: pixelated; }');
    doc.write('.text { font-family: "Courier New", Courier, monospace; font-size: 10px; color: #333; word-break: break-all; max-width: 7.5cm; text-align: center; line-height: 1.4; margin-top: 12px; }');
    doc.write('</style></head><body>');
    doc.write('<div class="label"></div>');
    doc.write('<img>');
    doc.write('<div class="text"></div>');
    doc.write('</body></html>');
    doc.close();

    // Set content via DOM to avoid XSS from share data
    doc.querySelector('.label').textContent = 'Share ' + num + ' of ' + total;
    doc.querySelector('img').src = qrDataURL;
    doc.querySelector('.text').textContent = shareData;

    // Wait for image to load, then print
    doc.querySelector('img').onload = function () {
      w.focus();
      w.print();
    };
    w.addEventListener('afterprint', function () {
      w.close();
    });
  }

  // ---------------------------------------------------------------------------
  // 5b. Print all shares
  // ---------------------------------------------------------------------------
  btnPrint.addEventListener('click', function () {
    var originalTitle = document.title;
    document.title = generateTimestampedName('sss-');
    window.print();
    document.title = originalTitle;
  });

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
      btnUpload.textContent = 'Upload QR Image';

      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        if (!file) return;
        SSS.Scanner.scanImage(file).then(function (text) {
          if (SSS.isValidShare(text) && !isDuplicateShare(text)) {
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
      actions.appendChild(fileInput);
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
      } else if (!SSS.isValidShare(val)) {
        errorMsg.textContent = 'Invalid share format';
        errorMsg.removeAttribute('hidden');
      } else if (isDuplicateShare(val)) {
        errorMsg.textContent = 'Duplicate share';
        errorMsg.removeAttribute('hidden');
      } else {
        errorMsg.setAttribute('hidden', '');
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
   * Returns true if a share with the same data already exists.
   */
  function isDuplicateShare(shareData) {
    var cards = shareInputs.querySelectorAll('.combine-card-filled');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.share === shareData) return true;
    }
    return false;
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

  // ---------------------------------------------------------------------------
  // 7. Camera
  // ---------------------------------------------------------------------------
  function openCamera() {
    cameraModal.removeAttribute('hidden');
    try {
      cameraController = SSS.Scanner.startCamera(cameraVideo, function (text) {
        var callback = activeCameraSlot && activeCameraSlot.callback;
        closeCamera();
        if (callback && SSS.isValidShare(text) && !isDuplicateShare(text)) {
          callback(text);
        }
      });
    } catch (err) {
      closeCamera();
      alert('Could not start camera: ' + err.message);
    }
  }

  function closeCamera() {
    if (cameraController) {
      cameraController.stop();
      cameraController = null;
    }
    cameraModal.setAttribute('hidden', '');
    activeCameraSlot = null;
  }

  btnCloseCamera.addEventListener('click', function () {
    closeCamera();
  });

  // Close camera on backdrop click
  cameraModal.addEventListener('click', function (e) {
    if (e.target === cameraModal) {
      closeCamera();
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Combine
  // ---------------------------------------------------------------------------
  btnCombine.addEventListener('click', function () {
    var shares = getValidShares();
    var secret;
    try {
      secret = SSS.combine(shares);
    } catch (err) {
      alert('Error combining shares: ' + err.message);
      return;
    }
    recoveredText.value = secret;
    combineOutput.removeAttribute('hidden');
  });

  // ---------------------------------------------------------------------------
  // 9. Copy
  // ---------------------------------------------------------------------------
  btnCopySecret.addEventListener('click', function () {
    navigator.clipboard.writeText(recoveredText.value).then(function () {
      showTooltip(btnCopySecret, 'Copied');
    }).catch(function () {
      // Clipboard unavailable — silently ignore
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Download link
  // ---------------------------------------------------------------------------
  if (downloadLink) {
    downloadLink.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.SSS && SSS.Bundler && typeof SSS.Bundler.download === 'function') {
        SSS.Bundler.download();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 11. Warn before closing if shares are visible
  // ---------------------------------------------------------------------------
  window.addEventListener('beforeunload', function (e) {
    if (!splitOutput.hasAttribute('hidden')) {
      e.preventDefault();
      return '';
    }
  });

})();
