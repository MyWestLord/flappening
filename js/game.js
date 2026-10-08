/* FLAPPENING — pick a meme, pick a world, flap.
   Everything (sprites, maps, sound) is drawn/synthesised in code: no image or audio files needed. */
'use strict';
(() => {
  const W = 270, GROUND = 64, PW = 44;
  let H = 480, GY = H - GROUND;
  const OUTL = '#1b1030';
  const FONT = '"Press Start 2P", monospace';
  const CFG = window.FLAP_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const app = $('#app'), cvs = $('#game'), ctx = cvs.getContext('2d');

  // ---------------------------------------------------------------- storage
  const store = {
    get(k, d) { try { const v = localStorage.getItem('flp_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('flp_' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- drawing helpers
  function E(g, x, y, rx, ry, c, rot) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); g.fill(); }
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function P(g, pts, c) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function RR(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }
  function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (fn) fn(g, c); return c; }

  function pixelize(c, outline) {
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const id = g.getImageData(0, 0, w, h), p = id.data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { if (p[i * 4 + 3] >= 120) { p[i * 4 + 3] = 255; solid[i] = 1; } else p[i * 4 + 3] = 0; }
    if (outline !== false) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
          p[i * 4] = 0x1b; p[i * 4 + 1] = 0x10; p[i * 4 + 2] = 0x30; p[i * 4 + 3] = 255;
        }
      }
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  const WING_A = [-0.85, -0.25, 0.55, -0.25], WING_Y = [-2, 0, 2, 0];
  function eye(g, x, y, r) { E(g, x, y, r, r, '#ffffff'); R(g, Math.round(x), Math.round(y - r * 0.6), 2, 2.4, OUTL); R(g, Math.round(x) - 1, Math.round(y - r * 0.8), 1, 1, '#ffffff'); }

  // ---------------------------------------------------------------- the flyers (40x32 sprites, facing right)
  const CHARS = [
    { id: 'wurst', name: 'Wurst Wing', tag: 'A bird on a sausage. Do not ask.', price: 0, puff: '#ffd43b',
      draw(g, f) {
        E(g, 20, 24.5, 15.5, 5, '#a8401f'); E(g, 20, 23.6, 14.5, 3.8, '#d6633a');
        R(g, 9, 21.5, 20, 1, '#f39b6b');
        g.strokeStyle = '#ffd43b'; g.lineWidth = 1.4; g.beginPath();
        for (let x = 8; x <= 32; x += 3) g.lineTo(x, 23.5 + ((x / 3) % 2 ? -1.2 : 1.2)); g.stroke();
        E(g, 4.8, 24.5, 1.8, 1.6, '#7b2c16'); E(g, 35.2, 24.5, 1.8, 1.6, '#7b2c16');
        R(g, 19, 18, 1.4, 2.5, '#ff8a1e'); R(g, 23, 18, 1.4, 2.5, '#ff8a1e');
        E(g, 21, 13.5, 7.6, 6.6, '#ffcc2e'); E(g, 22.5, 16, 4.8, 3.4, '#fff0a6');
        eye(g, 25.2, 11.6, 2.7); E(g, 24.6, 15, 1.4, 0.9, '#ff9aa2');
        P(g, [27.8, 12.4, 33.2, 13.8, 27.8, 15.4], '#ff8a1e');
        E(g, 17.5, 13 + WING_Y[f], 5, 2.8, '#eea21a', WING_A[f]);
        P(g, [13.5, 11, 10, 8.5, 14.5, 14], '#eea21a');
      } },
    { id: 'moon', name: 'Moon Boi', tag: 'One direction only: up.', price: 0, puff: '#ff9d2e', trail: 'flame',
      draw(g, f) {
        const L = [7, 10, 8, 11][f];
        P(g, [8, 20.2, 8 - L, 23.5, 8, 26.8], '#ff6a1c'); P(g, [8, 21.6, 8 - L * 0.55, 23.5, 8, 25.4], '#ffe14d');
        P(g, [11, 19, 6.5, 14.5, 15, 19.4], '#ff4d4d'); P(g, [11, 28, 6.5, 32, 15, 27.6], '#ff4d4d');
        E(g, 19.5, 23.5, 12.5, 5.2, '#eef1f8'); E(g, 19.5, 25.6, 11, 2.6, '#c6ccdb');
        P(g, [30.5, 19.6, 38, 23.5, 30.5, 27.4], '#ff4d4d');
        R(g, 13, 22.5, 2, 2, '#ff4d4d'); E(g, 25, 23.5, 2.4, 2.4, '#58c4ff');
        E(g, 19, 14.5, 6.2, 5.6, '#4fb3ff'); E(g, 20.4, 16.6, 3.6, 2.4, '#d6f1ff');
        eye(g, 22, 12.8, 2.4); P(g, [24.6, 13.6, 28.6, 14.8, 24.6, 16], '#ffb21e');
        E(g, 15.6, 15 + WING_Y[f] * 0.6, 3.6, 2.2, '#2f8de0', WING_A[f]);
        g.strokeStyle = '#c9f6ff'; g.lineWidth = 1.2; g.beginPath(); g.arc(19.2, 13.4, 8.2, Math.PI * 0.92, Math.PI * 2.08); g.stroke();
        R(g, 14, 7.5, 2, 1, '#ffffff');
      } },
    { id: 'duck', name: 'Debug Duck', tag: 'Explains your bug back to you.', price: 0, puff: '#bfefff',
      draw(g, f) {
        P(g, [9, 17, 4.5, 12, 11, 20], '#f4bd25');
        E(g, 19, 20.5, 10.5, 7.2, '#ffd84a'); E(g, 18, 24, 8, 3.2, '#f2b324');
        E(g, 26.5, 11.5, 6.3, 6.1, '#ffd84a');
        P(g, [31, 11.5, 37.5, 13, 31.5, 15.6], '#ff8c1a'); R(g, 31.5, 13.4, 5, 0.8, '#d4620a');
        eye(g, 28.2, 9.8, 2.4); E(g, 27.5, 14, 1.4, 0.9, '#ff9aa2');
        E(g, 16.5, 18.5 + WING_Y[f], 5.6, 3.2, '#f5c22e', WING_A[f] * 0.7);
        R(g, 21, 3.5, 3, 3, '#2d2d3a'); R(g, 20, 5.5, 5, 1.5, '#2d2d3a');
      } },
    { id: 'pigeon', name: 'Pigeonardo Bombardini', tag: 'Half pigeon. Half bomber. All brainrot.', price: 30, puff: '#c9ced8', trail: 'smoke',
      draw(g, f) {
        P(g, [10, 16, 4, 10, 12, 18], '#5d6b2f'); P(g, [10, 21, 4, 26, 12, 19.6], '#5d6b2f');
        RR(g, 9, 17.4, 22, 3.2, 1, '#6f7f39'); R(g, 11, 17.4, 18, 1, '#93a556');
        E(g, 20, 19, 11, 6, '#9aa3b5'); E(g, 18, 21.5, 8, 2.8, '#b7bfcd');
        E(g, 27, 15, 4.6, 4, '#3fb68f'); E(g, 27.6, 13.4, 3.6, 2.4, '#8b5cf6');
        E(g, 30.2, 10.8, 4.6, 4.1, '#a9b1c2'); E(g, 31.2, 9.8, 1.8, 1.8, '#ff8a1e'); R(g, 31, 9.2, 1.2, 1.4, OUTL);
        P(g, [33.8, 10.4, 38, 11.6, 33.8, 12.8], '#3a3340'); E(g, 34, 10.2, 1.1, 0.8, '#eef0f4');
        E(g, 15, 21.8, 2.6, 2, '#4a5528');
        const pl = [6, 1.5, 6, 1.5][f]; R(g, 12, 21.8 - pl / 2, 1.4, pl, '#e6e6e6');
        E(g, 21, 26.6, 3.3, 1.8, '#2b2b2b'); P(g, [17.5, 26.6, 15.6, 25, 15.6, 28.2], '#2b2b2b');
        E(g, 19, 18.2, 1.7, 1.7, '#ffffff'); E(g, 19, 18.2, 0.8, 0.8, '#e63946');
      } },
    { id: 'capy', name: 'Capy Copter', tag: 'Never stressed. Never landed.', price: 60, puff: '#ffe08a',
      draw(g, f) {
        RR(g, 7, 13.5, 24, 14, 7, '#a86b3c'); E(g, 18, 24.6, 9, 2.6, '#c48a55');
        E(g, 28.5, 17.5, 7, 6, '#a86b3c'); RR(g, 30, 16, 8.4, 7.2, 3, '#8a5530');
        R(g, 36.4, 17.4, 1.6, 1.6, '#2a160c'); R(g, 28.5, 15, 3, 1.2, '#2a160c');
        E(g, 25.6, 12.4, 2, 1.6, '#7a4a28'); R(g, 11, 26.5, 3, 2.5, '#7a4a28'); R(g, 24, 26.5, 3, 2.5, '#7a4a28');
        E(g, 26.5, 11, 5.4, 2.6, '#ff4d4d'); P(g, [26.5, 8.4, 31.9, 11, 26.5, 11], '#ffd43b'); P(g, [21.1, 11, 26.5, 8.4, 26.5, 11], '#3aa0ff');
        R(g, 26, 4.8, 1.2, 4, '#3a3340');
        const bw = [8, 3, 8, 3][f]; R(g, 26.6 - bw, 3.8, bw * 2, 1.6, '#ffd43b');
        E(g, 13, 11, 3.2, 3, '#ff9f1c'); R(g, 13, 7.4, 1, 1.4, '#3f8f2f');
      } },
    { id: 'toast', name: 'Toastito', tag: 'Butter side up. Always.', price: 100, puff: '#f6d58e',
      draw(g, f) {
        E(g, 9, 13 + WING_Y[f], 7, 3, '#ffffff', -WING_A[f] - 0.3);
        RR(g, 11, 10, 21, 19, 4, '#b8692c'); E(g, 15.5, 11, 5.4, 4, '#b8692c'); E(g, 27.5, 11, 5.4, 4, '#b8692c');
        RR(g, 13, 12, 17, 15, 3, '#f3c97a'); E(g, 16, 12.6, 3.8, 2.6, '#f3c97a'); E(g, 27, 12.6, 3.8, 2.6, '#f3c97a');
        R(g, 17.5, 13.5, 8, 5, '#ffe066'); R(g, 18.5, 13.5, 4, 1, '#fff6c2');
        R(g, 16, 19.5, 2, 2.6, OUTL); R(g, 25, 19.5, 2, 2.6, OUTL);
        g.strokeStyle = OUTL; g.lineWidth = 1; g.beginPath(); g.moveTo(19, 23.5); g.lineTo(21.5, 25); g.lineTo(24, 23.5); g.stroke();
        E(g, 15, 23, 1.4, 0.9, '#ff9aa2'); E(g, 28, 23, 1.4, 0.9, '#ff9aa2');
        E(g, 32, 15 + WING_Y[f], 6, 2.6, '#ffffff', WING_A[f] + 0.2);
      } },
    { id: 'gull', name: 'Chad Gull', tag: 'Steals fries. Steals hearts.', price: 150, puff: '#ffffff',
      draw(g, f) {
        P(g, [9, 16, 3, 13, 9, 21], '#9aa6b8');
        E(g, 19, 19, 11, 6.5, '#f4f6fb'); E(g, 18, 22.5, 9, 2.6, '#dfe4ee');
        E(g, 28, 12.5, 6.2, 5.8, '#ffffff');
        P(g, [32.5, 12.5, 39, 14, 32.5, 15.6], '#ffcc2e'); R(g, 36.5, 14.2, 1.4, 1.4, '#e63946');
        RR(g, 24.5, 10, 10, 3, 1, '#111111'); R(g, 25.5, 10.4, 2.4, 1, '#5cc8ff'); R(g, 30.6, 10.4, 2.4, 1, '#5cc8ff');
        g.strokeStyle = '#ffcc2e'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(23.6, 16.4); g.quadraticCurveTo(27.5, 20.6, 31.6, 17.2); g.stroke();
        R(g, 27, 19, 2, 2, '#ffcc2e');
        E(g, 16, 16 + WING_Y[f], 9, 3.4, '#9aa6b8', WING_A[f] * 0.8);
        E(g, 9.5, 16 + WING_Y[f] * 1.4 + (f === 0 ? -2 : f === 2 ? 2 : 0), 3, 2, '#2b2f3a', WING_A[f] * 0.8);
        R(g, 17, 25.4, 1.4, 2.5, '#ff9f1c'); R(g, 21, 25.4, 1.4, 2.5, '#ff9f1c');
      } },
    { id: 'brick', name: 'Flying Brick', tag: 'Physics said no. He said yes.', price: 0, unlock: 25, puff: '#d9a07a',
      draw(g, f) {
        E(g, 13, 11 + WING_Y[f], 7, 3, '#e8e8f0', -0.3 + WING_A[f]);
        RR(g, 7, 12, 27, 14, 1.5, '#c2452d'); R(g, 8, 12, 25, 1.4, '#e3694f'); R(g, 8, 24.4, 25, 1.4, '#962f1e');
        R(g, 7, 18.4, 27, 1, '#e9d6c2'); R(g, 15, 12, 1, 6.4, '#e9d6c2'); R(g, 26, 12, 1, 6.4, '#e9d6c2'); R(g, 20, 19.4, 1, 6.4, '#e9d6c2');
        R(g, 24.5, 15, 2.2, 2.2, OUTL); R(g, 29.5, 15, 2.2, 2.2, OUTL); R(g, 23.5, 13.6, 4, 0.9, OUTL); R(g, 28.5, 13.6, 4, 0.9, OUTL);
        E(g, 19, 13.5 + WING_Y[f], 6.5, 2.6, '#ffffff', -0.2 + WING_A[f]);
      } }
  ];
  CHARS.forEach((c) => { c.frames = [0, 1, 2, 3].map((f) => pixelize(mk(40, 32, (g) => c.draw(g, f)))); });

  // ---------------------------------------------------------------- maps
  function cloudBlob(g, x, y, s, top, shade) {
    E(g, x, y + s * 0.35, s * 1.9, s * 0.5, shade); E(g, x - s * 0.9, y + s * 0.15, s * 0.8, s * 0.6, top);
    E(g, x, y, s, s * 0.75, top); E(g, x + s, y + s * 0.15, s * 0.85, s * 0.6, top);
  }
  function wrapX(w, fn) { for (const dx of [-w, 0, w]) fn(dx); }

  const MAPS = [
    { id: 'cloud', name: 'Cloud Nine', desc: 'Blue skies, marble pillars, ancient vibes. The warm-up.', death: 'OUCH!', deathCol: '#ffd23f',
      words: ['+1', 'NICE', 'WOW', 'CLEAN', 'SMOOTH'], coin: '#ffd23f', moveFrom: 14, tempo: 118, scale: [0, 2, 4, 7, 9, 12], root: 60,
      build() {
        const L = {};
        L.sky = mk(W, H, (g) => {
          const gr = g.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, '#47b9ff'); gr.addColorStop(0.7, '#a6e4ff'); gr.addColorStop(1, '#d6f5ff');
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
          E(g, 206, 84, 30, 30, 'rgba(255,250,210,.35)'); E(g, 206, 84, 21, 21, '#fff7c9'); E(g, 206, 84, 17, 17, '#fffbe6');
        });
        L.far = pixelize(mk(W * 2, H, (g) => {
          const r = rng(11);
          for (let i = 0; i < 9; i++) { const x = r() * W * 2, y = 40 + r() * (GY - 220), s = 9 + r() * 12; wrapX(W * 2, (dx) => cloudBlob(g, x + dx, y, s, '#ffffff', '#d8f1ff')); }
        }), false);
        L.mid = pixelize(mk(W * 2, H, (g) => {
          const r = rng(5);
          g.fillStyle = '#9fe08e'; g.beginPath(); g.moveTo(0, GY);
          for (let x = 0; x <= W * 2; x += 6) g.lineTo(x, GY - 52 - 22 * Math.sin(x / W * Math.PI * 4) - 8 * Math.sin(x / 23));
          g.lineTo(W * 2, GY); g.fill();
          for (let i = 0; i < 14; i++) { const x = r() * W * 2; wrapX(W * 2, (dx) => { E(g, x + dx, GY - 26 - r() * 6, 7, 9, '#5fbf55'); R(g, x + dx - 1, GY - 22, 2, 8, '#7a5534'); }); }
          g.fillStyle = '#76cf63'; g.beginPath(); g.moveTo(0, GY);
          for (let x = 0; x <= W * 2; x += 6) g.lineTo(x, GY - 22 - 10 * Math.sin(x / W * Math.PI * 6 + 1));
          g.lineTo(W * 2, GY); g.fill();
        }), false);
        L.ground = mk(48, GROUND, (g) => {
          R(g, 0, 0, 48, GROUND, '#e0a565'); R(g, 0, 0, 48, 10, '#79d957'); R(g, 0, 10, 48, 3, '#55b53b'); R(g, 0, 0, 48, 2, '#b4f08f');
          for (let i = 0; i < 4; i++) P(g, [i * 12, 13, i * 12 + 6, 13, i * 12 + 18, GROUND, i * 12 + 12, GROUND], '#d0904f');
          R(g, 6, 4, 2, 2, '#ff6b9a'); R(g, 30, 6, 2, 2, '#fff38a');
        });
        return L;
      },
      bg(c, L, sx, t) {
        c.drawImage(L.sky, 0, 0);
        tile(c, L.far, sx * 0.12 + t * 4); tile(c, L.mid, sx * 0.35);
      },
      pillar(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 7 : 1));
        const sx = x + 5, sw = PW - 10;
        R(c, sx, y0, sw, y1 - y0, '#f4eee2'); R(c, sx, y0, 3, y1 - y0, '#ffffff'); R(c, sx + sw - 6, y0, 6, y1 - y0, '#d6cab3');
        for (let fx = sx + 6; fx < sx + sw - 7; fx += 5) R(c, fx, y0, 1, y1 - y0, '#e0d6c3');
        c.strokeStyle = OUTL; c.lineWidth = 1; c.strokeRect(sx + 0.5, y0 - 1, sw - 1, y1 - y0 + 2);
        for (let i = 0; i < 5; i++) {
          const ly = y0 + 18 + r() * Math.max(1, y1 - y0 - 36), lx = r() < 0.5 ? sx - 1 : sx + sw - 3;
          E(c, lx, ly, 3, 2, '#3fa34d'); E(c, lx + 2, ly + 3, 2.4, 1.6, '#59c25f');
        }
        const cy = top ? y1 - 12 : y0;
        R(c, x, cy, PW, 12, '#efe6d2'); R(c, x, cy + (top ? 9 : 0), PW, 3, '#e8b84a'); R(c, x + 2, cy + (top ? 1 : 4), PW - 4, 2, '#fff8ea');
        E(c, x + 5, cy + 6, 3, 3, '#d5c8ae'); E(c, x + PW - 5, cy + 6, 3, 3, '#d5c8ae'); R(c, x + 5, cy + 5, 1, 1, OUTL); R(c, x + PW - 6, cy + 5, 1, 1, OUTL);
        c.strokeRect(x + 0.5, cy + 0.5, PW - 1, 11);
      },
      ground(c, L, sx) { tile(c, L.ground, sx, GY, 48); }
    },
    { id: 'code', name: 'Claude Code', desc: 'Fly through a live terminal. Stacked windows. Every pass is a commit.', death: 'SEGFAULT', deathCol: '#ff7a59',
      words: ['+1 COMMIT', 'LGTM', 'SHIPPED', 'TESTS OK', 'MERGED', 'NO BUGS'], coin: '#ff9b6a', moveFrom: 12, tempo: 96, scale: [0, 3, 5, 7, 10, 12], root: 57,
      build() {
        const L = {};
        L.sky = mk(W, H, (g) => {
          const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#120f0d'); gr.addColorStop(1, '#2a1f19');
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
          g.globalAlpha = 0.07; g.fillStyle = '#d97757';
          for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
          g.globalAlpha = 1;
          E(g, 135, GY - 150, 70, 70, 'rgba(217,119,87,.07)'); E(g, 135, GY - 150, 44, 44, 'rgba(217,119,87,.07)');
        });
        const r = rng(9);
        L.cols = []; for (let i = 0; i < 28; i++) L.cols.push({ x: i * 10 + 3, sp: 18 + r() * 40, ph: r() * 600, len: 5 + (r() * 10 | 0), seed: r() * 1e6 | 0 });
        L.ground = mk(64, GROUND, (g) => {
          R(g, 0, 0, 64, GROUND, '#16120f'); R(g, 0, 0, 64, 2, '#d97757'); R(g, 0, 2, 64, 1, '#6b3a29');
          for (let i = 0; i < 64; i += 8) R(g, i, 8, 4, 1, '#3a2d25');
        });
        return L;
      },
      bg(c, L, sx, t) {
        c.drawImage(L.sky, 0, 0);
        c.font = '8px ' + FONT; c.textBaseline = 'top';
        const glyphs = '{}()<>=;/$#*+01[]';
        for (const col of L.cols) {
          const head = ((t * col.sp + col.ph) % (GY + col.len * 9)) - col.len * 9;
          const r = rng(col.seed + ((t * col.sp / 9) | 0));
          for (let k = 0; k < col.len; k++) {
            const y = head - k * 9; if (y < -8 || y > GY) continue;
            c.fillStyle = k === 0 ? '#ffd2b8' : k < 3 ? 'rgba(217,119,87,.55)' : 'rgba(217,119,87,' + (0.32 - k * 0.025) + ')';
            c.fillText(glyphs[(r() * glyphs.length) | 0], ((col.x - sx * 0.2) % W + W) % W, y);
          }
        }
      },
      pillar(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 3 : 9));
        R(c, x, y0, PW, y1 - y0, '#1f1a17');
        const cols = ['#d97757', '#ecc8a2', '#8fc27f', '#7aa8f5', '#a39589', '#c792ea'];
        const tb = top ? y1 - 11 : y0;
        if (top) { for (let yy = y1 - 17; yy > y0; yy -= 6) codeLine(c, r, cols, x, yy); }
        else { for (let yy = y0 + 15; yy < y1; yy += 6) codeLine(c, r, cols, x, yy); }
        R(c, x, tb, PW, 11, '#2f2722'); R(c, x, top ? tb : tb + 10, PW, 1, '#d97757');
        E(c, x + 6, tb + 5.5, 2, 2, '#ff5f57'); E(c, x + 12, tb + 5.5, 2, 2, '#febc2e'); E(c, x + 18, tb + 5.5, 2, 2, '#28c840');
        if (((now * 2) | 0) % 2) R(c, x + 34, tb + 3, 4, 6, '#d97757');
        c.strokeStyle = '#d97757'; c.lineWidth = 1; c.strokeRect(x + 0.5, y0 - 1, PW - 1, y1 - y0 + 2);
        c.strokeStyle = OUTL; c.strokeRect(x - 0.5, y0 - 2, PW + 1, y1 - y0 + 4);
      },
      ground(c, L, sx) {
        tile(c, L.ground, sx, GY, 64);
        c.font = '8px ' + FONT; c.textBaseline = 'top'; c.fillStyle = '#d97757';
        c.fillText('> claude --fly', 10, GY + 18);
        if (((now * 2) | 0) % 2) R(c, 10 + 8 * 14 + 2, GY + 17, 6, 9, '#d97757');
        c.fillStyle = '#7f6a5d'; c.fillText('score: ' + (game ? game.score : 0) + ' commits', 10, GY + 36);
      }
    },
    { id: 'city', name: 'Wasted City', desc: 'Neon sunset, palm trees, rooftops. Keep flying and the stars pile up.', death: 'WASTED', deathCol: '#d9263a',
      words: ['+$100', 'RESPECT +', 'SMOOTH', 'NO COPS', 'STYLE'], coin: '#7dffb0', moveFrom: 12, tempo: 104, scale: [0, 3, 5, 7, 8, 12], root: 53,
      build() {
        const L = {};
        L.sky = mk(W, H, (g) => {
          const gr = g.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, '#16083a'); gr.addColorStop(0.45, '#6a1d74'); gr.addColorStop(0.78, '#e2416e'); gr.addColorStop(1, '#ffb347');
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
          const r = rng(3); for (let i = 0; i < 40; i++) R(g, r() * W, r() * GY * 0.4, 1, 1, 'rgba(255,255,255,' + (0.3 + r() * 0.6) + ')');
          const sy = GY - 120, sr = 58;
          const sg = g.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, '#fff07a'); sg.addColorStop(0.55, '#ff8a3d'); sg.addColorStop(1, '#ff2e7e');
          g.fillStyle = sg; g.beginPath(); g.arc(135, sy, sr, 0, Math.PI * 2); g.fill();
          for (let k = 0; k < 7; k++) { const yy = sy + 6 + k * 8; g.clearRect(0, yy, W, 2 + k * 0.6); }
          const g2 = g.createLinearGradient(0, 0, 0, GY); g2.addColorStop(0, '#16083a'); g2.addColorStop(0.45, '#6a1d74'); g2.addColorStop(0.78, '#e2416e'); g2.addColorStop(1, '#ffb347');
          g.globalCompositeOperation = 'destination-over'; g.fillStyle = g2; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
        });
        L.far = mk(W * 2, H, (g) => {
          const r = rng(21); let x = 0;
          while (x < W * 2) {
            const w = 14 + r() * 26, h = 40 + r() * 110;
            R(g, x, GY - h, w, h, '#3a1456');
            for (let wy = GY - h + 5; wy < GY - 6; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (r() < 0.25) R(g, wx, wy, 2, 2, r() < 0.5 ? '#ff7ad9' : '#ffd36e');
            x += w + 1;
          }
        });
        L.mid = pixelize(mk(W * 2, H, (g) => {
          const r = rng(8);
          for (let i = 0; i < 7; i++) {
            const x0 = 30 + i * 78 + r() * 30, hh = 70 + r() * 50;
            wrapX(W * 2, (dx) => {
              const bx = x0 + dx; g.strokeStyle = '#1a0830'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, GY); g.quadraticCurveTo(bx + 6, GY - hh * 0.5, bx + 12, GY - hh); g.stroke();
              for (let k = 0; k < 6; k++) { const a = -Math.PI * 0.95 + k * 0.42; E(g, bx + 12 + Math.cos(a) * 11, GY - hh + Math.sin(a) * 6 + 4, 11, 2.6, '#1a0830', a); }
            });
          }
        }), false);
        L.ground = mk(48, GROUND, (g) => {
          R(g, 0, 0, 48, GROUND, '#1f1830'); R(g, 0, 0, 48, 8, '#5b4a7a'); R(g, 0, 8, 48, 2, '#2c2340');
          R(g, 4, 30, 22, 3, '#ffd23f'); R(g, 0, GROUND - 6, 48, 6, '#17121f');
        });
        return L;
      },
      bg(c, L, sx, t) { c.drawImage(L.sky, 0, 0); tile(c, L.far, sx * 0.15); tile(c, L.mid, sx * 0.4); },
      pillar(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 5 : 2));
        R(c, x + 2, y0, PW - 4, y1 - y0, '#2b1846'); R(c, x + PW - 9, y0, 7, y1 - y0, '#1f1036');
        const lit = ['#ffd36e', '#ff7ad9', '#5ef2ff'];
        const st = top ? y1 - 16 : y0 + 12;
        for (let wy = st; top ? wy > y0 - 6 : wy < y1; wy += top ? -8 : 8) for (let wx = x + 7; wx < x + PW - 9; wx += 7) R(c, wx, wy, 4, 5, r() < 0.42 ? lit[(r() * 3) | 0] : '#3c2463');
        const ey = top ? y1 - 5 : y0;
        R(c, x, ey, PW, 5, '#4a2c75');
        const neon = p.seed % 2 ? '#ff3df0' : '#38e0ff';
        const ny = top ? y1 - 11 : y0 + 7;
        c.globalAlpha = 0.35 + 0.25 * Math.sin(now * 6 + p.seed); R(c, x + 2, ny - 2, PW - 4, 6, neon); c.globalAlpha = 1;
        R(c, x + 4, ny, PW - 8, 2, neon);
        c.strokeStyle = OUTL; c.lineWidth = 1; c.strokeRect(x + 0.5, y0 - 1, PW - 1, y1 - y0 + 2);
      },
      ground(c, L, sx) { tile(c, L.ground, sx, GY, 48); }
    },
    { id: 'moon', name: 'To The Moon', desc: 'Green candles, red candles. The rugs move. Only up from here.', death: 'RUGGED', deathCol: '#ea3943',
      words: ['+69%', 'PUMP', 'HODL', 'WAGMI', 'ATH', 'SEND IT'], coin: '#ffd23f', moveFrom: 3, tempo: 128, scale: [0, 2, 3, 7, 9, 12], root: 62,
      build() {
        const L = {};
        L.sky = mk(W, H, (g) => {
          const gr = g.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, '#05051a'); gr.addColorStop(0.6, '#191047'); gr.addColorStop(1, '#3a1f6e');
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
          E(g, 202, 92, 38, 38, 'rgba(230,224,255,.12)'); E(g, 202, 92, 30, 30, '#efeaff');
          E(g, 192, 84, 6, 6, '#d8d0f2'); E(g, 212, 102, 8, 7, '#d8d0f2'); E(g, 208, 78, 3, 3, '#d8d0f2'); E(g, 190, 104, 4, 3, '#d8d0f2');
          E(g, 52, 170, 11, 11, '#ff8fc7'); g.strokeStyle = '#ffd1ea'; g.lineWidth = 2; g.beginPath(); g.ellipse(52, 170, 19, 4, -0.3, 0, Math.PI * 2); g.stroke();
        });
        const r = rng(4); L.stars = []; for (let i = 0; i < 70; i++) L.stars.push([r() * W * 2, r() * (GY - 40), r() * 6, r() < 0.15 ? 2 : 1]);
        L.chart = mk(W * 2, H, (g) => {
          g.strokeStyle = 'rgba(22,199,132,.22)'; g.lineWidth = 2; g.beginPath(); const rr = rng(7); let y = GY - 60;
          for (let x = 0; x <= W * 2; x += 12) { y = clamp(y - 8 + rr() * 12 - (x > W * 1.9 ? 0 : 0), 140, GY - 30); g.lineTo(x, y); }
          g.stroke();
        });
        L.ground = mk(64, GROUND, (g) => {
          R(g, 0, 0, 64, GROUND, '#6c678c'); R(g, 0, 0, 64, 3, '#a39ec4'); R(g, 0, 3, 64, 2, '#58547a');
          E(g, 14, 22, 7, 3, '#58547a'); E(g, 14, 21, 6, 2, '#7a7599'); E(g, 44, 40, 9, 4, '#58547a'); E(g, 44, 39, 8, 3, '#7a7599');
          E(g, 52, 14, 3, 1.5, '#58547a');
        });
        return L;
      },
      bg(c, L, sx, t) {
        c.drawImage(L.sky, 0, 0);
        for (const s of L.stars) { const x = ((s[0] - sx * 0.05) % (W * 2) + W * 2) % (W * 2); if (x > W) continue; const tw = 0.5 + 0.5 * Math.sin(t * 3 + s[2]); R(c, x, s[1], s[3], s[3], 'rgba(255,255,255,' + (0.25 + tw * 0.75) + ')'); }
        tile(c, L.chart, sx * 0.2);
        const st = (t % 7) / 1.2; if (st < 1) { const x = 260 - st * 200, y = 30 + st * 70; c.strokeStyle = 'rgba(255,255,255,' + (1 - st) + ')'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y - 6); c.stroke(); }
      },
      pillar(c, x, y0, y1, top, p) {
        const green = ((p.seed >> 3) % 2 === 0) !== top;
        const body = green ? '#16c784' : '#ea3943', dark = green ? '#0b8d5b' : '#a8202e', light = green ? '#6ff2bd' : '#ff8d98';
        const bx = x + 5, bw = PW - 10;
        R(c, x + PW / 2 - 1, y0, 2, y1 - y0, dark);
        const wick = 8;
        const b0 = top ? y0 : y0 + wick, b1 = top ? y1 - wick : y1;
        R(c, bx, b0, bw, b1 - b0, body); R(c, bx, b0, 3, b1 - b0, light); R(c, bx + bw - 4, b0, 4, b1 - b0, dark);
        c.strokeStyle = OUTL; c.lineWidth = 1; c.strokeRect(bx + 0.5, b0 - (top ? 1 : 0) + 0.5, bw - 1, b1 - b0 - 1 + (top ? 1 : 0));
        R(c, x + PW / 2 - 2, top ? y1 - wick : y0, 4, wick, dark);
        c.font = '8px ' + FONT; c.textBaseline = 'top'; c.textAlign = 'center';
        const ty = top ? b1 - 14 : b0 + 6;
        c.fillStyle = OUTL; c.fillText(green ? 'PUMP' : 'RUG', x + PW / 2 + 1, ty + 1); c.fillStyle = '#ffffff'; c.fillText(green ? 'PUMP' : 'RUG', x + PW / 2, ty);
        c.textAlign = 'left';
      },
      ground(c, L, sx) { tile(c, L.ground, sx, GY, 64); }
    }
  ];

  function tile(c, img, off, y, w) {
    const lw = w || img.width;
    let o = -(((off % lw) + lw) % lw);
    for (; o < W; o += lw) c.drawImage(img, Math.round(o), y || 0);
  }
  function codeLine(c, r, cols, x, yy) {
    let xx = x + 5 + ((r() * 3) | 0) * 4, rem = x + PW - 5 - xx;
    while (rem > 4) { const w = Math.min(rem, 3 + ((r() * 11) | 0)); R(c, xx, yy, w, 2, cols[(r() * cols.length) | 0]); xx += w + 2; rem -= w + 2; if (r() < 0.25) break; }
  }

  // ---------------------------------------------------------------- audio (all synthesised)
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, master = null, musicGain = null, musicTimer = null, nextNote = 0, step = 0;
  const S = {
    char: store.get('char', 'wurst'), map: store.get('map', 'cloud'), coins: store.get('coins', 0),
    owned: store.get('owned', ['wurst', 'moon', 'duck']), best: store.get('best', {}), sound: store.get('sound', true),
    name: store.get('name', ''), bestAny: store.get('bestAny', 0)
  };
  function audio() {
    if (!AC) return;
    if (!ac) {
      ac = new AC(); master = ac.createGain(); master.gain.value = S.sound ? 0.5 : 0; master.connect(ac.destination);
      musicGain = ac.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    }
    if (ac.state === 'suspended') ac.resume();
    if (!musicTimer) { nextNote = ac.currentTime + 0.1; musicTimer = setInterval(schedule, 50); }
  }
  function tone(freq, dur, type, vol, slide, when, dest) {
    if (!ac) return;
    const t0 = when || ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function noise(dur, vol) {
    if (!ac) return;
    const b = ac.createBuffer(1, Math.max(1, ac.sampleRate * dur | 0), ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(master); s.start();
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SFX = {
    flap() { tone(420, 0.09, 'square', 0.05, 1.8); },
    score() { tone(988, 0.07, 'square', 0.05); tone(1319, 0.12, 'square', 0.05, 0, ac && ac.currentTime + 0.07); },
    coin() { tone(1568, 0.06, 'square', 0.04); tone(2093, 0.1, 'square', 0.04, 0, ac && ac.currentTime + 0.06); },
    power() { [0, 4, 7, 12].forEach((n, i) => tone(mtof(72 + n), 0.1, 'square', 0.05, 0, ac && ac.currentTime + i * 0.06)); },
    hit() { noise(0.22, 0.35); tone(150, 0.3, 'sawtooth', 0.12, 0.35); },
    shield() { tone(600, 0.2, 'triangle', 0.12, 2.2); noise(0.08, 0.15); },
    die() { tone(520, 0.6, 'triangle', 0.12, 0.25); },
    click() { tone(700, 0.04, 'square', 0.04); }
  };
  function schedule() {
    if (!ac || !S.sound) return;
    const m = mapObj(); const spb = 60 / m.tempo / 2;
    while (nextNote < ac.currentTime + 0.25) {
      const bar = (step >> 3) % 4, s = step % 8;
      const prog = [0, 5, 3, 4][bar];
      const sc = m.scale;
      if (s % 2 === 0) tone(mtof(m.root - 24 + sc[prog % sc.length]), spb * 1.6, 'triangle', 0.09, 0, nextNote, musicGain);
      if (game && game.state === 'play' || s % 2 === 1) {
        const n = sc[(prog + [0, 2, 4, 2, 5, 4, 2, 1][s]) % sc.length] + (s > 3 ? 12 : 0);
        tone(mtof(m.root + n), spb * 0.9, 'square', 0.022, 0, nextNote, musicGain);
      }
      if (s === 0 || s === 4) { const t0 = nextNote; setTimeout(() => { if (ac && S.sound && game && game.state === 'play') noise(0.03, 0.04); }, Math.max(0, (t0 - ac.currentTime) * 1000)); }
      nextNote += spb; step++;
    }
  }
  function setSound(on) {
    S.sound = on; store.set('sound', on); $('#btn-sound').textContent = on ? '♪' : '×';
    if (master) master.gain.value = on ? 0.5 : 0;
  }

  // ---------------------------------------------------------------- game state
  const charObj = () => CHARS.find((c) => c.id === S.char) || CHARS[0];
  const mapObj = () => MAPS.find((m) => m.id === S.map) || MAPS[0];
  let layers = {};
  function buildLayers() { layers = {}; for (const m of MAPS) layers[m.id] = m.build(); }

  let now = 0, game = null, menuScroll = 0;
  const parts = [], pops = [];

  function newGame() {
    game = {
      state: 'ready', t: 0, score: 0, coins: 0, speed: 112, scroll: 0, pillars: [], items: [], spawned: 0, lastCy: GY * 0.48,
      bird: { x: 74, y: GY * 0.45, vy: 0, rot: 0, ft: 0, f: 1, flapT: 0 }, shield: 0, magnet: 0, inv: 0, deadT: 0, shake: 0, flash: 0, overShown: false
    };
    parts.length = 0; pops.length = 0;
  }

  function spawnPillar() {
    const m = mapObj(), g = game, r = Math.random;
    const gap = Math.max(96, 134 - g.score * 0.85);
    const minC = 46 + gap / 2, maxC = GY - 34 - gap / 2;
    let cy = clamp(g.lastCy + (r() * 2 - 1) * 120, minC, maxC);
    g.lastCy = cy;
    const p = { x: W + 8, cy, gap, seed: (r() * 1e9) | 0, passed: false, amp: 0, ph: r() * 6.28, spd: 1.4 + r() * 1.2 };
    if (g.score >= m.moveFrom && r() < (m.id === 'moon' ? 0.75 : 0.5)) p.amp = Math.min(30, 10 + g.score * 0.5);
    g.pillars.push(p);
    g.spawned++;
    let kind = null;
    if (g.spawned % 11 === 6) kind = 'shield'; else if (g.spawned % 17 === 12) kind = 'magnet'; else if (r() < 0.75) kind = 'coin';
    if (kind) g.items.push({ kind, p, dx: PW / 2, dy: 0, got: false, x: 0, y: 0 });
  }
  const pcy = (p) => p.cy + (p.amp ? Math.sin(now * p.spd + p.ph) * p.amp : 0);

  function flap() {
    audio();
    if (!game) return;
    const b = game.bird;
    if (game.state === 'ready') { game.state = 'play'; }
    if (game.state !== 'play') return;
    b.vy = -372; b.flapT = 0.28; SFX.flap();
    const ch = charObj();
    for (let i = 0; i < 4; i++) parts.push({ x: b.x - 10, y: b.y + 4, vx: -40 - Math.random() * 50, vy: 20 + Math.random() * 40, life: 0.45, max: 0.45, c: ch.puff, s: 2 });
  }

  function burst(x, y, n, cols, spd) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = (spd || 120) * (0.3 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.6 + Math.random() * 0.4, max: 1, c: cols[i % cols.length], s: 2, g: 300 }); }
  }
  function pop(x, y, txt, col) { pops.push({ x, y, txt, col: col || '#ffffff', life: 0.9 }); }

  function hitRect(cx, cy, r, x, y, w, h) {
    const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h);
    return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
  }

  function die() {
    const g = game; if (g.state !== 'play') return;
    g.state = 'dead'; g.deadT = 0; g.shake = 0.35; g.flash = 0.18; SFX.hit(); setTimeout(() => SFX.die(), 250);
    burst(g.bird.x, g.bird.y, 22, [charObj().puff, '#ffffff', '#ff4fa3'], 160);
    S.coins += g.coins; store.set('coins', S.coins);
    const m = mapObj();
    const prev = S.best[m.id] || 0;
    g.newBest = g.score > prev;
    if (g.newBest) { S.best[m.id] = g.score; store.set('best', S.best); }
    if (g.score > S.bestAny) { S.bestAny = g.score; store.set('bestAny', S.bestAny); }
    updateCoins();
  }

  function update(dt) {
    now += dt;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.life -= dt; p.y -= 28 * dt; if (p.life <= 0) pops.splice(i, 1); }
    if (!game) { menuScroll += 60 * dt; return; }
    const g = game, b = g.bird, m = mapObj();
    g.t += dt; g.shake = Math.max(0, g.shake - dt); g.flash = Math.max(0, g.flash - dt);
    b.ft += dt * (b.flapT > 0 ? 18 : 9); b.flapT = Math.max(0, b.flapT - dt); b.f = (b.ft | 0) % 4;
    if (charObj().trail === 'flame' && g.state !== 'dead' && Math.random() < 0.7) parts.push({ x: b.x - 15, y: b.y + 6, vx: -60 - Math.random() * 40, vy: (Math.random() - 0.5) * 20, life: 0.3, max: 0.3, c: Math.random() < 0.5 ? '#ffb21e' : '#ff5a1e', s: 2 });
    if (charObj().trail === 'smoke' && g.state === 'play' && Math.random() < 0.25) parts.push({ x: b.x - 14, y: b.y + 4, vx: -50, vy: -10, life: 0.6, max: 0.6, c: 'rgba(200,205,215,.7)', s: 3 });
    if (g.state === 'ready') { g.scroll += g.speed * dt; b.y = GY * 0.45 + Math.sin(g.t * 5) * 5; b.rot = 0; return; }
    if (g.state === 'play') {
      g.speed = 112 + Math.min(50, g.score * 1.15);
      b.vy = Math.min(520, b.vy + 1350 * dt); b.y += b.vy * dt;
      if (b.y < 6) { b.y = 6; b.vy = 0; }
      b.rot += (clamp(b.vy / 520 * 1.25, -0.42, 1.35) - b.rot) * Math.min(1, dt * 10);
      g.scroll += g.speed * dt;
      g.inv = Math.max(0, g.inv - dt); g.magnet = Math.max(0, g.magnet - dt);
      const last = g.pillars[g.pillars.length - 1];
      if (!last || last.x < W - 158) spawnPillar();
      for (const p of g.pillars) {
        p.x -= g.speed * dt;
        const cy = pcy(p);
        if (!p.passed && p.x + PW < b.x) {
          p.passed = true; g.score++; SFX.score();
          if (Math.abs(b.y - cy) < 9) { g.coins++; pop(b.x, b.y - 22, 'PERFECT +1$', '#7dffb0'); }
          else if (g.score % 5 === 0 || Math.random() < 0.3) pop(b.x + 10, b.y - 20, m.words[(Math.random() * m.words.length) | 0], '#ffffff');
        }
        if (g.inv <= 0) {
          const hit = hitRect(b.x, b.y, 9, p.x + 2, -50, PW - 4, cy - p.gap / 2 + 50) || hitRect(b.x, b.y, 9, p.x + 2, cy + p.gap / 2, PW - 4, GY - cy - p.gap / 2);
          if (hit) {
            if (g.shield > 0) { g.shield = 0; g.inv = 1.1; SFX.shield(); burst(b.x, b.y, 14, ['#38e0ff', '#ffffff'], 140); pop(b.x, b.y - 20, 'SHIELD SAVED YOU', '#38e0ff'); }
            else { die(); break; }
          }
        }
      }
      g.pillars = g.pillars.filter((p) => p.x > -PW - 10);
      for (const it of g.items) {
        if (it.got) continue;
        it.x = it.p.x + it.dx; it.y = pcy(it.p) + it.dy;
        if (g.magnet > 0 && it.kind === 'coin') {
          const dx = b.x - it.x, dy = b.y - it.y, d = Math.hypot(dx, dy);
          if (d < 140) { it.dx += dx / d * 260 * dt; it.dy += dy / d * 260 * dt; it.x = it.p.x + it.dx; it.y = pcy(it.p) + it.dy; }
        }
        if (Math.hypot(b.x - it.x, b.y - it.y) < 15) {
          it.got = true;
          if (it.kind === 'coin') { g.coins++; SFX.coin(); burst(it.x, it.y, 6, [m.coin, '#ffffff'], 70); }
          else if (it.kind === 'shield') { g.shield = 1; SFX.power(); pop(b.x, b.y - 22, 'SHIELD!', '#38e0ff'); }
          else if (it.kind === 'magnet') { g.magnet = 8; SFX.power(); pop(b.x, b.y - 22, 'MAGNET!', '#ff4fa3'); }
        }
      }
      g.items = g.items.filter((it) => !it.got && it.p.x > -PW - 10);
      if (b.y > GY - 10) {
        if (g.shield > 0) { g.shield = 0; g.inv = 1.0; b.vy = -380; SFX.shield(); burst(b.x, b.y, 14, ['#38e0ff', '#ffffff'], 140); }
        else { b.y = GY - 10; die(); }
      }
    } else if (g.state === 'dead') {
      g.deadT += dt;
      b.vy = Math.min(620, b.vy + 1500 * dt); b.y = Math.min(GY - 10, b.y + b.vy * dt); b.rot = Math.min(1.57, b.rot + dt * 6);
      if (g.deadT > 0.8 && !g.overShown) { g.overShown = true; showOver(); }
    }
  }

  // ---------------------------------------------------------------- rendering
  function drawSprite(c, img, x, y, rot, scale) {
    c.save(); c.translate(Math.round(x), Math.round(y)); if (rot) c.rotate(rot); if (scale && scale !== 1) c.scale(scale, scale);
    c.drawImage(img, -20, -17); c.restore();
  }
  function outlinedText(c, txt, x, y, size, fill, align) {
    c.font = size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'top';
    const o = size >= 16 ? 2 : 1;
    c.fillStyle = OUTL;
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o], [0, o + 1]]) c.fillText(txt, x + dx, y + dy);
    c.fillStyle = fill; c.fillText(txt, x, y);
    c.textAlign = 'left';
  }
  function drawCoin(c, x, y, col, t) {
    const w = Math.max(1, Math.abs(Math.cos(t * 4)) * 6);
    E(c, x, y + 1, w + 1, 7.5, OUTL); E(c, x, y, w, 6.5, col); E(c, x, y, w * 0.55, 4, 'rgba(0,0,0,.18)');
    if (w > 3) { c.font = '8px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff'; c.fillText('$', x + 0.5, y + 1); c.textAlign = 'left'; }
    R(c, x - w * 0.5, y - 5, 1, 2, '#ffffff');
  }
  function drawPower(c, x, y, kind, t) {
    const bob = Math.sin(t * 5) * 2;
    if (kind === 'shield') {
      E(c, x, y + bob, 10, 10, 'rgba(56,224,255,.25)'); c.strokeStyle = '#38e0ff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y + bob, 9, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = OUTL; c.lineWidth = 1; c.beginPath(); c.arc(x, y + bob, 10.5, 0, Math.PI * 2); c.stroke();
      P(c, [x - 4, y - 4 + bob, x + 4, y - 4 + bob, x + 4, y + 1 + bob, x, y + 5 + bob, x - 4, y + 1 + bob], '#ffffff');
    } else {
      E(c, x, y + bob, 10, 10, 'rgba(255,79,163,.25)');
      c.lineWidth = 4; c.strokeStyle = OUTL; c.beginPath(); c.arc(x, y + bob - 1, 5, Math.PI, 0, true); c.stroke();
      c.lineWidth = 2.6; c.strokeStyle = '#ff4fa3'; c.beginPath(); c.arc(x, y + bob - 1, 5, Math.PI, 0, true); c.stroke();
      R(c, x - 6.3, y + bob - 4, 2.6, 3, '#ffffff'); R(c, x + 3.7, y + bob - 4, 2.6, 3, '#ffffff');
    }
  }

  function render() {
    const m = mapObj(), L = layers[m.id];
    const g = game;
    const sx = g ? g.scroll : menuScroll;
    ctx.save();
    if (g && g.shake > 0) ctx.translate((Math.random() - 0.5) * 6 * g.shake / 0.35, (Math.random() - 0.5) * 6 * g.shake / 0.35);
    m.bg(ctx, L, sx, now);
    if (g) {
      for (const p of g.pillars) {
        const cy = pcy(p);
        m.pillar(ctx, Math.round(p.x), -4, Math.round(cy - p.gap / 2), true, p);
        m.pillar(ctx, Math.round(p.x), Math.round(cy + p.gap / 2), GY, false, p);
      }
      for (const it of g.items) { if (it.kind === 'coin') drawCoin(ctx, it.x, it.y, m.coin, now + it.p.seed % 7); else drawPower(ctx, it.x, it.y, it.kind, now); }
    }
    m.ground(ctx, L, sx);
    for (const p of parts) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); R(ctx, Math.round(p.x), Math.round(p.y), p.s, p.s, p.c); }
    ctx.globalAlpha = 1;
    const ch = charObj();
    if (g) {
      const b = g.bird;
      if (!(g.inv > 0 && ((now * 16) | 0) % 2)) drawSprite(ctx, ch.frames[g.state === 'dead' ? 1 : b.f], b.x, b.y, b.rot);
      if (g.shield > 0) { ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now * 8); ctx.strokeStyle = '#38e0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 19, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      if (g.magnet > 0) { ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, 24 + (now * 40) % 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    } else {
      for (let i = 0; i < 3; i++) {
        const per = 9, tt = (now + i * per / 3) % per, k = Math.floor((now + i * per / 3) / per);
        const pc = CHARS[(k * 3 + i * 5) % CHARS.length];
        if (pc === ch) continue;
        const px = -30 + tt / per * (W + 60), py = 120 + i * 70 + Math.sin(now * 2 + i) * 10;
        ctx.globalAlpha = 0.9; drawSprite(ctx, pc.frames[((now * 10 + i) | 0) % 4], px, py, Math.sin(now * 2 + i) * 0.15); ctx.globalAlpha = 1;
      }
      const bob = Math.sin(now * 3) * 6;
      drawSprite(ctx, ch.frames[((now * 9) | 0) % 4], W / 2, GY - 190 + bob, 0, 2);
    }
    for (const p of pops) { ctx.globalAlpha = clamp(p.life * 2, 0, 1); outlinedText(ctx, p.txt, p.x, p.y, 8, p.col); }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (g) {
      if (g.state !== 'dead' || g.deadT < 0.8) outlinedText(ctx, String(g.score), W / 2, 44, 24, '#ffffff');
      if (m.id === 'city') {
        const stars = Math.min(5, Math.floor(g.score / 5));
        for (let i = 0; i < 5; i++) starIcon(ctx, W - 16 - i * 13, 46, i < stars);
        if (stars >= 3 && g.state === 'play') { const red = ((now * 4) | 0) % 2; const gr = ctx.createLinearGradient(0, 0, 30, 0); gr.addColorStop(0, red ? 'rgba(255,40,60,.35)' : 'rgba(40,120,255,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 30, GY); const g2 = ctx.createLinearGradient(W, 0, W - 30, 0); g2.addColorStop(0, red ? 'rgba(40,120,255,.35)' : 'rgba(255,40,60,.35)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(W - 30, 0, 30, GY); }
      }
      if (g.state === 'play' || g.state === 'ready') { drawCoin(ctx, 14, 82, m.coin, 0); outlinedText(ctx, '+' + g.coins, 24, 78, 8, '#ffffff', 'left'); }
      if (g.magnet > 0) { R(ctx, W / 2 - 30, 76, 60 * g.magnet / 8, 3, '#ff4fa3'); }
      if (g.state === 'ready') {
        outlinedText(ctx, 'GET READY', W / 2, GY * 0.25, 16, '#ffd23f');
        outlinedText(ctx, m.name.toUpperCase(), W / 2, GY * 0.25 + 26, 8, '#ffffff');
        const k = ((now * 2) | 0) % 2;
        outlinedText(ctx, k ? 'TAP / SPACE' : 'TO FLAP', W / 2, GY * 0.62, 8, '#ffffff');
        drawHand(ctx, W / 2 + 34, GY * 0.62 + 16 + (k ? 0 : 3));
      }
      if (g.state === 'dead') {
        if (m.id === 'city') { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'hsl(0,0%,50%)'; ctx.globalAlpha = clamp(g.deadT * 2, 0, 1); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        if (g.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (g.flash / 0.18) * 0.8 + ')'; ctx.fillRect(0, 0, W, H); }
      }
    }
  }
  function starIcon(c, x, y, on) {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 2.6 : 6; pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.lineWidth = 2; c.strokeStyle = OUTL; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.stroke();
    P(c, pts, on ? '#ffffff' : 'rgba(255,255,255,.18)');
  }
  function drawHand(c, x, y) {
    R(c, x - 1, y - 1, 8, 13, OUTL); R(c, x, y, 6, 11, '#ffe0c2'); R(c, x + 4, y + 4, 8, 11, OUTL); R(c, x + 5, y + 5, 6, 9, '#ffe0c2'); R(c, x - 2, y + 9, 14, 8, OUTL); R(c, x - 1, y + 10, 12, 6, '#ffe0c2');
  }

  // ---------------------------------------------------------------- logo + icons
  function drawLogo(g) {
    const w = g.canvas.width;
    g.clearRect(0, 0, w, g.canvas.height);
    g.font = '16px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'top';
    const tx = w / 2, ty = 16, txt = 'FLAPPENING';
    g.fillStyle = OUTL;
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 5; dy++) g.fillText(txt, tx + dx, ty + dy);
    g.fillStyle = '#a3300f'; g.fillText(txt, tx, ty + 3); g.fillStyle = '#d4511a'; g.fillText(txt, tx, ty + 2); g.fillText(txt, tx, ty + 1);
    const gr = g.createLinearGradient(0, ty, 0, ty + 16); gr.addColorStop(0, '#fff6a0'); gr.addColorStop(0.45, '#ffd23f'); gr.addColorStop(0.5, '#ffad1f'); gr.addColorStop(1, '#ff6a2b');
    g.fillStyle = gr; g.fillText(txt, tx, ty);
    g.font = '8px ' + FONT;
    const sub = 'FLAP. DIE. REPEAT.';
    g.fillStyle = OUTL; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 2], [1, 1], [-1, 1]]) g.fillText(sub, tx + dx, 46 + dy);
    g.fillStyle = '#ffffff'; g.fillText(sub, tx, 46);
    g.textAlign = 'left';
  }
  function coinIcon(c) { const g = c.getContext('2d'); g.clearRect(0, 0, 9, 9); E(g, 4.5, 4.5, 4.4, 4.4, OUTL); E(g, 4.5, 4.5, 3.4, 3.4, '#ffd23f'); R(g, 3, 2, 1, 2, '#fff6c2'); }

  // ---------------------------------------------------------------- UI
  const screens = ['menu', 'chars', 'maps', 'lb', 'over', 'pause'];
  function show(name) { for (const s of screens) $('#scr-' + s).classList.toggle('on', s === name); }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => (t.style.display = 'none'), 1600); }
  function updateCoins() { $('#coins').textContent = S.coins; }
  function refreshMenu() {
    $('#menu-char').textContent = charObj().name.toUpperCase();
    $('#menu-map').textContent = 'MAP: ' + mapObj().name.toUpperCase() + '   BEST: ' + (S.best[S.map] || 0);
  }
  function goMenu() { game = null; show('menu'); refreshMenu(); $('#btn-pause').style.visibility = 'hidden'; }
  function startGame() { audio(); newGame(); show(null); $('#btn-pause').style.visibility = 'visible'; }

  const previews = [];
  function buildChars() {
    const grid = $('#char-grid'); grid.innerHTML = ''; previews.length = 0;
    CHARS.forEach((c) => {
      const owned = S.owned.includes(c.id) || (c.unlock && S.bestAny >= c.unlock) || (!c.price && !c.unlock);
      const el = document.createElement('div'); el.className = 'card' + (S.char === c.id ? ' sel' : '') + (owned ? '' : ' locked');
      const cv = document.createElement('canvas'); cv.width = 60; cv.height = 40; cv.className = 'px'; el.appendChild(cv);
      previews.push({ cv, c });
      el.insertAdjacentHTML('beforeend', '<div class="nm sh">' + c.name.toUpperCase() + '</div><div class="tg">' + c.tag + '</div>');
      const st = document.createElement('div'); st.className = 'st';
      st.textContent = S.char === c.id ? 'FLYING' : owned ? 'SELECT' : c.unlock ? 'SCORE ' + c.unlock + ' TO UNLOCK' : 'BUY ' + c.price + ' $';
      el.appendChild(st);
      el.onclick = () => {
        SFX.click();
        if (owned) { S.char = c.id; store.set('char', c.id); buildChars(); refreshMenu(); return; }
        if (c.unlock) { toast('SCORE ' + c.unlock + ' ON ANY MAP'); return; }
        if (S.coins >= c.price) { S.coins -= c.price; S.owned.push(c.id); store.set('owned', S.owned); store.set('coins', S.coins); S.char = c.id; store.set('char', c.id); updateCoins(); SFX.power(); toast('UNLOCKED ' + c.name.toUpperCase()); buildChars(); refreshMenu(); }
        else toast('NEED ' + (c.price - S.coins) + ' MORE $');
      };
      grid.appendChild(el);
    });
  }
  function buildMaps() {
    const grid = $('#map-grid'); grid.innerHTML = '';
    MAPS.forEach((m) => {
      const el = document.createElement('div'); el.className = 'card mapcard' + (S.map === m.id ? ' sel' : '');
      const cv = document.createElement('canvas'); cv.width = 120; cv.height = 150; cv.className = 'px';
      mapThumb(cv, m);
      el.appendChild(cv);
      el.insertAdjacentHTML('beforeend', '<div class="info"><div class="nm sh">' + m.name.toUpperCase() + '</div><div class="tg">' + m.desc + '</div><div class="st" style="align-self:flex-start">' + (S.map === m.id ? 'SELECTED' : 'BEST ' + (S.best[m.id] || 0)) + '</div></div>');
      el.onclick = () => { SFX.click(); S.map = m.id; store.set('map', m.id); buildMaps(); refreshMenu(); };
      grid.appendChild(el);
    });
  }
  function mapThumb(cv, m) {
    const big = mk(W, H); const g = big.getContext('2d');
    const saved = now; now = 1.3;
    m.bg(g, layers[m.id], 40, 2.2);
    const p = { seed: 12345, cy: GY * 0.5, gap: 120 };
    m.pillar(g, 150, -4, GY * 0.5 - 60, true, p); m.pillar(g, 150, GY * 0.5 + 60, GY, false, p);
    m.ground(g, layers[m.id], 40);
    drawSprite(g, charObj().frames[0], 92, GY * 0.47, -0.2, 1);
    now = saved;
    const c2 = cv.getContext('2d'); c2.imageSmoothingEnabled = false;
    c2.drawImage(big, 30, GY - 290, 180, 300, 0, 0, 120, 150);
  }

  let lbMap = 'cloud', lbScope = 'local';
  function localLB(id) { const all = store.get('lb', {}); return all[id] || []; }
  async function buildLB() {
    $('#lb-tabs').innerHTML = '';
    MAPS.forEach((m) => {
      const b = document.createElement('button'); b.className = 'tab' + (lbMap === m.id ? ' on' : ''); b.textContent = m.name.toUpperCase();
      b.onclick = () => { lbMap = m.id; SFX.click(); buildLB(); }; $('#lb-tabs').appendChild(b);
    });
    $('#lb-scope').innerHTML = '';
    const scopes = CFG.leaderboardUrl ? ['global', 'local'] : ['local'];
    scopes.forEach((s) => { const b = document.createElement('button'); b.className = 'tab' + (lbScope === s ? ' on' : ''); b.textContent = s === 'global' ? 'WORLD' : 'THIS DEVICE'; b.onclick = () => { lbScope = s; buildLB(); }; $('#lb-scope').appendChild(b); });
    const list = $('#lb-list');
    let rows = [];
    if (lbScope === 'global' && CFG.leaderboardUrl) {
      list.innerHTML = '<div class="empty">LOADING...</div>';
      try { const r = await fetch(CFG.leaderboardUrl.replace(/\/$/, '') + '/top?map=' + lbMap); const j = await r.json(); rows = (j.scores || []).map((x) => ({ n: x.name, s: x.score, c: x.char })); }
      catch (e) { list.innerHTML = '<div class="empty">WORLD BOARD OFFLINE<br>TRY AGAIN LATER</div>'; return; }
    } else rows = localLB(lbMap);
    if (!rows.length) { list.innerHTML = '<div class="empty">NO SCORES YET.<br>BE THE FIRST<br>LEGEND HERE.</div>'; return; }
    list.innerHTML = rows.slice(0, 20).map((r, i) => {
      const cn = (CHARS.find((c) => c.id === r.c) || { name: '?' }).name.toUpperCase();
      return '<div class="lbrow"><div>' + (i + 1) + '</div><div>' + esc(r.n) + '<span class="ch">' + esc(cn) + '</span></div><div class="sc">' + r.s + '</div></div>';
    }).join('');
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function medalFor(s) { return s >= 80 ? ['#9ff3ff', '#38c7e8', 'DIAMOND'] : s >= 40 ? ['#ffe27a', '#e0a100', 'GOLD'] : s >= 20 ? ['#eef2fb', '#a7b0c5', 'SILVER'] : s >= 10 ? ['#ffb98a', '#c46a2b', 'BRONZE'] : null; }
  function drawMedal(cv, s) {
    const g = cv.getContext('2d'); g.clearRect(0, 0, 34, 34);
    const md = medalFor(s);
    if (!md) { E(g, 17, 17, 14, 14, '#2c1d55'); E(g, 17, 17, 10, 10, '#24164a'); g.font = '8px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#6c55b0'; g.fillText('?', 17, 18); return; }
    P(g, [9, 0, 15, 0, 17, 10, 11, 10], '#ff4fa3'); P(g, [25, 0, 19, 0, 17, 10, 23, 10], '#38e0ff');
    E(g, 17, 20, 13, 13, OUTL); E(g, 17, 20, 12, 12, md[1]); E(g, 17, 20, 9, 9, md[0]);
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 2.6 : 6; pts.push(17 + Math.cos(a) * rr, 20 + Math.sin(a) * rr); }
    P(g, pts, md[1]); R(g, 11, 14, 2, 2, '#ffffff');
    pixelize(cv);
  }

  function qualifies(id, score) { const l = localLB(id); return score > 0 && (l.length < 10 || score > l[l.length - 1].s); }
  function showOver() {
    const g = game, m = mapObj();
    $('#death-txt').textContent = m.death; $('#death-txt').style.color = m.deathCol;
    $('#o-score').textContent = g.score; $('#o-best').textContent = S.best[m.id] || 0; $('#o-coins').textContent = '+' + g.coins;
    $('#o-new').style.display = g.newBest && g.score > 0 ? 'block' : 'none';
    drawMedal($('#medal'), g.score);
    const q = qualifies(m.id, g.score) || (CFG.leaderboardUrl && g.score > 0);
    $('#o-save').style.display = q ? 'flex' : 'none';
    $('#o-name').value = S.name; $('#o-saveb').disabled = false; $('#o-saveb').textContent = 'SAVE SCORE';
    show('over');
    $('#btn-pause').style.visibility = 'hidden';
  }
  async function saveScore() {
    const g = game, m = mapObj();
    let n = ($('#o-name').value || '').toUpperCase().replace(/[^A-Z0-9 _.\-]/g, '').trim().slice(0, 12);
    if (!n) { toast('TYPE A NAME'); return; }
    S.name = n; store.set('name', n);
    const all = store.get('lb', {}); const l = all[m.id] || [];
    l.push({ n, s: g.score, c: S.char, d: Date.now() }); l.sort((a, b) => b.s - a.s); all[m.id] = l.slice(0, 10); store.set('lb', all);
    $('#o-saveb').disabled = true; $('#o-saveb').textContent = 'SAVED!';
    if (CFG.leaderboardUrl) {
      try { await fetch(CFG.leaderboardUrl.replace(/\/$/, '') + '/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ map: m.id, name: n, score: g.score, char: S.char }) }); toast('SENT TO WORLD BOARD'); }
      catch (e) { toast('SAVED ON THIS DEVICE'); }
    } else toast('SAVED TO LEADERBOARD');
    lbMap = m.id;
  }
  function share() {
    const g = game, m = mapObj();
    const txt = 'I just scored ' + g.score + ' in FLAPPENING as ' + charObj().name + ' on ' + m.name + '.\n\nYour turn.';
    const url = 'https://x.com/intent/post?text=' + encodeURIComponent(txt) + '&url=' + encodeURIComponent(CFG.shareUrl || location.href);
    window.open(url, '_blank', 'noopener');
  }

  // ---------------------------------------------------------------- layout
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const portrait = vh / vw > 1.45;
    const newH = portrait ? Math.round(clamp(W * vh / vw, 480, 600)) : 480;
    let aw, ah;
    if (portrait) { aw = vw; ah = aw * newH / W; if (ah > vh) { ah = vh; aw = ah * W / newH; } }
    else { ah = Math.min(vh - 96, 1100); aw = ah * W / newH; if (aw > vw) { aw = vw; ah = aw * newH / W; } }
    document.documentElement.style.setProperty('--aw', aw + 'px'); document.documentElement.style.setProperty('--ah', ah + 'px');
    app.style.setProperty('--u', (aw / W) + 'px');
    $('#side').style.display = portrait ? 'none' : 'block';
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; ctx.imageSmoothingEnabled = false; }
    if (newH !== H && (!game || game.state !== 'play')) {
      H = newH; GY = H - GROUND; cvs.width = W; cvs.height = H; ctx.imageSmoothingEnabled = false; buildLayers();
      if (game) newGame();
    }
  }

  // ---------------------------------------------------------------- input
  function onPress(e) {
    if (e.target.closest && e.target.closest('button,input,.card,.list,.tab')) return;
    if (game && (game.state === 'ready' || game.state === 'play')) { e.preventDefault(); flap(); }
  }
  app.addEventListener('pointerdown', onPress, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter') saveScore(); return; }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (game && (game.state === 'ready' || game.state === 'play')) flap();
      else if (!game && $('#scr-menu').classList.contains('on')) startGame();
      else if (game && game.state === 'dead' && game.overShown) startGame();
    }
    if ((e.code === 'KeyP' || e.code === 'Escape') && game && game.state === 'play') pause();
  });
  function pause() { if (!game || game.state !== 'play') return; game.state = 'paused'; show('pause'); }
  function resume() { if (game && game.state === 'paused') { game.state = 'play'; show(null); last = performance.now(); } }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  $('#btn-play').onclick = () => { SFX.click(); startGame(); };
  $('#btn-chars').onclick = () => { audio(); SFX.click(); buildChars(); show('chars'); };
  $('#btn-maps').onclick = () => { audio(); SFX.click(); buildMaps(); show('maps'); };
  $('#btn-lb').onclick = () => { audio(); SFX.click(); lbMap = S.map; buildLB(); show('lb'); };
  document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { SFX.click(); show('menu'); refreshMenu(); }));
  $('#o-retry').onclick = () => { SFX.click(); startGame(); };
  $('#o-menu').onclick = () => { SFX.click(); goMenu(); };
  $('#o-share').onclick = share;
  $('#o-saveb').onclick = saveScore;
  $('#p-resume').onclick = resume;
  $('#p-menu').onclick = goMenu;
  $('#btn-pause').onclick = (e) => { e.stopPropagation(); pause(); };
  $('#btn-sound').onclick = (e) => { e.stopPropagation(); audio(); setSound(!S.sound); };

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(t) {
    let dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!game || game.state !== 'paused') {
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (let i = 0; i < n; i++) update(dt / n);
    }
    render();
    for (const pv of previews) {
      if (!pv.cv.isConnected) continue;
      const g = pv.cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 60, 40);
      g.drawImage(pv.c.frames[((now * 9) | 0) % 4], 10, 4 + Math.round(Math.sin(now * 3 + pv.c.id.length) * 2));
    }
    requestAnimationFrame(frame);
  }

  async function boot() {
    try { await document.fonts.load('16px "Press Start 2P"'); await document.fonts.load('8px "Press Start 2P"'); } catch (e) { /* fallback font */ }
    layout(); buildLayers();
    drawLogo($('#logo').getContext('2d'));
    document.querySelectorAll('.coinico').forEach(coinIcon);
    updateCoins(); setSound(S.sound); refreshMenu();
    $('#btn-pause').style.visibility = 'hidden';
    window.addEventListener('resize', layout);
    requestAnimationFrame((t) => { last = t; frame(t); });
  }

  // exposed for tooling (screenshots / exports); harmless in play
  window.FLAP = {
    get state() { return game ? game.state : 'menu'; }, get score() { return game ? game.score : 0; },
    start: startGame, flap, show, buildChars, buildMaps, buildLB, setMap(id) { S.map = id; refreshMenu(); }, setChar(id) { S.char = id; refreshMenu(); },
    logo(scale) { const c = mk(200 * scale, 72 * scale); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage($('#logo'), 0, 0, 200 * scale, 72 * scale); return c.toDataURL(); },
    sprite(id, f, scale) { const ch = CHARS.find((c) => c.id === id); const c = mk(40 * scale, 32 * scale); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(ch.frames[f || 0], 0, 0, 40 * scale, 32 * scale); return c.toDataURL(); },
    cheat(v) { if (game) { game.score = v; } },
    get game() { return game; }, CHARS, MAPS, layers: () => layers, drawLogo, mk, pixelize, GY: () => GY
  };
  boot();
})();
