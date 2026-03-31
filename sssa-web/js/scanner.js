// sssa-web/js/scanner.js
// QR code scanning via native BarcodeDetector API
// Camera + file upload + manual text input

(function() {
  'use strict';

  if (!window.SSS) window.SSS = {};

  const Scanner = {};

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
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
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
  // onError: function(err) called when camera access fails
  // Returns: { stop: function() } to stop scanning
  Scanner.startCamera = function(videoElement, onDetect, onError) {
    if (!Scanner.hasCamera) {
      throw new Error('Camera scanning not available');
    }

    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    let stream = null;
    let animationId = null;
    let stopped = false;

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
      if (!stopped) {
        if (onError) {
          onError(err);
        } else {
          console.error('Camera error:', err);
        }
      }
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
