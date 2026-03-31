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

      var parts = [];
      parts.push('<!DOCTYPE html>');
      parts.push('<html lang="en">');
      parts.push('<head>');
      parts.push('  <meta charset="utf-8">');
      parts.push('  <meta name="viewport" content="width=device-width, initial-scale=1">');
      parts.push("  <title>Shamir's Secret Sharing (Offline)</title>");
      parts.push('  <style>');
      parts.push(cssContent);
      parts.push('  </style>');
      parts.push('  <style>.download-banner { display: none !important; }</style>');
      parts.push('</head>');
      parts.push('<body>');
      parts.push(document.querySelector('main').outerHTML);
      parts.push(document.getElementById('camera-modal').outerHTML);
      parts.push('  <script>');
      parts.push(jsContent);
      parts.push('  <\/script>');
      parts.push('</body>');
      parts.push('</html>');

      var html = parts.join('\n');
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
