// QR Code Generator — app.js

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  var state = {
    activeTab: 'text',
    fgColor: '#000000',
    bgColor: '#ffffff',
    eyeColor: '#000000',
    eyeColorEnabled: false,
    transparent: false,
    ecLevel: 'M',
    size: 256,
    margin: 4,
    lastQR: null,
    lastData: '',
    debounceTimer: null
  };

  // Try restoring from localStorage
  try {
    var saved = JSON.parse(localStorage.getItem('qrgen_state') || '{}');
    if (saved.fgColor) state.fgColor = saved.fgColor;
    if (saved.bgColor) state.bgColor = saved.bgColor;
    if (saved.eyeColor) state.eyeColor = saved.eyeColor;
    if (typeof saved.eyeColorEnabled === 'boolean') state.eyeColorEnabled = saved.eyeColorEnabled;
    if (typeof saved.transparent === 'boolean') state.transparent = saved.transparent;
    if (saved.ecLevel) state.ecLevel = saved.ecLevel;
    if (saved.size) state.size = saved.size;
    if (saved.margin != null) state.margin = saved.margin;
  } catch (e) {}

  // ── DOM refs ─────────────────────────────────────────────────────────────
  var canvas        = document.querySelector('.qr-canvas-main');
  var ctx           = canvas.getContext('2d');
  var placeholder   = document.getElementById('placeholder');
  var warningsEl    = document.getElementById('warnings');
  var qrInfoEl      = document.getElementById('qr-info');
  var btnPng        = document.getElementById('btn-download-png');
  var btnSvg        = document.getElementById('btn-download-svg');
  var btnCopy       = document.getElementById('btn-copy');
  var linkHint      = document.getElementById('link-hint');

  var fgPicker      = document.getElementById('fg-color-picker');
  var fgHex         = document.getElementById('fg-color-hex');
  var bgPicker      = document.getElementById('bg-color-picker');
  var bgHex         = document.getElementById('bg-color-hex');
  var eyePicker     = document.getElementById('eye-color-picker');
  var eyeHex        = document.getElementById('eye-color-hex');
  var eyeEnabled    = document.getElementById('eye-color-enabled');
  var transparentCb = document.getElementById('transparent-bg');
  var swapBtn       = document.getElementById('swap-colors');
  var resetBtn      = document.getElementById('reset-colors');

  var ecSelect      = document.getElementById('ec-level');
  var sizeRange     = document.getElementById('qr-size');
  var sizeLabel     = document.getElementById('qr-size-label');
  var marginRange   = document.getElementById('qr-margin');
  var marginLabel   = document.getElementById('qr-margin-label');

  // ── Init UI from state ────────────────────────────────────────────────────
  function initUI() {
    fgPicker.value   = state.fgColor;
    fgHex.value      = state.fgColor;
    bgPicker.value   = state.bgColor;
    bgHex.value      = state.bgColor;
    eyePicker.value  = state.eyeColor;
    eyeHex.value     = state.eyeColor;
    eyeEnabled.checked   = state.eyeColorEnabled;
    transparentCb.checked = state.transparent;
    ecSelect.value   = state.ecLevel;
    sizeRange.value  = state.size;
    sizeLabel.textContent = state.size;
    marginRange.value = state.margin;
    marginLabel.textContent = state.margin;
  }
  initUI();

  // ── Tab switching ─────────────────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(function (c) {
        c.classList.remove('active');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.activeTab = tab.dataset.tab;
      document.getElementById('tab-' + state.activeTab).classList.add('active');
      scheduleUpdate();
    });
  });

  // ── Input listeners ───────────────────────────────────────────────────────
  var textInput = document.getElementById('text-input');
  textInput.addEventListener('input', function () {
    var isLink = /^https?:\/\//i.test(textInput.value.trim());
    linkHint.hidden = !isLink;
    scheduleUpdate();
  });

  ['wifi-ssid','wifi-password','wifi-security','wifi-hidden',
   'email-to','email-subject','email-body',
   'phone-number','sms-number','sms-body'
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', scheduleUpdate);
    if (el && el.tagName === 'SELECT') el.addEventListener('change', scheduleUpdate);
    if (el && el.type === 'checkbox') el.addEventListener('change', scheduleUpdate);
  });

  // ── Options listeners ─────────────────────────────────────────────────────
  ecSelect.addEventListener('change', function () {
    state.ecLevel = ecSelect.value;
    saveState(); scheduleUpdate();
  });

  sizeRange.addEventListener('input', function () {
    state.size = parseInt(sizeRange.value, 10);
    sizeLabel.textContent = state.size;
    saveState();
    if (state.lastQR) drawCanvas(state.lastQR);
  });

  marginRange.addEventListener('input', function () {
    state.margin = parseInt(marginRange.value, 10);
    marginLabel.textContent = state.margin;
    saveState(); scheduleUpdate();
  });

  // ── Color listeners ───────────────────────────────────────────────────────
  function bindColorPair(picker, hex, setFn) {
    picker.addEventListener('input', function () {
      hex.value = picker.value;
      hex.classList.remove('invalid');
      setFn(picker.value);
      if (state.lastQR) { drawCanvas(state.lastQR); updateWarnings(); }
      saveState();
    });
    hex.addEventListener('input', function () {
      var v = parseHex(hex.value);
      if (v) {
        hex.classList.remove('invalid');
        picker.value = v;
        setFn(v);
        if (state.lastQR) { drawCanvas(state.lastQR); updateWarnings(); }
        saveState();
      } else {
        hex.classList.add('invalid');
      }
    });
  }

  bindColorPair(fgPicker, fgHex, function (v) { state.fgColor = v; });
  bindColorPair(bgPicker, bgHex, function (v) { state.bgColor = v; });
  bindColorPair(eyePicker, eyeHex, function (v) { state.eyeColor = v; });

  eyeEnabled.addEventListener('change', function () {
    state.eyeColorEnabled = eyeEnabled.checked;
    if (state.lastQR) drawCanvas(state.lastQR);
    saveState();
  });

  transparentCb.addEventListener('change', function () {
    state.transparent = transparentCb.checked;
    if (state.lastQR) { drawCanvas(state.lastQR); updateWarnings(); }
    saveState();
  });

  swapBtn.addEventListener('click', function () {
    var tmp = state.fgColor;
    state.fgColor = state.bgColor;
    state.bgColor = tmp;
    fgPicker.value = state.fgColor; fgHex.value = state.fgColor;
    bgPicker.value = state.bgColor; bgHex.value = state.bgColor;
    if (state.lastQR) { drawCanvas(state.lastQR); updateWarnings(); }
    saveState();
  });

  resetBtn.addEventListener('click', function () {
    state.fgColor = '#000000'; state.bgColor = '#ffffff';
    state.eyeColor = '#000000'; state.eyeColorEnabled = false;
    state.transparent = false;
    fgPicker.value = '#000000'; fgHex.value = '#000000';
    bgPicker.value = '#ffffff'; bgHex.value = '#ffffff';
    eyePicker.value = '#000000'; eyeHex.value = '#000000';
    eyeEnabled.checked = false; transparentCb.checked = false;
    if (state.lastQR) { drawCanvas(state.lastQR); updateWarnings(); }
    saveState();
  });

  document.querySelectorAll('.swatch').forEach(function (sw) {
    sw.addEventListener('click', function () {
      state.fgColor = sw.dataset.fg;
      state.bgColor = sw.dataset.bg;
      fgPicker.value = state.fgColor; fgHex.value = state.fgColor;
      bgPicker.value = state.bgColor; bgHex.value = state.bgColor;
      if (state.lastQR) { drawCanvas(state.lastQR); updateWarnings(); }
      saveState();
    });
  });

  // ── Data builders ─────────────────────────────────────────────────────────
  function escapeWifi(s) {
    return s.replace(/([\\;,:""])/g, '\\$1');
  }

  function buildData() {
    switch (state.activeTab) {
      case 'text': return textInput.value;

      case 'wifi': {
        var ssid = document.getElementById('wifi-ssid').value;
        var pass = document.getElementById('wifi-password').value;
        var sec  = document.getElementById('wifi-security').value;
        var hid  = document.getElementById('wifi-hidden').checked;
        if (!ssid) return '';
        var s = 'WIFI:T:' + sec + ';S:' + escapeWifi(ssid) + ';';
        if (pass) s += 'P:' + escapeWifi(pass) + ';';
        if (hid)  s += 'H:true;';
        s += ';';
        return s;
      }

      case 'email': {
        var to   = document.getElementById('email-to').value.trim();
        var subj = document.getElementById('email-subject').value.trim();
        var body = document.getElementById('email-body').value.trim();
        if (!to) return '';
        var url = 'mailto:' + encodeURIComponent(to);
        var params = [];
        if (subj) params.push('subject=' + encodeURIComponent(subj));
        if (body) params.push('body=' + encodeURIComponent(body));
        if (params.length) url += '?' + params.join('&');
        return url;
      }

      case 'phone': {
        var num = document.getElementById('phone-number').value.trim();
        if (!num) return '';
        return 'tel:' + num.replace(/\s/g, '');
      }

      case 'sms': {
        var num2 = document.getElementById('sms-number').value.trim();
        var msg  = document.getElementById('sms-body').value.trim();
        if (!num2) return '';
        return 'SMSTO:' + num2.replace(/\s/g, '') + (msg ? ':' + msg : '');
      }

      default: return '';
    }
  }

  // ── Debounced update ──────────────────────────────────────────────────────
  function scheduleUpdate() {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(update, 150);
  }

  function update() {
    var data = buildData();
    if (!data) {
      showPlaceholder();
      return;
    }
    generateQR(data);
  }

  // ── QR generation ─────────────────────────────────────────────────────────
  function generateQR(data) {
    // Remove old error
    var oldErr = document.querySelector('.error-msg');
    if (oldErr) oldErr.remove();

    var encoded = unescape(encodeURIComponent(data));
    var qr = qrcode(0, state.ecLevel);
    try {
      qr.addData(encoded, 'Byte');
      qr.make();
    } catch (e) {
      var msg = String(e);
      var errDiv = document.createElement('div');
      errDiv.className = 'error-msg';
      if (msg.indexOf('overflow') !== -1) {
        errDiv.textContent = 'Data too long for error correction level ' + state.ecLevel +
          '. Try switching to L (Low) correction.';
      } else {
        errDiv.textContent = 'Error: ' + msg;
      }
      warningsEl.parentNode.insertBefore(errDiv, warningsEl);
      showPlaceholder();
      return;
    }

    state.lastQR  = qr;
    state.lastData = data;

    placeholder.hidden = true;
    canvas.hidden      = false;

    drawCanvas(qr);
    updateWarnings();
    updateInfo(qr, data);
    enableButtons(true);
  }

  // ── Canvas drawing ────────────────────────────────────────────────────────
  function drawCanvas(qr) {
    var count = qr.getModuleCount();
    var size  = state.size;
    var margin = state.margin;

    var moduleSize = Math.floor(size / (count + margin * 2));
    if (moduleSize < 1) moduleSize = 1;
    var total = moduleSize * (count + margin * 2);

    canvas.width  = total;
    canvas.height = total;

    var fg  = state.fgColor;
    var bg  = state.bgColor;
    var eye = state.eyeColorEnabled ? state.eyeColor : fg;

    // Background
    if (state.transparent) {
      ctx.clearRect(0, 0, total, total);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, total, total);
    }

    var offsetX = margin * moduleSize;
    var offsetY = margin * moduleSize;

    // Eye regions: top-left (0..8), top-right (count-7..count), bottom-left (count-7..count in row)
    function isEyeModule(r, c) {
      var inTL = (r < 7 && c < 7);
      var inTR = (r < 7 && c >= count - 7);
      var inBL = (r >= count - 7 && c < 7);
      return inTL || inTR || inBL;
    }

    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        var dark = qr.isDark(r, c);
        if (!dark) continue;
        ctx.fillStyle = isEyeModule(r, c) ? eye : fg;
        ctx.fillRect(
          offsetX + c * moduleSize,
          offsetY + r * moduleSize,
          moduleSize, moduleSize
        );
      }
    }

    // Show/hide checkerboard pseudo-element via canvas wrapper class
    var wrap = canvas.parentElement;
    if (wrap) {
      if (state.transparent) {
        wrap.classList.add('transparent-mode');
      } else {
        wrap.classList.remove('transparent-mode');
      }
    }
  }

  // ── Warnings ──────────────────────────────────────────────────────────────
  function updateWarnings() {
    warningsEl.innerHTML = '';
    var warnings = [];

    var fg = state.fgColor;
    var bg = state.transparent ? null : state.bgColor;

    if (state.transparent) {
      warnings.push({ cls: 'info', icon: 'ℹ️', text: 'Transparent background — scanners need sufficient contrast from the actual background.' });
    } else {
      var ratio = contrastRatio(fg, bg);
      var ratioStr = ratio.toFixed(2);

      if (ratio < 3) {
        warnings.push({ cls: 'warn', icon: '⚠️', text: 'Contrast ' + ratioStr + ':1 — May not scan reliably.' });
      } else if (ratio < 4.5) {
        warnings.push({ cls: 'warn', icon: '⚠️', text: 'Contrast ' + ratioStr + ':1 — Borderline. Works in good lighting.' });
      } else {
        warnings.push({ cls: 'ok', icon: '✓', text: 'Contrast ' + ratioStr + ':1 — Good.' });
      }

      var fgLum = relativeLuminance(fg);
      var bgLum = relativeLuminance(bg);
      if (fgLum > bgLum) {
        warnings.push({ cls: 'warn', icon: '⚠️', text: 'Light-on-dark code — some scanners may struggle. Test before distributing.' });
      }
    }

    warnings.forEach(function (w) {
      var div = document.createElement('div');
      div.className = 'warning-item ' + w.cls;
      div.textContent = w.icon + ' ' + w.text;
      warningsEl.appendChild(div);
    });
    warningsEl.hidden = (warnings.length === 0);
  }

  // ── Info line ─────────────────────────────────────────────────────────────
  function updateInfo(qr, data) {
    var count = qr.getModuleCount();
    var ver   = (count - 17) / 4;
    var bytes = new TextEncoder().encode(data).length;
    qrInfoEl.textContent = 'Version ' + ver + ' · ' + count + '×' + count + ' · ' + bytes + ' bytes';
    qrInfoEl.hidden = false;
  }

  // ── Placeholder ───────────────────────────────────────────────────────────
  function showPlaceholder() {
    placeholder.hidden = false;
    canvas.hidden      = true;
    warningsEl.hidden  = true;
    qrInfoEl.hidden    = true;
    enableButtons(false);
    state.lastQR   = null;
    state.lastData = '';
  }

  function enableButtons(on) {
    btnPng.disabled  = !on;
    btnSvg.disabled  = !on;
    btnCopy.disabled = !on;
  }

  // ── Downloads ─────────────────────────────────────────────────────────────
  btnPng.addEventListener('click', function () {
    if (!state.lastQR) return;
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a   = document.createElement('a');
      a.href  = url;
      a.download = 'qrcode.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    }, 'image/png');
  });

  btnSvg.addEventListener('click', function () {
    if (!state.lastQR) return;
    var svgStr = buildSVG(state.lastQR);
    var blob = new Blob([svgStr], { type: 'image/svg+xml' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = 'qrcode.svg';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  });

  btnCopy.addEventListener('click', function () {
    if (!state.lastQR) return;
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      canvas.toBlob(function (blob) {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]).then(function () {
          flashBtn(btnCopy, '✓ Copied!');
        }).catch(function () {
          fallbackCopy();
        });
      }, 'image/png');
    } else {
      fallbackCopy();
    }
  });

  function fallbackCopy() {
    try {
      var dataUrl = canvas.toDataURL('image/png');
      var win = window.open('');
      win.document.write('<img src="' + dataUrl + '" style="max-width:100%">');
      win.document.title = 'QR Code';
    } catch (e) {
      alert('Clipboard not available in this browser. Use Download PNG instead.');
    }
  }

  function flashBtn(btn, label) {
    var orig = btn.textContent;
    btn.textContent = label;
    setTimeout(function () { btn.textContent = orig; }, 2000);
  }

  // ── SVG builder ───────────────────────────────────────────────────────────
  function buildSVG(qr) {
    var count     = qr.getModuleCount();
    var moduleSize = 1;
    var margin    = state.margin;
    var total     = count + margin * 2;
    var fg        = state.fgColor;
    var bg        = state.bgColor;
    var eye       = state.eyeColorEnabled ? state.eyeColor : fg;
    var transparent = state.transparent;

    function isEyeModule(r, c) {
      return (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);
    }

    var svgParts = [];
    svgParts.push('<?xml version="1.0" encoding="UTF-8"?>');
    svgParts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges">');

    if (!transparent) {
      svgParts.push('<rect width="' + total + '" height="' + total + '" fill="' + bg + '"/>');
    }

    var fgPath = '';
    var eyePath = '';

    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (!qr.isDark(r, c)) continue;
        var x = c + margin;
        var y = r + margin;
        var rect = 'M' + x + ' ' + y + 'h1v1h-1z';
        if (isEyeModule(r, c)) {
          eyePath += rect;
        } else {
          fgPath += rect;
        }
      }
    }

    if (fgPath) {
      svgParts.push('<path fill="' + fg + '" d="' + fgPath + '"/>');
    }
    if (eyePath) {
      svgParts.push('<path fill="' + eye + '" d="' + eyePath + '"/>');
    }

    svgParts.push('</svg>');
    return svgParts.join('\n');
  }

  // ── Contrast helpers ──────────────────────────────────────────────────────
  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function relativeLuminance(hex) {
    var rgb = hexToRgb(hex);
    var c = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(function (v) {
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrastRatio(hex1, hex2) {
    var l1 = relativeLuminance(hex1);
    var l2 = relativeLuminance(hex2);
    var lighter = Math.max(l1, l2);
    var darker  = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // ── Hex parser ────────────────────────────────────────────────────────────
  function parseHex(str) {
    var s = str.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(s)) {
      s = s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
    }
    if (/^[0-9a-fA-F]{6}$/.test(s)) {
      return '#' + s.toLowerCase();
    }
    return null;
  }

  // ── Persist state ─────────────────────────────────────────────────────────
  function saveState() {
    try {
      localStorage.setItem('qrgen_state', JSON.stringify({
        fgColor: state.fgColor,
        bgColor: state.bgColor,
        eyeColor: state.eyeColor,
        eyeColorEnabled: state.eyeColorEnabled,
        transparent: state.transparent,
        ecLevel: state.ecLevel,
        size: state.size,
        margin: state.margin
      }));
    } catch (e) {}
  }

  // ── Checkerboard for transparent mode ────────────────────────────────────
  (function injectCheckerCSS() {
    var style = document.createElement('style');
    style.textContent = [
      '.preview-wrap.transparent-mode {',
      '  background-image:',
      '    linear-gradient(45deg,#aaa 25%,transparent 25%),',
      '    linear-gradient(-45deg,#aaa 25%,transparent 25%),',
      '    linear-gradient(45deg,transparent 75%,#aaa 75%),',
      '    linear-gradient(-45deg,transparent 75%,#aaa 75%);',
      '  background-size:16px 16px;',
      '  background-position:0 0,0 8px,8px -8px,-8px 0;',
      '  background-color:#fff;',
      '}'
    ].join('');
    document.head.appendChild(style);
  })();

  // ── Initial render ────────────────────────────────────────────────────────
  canvas.hidden = true;
  scheduleUpdate();

})();
