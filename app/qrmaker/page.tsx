'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

type Tab = 'text' | 'wifi' | 'email' | 'phone' | 'sms';
type EcLevel = 'L' | 'M' | 'Q' | 'H';

interface State {
  activeTab: Tab;
  fgColor: string;
  bgColor: string;
  eyeColor: string;
  eyeColorEnabled: boolean;
  transparent: boolean;
  ecLevel: EcLevel;
  size: number;
  margin: number;
}

const DEFAULT_STATE: State = {
  activeTab: 'text',
  fgColor: '#000000',
  bgColor: '#ffffff',
  eyeColor: '#000000',
  eyeColorEnabled: false,
  transparent: false,
  ecLevel: 'M',
  size: 256,
  margin: 4,
};

function hexToRgb(hex: string) {
  const h = hex.replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const c = [r / 255, g / 255, b / 255].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastRatio(hex1: string, hex2: string) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseHex(str: string): string | null {
  let s = str.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (/^[0-9a-fA-F]{6}$/.test(s)) return '#' + s.toLowerCase();
  return null;
}

function escapeWifi(s: string) {
  return s.replace(/([\\;,:""])/g, '\\$1');
}

export default function QRMaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [st, setSt] = useState<State>(DEFAULT_STATE);
  const [text, setText] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [wifiSec, setWifiSec] = useState('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubj, setEmailSubj] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [phone, setPhone] = useState('');
  const [smsNum, setSmsNum] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [hasQR, setHasQR] = useState(false);
  const [warning, setWarning] = useState('');
  const [qrInfo, setQrInfo] = useState('');
  const [error, setError] = useState('');
  const [fgHexInput, setFgHexInput] = useState('#000000');
  const [bgHexInput, setBgHexInput] = useState('#ffffff');
  const [eyeHexInput, setEyeHexInput] = useState('#000000');
  const [copyLabel, setCopyLabel] = useState('Copy Image');
  const lastQR = useRef<any>(null);

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('qrgen_state') || '{}');
      setSt((prev) => ({
        ...prev,
        ...(saved.fgColor && { fgColor: saved.fgColor }),
        ...(saved.bgColor && { bgColor: saved.bgColor }),
        ...(saved.eyeColor && { eyeColor: saved.eyeColor }),
        ...(typeof saved.eyeColorEnabled === 'boolean' && { eyeColorEnabled: saved.eyeColorEnabled }),
        ...(typeof saved.transparent === 'boolean' && { transparent: saved.transparent }),
        ...(saved.ecLevel && { ecLevel: saved.ecLevel }),
        ...(saved.size && { size: saved.size }),
        ...(saved.margin != null && { margin: saved.margin }),
      }));
      if (saved.fgColor) setFgHexInput(saved.fgColor);
      if (saved.bgColor) setBgHexInput(saved.bgColor);
      if (saved.eyeColor) setEyeHexInput(saved.eyeColor);
    } catch {}
  }, []);

  const saveState = useCallback((s: State) => {
    try {
      localStorage.setItem('qrgen_state', JSON.stringify({
        fgColor: s.fgColor, bgColor: s.bgColor, eyeColor: s.eyeColor,
        eyeColorEnabled: s.eyeColorEnabled, transparent: s.transparent,
        ecLevel: s.ecLevel, size: s.size, margin: s.margin,
      }));
    } catch {}
  }, []);

  const buildData = useCallback(() => {
    switch (st.activeTab) {
      case 'text': return text;
      case 'wifi': {
        if (!wifiSsid) return '';
        let s = `WIFI:T:${wifiSec};S:${escapeWifi(wifiSsid)};`;
        if (wifiPass) s += `P:${escapeWifi(wifiPass)};`;
        if (wifiHidden) s += 'H:true;';
        return s + ';';
      }
      case 'email': {
        if (!emailTo) return '';
        let url = 'mailto:' + encodeURIComponent(emailTo);
        const params: string[] = [];
        if (emailSubj) params.push('subject=' + encodeURIComponent(emailSubj));
        if (emailBody) params.push('body=' + encodeURIComponent(emailBody));
        if (params.length) url += '?' + params.join('&');
        return url;
      }
      case 'phone': return phone ? 'tel:' + phone.replace(/\s/g, '') : '';
      case 'sms': return smsNum ? 'SMSTO:' + smsNum.replace(/\s/g, '') + (smsBody ? ':' + smsBody : '') : '';
      default: return '';
    }
  }, [st.activeTab, text, wifiSsid, wifiPass, wifiSec, wifiHidden, emailTo, emailSubj, emailBody, phone, smsNum, smsBody]);

  function isEyeModule(r: number, c: number, count: number) {
    return (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);
  }

  const drawCanvas = useCallback((qr: any, s: State) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const count = qr.getModuleCount();
    const moduleSize = Math.max(1, Math.floor(s.size / (count + s.margin * 2)));
    const total = moduleSize * (count + s.margin * 2);
    canvas.width = total;
    canvas.height = total;
    const fg = s.fgColor;
    const bg = s.bgColor;
    const eye = s.eyeColorEnabled ? s.eyeColor : fg;
    if (s.transparent) {
      ctx.clearRect(0, 0, total, total);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, total, total);
    }
    const offsetX = s.margin * moduleSize;
    const offsetY = s.margin * moduleSize;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!qr.isDark(r, c)) continue;
        ctx.fillStyle = isEyeModule(r, c, count) ? eye : fg;
        ctx.fillRect(offsetX + c * moduleSize, offsetY + r * moduleSize, moduleSize, moduleSize);
      }
    }
  }, []);

  const generate = useCallback(async (s: State) => {
    const data = buildData();
    if (!data) {
      setHasQR(false);
      setError('');
      setWarning('');
      setQrInfo('');
      lastQR.current = null;
      return;
    }
    try {
      const qrcodeGenerator = (await import('qrcode-generator')).default;
      const qr = qrcodeGenerator(0, s.ecLevel);
      const encoded = unescape(encodeURIComponent(data));
      qr.addData(encoded, 'Byte');
      qr.make();
      lastQR.current = qr;
      drawCanvas(qr, s);
      setHasQR(true);
      setError('');
      // warnings
      if (s.transparent) {
        setWarning('ℹ️ Transparent background — scanners need sufficient contrast from the actual background.');
      } else {
        const ratio = contrastRatio(s.fgColor, s.bgColor);
        const r = ratio.toFixed(2);
        const fgLum = relativeLuminance(s.fgColor);
        const bgLum = relativeLuminance(s.bgColor);
        let w = ratio < 3
          ? `⚠️ Contrast ${r}:1 — May not scan reliably.`
          : ratio < 4.5
          ? `⚠️ Contrast ${r}:1 — Borderline. Works in good lighting.`
          : `✓ Contrast ${r}:1 — Good.`;
        if (fgLum > bgLum) w += ' Light-on-dark code — some scanners may struggle.';
        setWarning(w);
      }
      const count = qr.getModuleCount();
      const ver = (count - 17) / 4;
      const bytes = new TextEncoder().encode(data).length;
      setQrInfo(`Version ${ver} · ${count}×${count} · ${bytes} bytes`);
    } catch (e: any) {
      const msg = String(e);
      setError(msg.includes('overflow')
        ? `Data too long for error correction level ${s.ecLevel}. Try switching to L (Low) correction.`
        : `Error: ${msg}`);
      setHasQR(false);
      lastQR.current = null;
    }
  }, [buildData, drawCanvas]);

  // Re-generate whenever inputs or settings change
  useEffect(() => {
    const timer = setTimeout(() => generate(st), 150);
    return () => clearTimeout(timer);
  }, [st, generate]);

  // Also re-draw when size changes without full regeneration
  useEffect(() => {
    if (lastQR.current) drawCanvas(lastQR.current, st);
  }, [st.size, drawCanvas]);

  function buildSVG(qr: any, s: State): string {
    const count = qr.getModuleCount();
    const margin = s.margin;
    const total = count + margin * 2;
    const fg = s.fgColor;
    const bg = s.bgColor;
    const eye = s.eyeColorEnabled ? s.eyeColor : fg;
    let fgPath = '';
    let eyePath = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!qr.isDark(r, c)) continue;
        const x = c + margin;
        const y = r + margin;
        const rect = `M${x} ${y}h1v1h-1z`;
        if (isEyeModule(r, c, count)) eyePath += rect;
        else fgPath += rect;
      }
    }
    const parts = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`,
      ...(!s.transparent ? [`<rect width="${total}" height="${total}" fill="${bg}"/>`] : []),
      ...(fgPath ? [`<path fill="${fg}" d="${fgPath}"/>`] : []),
      ...(eyePath ? [`<path fill="${eye}" d="${eyePath}"/>`] : []),
      '</svg>',
    ];
    return parts.join('\n');
  }

  function downloadPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qrcode.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  }

  function downloadSVG() {
    if (!lastQR.current) return;
    const svg = buildSVG(lastQR.current, st);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrcode.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function copyImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.ClipboardItem && navigator.clipboard?.write) {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopyLabel('✓ Copied!');
          setTimeout(() => setCopyLabel('Copy Image'), 2000);
        } catch {
          fallbackCopy(canvas);
        }
      }, 'image/png');
    } else {
      fallbackCopy(canvas);
    }
  }

  function fallbackCopy(canvas: HTMLCanvasElement) {
    const win = window.open('');
    if (win) {
      win.document.write(`<img src="${canvas.toDataURL('image/png')}" style="max-width:100%">`);
      win.document.title = 'QR Code';
    }
  }

  function applyPreset(fg: string, bg: string) {
    setSt((p) => { const n = { ...p, fgColor: fg, bgColor: bg }; saveState(n); return n; });
    setFgHexInput(fg);
    setBgHexInput(bg);
  }

  function resetColors() {
    applyPreset('#000000', '#ffffff');
    setSt((p) => {
      const n = { ...p, eyeColor: '#000000', eyeColorEnabled: false, transparent: false };
      saveState(n);
      return n;
    });
    setEyeHexInput('#000000');
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'text', label: 'Text / Link' },
    { id: 'wifi', label: 'Wi-Fi' },
    { id: 'email', label: 'Email' },
    { id: 'phone', label: 'Phone' },
    { id: 'sms', label: 'SMS' },
  ];

  const presets = [
    { fg: '#000000', bg: '#ffffff', title: 'Black/White' },
    { fg: '#1a1a2e', bg: '#e8e8f5', title: 'Navy' },
    { fg: '#1b4332', bg: '#d8f3dc', title: 'Forest' },
    { fg: '#6b2d8b', bg: '#f3e8fb', title: 'Plum' },
    { fg: '#9b2226', bg: '#fdf0f0', title: 'Brick' },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-10 bg-[var(--background)] border-b border-[var(--border)] px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-sm hover:opacity-70 transition-opacity">
          ← Lylatier
        </Link>
        <span className="text-sm font-medium">QR Maker</span>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Panel */}
        <section className="space-y-5">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSt((p) => { const n = { ...p, activeTab: tab.id }; saveState(n); return n; })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 ${
                  st.activeTab === tab.id
                    ? 'bg-[var(--foreground)] text-[var(--background)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="space-y-3">
            {st.activeTab === 'text' && (
              <>
                <label className="block text-sm font-medium">Text or URL</label>
                <textarea
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--foreground)]"
                  rows={4}
                  placeholder="Enter text or paste a URL…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                {/^https?:\/\//i.test(text.trim()) && (
                  <p className="text-xs text-[var(--muted)]">🔗 Link detected</p>
                )}
              </>
            )}
            {st.activeTab === 'wifi' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Network Name (SSID)</label>
                  <input className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]" placeholder="MyNetwork" value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input type="password" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]" placeholder="(leave blank if open)" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Security</label>
                  <select className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none" value={wifiSec} onChange={(e) => setWifiSec(e.target.value)}>
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None (open)</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={wifiHidden} onChange={(e) => setWifiHidden(e.target.checked)} /> Hidden network
                </label>
              </div>
            )}
            {st.activeTab === 'email' && (
              <div className="space-y-3">
                <div><label className="block text-sm font-medium mb-1">To</label><input type="email" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]" placeholder="someone@example.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} /></div>
                <div><label className="block text-sm font-medium mb-1">Subject</label><input className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]" placeholder="Hello" value={emailSubj} onChange={(e) => setEmailSubj(e.target.value)} /></div>
                <div><label className="block text-sm font-medium mb-1">Body</label><textarea className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--foreground)]" rows={3} placeholder="Message…" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} /></div>
              </div>
            )}
            {st.activeTab === 'phone' && (
              <div><label className="block text-sm font-medium mb-1">Phone Number</label><input type="tel" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]" placeholder="+1 555 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            )}
            {st.activeTab === 'sms' && (
              <div className="space-y-3">
                <div><label className="block text-sm font-medium mb-1">Phone Number</label><input type="tel" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]" placeholder="+1 555 000 0000" value={smsNum} onChange={(e) => setSmsNum(e.target.value)} /></div>
                <div><label className="block text-sm font-medium mb-1">Message</label><textarea className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--foreground)]" rows={3} placeholder="Your message…" value={smsBody} onChange={(e) => setSmsBody(e.target.value)} /></div>
              </div>
            )}
          </div>

          {/* Options */}
          <details className="border border-[var(--border)] rounded-lg" open>
            <summary className="px-4 py-3 text-sm font-medium cursor-pointer select-none">Options</summary>
            <div className="px-4 pb-4 space-y-4">
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Error Correction</label>
                <select className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" value={st.ecLevel} onChange={(e) => setSt((p) => { const n = { ...p, ecLevel: e.target.value as EcLevel }; saveState(n); return n; })}>
                  <option value="L">L – Low (7%)</option>
                  <option value="M">M – Medium (15%)</option>
                  <option value="Q">Q – Quartile (25%)</option>
                  <option value="H">H – High (30%)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Size (px): {st.size}</label>
                <input type="range" min={128} max={1024} step={8} value={st.size} className="w-full" onChange={(e) => setSt((p) => { const n = { ...p, size: +e.target.value }; saveState(n); return n; })} />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Margin (modules): {st.margin}</label>
                <input type="range" min={0} max={8} step={1} value={st.margin} className="w-full" onChange={(e) => setSt((p) => { const n = { ...p, margin: +e.target.value }; saveState(n); return n; })} />
              </div>
            </div>
          </details>

          {/* Colors */}
          <details className="border border-[var(--border)] rounded-lg" open>
            <summary className="px-4 py-3 text-sm font-medium cursor-pointer select-none">Colors</summary>
            <div className="px-4 pb-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-[var(--muted)] mb-1">Foreground</label>
                  <div className="flex gap-2">
                    <input type="color" value={st.fgColor} onChange={(e) => { setSt((p) => { const n = { ...p, fgColor: e.target.value }; saveState(n); return n; }); setFgHexInput(e.target.value); }} className="h-9 w-10 rounded border border-[var(--border)] cursor-pointer" />
                    <input type="text" value={fgHexInput} maxLength={7} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm font-mono focus:outline-none focus:border-[var(--foreground)]"
                      onChange={(e) => { setFgHexInput(e.target.value); const v = parseHex(e.target.value); if (v) setSt((p) => { const n = { ...p, fgColor: v }; saveState(n); return n; }); }} />
                  </div>
                </div>
                <button onClick={() => { setSt((p) => { const n = { ...p, fgColor: p.bgColor, bgColor: p.fgColor }; saveState(n); return n; }); setFgHexInput(st.bgColor); setBgHexInput(st.fgColor); }} className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-2 mt-4" title="Swap colors">⇄</button>
                <div className="flex-1">
                  <label className="block text-xs text-[var(--muted)] mb-1">Background</label>
                  <div className="flex gap-2">
                    <input type="color" value={st.bgColor} onChange={(e) => { setSt((p) => { const n = { ...p, bgColor: e.target.value }; saveState(n); return n; }); setBgHexInput(e.target.value); }} className="h-9 w-10 rounded border border-[var(--border)] cursor-pointer" />
                    <input type="text" value={bgHexInput} maxLength={7} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm font-mono focus:outline-none focus:border-[var(--foreground)]"
                      onChange={(e) => { setBgHexInput(e.target.value); const v = parseHex(e.target.value); if (v) setSt((p) => { const n = { ...p, bgColor: v }; saveState(n); return n; }); }} />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-[var(--muted)]">Corner Eyes</label>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={st.eyeColorEnabled} onChange={(e) => setSt((p) => { const n = { ...p, eyeColorEnabled: e.target.checked }; saveState(n); return n; })} /> Custom color</label>
                </div>
                {st.eyeColorEnabled && (
                  <div className="flex gap-2">
                    <input type="color" value={st.eyeColor} onChange={(e) => { setSt((p) => { const n = { ...p, eyeColor: e.target.value }; saveState(n); return n; }); setEyeHexInput(e.target.value); }} className="h-9 w-10 rounded border border-[var(--border)] cursor-pointer" />
                    <input type="text" value={eyeHexInput} maxLength={7} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm font-mono focus:outline-none focus:border-[var(--foreground)]"
                      onChange={(e) => { setEyeHexInput(e.target.value); const v = parseHex(e.target.value); if (v) setSt((p) => { const n = { ...p, eyeColor: v }; saveState(n); return n; }); }} />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={st.transparent} onChange={(e) => setSt((p) => { const n = { ...p, transparent: e.target.checked }; saveState(n); return n; })} /> Transparent background
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-[var(--muted)]">Presets:</span>
                {presets.map((p) => (
                  <button key={p.title} title={p.title} onClick={() => applyPreset(p.fg, p.bg)} className="w-6 h-6 rounded-full border border-[var(--border)] hover:scale-110 transition-transform" style={{ background: p.fg }} />
                ))}
                <button onClick={resetColors} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline-offset-2 hover:underline transition-colors">Reset</button>
              </div>
            </div>
          </details>
        </section>

        {/* Preview Panel */}
        <section className="flex flex-col gap-4">
          <div className={`flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] min-h-[300px] ${st.transparent ? 'bg-checkerboard' : ''}`}>
            {!hasQR && !error && (
              <p className="text-sm text-[var(--muted)]">Enter something to generate a QR code</p>
            )}
            {error && <p className="text-sm text-red-500 px-4 text-center">{error}</p>}
            <canvas ref={canvasRef} className={hasQR ? 'max-w-full rounded' : 'hidden'} />
          </div>

          {warning && hasQR && (
            <p className="text-xs text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2">{warning}</p>
          )}
          {qrInfo && hasQR && (
            <p className="text-xs text-[var(--muted)] text-center">{qrInfo}</p>
          )}

          <div className="flex gap-2">
            <button onClick={downloadPNG} disabled={!hasQR} className="flex-1 py-2 px-3 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium disabled:opacity-30 hover:opacity-80 transition-opacity">↓ PNG</button>
            <button onClick={downloadSVG} disabled={!hasQR} className="flex-1 py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-medium disabled:opacity-30 hover:border-[var(--foreground)] transition-colors">↓ SVG</button>
            <button onClick={copyImage} disabled={!hasQR} className="flex-1 py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-medium disabled:opacity-30 hover:border-[var(--foreground)] transition-colors">{copyLabel}</button>
          </div>
        </section>
      </main>

      <style>{`
        .bg-checkerboard {
          background-image:
            linear-gradient(45deg, #aaa 25%, transparent 25%),
            linear-gradient(-45deg, #aaa 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #aaa 75%),
            linear-gradient(-45deg, transparent 75%, #aaa 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0;
          background-color: #fff;
        }
      `}</style>
    </div>
  );
}
