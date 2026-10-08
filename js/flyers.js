/* FLAPPENING flyers: hi-res pixel sprites (80x64) drawn in code with cel shading,
   palette snapping and coloured outlines. Exposes window.FLYERS. */
'use strict';
(() => {
  const OUTL = [27, 16, 48];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const rgb = (a) => 'rgb(' + a.map((v) => Math.round(clamp(v, 0, 255))).join(',') + ')';
  const mixA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const dark = (c) => rgb(mixA(mixA(hex(c), [0, 0, 0], 0.32), [58, 36, 120], 0.22));
  const light = (c) => rgb(mixA(mixA(hex(c), [255, 255, 255], 0.38), [255, 246, 200], 0.15));
  const deep = (c) => rgb(mixA(mixA(hex(c), [0, 0, 0], 0.5), [40, 20, 90], 0.25));

  function E(g, x, y, rx, ry, c, rot) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); g.fill(); }
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function P(g, pts, c) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function L(g, pts, c, w) { g.strokeStyle = c; g.lineWidth = w || 1; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); }
  function RR(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }

  // cel-shaded ellipse: shadow crescent bottom-right, base, light top-left, optional glint
  function ball(g, x, y, rx, ry, c, rot, glint) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    E(g, 0, 0, rx, ry, dark(c));
    g.save(); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.clip();
    E(g, -rx * 0.13, -ry * 0.16, rx * 0.9, ry * 0.84, c);
    E(g, -rx * 0.34, -ry * 0.42, rx * 0.48, ry * 0.38, light(c));
    g.restore();
    if (glint) E(g, -rx * 0.45, -ry * 0.5, Math.max(0.6, rx * 0.12), Math.max(0.5, ry * 0.1), '#ffffff');
    g.restore();
  }
  function rbox(g, x, y, w, h, r, c) {
    RR(g, x, y, w, h, r, dark(c));
    RR(g, x, y, w - 1.2, h - 1.4, r, c);
    RR(g, x + 0.8, y + 0.8, w * 0.55, Math.max(1, h * 0.28), r * 0.6, light(c));
  }
  function eye(g, x, y, r, blink, look) {
    if (blink) { L(g, [x - r, y + 0.2, x, y + r * 0.45, x + r, y + 0.2], '#1b1030', 1.1); return; }
    E(g, x, y, r, r * 1.05, '#ffffff');
    E(g, x + (look || 0.45) * r * 0.5, y + 0.1, r * 0.62, r * 0.7, '#1b1030');
    E(g, x + (look || 0.45) * r * 0.5 - r * 0.25, y - r * 0.3, r * 0.24, r * 0.24, '#ffffff');
  }
  function wing(g, x, y, rx, ry, c, f, flip) {
    const A = [-0.95, -0.55, -0.05, 0.5, 0.2, -0.45][f], Y = [-2.3, -1.4, 0, 1.8, 0.8, -1.1][f];
    const a = flip ? -A : A;
    g.save(); g.translate(x, y + Y); g.rotate(a);
    E(g, -rx * 0.95, ry * 0.35, rx * 0.42, ry * 0.42, dark(c));
    E(g, -rx * 0.7, ry * 0.62, rx * 0.4, ry * 0.36, dark(c));
    ball(g, 0, 0, rx, ry, c);
    L(g, [-rx * 0.15, ry * 0.15, -rx * 0.75, ry * 0.4], dark(c), 0.7);
    g.restore();
  }
  const WY = [-2.3, -1.4, 0, 1.8, 0.8, -1.1];

  // palette snap + coloured outline on a 2x canvas
  function finish(c) {
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const id = g.getImageData(0, 0, w, h), p = id.data;
    const n = w * h, solid = new Uint8Array(n);
    const counts = new Map();
    for (let i = 0; i < n; i++) {
      if (p[i * 4 + 3] >= 128) { p[i * 4 + 3] = 255; solid[i] = 1; const k = (p[i * 4] << 16) | (p[i * 4 + 1] << 8) | p[i * 4 + 2]; counts.set(k, (counts.get(k) || 0) + 1); }
      else p[i * 4 + 3] = 0;
    }
    const pal = [];
    for (const [k, v] of counts) if (v >= 5) pal.push([k >> 16 & 255, k >> 8 & 255, k & 255]);
    if (pal.length) {
      for (let i = 0; i < n; i++) {
        if (!solid[i]) continue;
        const r = p[i * 4], gg = p[i * 4 + 1], b = p[i * 4 + 2];
        const k = (r << 16) | (gg << 8) | b;
        if ((counts.get(k) || 0) >= 5) continue;
        let best = null, bd = 1e9;
        for (const q of pal) { const d = (q[0] - r) ** 2 + (q[1] - gg) ** 2 + (q[2] - b) ** 2; if (d < bd) { bd = d; best = q; } }
        p[i * 4] = best[0]; p[i * 4 + 1] = best[1]; p[i * 4 + 2] = best[2];
      }
    }
    const out = new Uint8ClampedArray(p);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      let nb = -1;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        const jx = j % w;
        if (j >= 0 && j < n && Math.abs(jx - x) <= 1 && solid[j]) { nb = j; break; }
      }
      if (nb < 0) continue;
      const col = mixA([p[nb * 4] * 0.28, p[nb * 4 + 1] * 0.28, p[nb * 4 + 2] * 0.28], OUTL, 0.55);
      out[i * 4] = col[0]; out[i * 4 + 1] = col[1]; out[i * 4 + 2] = col[2]; out[i * 4 + 3] = 255;
    }
    g.putImageData(new ImageData(out, w, h), 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- the flyers (40x32 design units, drawn at 2x)
  const CHARS = [
    { id: 'wurst', name: 'Wurst Wing', tag: 'A bird on a sausage. Do not ask.', price: 0, puff: '#ffd43b', sfx: 'chirp',
      perk: 'SNACK: +1 $ every 5 points', stats: [3, 4, 3],
      draw(g, f, b) {
        const wv = [0, 1, 2, 1, 0, -1][f];
        P(g, [17, 14, 9, 12 + wv, 3, 10 + wv * 1.5, 5, 13.5 + wv, 9, 15.5, 17, 17], '#ff3b5c');
        P(g, [17, 15.5, 10, 16 + wv, 4, 17 + wv * 1.2, 9, 18, 17, 17.5], '#d61f45');
        ball(g, 20, 25, 15.8, 5, '#c9522b', 0, true);
        for (const x of [12, 19, 26]) L(g, [x, 22, x + 3, 27.5], '#7a2a14', 0.9);
        g.strokeStyle = '#ffd43b'; g.lineWidth = 1.2; g.beginPath(); for (let x = 7; x <= 33; x += 2.6) g.lineTo(x, 22.6 + ((x / 2.6) % 2 < 1 ? -0.9 : 0.9)); g.stroke();
        ball(g, 4.6, 25, 2, 1.8, '#a3401f'); ball(g, 35.4, 25, 2, 1.8, '#a3401f');
        R(g, 18.5, 18.8, 1.3, 2.4, '#ff8a1e'); R(g, 23, 18.8, 1.3, 2.4, '#ff8a1e');
        ball(g, 21, 14.2, 7.8, 6.9, '#ffcf3a');
        E(g, 22.8, 16.8, 4.4, 3, '#fff2b8');
        R(g, 16, 9.1, 12, 1.7, '#5a3a22');
        E(g, 25.6, 11, 3.6, 3.6, '#3a2a1a'); E(g, 25.6, 11, 2.8, 2.8, '#bff3ff');
        if (!b) { E(g, 26.4, 11.2, 1.3, 1.5, '#1b1030'); E(g, 25.4, 10.1, 0.6, 0.6, '#ffffff'); } else L(g, [24, 11.4, 27.2, 11.4], '#1b1030', 0.9);
        P(g, [28.4, 12.3, 33.6, 13.6, 28.4, 14.6], '#ff8a1e'); P(g, [28.4, 14.6, 32.4, 14.4, 28.4, 15.8], '#e5650f');
        E(g, 24.6, 15.2, 1.4, 0.9, '#ff8fa0');
        wing(g, 17.4, 14, 5.4, 3, '#f5a623', f);
      } },
    { id: 'moon', name: 'Moon Boi', tag: 'A bird, a helmet, a rocket. One direction only: up.', price: 0, puff: '#ff9d2e', trail: 'flame', sfx: 'boost',
      perk: 'BOOST: stronger flaps', stats: [5, 3, 4],
      draw(g, f, b) {
        const Lf = [7, 10, 8, 11, 9, 8][f];
        P(g, [8, 20, 8 - Lf, 23.5, 8, 27], '#ff5a1e'); P(g, [8, 21.3, 8 - Lf * 0.62, 23.5, 8, 25.7], '#ffb21e'); P(g, [8, 22.4, 8 - Lf * 0.3, 23.5, 8, 24.6], '#fff3b0');
        P(g, [12, 19, 6, 14, 10, 14, 16, 19.5], '#ff4d4d'); P(g, [12, 28, 6, 33, 10, 33, 16, 27.5], '#ff4d4d');
        ball(g, 19.5, 23.5, 13, 5.5, '#eef1f8', 0, true);
        R(g, 13, 18.2, 2.2, 10.6, '#ff4d4d');
        P(g, [30.5, 19.2, 38.4, 23.5, 30.5, 27.8], '#ff4d4d'); P(g, [30.5, 19.2, 36, 22.2, 30.5, 22.4], '#ff9a9a');
        E(g, 25, 23.5, 2.7, 2.7, '#4a5a7a'); E(g, 25, 23.5, 2, 2, '#58c4ff'); E(g, 24.3, 22.8, 0.7, 0.7, '#ffffff');
        for (const x of [17, 20, 23]) E(g, x, 27.4, 0.5, 0.5, '#a8b0c4');
        ball(g, 19, 14.2, 6.6, 5.9, '#4fb3ff');
        E(g, 20.6, 16.6, 3.6, 2.3, '#d6f1ff');
        eye(g, 22.2, 12.6, 2.4, b);
        P(g, [24.8, 13.6, 29, 14.8, 24.8, 16.2], '#ffb21e');
        wing(g, 15.4, 15, 3.8, 2.3, '#2f8de0', f);
        g.strokeStyle = '#e4fbff'; g.lineWidth = 1.1; g.beginPath(); g.arc(19.2, 13.3, 8.6, Math.PI * 0.95, Math.PI * 2.05); g.stroke();
        g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.arc(19.2, 13.3, 6.8, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
        L(g, [19, 4.7, 21, 1.6], '#9aa6c4', 0.8); E(g, 21.2, 1.4, 1.2, 1.2, f % 3 === 0 ? '#ff4d4d' : '#ffd3d3');
      } },
    { id: 'duck', name: 'Debug Duck', tag: 'Explains your bug back to you. Loudly.', price: 0, puff: '#bfefff', sfx: 'quack',
      perk: 'RUBBER: bounces off the ground once', stats: [2, 4, 3],
      draw(g, f, b) {
        ball(g, 9.6, 15.6, 4.2, 2.6, '#f4bd25', -0.7);
        ball(g, 19, 21, 10.8, 7.3, '#ffd84a', 0, true);
        ball(g, 26.5, 11.6, 6.6, 6.3, '#ffd84a', 0, true);
        P(g, [31.2, 11.6, 38, 13.1, 31.6, 14.4], '#ff8c1a'); P(g, [31.6, 14.4, 36.6, 14.2, 31.8, 15.8], '#e0650c');
        eye(g, 28.6, 10.4, 2.3, b);
        g.strokeStyle = '#1b1030'; g.lineWidth = 0.9; g.beginPath(); g.arc(28.6, 10.4, 3.2, 0, Math.PI * 2); g.stroke();
        L(g, [31.8, 10, 33.6, 10.4], '#1b1030', 0.9);
        g.strokeStyle = '#3a3550'; g.lineWidth = 1.4; g.beginPath(); g.arc(25.6, 11.4, 6.6, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
        ball(g, 21.2, 11.8, 2.2, 2.8, '#3a3550');
        L(g, [21.6, 14, 24, 16.6, 29.6, 16.2], '#3a3550', 0.8); E(g, 30, 16.2, 0.9, 0.9, '#1b1030');
        E(g, 26.6, 15.2, 1.3, 0.8, '#ff9aa2');
        P(g, [25.5, 5.6, 26.5, 3.4, 27.2, 5.5, 28.6, 4, 28.4, 6], '#ffd84a');
        wing(g, 16.4, 19, 6, 3.4, '#f5c22e', f);
      } },
    { id: 'ceo', name: 'Founder Mode', tag: 'Navy suit, red tie, big glasses. Raising a Series A in mid-air.', price: 0, puff: '#9fd0ff', sfx: 'ding',
      perk: 'SEED ROUND: starts every run with a shield', stats: [3, 5, 3],
      draw(g, f, b) {
        P(g, [10, 17, 3, 13.5, 4.5, 18.5, 10, 22], '#1a2f6e');
        R(g, 17, 26.4, 1.4, 2.8, '#ff9f1c'); R(g, 21.4, 26.4, 1.4, 2.8, '#ff9f1c');
        ball(g, 19, 20.6, 10.8, 7.2, '#27459a', 0, true);
        P(g, [23.2, 15.2, 29.6, 17, 27, 26.4, 22, 24], '#f4f6fb');
        P(g, [25.6, 16.6, 27.6, 17.2, 27.4, 19, 25.4, 18.4], '#9c1826');
        P(g, [25.6, 18.6, 27.4, 19, 27.6, 24.4, 26.2, 26, 24.8, 23.8], '#c62a3a');
        P(g, [21.6, 14.6, 24.4, 15.4, 23, 22.6, 20.4, 19], '#1d3580');
        E(g, 21.4, 19.6, 0.8, 0.8, '#8fd3ff');
        ball(g, 26.6, 11.2, 6.5, 6.1, '#f0cfa0', 0, true);
        for (const [x, y, rx, ry] of [[22, 8.2, 2.6, 3], [24.2, 5.8, 3, 2.6], [27.4, 4.9, 3.2, 2.5], [30.4, 6.2, 2.6, 2.2]]) ball(g, x, y, rx, ry, '#5a3a22');
        P(g, [32, 11.6, 38, 13, 32.2, 14.6], '#ff9f1c'); P(g, [32.2, 14.6, 36.8, 14.3, 32.4, 15.8], '#e0780c');
        eye(g, 28.8, 10.9, 2, b);
        g.strokeStyle = '#141018'; g.lineWidth = 1.1; g.beginPath(); if (g.roundRect) g.roundRect(25.9, 8.3, 5.9, 5.3, 1.2); else g.rect(25.9, 8.3, 5.9, 5.3); g.stroke();
        L(g, [25.9, 10.4, 22.6, 9.8], '#141018', 1); L(g, [31.8, 10.4, 33.4, 10.6], '#141018', 1);
        E(g, 26.6, 15, 1.2, 0.8, '#ff9aa2');
        wing(g, 15.8, 19.4, 6, 3.4, '#1d3580', f);
      } },
    { id: 'mogul', name: 'Mars Mogul', tag: 'Black tee, a tiny red car, big plans for another planet.', price: 0, puff: '#ffb3a0', sfx: 'boost',
      perk: 'TO MARS: +5 $ every 10 pipes', stats: [5, 4, 5],
      draw(g, f, b) {
        P(g, [10, 17, 3, 13.5, 4.5, 18.5, 10, 22], '#101014');
        R(g, 17, 26.4, 1.4, 2.8, '#ff9f1c'); R(g, 21.4, 26.4, 1.4, 2.8, '#ff9f1c');
        ball(g, 19, 20.6, 10.8, 7.2, '#2a2a33', 0, true);
        P(g, [19.4, 20.8, 23.6, 19.6, 22.4, 21.8], '#f4f6fb'); L(g, [15.6, 23, 19.6, 21.4, 24.6, 21.8], '#f4f6fb', 0.7);
        ball(g, 26.6, 11.2, 6.5, 6.1, '#efc79c', 0, true);
        P(g, [21, 9, 21.8, 4.2, 24, 6.4, 25.4, 2.6, 27.4, 5.6, 29.6, 3, 30.4, 6.2, 32, 5.4, 31.6, 8.6, 26, 7], '#4a2e1c');
        P(g, [32, 11.6, 38, 13, 32.2, 14.6], '#ff9f1c'); P(g, [32.2, 14.6, 36.8, 14.3, 32.4, 15.8], '#e0780c');
        eye(g, 28.8, 10.9, 2, b); L(g, [26.8, 8, 30.6, 8.4], '#3a2416', 0.9);
        L(g, [26.4, 15.2, 28, 15.9, 29.8, 15.2], '#8a5a3a', 0.7);
        wing(g, 15.8, 19.4, 6, 3.4, '#1a1a20', f);
        const cy = 23.2 + [0, -0.4, -0.8, -0.4, 0, 0.3][f];
        rbox(g, 27.2, cy, 10.8, 3.6, 1.5, '#d8232f'); P(g, [29.6, cy + 0.3, 31.2, cy - 2.2, 34.6, cy - 2.2, 36.2, cy + 0.3], '#b01822'); P(g, [30.6, cy, 31.6, cy - 1.5, 34.2, cy - 1.5, 35.2, cy], '#bfe9ff');
        E(g, 29.8, cy + 3.6, 1.4, 1.4, '#16121e'); E(g, 35.4, cy + 3.6, 1.4, 1.4, '#16121e'); E(g, 29.8, cy + 3.6, 0.5, 0.5, '#c9ced8'); E(g, 35.4, cy + 3.6, 0.5, 0.5, '#c9ced8'); E(g, 37.4, cy + 1.2, 0.6, 0.6, '#fff3b0');
      } },
    { id: 'dev', name: 'Hoodie Dev', tag: 'Ships at 3 a.m. Tests in production. Hood always up.', price: 0, puff: '#7dffb0', sfx: 'chirp',
      perk: 'SHIP IT: PERFECT passes pay double', stats: [3, 3, 4],
      draw(g, f, b) {
        P(g, [10, 17, 3, 13.5, 4.5, 18.5, 10, 22], '#2c2f45');
        R(g, 17, 26.4, 1.4, 2.8, '#ff9f1c'); R(g, 21.4, 26.4, 1.4, 2.8, '#ff9f1c');
        ball(g, 19, 20.6, 10.8, 7.2, '#454a6b', 0, true);
        L(g, [15, 23.4, 21, 24.4], '#2c2f45', 0.8);
        ball(g, 25.8, 11, 7.4, 6.9, '#454a6b', 0, true);
        E(g, 28, 11.8, 5, 4.9, '#2c2f45'); E(g, 28.4, 11.9, 4.4, 4.4, '#ffd84a');
        eye(g, 29.6, 11, 1.9, b);
        P(g, [32.4, 12, 37.6, 13.2, 32.4, 14.6], '#ff9f1c'); P(g, [32.4, 14.6, 36.4, 14.4, 32.6, 15.6], '#e0780c');
        L(g, [25.6, 16.6, 25.2, 20], '#eef0f8', 0.7); L(g, [27.6, 16.8, 27.8, 19.6], '#eef0f8', 0.7);
        wing(g, 15.8, 19.4, 6, 3.4, '#383c58', f);
        P(g, [28.2, 17.8, 37, 18.8, 36.4, 24.2, 27.8, 23.2], '#1c2030'); P(g, [29, 18.8, 36.2, 19.6, 35.8, 23.2, 28.7, 22.4], '#0f1a22');
        R(g, 30, 19.8, 3.6, 0.8, '#7dffb0'); R(g, 30, 21.2, 2.2, 0.8, '#58c4ff'); if (f % 2) R(g, 33, 21.2, 0.8, 0.8, '#ffffff');
        P(g, [26.6, 23.4, 37.2, 24.6, 36.8, 25.8, 26.2, 24.6], '#aab2c4');
      } },
    { id: 'gem', name: 'Diamond Hands', tag: 'Never sold. Never will. Wings made of pure conviction.', price: 0, puff: '#9ff3ff', sfx: 'ding',
      perk: 'HODL: coins x3 during FEVER', stats: [3, 5, 2],
      draw(g, f, b) {
        wing(g, 10, 14, 7, 3.2, '#ffffff', f, true);
        P(g, [11, 12.4, 16.6, 5.6, 27.4, 5.6, 33, 12.4, 22, 29], '#38c7e8');
        P(g, [11, 12.4, 16.6, 5.6, 18.6, 12.4], '#c9fbff'); P(g, [16.6, 5.6, 27.4, 5.6, 25.4, 12.4, 18.6, 12.4], '#e9feff'); P(g, [27.4, 5.6, 33, 12.4, 25.4, 12.4], '#7fe6f8');
        P(g, [11, 12.4, 18.6, 12.4, 22, 29], '#62dcf4'); P(g, [25.4, 12.4, 33, 12.4, 22, 29], '#1f9fc6');
        RR(g, 15.4, 13.6, 13.6, 3.6, 1.3, '#141018'); R(g, 16.6, 14.3, 3, 0.9, b ? '#58c4ff' : '#ffffff'); R(g, 23.4, 14.3, 3, 0.9, b ? '#58c4ff' : '#ffffff');
        L(g, [19.6, 20, 22, 21.4, 25, 19.6], '#0b5d78', 0.9);
        if (f % 3 === 0) { R(g, 30.4, 6.4, 3.2, 0.8, '#ffffff'); R(g, 31.6, 5.2, 0.8, 3.2, '#ffffff'); } else { R(g, 13.6, 8.2, 2.4, 0.7, '#ffffff'); R(g, 14.45, 7.35, 0.7, 2.4, '#ffffff'); }
        wing(g, 35, 16.4, 4.8, 2.6, '#ffffff', f);
      } },
    { id: 'cup', name: 'Coffee Intern', tag: 'Runs on espresso and unpaid overtime. Has not slept since v1.', price: 0, puff: '#d9b38c', sfx: 'pop',
      perk: 'OVERTIME: every CLOSE! call pays +2 $', stats: [4, 2, 4],
      draw(g, f, b) {
        const wv = [0, 0.8, 1.4, 0.8, 0, -0.8][f];
        L(g, [17, 4.6, 16 + wv, 2.6, 17.4, 0.8], '#ffffff', 0.9); L(g, [22.6, 4.4, 23.6 - wv, 2.4, 22.2, 0.6], '#ffffff', 0.9);
        wing(g, 10, 15.4, 6.6, 3, '#ffffff', f, true);
        P(g, [12, 9.6, 30.4, 9.6, 28.4, 29.4, 14, 29.4], '#f6f1e7'); P(g, [26.4, 9.6, 30.4, 9.6, 28.4, 29.4, 25.6, 29.4], '#d9d0c0');
        P(g, [12.7, 15.6, 29.8, 15.6, 29, 24, 13.5, 24], '#b5793f'); P(g, [26.1, 15.6, 29.8, 15.6, 29, 24, 25.8, 24], '#93602f');
        rbox(g, 10.6, 7, 21.2, 3.4, 1.4, '#4a3524'); rbox(g, 13, 5, 16.4, 2.6, 1.2, '#5a4230');
        eye(g, 17.6, 19.2, 2, b); eye(g, 24, 19.2, 2, b);
        L(g, [15.8, 22, 19.2, 22.2], '#6b4424', 0.7); L(g, [22.4, 22.2, 25.8, 22], '#6b4424', 0.7);
        L(g, [19.6, 22.4, 20.8, 23, 22, 22.4], '#1b1030', 0.7);
        R(g, 17, 29.4, 1.4, 2.2, '#ff9f1c'); R(g, 24, 29.4, 1.4, 2.2, '#ff9f1c');
        wing(g, 34.8, 17.4, 4.8, 2.6, '#ffffff', f);
      } },
    { id: 'pigeon', name: 'Pigeonardo Bombardini', tag: 'Half pigeon. Half bomber. All brainrot.', price: 30, puff: '#c9ced8', trail: 'smoke', sfx: 'coo',
      perk: 'WAR CHEST: every coin worth 2', stats: [3, 3, 5],
      draw(g, f, b) {
        P(g, [10, 16, 3.5, 9.5, 6.5, 9.5, 12.5, 17], '#5d6b2f'); P(g, [10, 21, 3.5, 27, 6.5, 27, 12.5, 20], '#5d6b2f');
        ball(g, 20, 19, 11.2, 6.2, '#9aa3b5', 0, true);
        E(g, 18.5, 21.8, 7.6, 2.6, '#c3c9d6');
        rbox(g, 8, 16.6, 24, 3.6, 1.2, '#6f7f39');
        E(g, 14, 18.4, 1.7, 1.4, '#ffffff'); E(g, 14, 18.4, 0.8, 0.7, '#e63946');
        ball(g, 27, 15, 4.8, 4.2, '#3fb68f'); E(g, 27.6, 13.4, 3.5, 2.2, '#8b5cf6');
        ball(g, 30.4, 10.8, 4.9, 4.4, '#a9b1c2', 0, true);
        R(g, 26.6, 7, 7.4, 2.4, '#7a4a28'); E(g, 30.2, 6.9, 3.8, 1.6, '#8f5a32');
        E(g, 28, 7.6, 1.4, 1.2, '#3a2a1a'); E(g, 28, 7.6, 0.9, 0.8, '#bff3ff');
        E(g, 31.6, 10.6, 1.9, 1.9, '#ff8a1e'); if (!b) { E(g, 31.9, 10.6, 1, 1.1, '#1b1030'); E(g, 31.4, 10, 0.4, 0.4, '#fff'); } else L(g, [30, 10.8, 33.2, 10.8], '#1b1030', 0.8);
        P(g, [34.2, 10.6, 38.6, 11.8, 34.2, 13], '#3a3340'); E(g, 34.6, 10.4, 1.1, 0.8, '#eef0f4');
        ball(g, 14.5, 22.3, 2.8, 2.2, '#4a5528');
        const pl = [7, 2, 7, 2, 6, 3][f]; E(g, 11.6, 22.3, 0.8, pl / 2, '#e6e6e6');
        ball(g, 21, 27, 3.6, 2, '#2b2b2b', 0, true); P(g, [17.4, 27, 15.2, 25.2, 15.2, 28.8], '#2b2b2b'); R(g, 20.4, 24.6, 1, 1.2, '#2b2b2b');
      } },
    { id: 'capy', name: 'Capy Copter', tag: 'Never stressed. Never landed. Yuzu on top.', price: 60, puff: '#ffe08a', sfx: 'pop',
      perk: 'CHILL: world moves 10% slower', stats: [1, 5, 2],
      draw(g, f, b) {
        R(g, 11, 26, 3, 3, '#6e4224'); R(g, 23.5, 26, 3, 3, '#6e4224');
        rbox(g, 7, 13.5, 24.5, 14.5, 7, '#a86b3c');
        E(g, 18, 25, 9, 2.4, '#c48a55');
        ball(g, 28.6, 17.4, 7.2, 6.2, '#a86b3c');
        rbox(g, 30, 15.6, 8.8, 7.6, 3.2, '#8a5530');
        E(g, 36.6, 17.4, 1, 0.9, '#2a160c');
        if (!b) L(g, [27.6, 15.4, 29, 14.4, 30.4, 15.4], '#2a160c', 0.9); else L(g, [27.6, 15, 30.4, 15], '#2a160c', 0.9);
        L(g, [33, 21.4, 34.6, 22, 36.4, 21.2], '#4a2a16', 0.7);
        ball(g, 25.6, 12.3, 2.1, 1.7, '#7a4a28');
        ball(g, 27, 11, 5.6, 2.8, '#ff4d4d'); P(g, [27, 8.2, 32.6, 11, 27, 11], '#ffd43b'); P(g, [21.4, 11, 27, 8.2, 27, 11], '#3aa0ff');
        R(g, 26.5, 4.6, 1.2, 4, '#3a3340');
        const bw = [8.5, 4, 1.5, 4, 8.5, 6][f]; RR(g, 27.1 - bw, 3.6, bw * 2, 1.7, 0.8, '#ffd43b');
        ball(g, 13.2, 11, 3.4, 3.2, '#ff9f1c', 0, true); P(g, [13.2, 7.8, 15.6, 6.2, 14.4, 8.4], '#3f8f2f');
      } },
    { id: 'toast', name: 'Toastito', tag: 'Holy toast. Butter side up. Always.', price: 100, puff: '#f6d58e', sfx: 'ding',
      perk: 'BLESSED: perfect zone is wider', stats: [3, 5, 2],
      draw(g, f, b) {
        g.strokeStyle = '#ffd43b'; g.lineWidth = 1.3; g.beginPath(); g.ellipse(21.5, 4.6 + (f % 3) * 0.3, 6, 1.6, 0, 0, Math.PI * 2); g.stroke();
        wing(g, 9, 14, 7, 3.2, '#ffffff', f, true);
        RR(g, 11, 10, 21, 19, 4, '#9c5420'); E(g, 15.5, 11, 5.6, 4.2, '#9c5420'); E(g, 27.5, 11, 5.6, 4.2, '#9c5420');
        RR(g, 11.6, 10.4, 19.6, 18, 3.6, '#c47a35');
        RR(g, 13, 12, 17, 15, 3, '#f3c97a'); E(g, 16, 12.6, 3.8, 2.6, '#f3c97a'); E(g, 27, 12.6, 3.8, 2.6, '#f3c97a');
        R(g, 14, 13, 8, 1.4, '#fde3a6');
        rbox(g, 17.5, 13.2, 8.4, 5.2, 1.2, '#ffe066'); P(g, [21, 18.4, 22.4, 18.4, 21.7, 21], '#ffe066');
        if (!b) { E(g, 17, 20.6, 1.4, 1.8, '#1b1030'); E(g, 25.6, 20.6, 1.4, 1.8, '#1b1030'); E(g, 16.6, 20, 0.5, 0.5, '#fff'); E(g, 25.2, 20, 0.5, 0.5, '#fff'); }
        else { L(g, [15.6, 20.8, 18.4, 20.8], '#1b1030', 0.9); L(g, [24.2, 20.8, 27, 20.8], '#1b1030', 0.9); }
        L(g, [19.4, 23.6, 21.3, 25, 23.2, 23.6], '#1b1030', 0.9);
        E(g, 15, 23.2, 1.5, 0.9, '#ff8fa0'); E(g, 28, 23.2, 1.5, 0.9, '#ff8fa0');
        wing(g, 32.5, 15, 6.4, 2.8, '#ffffff', f);
      } },
    { id: 'gull', name: 'Chad Gull', tag: 'Steals fries. Steals hearts. Never pays.', price: 150, puff: '#ffffff', sfx: 'squawk',
      perk: 'THIEF: pulls coins from far away', stats: [4, 5, 4],
      draw(g, f, b) {
        P(g, [9.5, 16, 2.5, 12.5, 4, 17.5, 9.5, 21], '#9aa6b8');
        ball(g, 19, 19, 11.2, 6.7, '#f4f6fb', 0, true);
        E(g, 18, 22.8, 8.8, 2.4, '#dfe4ee');
        ball(g, 28.2, 12.4, 6.4, 6, '#ffffff', 0, true);
        P(g, [32.8, 12.6, 39.4, 14, 32.8, 15.8], '#ffcc2e'); E(g, 37.2, 14.5, 0.8, 0.8, '#e63946');
        L(g, [35.4, 14.6, 39.4, 9.6], '#e8a612', 2.2); L(g, [35.4, 14.2, 39, 9.8], '#ffd23f', 1.2); E(g, 39.3, 9.6, 0.9, 0.9, '#ffe98a');
        RR(g, 24.4, 9.8, 10.6, 3.3, 1.2, '#111111'); R(g, 25.4, 10.3, 2.6, 0.9, '#5cc8ff'); R(g, 30.8, 10.3, 2.6, 0.9, '#5cc8ff');
        L(g, [23.6, 16.4, 27.6, 20.4, 31.6, 17.4], '#ffcc2e', 1.3); ball(g, 27.6, 20.4, 1.4, 1.6, '#ffcc2e');
        wing(g, 16.4, 16, 9.2, 3.5, '#9aa6b8', f);
        E(g, 8.6 , 16 + WY[f] * 1.5, 3, 1.9, '#2b2f3a', [-0.95, -0.55, -0.05, 0.5, 0.2, -0.45][f] * 0.8);
        R(g, 17, 25.6, 1.4, 2.6, '#ff9f1c'); R(g, 21, 25.6, 1.4, 2.6, '#ff9f1c');
      } },
    { id: 'brick', name: 'Flying Brick', tag: 'Physics said no. He said yes.', price: 0, unlock: 25, puff: '#d9a07a', sfx: 'thud',
      perk: 'HEAVY: falls faster, +1 $ every pass', stats: [2, 2, 5],
      draw(g, f, b) {
        wing(g, 13, 11, 7, 3, '#eef0ff', f, true);
        rbox(g, 7, 12, 27, 14.4, 1.6, '#c2452d');
        R(g, 7, 18.6, 26, 1, '#e9d6c2'); R(g, 15, 12, 1, 6.6, '#e9d6c2'); R(g, 26, 12, 1, 6.6, '#e9d6c2'); R(g, 20, 19.6, 1, 6.2, '#e9d6c2');
        L(g, [10, 22, 12, 23.5, 11.4, 25], '#7a2414', 0.7);
        if (!b) { E(g, 25.6, 16, 1.4, 1.5, '#1b1030'); E(g, 30.4, 16, 1.4, 1.5, '#1b1030'); } else { L(g, [24.4, 16, 26.8, 16], '#1b1030', 0.9); L(g, [29.2, 16, 31.6, 16], '#1b1030', 0.9); }
        L(g, [23.6, 13.4, 27.2, 14.4], '#1b1030', 1); L(g, [32.2, 13.4, 28.8, 14.4], '#1b1030', 1);
        L(g, [26, 22, 28, 21.2, 30, 22], '#1b1030', 0.8);
        E(g, 33.6, 12.8, 1, 1.5, '#7fd6ff');
        wing(g, 17, 13, 5, 2.3, '#ffffff', f);
      } },
    { id: 'shark', name: 'Sharko Turbini', tag: 'A shark in jet sneakers. Nobody asked. He came anyway.', price: 200, puff: '#9ad7ff', trail: 'jet', sfx: 'boost',
      perk: 'TURBO: 15% faster, coins x2', stats: [5, 4, 5],
      draw(g, f, b) {
        const fl = [4, 6, 5, 7, 5, 6][f];
        P(g, [14.5, 28.5, 14.5 - fl * 0.4, 31.5 + fl * 0.5, 16.5, 29], '#ffb21e'); P(g, [22.5, 28.5, 22.5 - fl * 0.4, 31.5 + fl * 0.5, 24.5, 29], '#ffb21e');
        L(g, [16, 22, 15.4, 26], '#7a8fa8', 1.2); L(g, [24, 22, 23.4, 26], '#7a8fa8', 1.2);
        rbox(g, 12.6, 25.6, 5.6, 3.2, 1.2, '#ff3b5c'); R(g, 12.8, 27.6, 5.4, 1.1, '#ffffff');
        rbox(g, 20.6, 25.6, 5.6, 3.2, 1.2, '#ff3b5c'); R(g, 20.8, 27.6, 5.4, 1.1, '#ffffff');
        P(g, [8, 17, 1.5, 10, 3.5, 17, 1.5, 23.5], '#5f86b0');
        P(g, [18, 10.5, 22, 3.6, 24.5, 11], '#5f86b0');
        ball(g, 19.5, 17, 13, 6.8, '#7aa6d6', 0, true);
        P(g, [9, 19, 30, 19.6, 32.5, 18, 31, 22.6, 12, 22.4], '#f2f6fb');
        P(g, [17, 21, 13.5, 26, 20, 22], '#5f86b0');
        L(g, [24.6, 15.4, 24.2, 18], '#4a6d94', 0.7); L(g, [22.6, 15.4, 22.2, 18], '#4a6d94', 0.7);
        eye(g, 28.4, 14.2, 2, b);
        L(g, [26.6, 19.4, 32.6, 19.2], '#1b1030', 0.8);
        for (let x = 27.4; x < 32.4; x += 1.6) P(g, [x, 19.4, x + 0.8, 20.8, x + 1.6, 19.4], '#ffffff');
        R(g, 25.6, 11.8, 4.6, 1, '#1b1030');
      } },
    { id: 'cat', name: 'Cardboard Cat', tag: 'Drew wings on a box. It worked.', price: 250, puff: '#e9c79a', sfx: 'meow',
      perk: 'NINE LIVES: survives the first hit', stats: [3, 5, 4],
      draw(g, f, b) {
        ball(g, 22.5, 10.5, 6.6, 5.8, '#ff9a3c', 0, true);
        P(g, [17.6, 7.6, 18.6, 1.8, 21.6, 5.4], '#ff9a3c'); P(g, [23.6, 5.2, 27, 1.6, 27.6, 7.4], '#ff9a3c');
        P(g, [18.6, 6.6, 19.2, 3.6, 20.8, 5.6], '#ffc7d2'); P(g, [24.6, 5.4, 26.6, 3.2, 26.8, 6.6], '#ffc7d2');
        L(g, [17.4, 9.2, 19.8, 9.8], '#d96a16', 0.8); L(g, [17.2, 11, 19.6, 11], '#d96a16', 0.8);
        eye(g, 24.8, 10, 1.8, b); eye(g, 28.4, 10.2, 1.6, b);
        P(g, [27.4, 12.4, 28.6, 12.4, 28, 13.2], '#ff6b8a'); L(g, [26.6, 13.8, 28, 14.6, 29.4, 13.8], '#1b1030', 0.7);
        L(g, [29.6, 12.6, 33.4, 11.8], '#ffffff', 0.5); L(g, [29.6, 13.4, 33.4, 13.8], '#ffffff', 0.5);
        g.strokeStyle = '#d96a16'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(11.5, 14); g.quadraticCurveTo(6 + [0, 1, 2, 1, 0, -1][f], 9, 9.5, 4); g.stroke(); g.strokeStyle = '#ff9a3c'; g.lineWidth = 1.6; g.stroke();
        rbox(g, 8, 14, 26, 15, 1.2, '#c99a62');
        P(g, [8, 14, 4, 11.4, 12, 11.4, 15, 14], '#b78a54'); P(g, [34, 14, 37.6, 11.4, 29.4, 11.4, 27, 14], '#b78a54');
        R(g, 17.6, 14, 3.2, 15, '#d9c08a');
        ball(g, 14.4, 14.4, 2, 1.4, '#ff9a3c'); ball(g, 28.6, 14.4, 2, 1.4, '#ff9a3c');
        const a = [-0.5, -0.3, 0, 0.3, 0.15, -0.2][f];
        g.save(); g.translate(26, 21); g.rotate(a); g.strokeStyle = '#1b1030'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-3, 0); g.quadraticCurveTo(2, -5, 6, -3); g.quadraticCurveTo(3, -1.6, 5, 0.6); g.quadraticCurveTo(1.6, 0, 2.6, 2.2); g.quadraticCurveTo(-1, 1.6, -3, 0); g.stroke(); g.restore();
        L(g, [10.6, 24, 13.2, 23.4, 15, 25], '#8b6232', 0.7);
      } },
    { id: 'burger', name: 'Burgerini Jetpackini', tag: 'A double cheeseburger with a jetpack. Peak brainrot cuisine.', price: 300, puff: '#ffcc2e', trail: 'pack', sfx: 'pop',
      perk: 'EXTRA CHEESE: FEVER lasts twice as long', stats: [4, 4, 5],
      draw(g, f, b) {
        const fl = [5, 8, 6, 9, 6, 7][f];
        rbox(g, 6.5, 12, 6, 13, 2, '#b8c2d6'); rbox(g, 9.5, 12.5, 5, 12, 2, '#d6deec');
        P(g, [7, 25, 7.8 + 1, 25 + fl, 9.5, 25], '#ff8a1e'); P(g, [7.6, 25, 8.4, 25 + fl * 0.55, 9, 25], '#fff3b0');
        P(g, [10.4, 24.5, 11.6, 24.5 + fl * 0.9, 13, 24.5], '#ff8a1e'); P(g, [11, 24.5, 11.8, 24.5 + fl * 0.5, 12.4, 24.5], '#fff3b0');
        L(g, [14, 15, 16, 15], '#7a8396', 1);
        ball(g, 23, 25, 11, 3.6, '#d98c3a');
        rbox(g, 12.4, 19.6, 21.6, 4.6, 2.2, '#6b3a1f'); R(g, 13.6, 20.4, 18, 0.8, '#8a5030');
        P(g, [12.6, 19.4, 34, 19.4, 33, 21.8, 29.6, 20.2, 27, 23.2, 24.6, 20.2, 20, 22.6, 17.6, 20.2, 13.6, 21.8], '#ffcc2e');
        g.fillStyle = '#5fcf5a'; g.beginPath(); g.moveTo(12, 18.8); for (let x = 12; x <= 34.5; x += 2.25) g.lineTo(x, 18.6 + ((x / 2.25) % 2 < 1 ? 1.6 : -0.2)); g.lineTo(34.5, 17.2); g.lineTo(12, 17.2); g.closePath(); g.fill();
        R(g, 15, 16.2, 6, 1.6, '#ff4d4d'); R(g, 25, 16.2, 6, 1.6, '#ff4d4d');
        ball(g, 23, 12.4, 11.4, 6.2, '#e8a24a', 0, true);
        for (const [sx, sy] of [[17, 9], [21, 7.6], [26, 8], [29.5, 10], [19.5, 11.5], [24.5, 10.6]]) E(g, sx, sy, 0.9, 0.55, '#fff6e0', 0.4);
        eye(g, 25.6, 12.4, 2, b); eye(g, 30.4, 12.6, 1.8, b);
        L(g, [27, 15.4, 28.6, 16.2, 30.2, 15.4], '#1b1030', 0.7);
        R(g, 18, 28, 1.3, 2.6, '#ffcc2e'); R(g, 27, 28, 1.3, 2.6, '#ffcc2e'); R(g, 16.8, 30, 3.2, 1.4, '#ff3b5c'); R(g, 25.8, 30, 3.2, 1.4, '#ff3b5c');
      } }
  ];

  const NF = 6;
  function build() {
    for (const c of CHARS) {
      c.frames = []; c.blink = [];
      for (let f = 0; f < NF; f++) {
        c.frames.push(finish(mk(80, 64, (g) => { g.scale(2, 2); c.draw(g, f, false); })));
      }
      c.blink = [1, 4].map((f) => finish(mk(80, 64, (g) => { g.scale(2, 2); c.draw(g, f, true); })));
    }
    return CHARS;
  }
  function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (fn) fn(g, c); return c; }

  window.FLYERS = { CHARS, build, NF, ball, finish, mk, E, R, P, L, RR, dark, light };
})();
