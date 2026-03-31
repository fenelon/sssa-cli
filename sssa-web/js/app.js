/**
 * app.js — UI logic for the Shamir Secret Sharing web app.
 *
 * Wires up all interactions: mode toggle, split, combine, share slots,
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
  var btnAddShare    = document.getElementById('btn-add-share');
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

    // over-limit class on the byte-counter container
    if (bytes > 512) {
      byteCounter.classList.add('over-limit');
    } else {
      byteCounter.classList.remove('over-limit');
    }

    // warning class if QR share size would exceed 700 chars
    // share length = chunks * 88, where chunks = ceil(bytes / 32)
    var chunks = Math.ceil(bytes / 32) || 1;
    var shareLen = chunks * 88;
    if (shareLen > 700) {
      byteCounter.classList.add('warning');
    } else {
      byteCounter.classList.remove('warning');
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

      // QR warning if share is too long for reliable scanning
      if (share.length > 700) {
        var warn = document.createElement('span');
        warn.className = 'qr-warning';
        warn.textContent = 'Share is large — QR code may be hard to scan';
        card.appendChild(warn);
      }

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
  // 5. Print
  // ---------------------------------------------------------------------------
  btnPrint.addEventListener('click', function () {
    window.print();
  });

  // ---------------------------------------------------------------------------
  // 6. Combine share slots
  // ---------------------------------------------------------------------------
  var slotCount = 0;   // ever-increasing counter for slot ids
  var cameraController = null;  // active camera controller
  var activeCameraSlot = null;  // the slot that opened the camera

  /**
   * Creates a share slot div and appends it to shareInputs.
   */
  function createShareSlot() {
    slotCount++;
    var slotIndex = slotCount; // captured for this slot

    var slot = document.createElement('div');
    slot.className = 'share-slot';
    slot.dataset.slotId = slotIndex;

    // --- Header (label + status) ---
    var header = document.createElement('div');
    header.className = 'share-slot-header';

    var slotLabel = document.createElement('span');
    slotLabel.className = 'share-slot-label';
    // Placeholder text — renumberSlots() will set the correct ordinal after appending
    slotLabel.textContent = 'Share';

    var status = document.createElement('span');
    status.className = 'share-slot-status';

    header.appendChild(slotLabel);
    header.appendChild(status);
    slot.appendChild(header);

    // --- Text input ---
    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'share-slot-input';
    textInput.placeholder = 'Paste share here…';
    textInput.setAttribute('autocomplete', 'off');
    textInput.setAttribute('spellcheck', 'false');

    textInput.addEventListener('input', function () {
      var val = textInput.value.trim();
      if (val === '') {
        status.textContent = '';
        status.className = 'share-slot-status';
      } else if (SSS.isValidShare(val)) {
        status.textContent = '\u2713'; // checkmark
        status.className = 'share-slot-status valid';
      } else {
        status.textContent = '\u2717'; // cross
        status.className = 'share-slot-status invalid';
      }
      validateCombine();
    });

    slot.appendChild(textInput);

    // --- Action buttons ---
    var actions = document.createElement('div');
    actions.className = 'share-slot-actions';

    // Scan QR (camera)
    if (SSS.Scanner.hasCamera) {
      var btnScan = document.createElement('button');
      btnScan.className = 'btn-secondary';
      btnScan.textContent = 'Scan QR';
      btnScan.addEventListener('click', function () {
        activeCameraSlot = { input: textInput, status: status };
        openCamera();
      });
      actions.appendChild(btnScan);
    }

    // Upload Image
    if (SSS.Scanner.hasBarcodeDetector) {
      var btnUpload = document.createElement('button');
      btnUpload.className = 'btn-secondary';
      btnUpload.textContent = 'Upload Image';

      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        if (!file) return;
        SSS.Scanner.scanImage(file).then(function (text) {
          textInput.value = text;
          textInput.dispatchEvent(new Event('input'));
        }).catch(function (err) {
          alert('Could not read QR code from image: ' + err.message);
        });
        // Reset so the same file can be re-selected
        fileInput.value = '';
      });

      btnUpload.addEventListener('click', function () {
        fileInput.click();
      });

      actions.appendChild(btnUpload);
      slot.appendChild(fileInput);
    }

    // Remove button
    var btnRemove = document.createElement('button');
    btnRemove.className = 'btn-secondary';
    btnRemove.textContent = 'Remove';
    btnRemove.addEventListener('click', function () {
      if (shareInputs.children.length > 2) {
        shareInputs.removeChild(slot);
        renumberSlots();
        validateCombine();
      }
    });
    actions.appendChild(btnRemove);

    slot.appendChild(actions);
    shareInputs.appendChild(slot);

    // Re-number after insertion so the new slot label is correct
    renumberSlots();
  }

  /**
   * Updates share slot labels to reflect current order after additions/removals.
   */
  function renumberSlots() {
    var slots = shareInputs.querySelectorAll('.share-slot');
    slots.forEach(function (s, i) {
      var lbl = s.querySelector('.share-slot-label');
      if (lbl) {
        lbl.textContent = 'Share ' + (i + 1);
      }
    });
  }

  /**
   * Returns an array of trimmed share strings from slots that are valid.
   */
  function getValidShares() {
    var result = [];
    var inputs = shareInputs.querySelectorAll('.share-slot-input');
    inputs.forEach(function (inp) {
      var val = inp.value.trim();
      if (SSS.isValidShare(val)) {
        result.push(val);
      }
    });
    return result;
  }

  /**
   * Enables btn-combine when there are >= 2 valid shares.
   */
  function validateCombine() {
    btnCombine.disabled = getValidShares().length < 2;
  }

  // Initialise with 2 slots
  createShareSlot();
  createShareSlot();

  // Add more slots on demand
  btnAddShare.addEventListener('click', function () {
    createShareSlot();
  });

  // ---------------------------------------------------------------------------
  // 7. Camera
  // ---------------------------------------------------------------------------
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

})();
