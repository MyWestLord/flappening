/* FLAPPENING — pick a meme, pick a world, flap.
   Everything (flyers, worlds, effects, sound) is drawn or synthesised in code. */
'use strict';
(() => {
  const W = 270, GROUND = 64, PW = 44, SC = 2;
  let H = 480, GY = H - GROUND;
  const OUTL = '#1b1030';
  const FONT = '"Press Start 2P", monospace';
  const CFG = window.FLAP_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const app = $('#app'), cvs = $('#game'), ctx = cvs.getContext('2d');
  const fx = $('#fx'), fxc = fx.getContext('2d');

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
  const ease = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const back = (u) => { u = clamp(u, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

  function E(g, x, y, rx, ry, c, rot) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); g.fill(); }
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function P(g, pts, c) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function RR(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }
  function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (fn) fn(g, c); return c; }
  const hexA = (h, a) => { h = h.replace('#', ''); return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')'; };
  function glow(c, x, y, r, col, a) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
  }

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

  const CHARS = window.FLYERS.build();

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
    { id: 'code', name: 'Claude Code', desc: 'Fly through a live Claude Code session. Tool calls, diffs, a spinner that never stops thinking.', death: 'INTERRUPTED', deathCol: '#d97757',
      words: ['+1 COMMIT', 'LGTM', 'SHIPPED', 'TESTS PASS', 'MERGED', 'NO BUGS', 'YOLO'], coin: '#d97757', moveFrom: 12, tempo: 96, scale: [0, 3, 5, 7, 10, 12], root: 57,
      build() {
        const L = {};
        L.sky = mk(W, H, (g) => {
          const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#121110'); gr.addColorStop(1, '#1c1a17');
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
        });
        L.log = mk(W * 2, 760 * 2, (g) => { g.scale(2, 2); drawTranscript(g, 760); });
        return L;
      },
      bg(c, L, sx, t) {
        c.drawImage(L.sky, 0, 0);
        const lh = 760, off = (t * 7 + sx * 0.04) % lh;
        c.globalAlpha = 0.3;
        for (let k = -1; k < Math.ceil(H / lh) + 1; k++) c.drawImage(L.log, 0, -off + k * lh, W, lh);
        c.globalAlpha = 1;
        const gr = c.createLinearGradient(0, 0, 0, 60); gr.addColorStop(0, 'rgba(18,17,16,1)'); gr.addColorStop(1, 'rgba(18,17,16,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, 60);
        glow(c, W * 0.5, GY - 120, 140, '#d97757', 0.06);
      },
      pillar(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 3 : 9));
        const kinds = ['Edit', 'Bash', 'Read', 'Write', 'Grep', 'Task'];
        const kind = kinds[(p.seed >> (top ? 2 : 5)) % kinds.length];
        glow(c, x + PW / 2, top ? y1 : y0, 40, '#d97757', 0.16);
        RR(c, x - 1, y0 - 3, PW + 2, y1 - y0 + 6, 3.5, '#0c0b0a');
        RR(c, x, y0 - 2, PW, y1 - y0 + 4, 3, '#3b3530');
        RR(c, x + 1, y0 - 1, PW - 2, y1 - y0 + 2, 2.5, '#24211e');
        const hy = top ? y1 - 12 : y0 + 2;
        R(c, x + 1, hy, PW - 2, 10, '#33281f'); R(c, x + 1, top ? hy : hy + 9.5, PW - 2, 0.5, '#d97757');
        const dotc = kind === 'Bash' ? '#7fd88f' : kind === 'Read' || kind === 'Grep' ? '#8bb3ff' : '#d97757';
        E(c, x + 6, hy + 5, 2, 2, dotc); glow(c, x + 6, hy + 5, 10, dotc, 0.35);
        c.font = '4px ' + FONT; c.textBaseline = 'top'; c.fillStyle = '#ece8e1'; c.fillText(kind, x + 11, hy + 3);
        c.fillStyle = '#8c8781'; c.fillText('()', x + 11 + kind.length * 4, hy + 3);
        const ly0 = top ? y1 - 18 : y0 + 15, step = top ? -6 : 6;
        let k = 0;
        for (let yy = ly0; top ? yy > y0 - 6 : yy < y1; yy += step, k++) {
          if (kind === 'Edit' || kind === 'Write') {
            const add = kind === 'Write' || (r() < 0.6);
            R(c, x + 2, yy, PW - 4, 5, add ? '#183420' : '#3a171d');
            c.fillStyle = add ? '#7fd88f' : '#ff8a96'; c.fillText(add ? '+' : '-', x + 3, yy + 0.5);
            let xx = x + 9; const n = 1 + (r() * 3 | 0);
            for (let q = 0; q < n && xx < x + PW - 6; q++) { const w = Math.min(x + PW - 4 - xx, 3 + r() * 10); R(c, xx, yy + 1.5, w, 2, add ? '#a9e7b4' : '#ffb3bb'); xx += w + 2; }
          } else if (kind === 'Read' || kind === 'Grep') {
            c.fillStyle = '#5d5953'; c.fillText(String((p.seed >> 3) % 90 + k + 1).padStart(2, ' ').slice(-2), x + 3, yy + 0.5);
            let xx = x + 13; const cols = ['#b392f0', '#8bb3ff', '#ece8e1', '#e5c07b', '#d97757'];
            while (xx < x + PW - 6) { const w = Math.min(x + PW - 4 - xx, 2 + r() * 8); R(c, xx, yy + 1.5, w, 2, cols[(r() * cols.length) | 0]); xx += w + 2; if (r() < 0.3) break; }
          } else {
            if (k === 0) { c.fillStyle = '#5d5953'; c.fillText('L', x + 3, yy + 0.5); }
            R(c, x + 9, yy + 1.5, 4 + r() * (PW - 18), 2, k % 4 === 0 ? '#7fd88f' : '#8c8781');
          }
        }
        if (kind === 'Task' && ((now * 2) | 0) % 2) R(c, x + PW - 7, hy + 2.5, 3, 5, '#d97757');
        c.strokeStyle = '#d97757'; c.lineWidth = 0.75; c.beginPath(); if (c.roundRect) c.roundRect(x + 0.25, y0 - 1.75, PW - 0.5, y1 - y0 + 3.5, 3); else c.rect(x, y0, PW, y1 - y0); c.stroke();
      },
      ground(c, L, sx) {
        R(c, 0, GY, W, GROUND, '#141312');
        R(c, 0, GY, W, 0.5, '#3a3632');
        const verbs = ['Flapping', 'Dodging', 'Clauding', 'Shipping', 'Vibing', 'Pondering', 'Gliding', 'Cooking', 'Tokenizing', 'Yeeting'];
        const vi = ((now / 2.2) | 0) % verbs.length, secs = game ? Math.floor(game.t) : Math.floor(now);
        spinStar(c, 9, GY + 7, now);
        c.font = '4px ' + FONT; c.textBaseline = 'top';
        const dots = '...'.slice(0, 1 + (((now * 3) | 0) % 3));
        c.fillStyle = '#e8936f'; c.fillText(verbs[vi] + dots, 15, GY + 5);
        const tk = game ? (game.score * 137 + game.coins * 21) : 0;
        c.fillStyle = '#8c8781'; c.fillText('(' + secs + 's · ' + (tk > 999 ? (tk / 1000).toFixed(1) + 'k' : tk) + ' tokens · esc to interrupt)', 15 + 4 * 13, GY + 5);
        c.strokeStyle = '#6f6a64'; c.lineWidth = 0.75; c.beginPath(); if (c.roundRect) c.roundRect(5.5, GY + 15.5, W - 11, 22, 3); else c.rect(5.5, GY + 15.5, W - 11, 22); c.stroke();
        c.fillStyle = '#ece8e1'; c.font = '8px ' + FONT; c.fillText('>', 11, GY + 23);
        c.font = '4px ' + FONT; c.fillStyle = '#6f6a64'; c.fillText('Try "fly through 100 pipes"', 24, GY + 25);
        if (((now * 2) | 0) % 2) R(c, 20, GY + 22, 2.5, 9, '#ece8e1');
        c.fillStyle = '#6f6a64'; c.fillText('? for shortcuts', 7, GY + 43);
        c.fillStyle = '#b392f0'; c.fillText('>> auto-flap off (shift+tab)', W - 7 - 4 * 28, GY + 43);
        c.fillStyle = '#4b4741'; c.fillText('~/flappening  ·  main  ·  ' + charObj().name.toLowerCase(), 7, GY + 52);
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
        R(c, x + 4, ny, PW - 8, 2, neon); glow(c, x + PW / 2, ny + 1, 30, neon, 0.28);
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
        R(c, x + PW / 2 - 2, top ? y1 - wick : y0, 4, wick, dark); glow(c, x + PW / 2, top ? y1 : y0, 26, body, 0.25);
        c.font = '8px ' + FONT; c.textBaseline = 'top'; c.textAlign = 'center';
        const ty = top ? b1 - 14 : b0 + 6;
        c.fillStyle = OUTL; c.fillText(green ? 'PUMP' : 'RUG', x + PW / 2 + 1, ty + 1); c.fillStyle = '#ffffff'; c.fillText(green ? 'PUMP' : 'RUG', x + PW / 2, ty);
        c.textAlign = 'left';
      },
      ground(c, L, sx) { tile(c, L.ground, sx, GY, 64); }
    }
  ];

  // ================================================================ brand worlds (parody levels, every mark is drawn in code)
  function rrPath(c, x, y, w, h, r) { if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function T(c, s, x, y, col, size) { c.font = (size || 4) + 'px ' + FONT; c.textBaseline = 'top'; c.textAlign = 'left'; c.fillStyle = col; c.fillText(s, x, y); return x + s.length * (size || 4); }
  function TC(c, s, x, y, col, size) { c.font = (size || 4) + 'px ' + FONT; c.textBaseline = 'top'; c.textAlign = 'center'; c.fillStyle = col; c.fillText(s, x, y); c.textAlign = 'left'; }
  const fmtK = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n));
  const pick = (a) => a[(Math.random() * a.length) | 0];
  // 2x canvases keep 4px text crisp
  function mk2(w, h, fn) { const img = mk(w * 2, h * 2, (g) => { g.scale(2, 2); fn(g); }); img.lw = w; img.lh = h; return img; }
  function tile2(c, img, off, y) { let o = -(((off % img.lw) + img.lw) % img.lw); for (; o < W; o += img.lw) c.drawImage(img, o, y || 0, img.lw, img.lh); }
  function vtile2(c, img, off) { const o = ((off % img.lh) + img.lh) % img.lh; for (let y = -o; y < H; y += img.lh) c.drawImage(img, 0, y, img.lw, img.lh); }
  function feedImg(draw) { const h = Math.ceil(draw(mk(4, 4).getContext('2d'))); return mk2(W, h, draw); }
  function tapeImg(segs) { const n = segs.reduce((a, s) => a + s[0].length, 0); return mk2(n * 4, 8, (g) => { let x = 0; for (const s of segs) x = T(g, s[0], x, 2, s[1]); }); }
  function heart(c, x, y, s, col) { E(c, x - s * 0.45, y - s * 0.25, s * 0.58, s * 0.58, col); E(c, x + s * 0.45, y - s * 0.25, s * 0.58, s * 0.58, col); P(c, [x - s * 0.98, y + s * 0.02, x + s * 0.98, y + s * 0.02, x, y + s], col); }
  function star5(c, x, y, r, col) { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } P(c, pts, col); }
  function topFade(c, col, h) { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, hexA(col, 1)); gr.addColorStop(1, hexA(col, 0)); c.fillStyle = gr; c.fillRect(0, 0, W, h); }
  function flyerDisc(c, x, y, r, bgc) {
    c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip(); R(c, x - r, y - r, r * 2, r * 2, bgc);
    const k = r / 8; c.drawImage(charObj().frames[0], x - 12.5 * k, y - 10 * k, 25 * k, 20 * k); c.restore();
  }

  // ---- marks
  function mkBinance(c, x, y, s, col) {
    c.fillStyle = col;
    const d = (cx, cy, r) => { c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath(); c.fill(); };
    d(x, y, s * 0.25); d(x - s * 0.76, y, s * 0.24); d(x + s * 0.76, y, s * 0.24);
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(x, y + k * s); c.lineTo(x + s * 0.61, y + k * s * 0.39); c.lineTo(x + s * 0.38, y + k * s * 0.16); c.lineTo(x, y + k * s * 0.54); c.lineTo(x - s * 0.38, y + k * s * 0.16); c.lineTo(x - s * 0.61, y + k * s * 0.39); c.closePath(); c.fill(); }
  }
  function mkKnot(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.strokeStyle = col; c.lineWidth = Math.max(0.6, s * 0.16);
    for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 3); c.beginPath(); rrPath(c, -s * 0.24, -s * 0.92, s * 0.76, s * 0.56, s * 0.28); c.stroke(); }
    c.restore();
  }
  function mkX(c, x, y, s, col, cut) {
    c.strokeStyle = col; c.lineWidth = Math.max(0.6, s * 0.15);
    c.beginPath(); c.moveTo(x + s * 0.9, y - s); c.lineTo(x - s * 0.92, y + s); c.stroke();
    P(c, [x - s, y - s, x - s * 0.4, y - s, x + s, y + s, x + s * 0.4, y + s], col);
    if (cut) {
      const dst = cut === 'cut'; if (dst) { c.save(); c.globalCompositeOperation = 'destination-out'; }
      P(c, [x - s * 0.72, y - s * 0.86, x - s * 0.48, y - s * 0.86, x + s * 0.72, y + s * 0.86, x + s * 0.48, y + s * 0.86], dst ? '#000' : cut);
      if (dst) c.restore();
    }
  }
  function mkNote(c, x, y, s, col) {
    c.strokeStyle = col; c.lineWidth = s * 0.34;
    const sx = x + s * 0.18, cy = y + s * 0.45, r = s * 0.44;
    c.beginPath(); c.arc(sx - r, cy, r, 0, Math.PI * 1.7); c.stroke();
    c.beginPath(); c.moveTo(sx, cy + 0.01); c.lineTo(sx, y - s * 0.98); c.stroke();
    c.beginPath(); c.arc(sx + s * 0.66, y - s * 0.98, s * 0.66, Math.PI, Math.PI * 0.5, true); c.stroke();
  }
  function mkTok(c, x, y, s, core) { mkNote(c, x - s * 0.09, y - s * 0.07, s, '#25f4ee'); mkNote(c, x + s * 0.09, y + s * 0.07, s, '#fe2c55'); mkNote(c, x, y, s, core || '#ffffff'); }
  function mkOcto(c, x, y, s, disc, cat) {
    E(c, x, y, s, s, disc);
    c.save(); c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.clip();
    const cut = cat === 'cut', k = cut ? '#000' : cat; if (cut) c.globalCompositeOperation = 'destination-out';
    E(c, x, y - s * 0.1, s * 0.56, s * 0.46, k);
    P(c, [x - s * 0.56, y - s * 0.1, x - s * 0.5, y - s * 0.68, x - s * 0.14, y - s * 0.46], k);
    P(c, [x + s * 0.56, y - s * 0.1, x + s * 0.5, y - s * 0.68, x + s * 0.14, y - s * 0.46], k);
    R(c, x - s * 0.21, y + s * 0.2, s * 0.42, s, k);
    c.strokeStyle = k; c.lineWidth = s * 0.11; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s * 0.2, y + s * 0.64); c.quadraticCurveTo(x - s * 0.42, y + s * 0.76, x - s * 0.52, y + s * 0.52); c.quadraticCurveTo(x - s * 0.58, y + s * 0.4, x - s * 0.72, y + s * 0.38); c.stroke();
    c.restore();
  }
  function mkGrok(c, x, y, s, col) {
    c.strokeStyle = col; c.lineWidth = s * 0.28;
    const a = -Math.PI / 4, gap = 0.32;
    c.beginPath(); c.arc(x, y, s * 0.66, a + gap, a + Math.PI - gap); c.stroke();
    c.beginPath(); c.arc(x, y, s * 0.66, a + Math.PI + gap, a + Math.PI * 2 - gap); c.stroke();
    const dx = Math.cos(a), dy = Math.sin(a), L = s * 1.25, w = s * 0.1;
    P(c, [x - dx * L, y - dy * L, x - dy * w, y + dx * w, x + dx * L, y + dy * L, x + dy * w, y - dx * w], col);
  }
  function mkPill(c, x, y, s, rot) {
    c.save(); c.translate(x, y); c.rotate(rot == null ? -Math.PI / 4 : rot);
    const w = s * 2, h = s * 0.95;
    RR(c, -w / 2 - 1, -h / 2 - 1, w + 2, h + 2, h / 2 + 1, '#12382b');
    c.save(); c.beginPath(); rrPath(c, -w / 2, -h / 2, w, h, h / 2); c.clip();
    R(c, -w / 2, -h / 2, w / 2, h, '#5fd68a'); R(c, 0, -h / 2, w / 2, h, '#f6faf8');
    R(c, -w / 2, h * 0.12, w / 2, h * 0.4, '#3fb873'); R(c, 0, h * 0.12, w / 2, h * 0.4, '#d3dedb');
    c.restore();
    R(c, -0.5, -h / 2, 1, h, '#12382b'); R(c, -w * 0.36, -h * 0.26, w * 0.13, Math.max(0.6, s * 0.1), '#eafff2');
    c.restore();
  }
  function mkBadge(c, x, y, s, col) {
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; E(c, x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.4, s * 0.4, col); }
    E(c, x, y, s * 0.82, s * 0.82, col);
    c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(0.5, s * 0.26); c.beginPath(); c.moveTo(x - s * 0.42, y + s * 0.04); c.lineTo(x - s * 0.1, y + s * 0.36); c.lineTo(x + s * 0.46, y - s * 0.32); c.stroke();
  }

  // ---- shared death bits
  function toastBox(c, accent, lines, n) {
    const h = lines.length * 8 + 4, y = GY - 12 - h;
    RR(c, 6, y - 6, W - 12, h + 8, 3, 'rgba(8,8,10,.94)');
    c.strokeStyle = accent; c.lineWidth = 0.75; c.beginPath(); rrPath(c, 6.4, y - 5.6, W - 12.8, h + 7.2, 3); c.stroke();
    R(c, 6, y - 3, 2, h + 2, accent);
    for (let i = 0; i < lines.length && i <= n; i++) T(c, lines[i][0], 13, y + i * 8, lines[i][1] || '#ffffff');
  }
  function crashLine(g, col) {
    const u = clamp(g.deadT / 0.8, 0, 1);
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
    const pts = [[0, 90], [40, 70], [70, 96], [100, 60], [130, 74], [150, 50], [170, 120], [200, 210], [230, 330], [270, 460]];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { if (pts[i][0] / W > u) { const a = pts[i - 1], b = pts[i], k = (u * W - a[0]) / (b[0] - a[0]); ctx.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); break; } ctx.lineTo(pts[i][0], pts[i][1]); }
    ctx.stroke(); glow(ctx, u * W, 90 + u * 300, 30, col, 0.4);
  }
  function grabFrame() {
    if (!glitchBuf || glitchBuf.width !== cvs.width || glitchBuf.height !== cvs.height) glitchBuf = mk(cvs.width, cvs.height);
    const bg = glitchBuf.getContext('2d'); bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, glitchBuf.width, glitchBuf.height); bg.drawImage(cvs, 0, 0); return glitchBuf;
  }
  function tint(col, a) { ctx.fillStyle = hexA(col, a * (0.6 + 0.4 * Math.sin(now * 10))); ctx.fillRect(0, 0, W, H); }
  function sendBtn(c, x, y, r) { E(c, x, y, r, r, '#f4f4f4'); P(c, [x, y - r * 0.56, x + r * 0.5, y, x - r * 0.5, y], '#0d0d0d'); R(c, x - r * 0.13, y - r * 0.1, r * 0.26, r * 0.62, '#0d0d0d'); }

  MAPS.push(
    // ------------------------------------------------------------ BINANCE
    { id: 'bnb', name: 'Binance', bgc: '#0b0e11', mark(c, x, y, s) { mkBinance(c, x, y, s, '#f0b90b'); },
      desc: 'Fly the spread: red asks hang above, green bids rise below. Funds are SAFU. The bird is not.', death: 'LIQUIDATED', deathCol: '#f6465d',
      words: ['+1 BNB', 'HODL', 'SAFU', 'LONG x125', 'BUIDL', 'FILLED', 'GM'], coin: '#f0b90b', moveFrom: 8, tempo: 124, scale: [0, 2, 4, 7, 9, 12], root: 59,
      build() {
        const L = {};
        L.sky = mk(W, H, (g) => {
          R(g, 0, 0, W, H, '#0b0e11');
          const gr = g.createRadialGradient(W / 2, GY * 0.48, 10, W / 2, GY * 0.48, 240); gr.addColorStop(0, 'rgba(240,185,11,.14)'); gr.addColorStop(1, 'rgba(240,185,11,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
          for (let y = 26; y < GY; y += 32) R(g, 0, y, W, 0.5, '#1e2329');
          for (let x = 14; x < W; x += 32) R(g, x, 0, 0.5, GY, '#1e2329');
          g.globalAlpha = 0.1; mkBinance(g, W / 2, GY * 0.48, 88, '#f0b90b'); g.globalAlpha = 1;
        });
        L.axis = mk2(34, H, (g) => { for (let i = 0, y = 23; y < GY; y += 32, i++) T(g, (69420 - i * 420).toLocaleString('en-US'), 2, y, '#474d57'); });
        L.chart = mk(W * 3, H, (g) => {
          const r = rng(77), base = GY * 0.52; let p = base;
          for (let x = 3; x < W * 3; x += 9) {
            let cl = clamp(p + (3 + r() * 24) * (r() < 0.55 ? -1 : 1), 80, GY - 60);
            if (x > W * 3 - 150) cl += (base - cl) * 0.3;
            const col = cl < p ? '#0ecb81' : '#f6465d', hi = Math.min(p, cl) - r() * 9, lo = Math.max(p, cl) + r() * 9;
            R(g, x + 2.5, hi, 1, lo - hi, col); R(g, x, Math.min(p, cl), 6, Math.max(1.5, Math.abs(cl - p)), col);
            g.globalAlpha = 0.3; R(g, x, GY - 4 - r() * 26, 6, 40, col); g.globalAlpha = 1;
            p = cl;
          }
        });
        const G = '#0ecb81', Rd = '#f6465d', Wt = '#eaecef', Gy = '#848e9c';
        L.tape = tapeImg([['BTC ', Wt], ['69,420 ', Gy], ['+4.20%   ', G], ['ETH ', Wt], ['4,269 ', Gy], ['-0.69%   ', Rd], ['BNB ', Wt], ['777.7 ', Gy], ['+7.77%   ', G], ['SOL ', Wt], ['420.6 ', Gy], ['+6.90%   ', G], ['DOGE ', Wt], ['0.42 ', Gy], ['-4.20%   ', Rd], ['FLAP ', '#f0b90b'], ['0.0069 ', Gy], ['+690%   ', G]]);
        return L;
      },
      bg(c, L, sx, t) {
        c.drawImage(L.sky, 0, 0);
        c.globalAlpha = 0.5; tile(c, L.chart, sx * 0.3); c.globalAlpha = 1;
        c.drawImage(L.axis, W - 34, 0, 34, H);
        const py = GY * 0.52 + Math.sin(t * 0.9) * 26 + Math.sin(t * 2.3) * 8;
        c.fillStyle = '#f0b90b'; for (let x = 0; x < W - 38; x += 6) c.fillRect(x, py, 3, 0.5);
        RR(c, W - 38, py - 4, 38, 8, 1.5, '#f0b90b'); T(c, (69420 + Math.round((GY * 0.52 - py) * 16)).toLocaleString('en-US'), W - 34, py - 2, '#0b0e11');
        mkBinance(c, 98, 14, 6.5, '#f0b90b'); T(c, 'BINANCE', 110, 10, '#f0b90b', 8);
      },
      pillar(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 4 : 8)), col = top ? '#f6465d' : '#0ecb81', dk = top ? '#35141d' : '#102821', h = y1 - y0;
        R(c, x - 1, y0, PW + 2, h, '#0b0e11'); R(c, x, y0, PW, h, '#181a20');
        const base = 69420 + (p.seed % 400); let k = 0;
        for (let yy = top ? y1 - 21 : y0 + 16; top ? yy > y0 - 6 : yy < y1; yy += top ? -6 : 6, k++) {
          const w = 5 + r() * (PW - 8);
          R(c, x + PW - w, yy, w, 5, dk);
          T(c, String(base + (top ? 1 + k : -1 - k) * 5), x + 2, yy + 0.5, col);
          if (r() < 0.55) T(c, (r() * 9).toFixed(1), x + 30, yy + 0.5, '#848e9c');
        }
        R(c, x, y0, 0.5, h, '#2b3139'); R(c, x + PW - 0.5, y0, 0.5, h, '#2b3139');
        const cy = top ? y1 - 14 : y0;
        glow(c, x + PW / 2, top ? y1 : y0, 34, col, 0.24);
        RR(c, x - 2, cy - 1, PW + 4, 16, 3.5, '#0b0e11'); RR(c, x - 1, cy, PW + 2, 14, 3, col); RR(c, x + 1, cy + 1.5, PW - 2, 3, 1.5, 'rgba(255,255,255,.22)');
        TC(c, top ? 'SELL' : 'BUY', x + PW / 2 + 0.5, cy + 3.5, '#ffffff', 8);
      },
      ground(c, L, sx) {
        const sc = game ? game.score : 0;
        R(c, 0, GY, W, GROUND, '#181a20'); R(c, 0, GY, W, 2, '#f0b90b'); R(c, 0, GY + 2, W, 1, '#8a6a06');
        tile2(c, L.tape, sx, GY + 5); R(c, 0, GY + 15, W, 0.5, '#2b3139');
        let x = 8; for (const [s, on] of [['Spot', 0], ['Futures', 1], ['Earn', 0], ['Square', 0]]) { const nx = T(c, s, x, GY + 21, on ? '#eaecef' : '#848e9c'); if (on) R(c, x, GY + 28, nx - x, 1, '#f0b90b'); x = nx + 10; }
        RR(c, W - 100, GY + 19, 44, 12, 2.5, '#0ecb81'); T(c, 'Buy/Long', W - 94, GY + 23, '#ffffff');
        RR(c, W - 52, GY + 19, 44, 12, 2.5, '#f6465d'); T(c, 'Sell/Short', W - 50, GY + 23, '#ffffff');
        T(c, 'PNL', 8, GY + 35, '#848e9c'); const nx = T(c, '+' + (sc * 4.2).toFixed(2) + '%', 24, GY + 35, '#0ecb81'); T(c, '125x', nx + 8, GY + 35, '#f0b90b');
        T(c, 'Margin', W - 100, GY + 35, '#848e9c'); RR(c, W - 72, GY + 35.5, 64, 3, 1.5, '#2b3139'); RR(c, W - 72, GY + 35.5, Math.max(3, 64 * Math.min(1, sc / 40)), 3, 1.5, sc > 25 ? '#f6465d' : '#f0b90b');
        T(c, 'FLAP/USDT Perp', 8, GY + 45, '#eaecef'); T(c, '24h Vol 69.42M', W - 64, GY + 45, '#848e9c');
        mkBinance(c, 11.5, GY + 56, 3.5, '#f0b90b'); T(c, 'FUNDS ARE SAFU', 19, GY + 54, '#5e6673'); T(c, charObj().name.toLowerCase(), W - 8 - charObj().name.length * 4, GY + 54, '#5e6673');
      },
      coinDraw(c, x, y, t) {
        const w = Math.max(1, Math.abs(Math.cos(t * 4)) * 6.5); glow(c, x, y, 14, '#f0b90b', 0.28);
        E(c, x, y + 1, w + 1, 7.5, OUTL); E(c, x, y, w, 6.5, '#f0b90b'); E(c, x, y, w * 0.82, 5.3, '#fcd535');
        if (w > 4) mkBinance(c, x, y, 3.8, '#8a6a06'); R(c, x - w * 0.5, y - 5, 1, 2, '#ffffff');
      },
      ambient(dt, r) { if (r < dt * 0.9) { const up = Math.random() < 0.6; amb.push({ k: 'txt', x: 8 + Math.random() * (W - 70), y: GY - 6, vx: 0, vy: -16 - Math.random() * 10, t: 0, life: 4, txt: (up ? '+' : '-') + (Math.random() * 9).toFixed(2) + '%', c: up ? '#0ecb81' : '#f6465d' }); } },
      deathFX(g) {
        tint('#f6465d', 0.16); crashLine(g, '#f6465d');
        toastBox(ctx, '#f6465d', [['Liquidation Notice', '#f6465d'], ['FLAP/USDT Perp 125x Long: closed', '#eaecef'], ['Realized PNL: -100.00%', '#f6465d'], ['Funds are SAFU. Yours are gone.', '#848e9c']], (g.deadT * 4) | 0);
      }
    },
    // ------------------------------------------------------------ CHATGPT
    { id: 'gpt', name: 'ChatGPT', bgc: '#212121', mark(c, x, y, s) { mkKnot(c, x, y, s, '#ffffff'); },
      desc: 'A chat that never ends. Dodge the reply towers, type "flap" forever, try not to hallucinate a pipe.', death: 'HALLUCINATED', deathCol: '#ff6b5e',
      words: ['GOOD PROMPT', '+1 TOKEN', 'DELVE', 'CERTAINLY!', 'REASONING', 'AGI SOON', 'GREAT QUESTION'], coin: '#ffffff', moveFrom: 10, tempo: 100, scale: [0, 2, 4, 7, 9, 12], root: 55,
      build() {
        const L = {};
        L.chat = feedImg((g) => {
          let y = 10;
          const user = (s) => { const w = s.length * 4 + 14; RR(g, W - 12 - w, y, w, 14, 7, '#303030'); T(g, s, W - 5 - w, y + 5, '#ececec'); y += 24; };
          const say = (...ls) => { for (const s of ls) { T(g, s, 12, y, '#d1d1d1'); y += 8; } y += 3; };
          const icons = () => { g.strokeStyle = '#8e8e8e'; g.lineWidth = 0.6; for (let i = 0; i < 5; i++) g.strokeRect(12.3 + i * 10, y + 0.3, 4.4, 4.4); y += 16; };
          const think = (s) => { T(g, s + ' >', 12, y, '#8e8e8e'); y += 10; };
          const code = (ls) => { const h = 14 + ls.length * 7; RR(g, 12, y, W - 64, h, 4, '#171717'); RR(g, 12, y, W - 64, 10, 4, '#2f2f2f'); R(g, 12, y + 6, W - 64, 4, '#2f2f2f'); T(g, 'javascript', 17, y + 3, '#b4b4b4'); T(g, 'Copy code', W - 94, y + 3, '#b4b4b4'); ls.forEach((l, i) => T(g, l[0], 17, y + 13 + i * 7, l[1])); y += h + 6; };
          user('make me a flappy bird game'); think('Thought for 12 seconds');
          say('Certainly! Let us delve into it.', 'Here is a robust, scalable bird:');
          code([['function flap() {', '#2e95d3'], ['  bird.vy = -372;', '#ececec'], ['  // TODO: avoid pipes', '#8e8e8e'], ['}', '#2e95d3']]); icons();
          user('it hit a pipe');
          say('You are absolutely right!', 'Great catch. Fixed version:');
          code([['if (pipe) dont();', '#00a67d']]); icons();
          user('it hit a pipe again'); think('Thought for 4 minutes');
          say('I apologize for the confusion.', 'As a large language model I', 'cannot see pipes. Try flapping.'); icons();
          user('are you sure?'); say('No.'); icons();
          return y;
        });
        return L;
      },
      bg(c, L, sx, t) {
        R(c, 0, 0, W, H, '#212121');
        c.globalAlpha = 0.45; vtile2(c, L.chat, t * 7 + sx * 0.05); c.globalAlpha = 1;
        glow(c, W / 2, GY * 0.5, 170, '#ffffff', 0.035);
        topFade(c, '#212121', 64);
        mkKnot(c, 96, 14, 6.5, '#ececec'); T(c, 'ChatGPT', 108, 10, '#ececec', 8);
      },
      pillar(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 6 : 2)), h = y1 - y0;
        R(c, x + 2, y0, PW - 4, h, '#141414'); R(c, x + 3, y0, PW - 6, h, '#2f2f2f'); R(c, x + 3, y0, 1.5, h, '#3d3d3d'); R(c, x + PW - 8, y0, 5, h, '#292929');
        let k = 0;
        for (let yy = top ? y1 - 31 : y0 + 26; top ? yy > y0 - 8 : yy < y1; yy += top ? -7 : 7, k++) {
          if (k % 9 > 5) { R(c, x + 6, yy - 1, PW - 12, 7, '#171717'); R(c, x + 9, yy + 1.5, 4 + r() * 8, 2, ['#2e95d3', '#00a67d', '#df3079'][(r() * 3) | 0]); R(c, x + 24, yy + 1.5, 3 + r() * 9, 2, '#b4b4b4'); }
          else R(c, x + 7, yy + 1.5, 10 + r() * (PW - 24), 2, k % 9 === 5 ? '#6b6b6b' : '#b4b4b4');
        }
        const dy = top ? y1 - 21 : y0 + 20, di = ((now * 4) | 0) % 3;
        for (let i = 0; i < 3; i++) E(c, x + PW / 2 - 6 + i * 6, dy, 1.5, 1.5, i === di ? '#ffffff' : '#6b6b6b');
        const cy = top ? y1 - 14 : y0;
        glow(c, x + PW / 2, top ? y1 : y0, 34, '#ffffff', 0.13);
        RR(c, x - 2, cy - 1, PW + 4, 16, 8, '#0d0d0d'); RR(c, x - 1, cy, PW + 2, 14, 7, '#f4f4f4');
        mkKnot(c, x + 8, cy + 7, 4.8, '#0d0d0d');
        TC(c, ['GPT', '4o', 'o3', 'AGI'][(p.seed >> 4) % 4], x + 29, cy + 3.5, '#0d0d0d', 8);
      },
      ground(c, L, sx) {
        R(c, 0, GY, W, GROUND, '#212121');
        RR(c, 7, GY + 6, W - 14, 30, 15, '#424242'); RR(c, 7.75, GY + 6.75, W - 15.5, 28.5, 14.25, '#303030');
        R(c, 17, GY + 20.5, 9, 1, '#ececec'); R(c, 21, GY + 16.5, 1, 9, '#ececec');
        const typing = game && game.state === 'play', s = typing ? 'flap '.repeat(1 + game.flaps % 4).trim() : 'Ask anything';
        T(c, s, 34, GY + 17, typing ? '#ececec' : '#8e8e8e', 8);
        if (((now * 2) | 0) % 2) R(c, typing ? 36 + s.length * 8 : 31, GY + 16, 1, 10, '#ececec');
        RR(c, W - 46, GY + 16, 4, 7, 2, '#ececec'); c.strokeStyle = '#ececec'; c.lineWidth = 0.8; c.beginPath(); c.arc(W - 44, GY + 21, 4, 0.1, Math.PI - 0.1); c.stroke(); R(c, W - 44.4, GY + 25, 0.8, 2.5, '#ececec');
        sendBtn(c, W - 24, GY + 21, 9);
        TC(c, 'ChatGPT can make mistakes. Check important info.', W / 2, GY + 43, '#8e8e8e');
        TC(c, 'Flappening can make mistakes too. Check for pipes.', W / 2, GY + 52, '#5a5a5a');
      },
      coinDraw(c, x, y, t) {
        const w = Math.max(1, Math.abs(Math.cos(t * 4)) * 6.5); glow(c, x, y, 14, '#ffffff', 0.22);
        E(c, x, y + 1, w + 1, 7.5, '#0d0d0d'); E(c, x, y, w, 6.5, '#f4f4f4'); if (w > 4.4) mkKnot(c, x, y, 4.6, '#0d0d0d');
      },
      ambient(dt, r) { if (r < dt * 2) amb.push({ k: 'spark4', x: Math.random() * W, y: 30 + Math.random() * (GY - 60), vx: 0, vy: -3, t: 0, life: 1.4 + Math.random(), c: 'rgba(255,255,255,.55)', s: 1.5 + Math.random() * 2.5 }); },
      deathFX(g) {
        tint('#ff6b5e', 0.1);
        toastBox(ctx, '#ff6b5e', [['Something went wrong.', '#ff6b5e'], ['The bird confidently flew into a pipe', '#ececec'], ['it had just said was not there.', '#ececec'], ['[ Regenerate ]', '#8e8e8e']], (g.deadT * 4) | 0);
      }
    },
    // ------------------------------------------------------------ X / TWITTER
    { id: 'x', name: 'X / Twitter', tab: 'X', bgc: '#000000', mark(c, x, y, s) { mkX(c, x, y, s * 0.86, '#ffffff', '#000000'); },
      desc: 'Scroll the timeline at full speed. Towers of posts, blue checks to collect, hearts in the air. Do not get ratioed.', death: 'RATIOED', deathCol: '#f4212e',
      words: ['+1 LIKE', 'BANGER', 'VIRAL', 'BASED', 'W POST', 'REPOSTED', 'GM'], coin: '#1d9bf0', moveFrom: 9, tempo: 132, scale: [0, 3, 5, 7, 10, 12], root: 57,
      build() {
        const L = {};
        L.mark = mk(180, 180, (g) => mkX(g, 90, 90, 78, '#ffffff', 'cut'));
        L.feed = feedImg((g) => {
          let y = 6;
          const ic = (i, x, yy, on) => {
            const col = on ? '#f91880' : '#71767b'; g.strokeStyle = col; g.lineWidth = 0.7;
            if (i === 0) { g.beginPath(); g.arc(x + 2.5, yy + 2, 2.2, 0, 6.3); g.stroke(); R(g, x + 1, yy + 4, 1.4, 1.2, col); }
            else if (i === 1) { P(g, [x, yy + 1.6, x + 1.6, yy - 0.3, x + 3.2, yy + 1.6], col); R(g, x + 1.25, yy + 1.4, 0.7, 3, col); P(g, [x + 2.6, yy + 2.6, x + 4.2, yy + 4.5, x + 5.8, yy + 2.6], col); R(g, x + 3.85, yy, 0.7, 2.8, col); }
            else if (i === 2) heart(g, x + 2.5, yy + 1.6, 2.5, col);
            else { R(g, x, yy + 2.5, 1, 2, col); R(g, x + 2, yy + 0.5, 1, 4, col); R(g, x + 4, yy + 1.5, 1, 3, col); }
          };
          const post = (name, handle, lines, st, liked, hue) => {
            E(g, 19, y + 9, 7.5, 7.5, hue); E(g, 19, y + 7.5, 2.6, 2.6, 'rgba(0,0,0,.35)'); E(g, 19, y + 14, 5, 3.4, 'rgba(0,0,0,.35)');
            let x = T(g, name, 32, y + 2, '#e7e9ea'); mkBadge(g, x + 4.5, y + 4, 2.7, '#1d9bf0'); T(g, '@' + handle, x + 10, y + 2, '#71767b');
            lines.forEach((s, i) => T(g, s, 32, y + 11 + i * 7, '#e7e9ea'));
            const ay = y + 14 + lines.length * 7;
            st.forEach((s, i) => { const ix = 32 + i * 54; ic(i, ix, ay, i === 2 && liked); T(g, s, ix + 8, ay, i === 2 && liked ? '#f91880' : '#71767b'); });
            y = ay + 11; R(g, 0, y, W, 0.5, '#2f3336'); y += 6;
          };
          post('flappening', 'flap · 1m', ['gm. flap. die. repeat.'], ['69', '420', '4.2K', '69K'], 1, '#ffd23f');
          post('anon', 'anon · 2h', ['this bird has more aura than', 'my entire portfolio'], ['12', '88', '1.1K', '42K'], 0, '#7856ff');
          post('dev', 'dev · 4h', ['shipped a game in 40 minutes.', 'no bugs. (i did not test)'], ['404', '13', '999', '31K'], 1, '#00ba7c');
          post('pipe', 'pipe · 5h', ['ratio'], ['4.2K', '1', '2', '1M'], 0, '#f4212e');
          post('birb', 'birb · 9h', ['who up flapping rn'], ['7', '77', '777', '7.7K'], 1, '#1d9bf0');
          post('ceo of pipes', 'pipes · 1d', ['we are raising the pipes again.', 'this is good for the bird.'], ['2K', '3', '11', '900K'], 0, '#ff7a00');
          post('wurst wing', 'wurst · 2d', ['day 420 of asking for an', 'edit button'], ['42', '420', '4.2K', '420K'], 1, '#f91880');
          return y;
        });
        return L;
      },
      bg(c, L, sx, t) {
        R(c, 0, 0, W, H, '#000000');
        c.globalAlpha = 0.5; vtile2(c, L.feed, t * 9 + sx * 0.05); c.globalAlpha = 1;
        glow(c, W / 2, GY * 0.47, 150, '#1d9bf0', 0.07);
        c.globalAlpha = 0.09 + 0.02 * Math.sin(t * 2); c.drawImage(L.mark, W / 2 - 90, GY * 0.47 - 90); c.globalAlpha = 1;
        topFade(c, '#000000', 64);
        T(c, 'For you', 66, 9, '#e7e9ea', 8); R(c, 76, 20, 36, 2, '#1d9bf0'); T(c, 'Following', 138, 9, '#71767b', 8);
      },
      pillar(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 1 : 5)), h = y1 - y0;
        R(c, x, y0, PW, h, '#2f3336'); R(c, x + 1, y0, PW - 2, h, '#000000');
        for (let yy = top ? y1 - 34 : y0 + 19; top ? yy > y0 - 20 : yy < y1; yy += top ? -20 : 20) {
          E(c, x + 7, yy + 4, 3.5, 3.5, ['#1d9bf0', '#f91880', '#00ba7c', '#ffd400', '#7856ff', '#ff7a00'][(r() * 6) | 0]);
          R(c, x + 13, yy + 1, 10 + r() * 8, 2, '#e7e9ea'); if (r() < 0.6) mkBadge(c, x + 37, yy + 2.5, 2.3, '#1d9bf0');
          R(c, x + 13, yy + 5, 14 + r() * 14, 2, '#71767b'); R(c, x + 13, yy + 9, 8 + r() * 16, 2, '#71767b');
          heart(c, x + 7, yy + 13, 1.9, r() < 0.5 ? '#f91880' : '#71767b'); R(c, x + 13, yy + 13, 6, 1.5, '#3a3f44');
          R(c, x + 1, yy + 17.5, PW - 2, 0.5, '#2f3336');
        }
        const cy = top ? y1 - 14 : y0, i = top ? (p.seed >> 3) % 3 : 0, col = ['#1d9bf0', '#f91880', '#00ba7c'][i];
        glow(c, x + PW / 2, top ? y1 : y0, 34, col, 0.26);
        RR(c, x - 2, cy - 1, PW + 4, 16, 8, '#000000'); RR(c, x - 1, cy, PW + 2, 14, 7, col); RR(c, x + 4, cy + 1.5, PW - 8, 3, 1.5, 'rgba(255,255,255,.22)');
        TC(c, ['POST', 'LIKE', 'RT'][i], x + PW / 2 + 0.5, cy + 3.5, '#ffffff', 8);
      },
      ground(c, L, sx) {
        const sc = game ? game.score : 0, typing = game && game.state === 'play';
        R(c, 0, GY, W, GROUND, '#000000'); R(c, 0, GY, W, 0.5, '#2f3336');
        flyerDisc(c, 16, GY + 14, 8, '#16181c');
        T(c, typing ? 'flap' + '!'.repeat(1 + game.flaps % 5) : "What's happening?!", 30, GY + 10, typing ? '#e7e9ea' : '#71767b', 8);
        RR(c, W - 44, GY + 7, 38, 14, 7, '#1d9bf0'); TC(c, 'Post', W - 25, GY + 12, '#ffffff');
        R(c, 0, GY + 26, W, 0.5, '#2f3336');
        T(c, 'Trending in Gaming', 8, GY + 30, '#71767b'); const nx = T(c, '#FLAPPENING', 8, GY + 37, '#e7e9ea'); T(c, (69.4 + sc * 0.1).toFixed(1) + 'K posts', nx + 6, GY + 37, '#71767b');
        heart(c, W - 44, GY + 35, 3.4, sc ? '#f91880' : '#71767b'); T(c, fmtK(sc * 1337), W - 38, GY + 33, sc ? '#f91880' : '#71767b');
        R(c, 0, GY + 45, W, 0.5, '#2f3336');
        const ny = GY + 55; c.strokeStyle = '#e7e9ea'; c.lineWidth = 1;
        P(c, [22, ny, 27, ny - 5, 32, ny], '#e7e9ea'); R(c, 23.5, ny, 7, 4.5, '#e7e9ea'); R(c, 26, ny + 1.5, 2, 3, '#000000');
        c.beginPath(); c.arc(80, ny - 1, 3.2, 0, 6.3); c.stroke(); c.beginPath(); c.moveTo(82.4, ny + 1.4); c.lineTo(85, ny + 4); c.stroke();
        mkX(c, 135, ny, 4.4, '#e7e9ea', '#000000');
        c.beginPath(); c.arc(189, ny, 3.6, Math.PI, 0); c.lineTo(193.6, ny + 3); c.lineTo(184.4, ny + 3); c.closePath(); c.stroke(); R(c, 188, ny + 4, 2, 1.2, '#e7e9ea');
        if (sc) { E(c, 193.5, ny - 4.5, 4.2, 4.2, '#1d9bf0'); TC(c, String(Math.min(99, sc)), 193.5, ny - 6.5, '#ffffff'); }
        c.strokeRect(238.5, ny - 3.5, 10, 7); c.beginPath(); c.moveTo(238.5, ny - 3.5); c.lineTo(243.5, ny + 0.5); c.lineTo(248.5, ny - 3.5); c.stroke();
      },
      coinDraw(c, x, y, t) { const k = Math.max(0.15, Math.abs(Math.cos(t * 4))); glow(c, x, y, 14, '#1d9bf0', 0.32); c.save(); c.translate(x, y); c.scale(k, 1); mkBadge(c, 0, 0.8, 7.7, '#05070a'); mkBadge(c, 0, 0, 6.8, '#1d9bf0'); c.restore(); },
      ambient(dt, r) { if (r < dt * 1.3) amb.push({ k: 'heart', x: Math.random() * W, y: GY - 4, vx: (Math.random() - 0.5) * 10, vy: -22 - Math.random() * 14, t: 0, life: 5, c: Math.random() < 0.7 ? '#f91880' : '#1d9bf0', s: 2 + Math.random() * 2 }); },
      deathFX(g) {
        tint('#f4212e', 0.1);
        toastBox(ctx, '#f4212e', [['You got ratioed.', '#f4212e'], ['1 like · 4,269 replies · 0 reposts', '#e7e9ea'], ['Readers added context: skill issue', '#1d9bf0'], ['This post is no longer available.', '#71767b']], (g.deadT * 4) | 0);
      }
    },
    // ------------------------------------------------------------ PUMP.FUN
    { id: 'pump', name: 'pump.fun', bgc: '#15161b', mark(c, x, y, s) { mkPill(c, x, y, s * 0.92); },
      desc: 'Giant pills, fresh coins every second, a curve that only goes up. Fill the bonding curve before the dev sells.', death: 'DEV SOLD', deathCol: '#f87171',
      words: ['APE IN', 'SEND IT', 'BONDED', '+1 SOL', 'LFG', 'UP ONLY', 'DIAMOND HANDS'], coin: '#86efac', moveFrom: 4, tempo: 138, scale: [0, 2, 3, 7, 9, 12], root: 62,
      build() {
        const L = {};
        L.sky = mk(W, H, (g) => {
          const gr = g.createLinearGradient(0, 0, 0, GY); gr.addColorStop(0, '#0f1014'); gr.addColorStop(1, '#1b1d28'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
          const rg = g.createRadialGradient(W / 2, GY, 10, W / 2, GY, 300); rg.addColorStop(0, 'rgba(134,239,172,.2)'); rg.addColorStop(1, 'rgba(134,239,172,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
        });
        L.cards = mk2(360, H, (g) => {
          const r = rng(31), names = ['FLAP', 'WURST', 'PIPE', 'BIRB', 'CAPY', 'TOAST', 'DUCK', 'JEET', 'GIGA', 'BRICK', 'SHARKO', 'BURGR', 'MOONBOI', 'COPE', 'HOPIUM', 'SEND', 'APE', 'WAGMI', 'NGMI', 'ANON', 'GM'];
          let n = 0;
          for (let row = 0, y = 34; y < GY - 30; y += 58, row++) for (let i = 0; i < 3; i++, n++) {
            const x0 = i * 120 + (row % 2 ? 60 : 0), nm = names[n % names.length], hue = (r() * 360) | 0, mc = (1 + r() * 68).toFixed(1), rep = (r() * 420) | 0, pr = 0.08 + r() * 0.9;
            wrapX(360, (dx) => {
              const x = x0 + dx;
              RR(g, x + 4, y, 112, 48, 4, '#2b2f40'); RR(g, x + 4.75, y + 0.75, 110.5, 46.5, 3.5, '#1b1d28');
              RR(g, x + 9, y + 5, 24, 24, 3, 'hsl(' + hue + ',70%,52%)'); E(g, x + 21, y + 19, 8, 6.5, 'hsl(' + ((hue + 40) % 360) + ',85%,74%)'); R(g, x + 17, y + 16, 2, 2.5, '#111'); R(g, x + 23, y + 16, 2, 2.5, '#111'); R(g, x + 18.5, y + 21.5, 5, 1, '#111');
              T(g, '$' + nm, x + 38, y + 6, '#ffffff'); T(g, 'created by anon', x + 38, y + 13, '#6b7280'); T(g, 'MC $' + mc + 'K', x + 38, y + 20, '#86efac'); T(g, 'replies ' + rep, x + 38, y + 27, '#9ca3af');
              RR(g, x + 9, y + 36, 102, 4, 2, '#2a2d3a'); RR(g, x + 9, y + 36, 102 * pr, 4, 2, pr > 0.9 ? '#fde047' : '#86efac');
            });
          }
        });
        L.tape = tapeImg([['anon bought 0.42 SOL of $FLAP    ', '#86efac'], ['jeet sold 6.9 SOL of $PIPE    ', '#f87171'], ['dev created $WURST    ', '#93c5fd'], ['whale bought 69 SOL of $BIRB    ', '#86efac'], ['paperhands sold 0.01 SOL of $CAPY    ', '#f87171']]);
        return L;
      },
      bg(c, L, sx, t) {
        c.drawImage(L.sky, 0, 0);
        c.globalAlpha = 0.5; tile2(c, L.cards, sx * 0.18, 0); c.globalAlpha = 1;
        const off = sx * 0.3, per = 190;
        for (const [lw, col] of [[5, 'rgba(134,239,172,.12)'], [1.5, 'rgba(134,239,172,.75)']]) {
          c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
          for (let x = -4; x <= W + 4; x += 3) { const u = (((x + off) % per) + per) % per / per, y = GY - 34 - Math.pow(u, 2.6) * GY * 0.56; if (x === -4) c.moveTo(x, y); else c.lineTo(x, y); }
          c.stroke();
        }
        topFade(c, '#0f1014', 60);
        mkPill(c, 92, 14, 7.5); T(c, 'pump.fun', 106, 10, '#ffffff', 8);
      },
      pillar(c, x, y0, y1, top, p) {
        const px = x + 3, pw = PW - 6, ph = 60, ol = '#12382b', e = 3;
        glow(c, x + PW / 2, top ? y1 : y0, 36, '#86efac', 0.22);
        for (let i = 0; i < 14; i++) {
          const yy = top ? y1 + e - (i + 1) * ph - i * 3 : y0 - e + i * (ph + 3);
          if (top ? yy + ph < y0 - 4 : yy > y1) break;
          const flip = (i % 2 === 1) !== top, ca = flip ? '#5fd68a' : '#f6faf8', cb = flip ? '#f6faf8' : '#5fd68a', hh = (ph - 3) / 2, ya = yy + 1.5;
          RR(c, px - 1.5, yy, pw + 3, ph, pw / 2 + 1.5, ol);
          c.save(); c.beginPath(); rrPath(c, px, ya, pw, ph - 3, pw / 2); c.clip();
          R(c, px, ya, pw, hh, ca); R(c, px, ya + hh, pw, hh, cb);
          R(c, px + pw - 9, ya, 9, hh, flip ? '#3fb873' : '#d3dedb'); R(c, px + pw - 9, ya + hh, 9, hh, flip ? '#d3dedb' : '#3fb873');
          R(c, px + 5, ya, 3, hh, flip ? '#a6f3c2' : '#ffffff'); R(c, px + 5, ya + hh, 3, hh, flip ? '#ffffff' : '#a6f3c2');
          c.restore();
          R(c, px, ya + hh - 0.75, pw, 1.5, ol);
          T(c, 'PUMP', px + pw / 2 - 8, (flip ? ya + hh : ya) + hh / 2 - 2, '#a9b8b3');
        }
      },
      ground(c, L, sx) {
        const sc = game ? game.score : 0, pct = Math.min(100, sc * 4);
        R(c, 0, GY, W, GROUND, '#15161b'); R(c, 0, GY, W, 1.5, '#86efac'); R(c, 0, GY + 1.5, W, 1, '#1f4a3a');
        const nx = T(c, 'bonding curve progress: ', 8, GY + 7, '#9ca3af'); T(c, pct + '%', nx, GY + 7, '#86efac');
        RR(c, 8, GY + 14, W - 16, 6, 3, '#2a2d3a');
        if (pct) { const bw = Math.max(6, (W - 16) * pct / 100); RR(c, 8, GY + 14, bw, 6, 3, pct >= 100 ? '#fde047' : '#86efac'); const sh = (now * 60) % (bw + 20) - 10; if (sh > 2 && sh < bw - 6) R(c, 8 + sh, GY + 15, 4, 4, 'rgba(255,255,255,.55)'); }
        T(c, pct >= 100 ? 'graduated. the bird is now a blue chip.' : (25 - sc) + ' pipes left until the bird graduates', 8, GY + 24, '#6b7280');
        P(c, [8, GY + 38, 8, GY + 33, 10.5, GY + 35.5, 13, GY + 32.5, 15.5, GY + 35.5, 18, GY + 33, 18, GY + 38], '#fde047');
        T(c, 'king of the hill: ' + charObj().name.toLowerCase(), 22, GY + 33, '#fde047');
        tile2(c, L.tape, now * 30, GY + 41);
        T(c, 'ca: FLAP...pump', 8, GY + 54, '#4b5563');
        RR(c, W - 86, GY + 51, 36, 10, 3, '#86efac'); TC(c, 'buy', W - 68, GY + 54, '#0f1014'); RR(c, W - 46, GY + 51, 38, 10, 3, '#f87171'); TC(c, 'sell', W - 27, GY + 54, '#0f1014');
      },
      coinDraw(c, x, y, t) { glow(c, x, y, 14, '#86efac', 0.3); mkPill(c, x, y, 6.6, -Math.PI / 4 + Math.sin(t * 4) * 0.6); },
      ambient(dt, r) {
        if (r < dt * 2.2) amb.push({ k: 'bub', x: Math.random() * W, y: GY - 4, vx: 0, vy: -20 - Math.random() * 22, t: 0, life: 4, c: '#86efac', s: 1 + Math.random() * 2.6 });
        else if (r < dt * 2.6) { const buy = Math.random() < 0.65; amb.push({ k: 'txt', x: 8, y: GY - 12, vx: 0, vy: -14, t: 0, life: 3.5, a: 0.9, txt: buy ? pick(['anon bought 0.5 SOL', 'whale aped 42 SOL', 'new ATH', 'dev is typing...']) : pick(['jeet sold 2 SOL', 'paperhands exited']), c: buy ? '#86efac' : '#f87171' }); }
      },
      deathFX(g) {
        tint('#f87171', 0.14); crashLine(g, '#f87171');
        toastBox(ctx, '#f87171', [['dev sold 100% of supply', '#f87171'], ['market cap: $69K -> $4.20', '#e5e7eb'], ['you are now the exit liquidity', '#9ca3af'], ['[ create a new coin ]', '#86efac']], (g.deadT * 4) | 0);
      }
    },
    // ------------------------------------------------------------ TIKTOK
    { id: 'tok', name: 'TikTok', bgc: '#010101', glitch: true, mark(c, x, y, s) { mkTok(c, x - s * 0.1, y, s * 0.82); },
      desc: 'You are the For You page now. Neon towers in cyan and red, hearts for coins, the beat never stops. Do not flop.', death: 'FLOPPED', deathCol: '#fe2c55',
      words: ['+1K LIKES', 'FYP', 'VIRAL', 'SLAY', 'NO CAP', 'RIZZ', 'AURA +100'], coin: '#fe2c55', moveFrom: 7, tempo: 128, scale: [0, 3, 5, 7, 10, 12], root: 60,
      build() {
        const L = {};
        L.sky = mk(W, H, (g) => {
          R(g, 0, 0, W, H, '#010101');
          let rg = g.createRadialGradient(30, 60, 10, 30, 60, 260); rg.addColorStop(0, 'rgba(37,244,238,.16)'); rg.addColorStop(1, 'rgba(37,244,238,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
          rg = g.createRadialGradient(W - 20, GY - 40, 10, W - 20, GY - 40, 280); rg.addColorStop(0, 'rgba(254,44,85,.18)'); rg.addColorStop(1, 'rgba(254,44,85,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
        });
        L.mark = mk(220, 240, (g) => mkTok(g, 100, 124, 78));
        L.far = mk(W * 2, H, (g) => {
          const r = rng(9);
          for (let i = 0; i < 46; i++) {
            const x = r() * W * 2, y = 30 + r() * (GY - 60), col = r() < 0.5 ? '#25f4ee' : '#fe2c55', s = 3 + r() * 5, kind = (r() * 3) | 0;
            g.globalAlpha = 0.25 + r() * 0.35;
            wrapX(W * 2, (dx) => { if (kind === 0) mkNote(g, x + dx, y, s, col); else if (kind === 1) heart(g, x + dx, y, s * 0.7, col); else { R(g, x + dx - s, y - 0.5, s * 2, 1, col); R(g, x + dx - 0.5, y - s, 1, s * 2, col); } });
          }
          g.globalAlpha = 1;
        });
        L.tape = tapeImg([['original sound - flappening     ', '#ffffff'], ['flap flap flap (sped up)     ', '#ffffff'], ['pipe phonk remix     ', '#ffffff']]);
        return L;
      },
      bg(c, L, sx, t) {
        const sc = game ? game.score : 0;
        c.drawImage(L.sky, 0, 0);
        c.globalAlpha = 0.5; tile(c, L.far, sx * 0.12); c.globalAlpha = 1;
        const beat = 1 + 0.06 * Math.pow(Math.max(0, Math.sin(t * 6.7)), 6);
        c.save(); c.globalAlpha = 0.2; c.translate(W * 0.44, GY * 0.46); c.scale(beat, beat); c.drawImage(L.mark, -100, -124); c.restore();
        for (let i = 0, x = 2; x < W; x += 7, i++) { const hh = 4 + 24 * Math.abs(Math.sin(t * 5 + i * 0.7) * Math.sin(t * 1.7 + i * 0.31)); R(c, x, GY - hh, 4, hh, i % 2 ? 'rgba(254,44,85,.4)' : 'rgba(37,244,238,.4)'); }
        topFade(c, '#010101', 56);
        T(c, 'Following', 65, 9, 'rgba(255,255,255,.55)', 8); T(c, 'For You', 149, 9, '#ffffff', 8); R(c, 165, 20, 24, 2, '#ffffff');
        const rx = W - 17, by = GY - 152;
        E(c, rx, by, 9.5, 9.5, '#ffffff'); flyerDisc(c, rx, by, 8.5, '#1c1c22'); E(c, rx, by + 9.5, 4, 4, '#fe2c55'); R(c, rx - 2, by + 9, 4, 1, '#ffffff'); R(c, rx - 0.5, by + 7.5, 1, 4, '#ffffff');
        heart(c, rx, by + 30, 6.5, sc ? '#fe2c55' : '#ffffff'); TC(c, fmtK(1200 + sc * 1337), rx, by + 39, '#ffffff');
        E(c, rx, by + 58, 7, 6, '#ffffff'); P(c, [rx - 5, by + 61, rx - 7, by + 66, rx - 1, by + 63], '#ffffff'); for (let i = -1; i < 2; i++) E(c, rx + i * 3, by + 58, 0.9, 0.9, '#010101'); TC(c, fmtK(69 + sc * 42), rx, by + 67, '#ffffff');
        P(c, [rx - 7, by + 90, rx, by + 80, rx, by + 84.5, rx + 7, by + 84.5, rx + 7, by + 89, rx, by + 89, rx, by + 93], '#ffffff'); TC(c, 'Share', rx, by + 96, '#ffffff');
        c.save(); c.translate(rx, by + 122); c.rotate(t * 2.2); E(c, 0, 0, 10, 10, '#2a2a2e'); E(c, 0, 0, 8.6, 8.6, '#121214'); R(c, -8, -0.5, 16, 1, '#2a2a2e'); R(c, -0.5, -8, 1, 16, '#2a2a2e'); E(c, 0, 0, 4, 4, '#fe2c55'); E(c, 0, 0, 1.4, 1.4, '#25f4ee'); c.restore();
      },
      pillar(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 2 : 6)), h = y1 - y0;
        R(c, x - 2, y0, PW, h, '#25f4ee'); R(c, x + 2, y0, PW, h, '#fe2c55'); R(c, x, y0, PW, h, '#0c0c0f'); R(c, x + 1, y0, PW - 2, h, '#141418');
        for (let yy = top ? y1 - 62 : y0 + 18; top ? yy > y0 - 46 : yy < y1; yy += top ? -46 : 46) {
          const hue = (r() * 360) | 0, live = r() < 0.35, views = ((r() * 99) | 0) / 10 + 'M';
          const gr = c.createLinearGradient(0, yy, 0, yy + 42); gr.addColorStop(0, 'hsl(' + hue + ',55%,34%)'); gr.addColorStop(1, 'hsl(' + ((hue + 60) % 360) + ',60%,13%)');
          c.fillStyle = gr; c.fillRect(x + 4, yy, PW - 8, 42);
          P(c, [x + PW / 2 - 4, yy + 13, x + PW / 2 + 6, yy + 19, x + PW / 2 - 4, yy + 25], 'rgba(255,255,255,.85)');
          P(c, [x + 6, yy + 34, x + 10, yy + 36.5, x + 6, yy + 39], '#ffffff'); T(c, views, x + 12, yy + 34.5, '#ffffff');
          if (live) { RR(c, x + 6, yy + 3, 18, 7, 1.5, '#fe2c55'); T(c, 'LIVE', x + 7, yy + 4.5, '#ffffff'); }
        }
        const cy = top ? y1 - 14 : y0, pulse = 0.26 + 0.16 * Math.sin(now * 6.7);
        glow(c, x + PW / 2 - 10, top ? y1 : y0, 30, '#25f4ee', pulse); glow(c, x + PW / 2 + 10, top ? y1 : y0, 30, '#fe2c55', pulse);
        RR(c, x - 3, cy, PW, 14, 5, '#25f4ee'); RR(c, x + 3, cy, PW, 14, 5, '#fe2c55'); RR(c, x, cy, PW, 14, 5, '#ffffff');
        R(c, x + PW / 2 - 5, cy + 6, 10, 2, '#0c0c0f'); R(c, x + PW / 2 - 1, cy + 2, 2, 10, '#0c0c0f');
      },
      ground(c, L, sx) {
        R(c, 0, GY, W, GROUND, '#000000');
        const u = ((game ? game.t : now) % 15) / 15;
        R(c, 0, GY, W, 1.5, '#3a3a3a'); R(c, 0, GY, W * u, 1.5, '#ffffff'); E(c, W * u, GY + 0.75, 2.2, 2.2, '#ffffff');
        T(c, '@' + charObj().name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), 8, GY + 6, '#ffffff', 8);
        const nx = T(c, 'flap. die. repeat. ', 8, GY + 18, '#d0d0d0'); T(c, '#fyp #flappening #birdtok', nx, GY + 18, '#ffffff');
        mkNote(c, 11, GY + 30, 3, '#ffffff'); c.save(); c.beginPath(); c.rect(18, GY + 25, 150, 10); c.clip(); tile2(c, L.tape, now * 24, GY + 26); c.restore();
        R(c, 0, GY + 38, W, 0.5, '#2a2a2a');
        T(c, 'Home', 19, GY + 49, '#ffffff'); T(c, 'Friends', 67, GY + 49, '#8a8a8a'); T(c, 'Inbox', 179, GY + 49, '#8a8a8a'); T(c, 'Profile', 229, GY + 49, '#8a8a8a');
        RR(c, 119, GY + 44, 26, 13, 4.5, '#25f4ee'); RR(c, 125, GY + 44, 26, 13, 4.5, '#fe2c55'); RR(c, 122, GY + 44, 26, 13, 4.5, '#ffffff'); R(c, 131, GY + 49.75, 8, 1.5, '#000000'); R(c, 134.25, GY + 46.5, 1.5, 8, '#000000');
      },
      coinDraw(c, x, y, t) { const k = 1 + 0.12 * Math.sin(t * 8); glow(c, x, y, 14, '#fe2c55', 0.32); heart(c, x, y + 0.6, 8 * k, '#0c0c0f'); heart(c, x - 1.3, y - 0.9, 6.4 * k, '#25f4ee'); heart(c, x + 0.5, y + 0.2, 6.4 * k, '#fe2c55'); R(c, x - 3, y - 3.2, 2, 1.5, '#ffffff'); },
      ambient(dt, r) {
        if (r < dt * 2.4) amb.push({ k: 'heart', x: W - 17, y: GY - 124, vx: -6 - Math.random() * 16, vy: -30 - Math.random() * 24, t: 0, life: 3, c: pick(['#fe2c55', '#fe2c55', '#25f4ee', '#ffffff']), s: 1.6 + Math.random() * 2.2 });
        else if (r < dt * 3.2) amb.push({ k: 'note', x: W - 26, y: GY - 34, vx: -16 - Math.random() * 10, vy: -14, t: 0, life: 2.6, c: Math.random() < 0.5 ? '#25f4ee' : '#ffffff' });
      },
      deathFX(g) {
        tint('#fe2c55', 0.08);
        toastBox(ctx, '#fe2c55', [['Video removed', '#fe2c55'], ['0 views · 0 likes · 1 pipe', '#ffffff'], ['Not eligible for the For You feed', '#9a9a9a'], ['Swipe up to try again', '#25f4ee']], (g.deadT * 4) | 0);
      }
    },
    // ------------------------------------------------------------ GITHUB
    { id: 'git', name: 'GitHub', bgc: '#0d1117', mark(c, x, y, s) { mkOcto(c, x, y, s, '#ffffff', '#0d1117'); },
      desc: 'Fly across the contribution graph. Branch towers full of commits, stars instead of coins, green checks all the way.', death: 'MERGE CONFLICT', deathCol: '#f85149',
      words: ['+1 STAR', 'LGTM', 'MERGED', 'FORKED', 'CI PASSED', 'SHIP IT', 'git push -f'], coin: '#e3b341', moveFrom: 10, tempo: 112, scale: [0, 2, 4, 7, 9, 12], root: 58,
      build() {
        const L = {};
        L.grid = mk(550, H, (g) => {
          const cols = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'], r = rng(42);
          for (let cx = 0; cx < 50; cx++) for (let ry = 0, y = 34; y < GY - 4; y += 11, ry++) {
            const v = Math.sin(cx * Math.PI * 2 / 25 + ry * 0.2) + Math.sin(cx * Math.PI * 2 / 50 - ry * 0.45) + r() * 1.8 - 1.1;
            RR(g, cx * 11 + 1, y, 9, 9, 2, cols[clamp(Math.round(v * 1.3), 0, 4)]);
          }
        });
        L.mark = mk(150, 150, (g) => mkOcto(g, 75, 75, 70, '#ffffff', 'cut'));
        return L;
      },
      bg(c, L, sx, t) {
        R(c, 0, 0, W, H, '#0d1117');
        c.globalAlpha = 0.5; tile(c, L.grid, sx * 0.25); c.globalAlpha = 1;
        const tk = (t * 2.5) | 0, o0 = Math.round(-((((sx * 0.25) % 550) + 550) % 550)), hx = o0 + (Math.ceil(-o0 / 11) + (tk * 131) % 24) * 11 + 1, hy = 34 + ((tk * 57) % Math.max(1, ((GY - 50) / 11) | 0)) * 11;
        c.globalAlpha = 1 - (t * 2.5) % 1; RR(c, hx, hy, 9, 9, 2, '#7dff9b'); glow(c, hx + 4.5, hy + 4.5, 14, '#39d353', 0.5 * (1 - (t * 2.5) % 1)); c.globalAlpha = 1;
        c.globalAlpha = 0.08; c.drawImage(L.mark, W / 2 - 75, GY * 0.46 - 75); c.globalAlpha = 1;
        topFade(c, '#0d1117', 60);
        mkOcto(c, 86, 14, 7, '#e6edf3', '#0d1117'); T(c, 'GitHub', 98, 10, '#e6edf3', 8);
      },
      pillar(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 3 : 7)), h = y1 - y0, bc = ['#58a6ff', '#3fb950', '#a371f7', '#f78166'][(p.seed >> 2) % 4];
        R(c, x, y0, PW, h, '#30363d'); R(c, x + 1, y0, PW - 2, h, '#161b22');
        R(c, x + 7.25, y0, 1.5, h, bc);
        let k = 0;
        for (let yy = top ? y1 - 27 : y0 + 21; top ? yy > y0 - 10 : yy < y1; yy += top ? -11 : 11, k++) {
          E(c, x + 8, yy + 2.5, 3.4, 3.4, '#161b22'); E(c, x + 8, yy + 2.5, 2.5, 2.5, bc); E(c, x + 8, yy + 2.5, 1, 1, '#161b22');
          T(c, (Math.imul(p.seed + k * 7919 + (top ? 13 : 0), 2654435761) >>> 4).toString(16).padStart(7, '0').slice(0, 7), x + 14, yy, '#8b949e');
          R(c, x + 14, yy + 6, 4 + r() * 22, 1.5, r() < 0.72 ? '#238636' : '#da3633');
        }
        const cy = top ? y1 - 14 : y0, col = top ? '#8957e5' : '#238636';
        glow(c, x + PW / 2, top ? y1 : y0, 34, col, 0.3);
        RR(c, x - 2, cy - 1, PW + 4, 16, 5, '#010409'); RR(c, x - 1, cy, PW + 2, 14, 4, col); RR(c, x + 1, cy + 1.5, PW - 2, 3, 1.5, 'rgba(255,255,255,.2)');
        TC(c, top ? 'MERGE' : 'OPEN', x + PW / 2 + 0.5, cy + 3.5, '#ffffff', 8);
      },
      ground(c, L, sx) {
        const sc = game ? game.score : 0, dead = game && game.state === 'dead';
        R(c, 0, GY, W, GROUND, '#010409'); R(c, 0, GY, W, 0.5, '#30363d');
        let x = 8;
        for (const [s, n, on] of [['<> Code', '', 1], ['Issues', '69', 0], ['Pull requests', '420', 0], ['Actions', '', 0]]) {
          const nx = T(c, s, x, GY + 6, on ? '#e6edf3' : '#8b949e'); let ex = nx;
          if (n) { RR(c, nx + 3, GY + 4.5, n.length * 4 + 5, 7, 3.5, '#30363d'); T(c, n, nx + 5.5, GY + 6, '#e6edf3'); ex = nx + 8 + n.length * 4; }
          if (on) R(c, x - 2, GY + 13, nx - x + 4, 1.5, '#f78166');
          x = ex + 10;
        }
        R(c, 0, GY + 14.5, W, 0.5, '#30363d');
        let nx = T(c, 'mywestlord', 8, GY + 21, '#58a6ff'); nx = T(c, ' / ', nx, GY + 21, '#8b949e'); nx = T(c, 'flappening', nx, GY + 21, '#58a6ff');
        c.strokeStyle = '#30363d'; c.lineWidth = 0.6; c.beginPath(); rrPath(c, nx + 5.3, GY + 19.3, 29.4, 7.4, 3.7); c.stroke(); T(c, 'Public', nx + 8, GY + 21, '#8b949e');
        RR(c, W - 70, GY + 17.5, 62, 11, 3, '#30363d'); RR(c, W - 69.4, GY + 18.1, 60.8, 9.8, 2.5, '#21262d');
        star5(c, W - 62, GY + 23, 3.4, '#e3b341'); T(c, 'Star', W - 56, GY + 21, '#e6edf3'); R(c, W - 36, GY + 18, 0.6, 10, '#30363d'); TC(c, fmtK(sc), W - 22, GY + 21, '#e6edf3');
        E(c, 11, GY + 36, 3.2, 3.2, dead ? '#f85149' : '#3fb950'); c.strokeStyle = '#010409'; c.lineWidth = 0.9; c.beginPath();
        if (dead) { c.moveTo(9.6, GY + 34.6); c.lineTo(12.4, GY + 37.4); c.moveTo(12.4, GY + 34.6); c.lineTo(9.6, GY + 37.4); } else { c.moveTo(9.4, GY + 36.1); c.lineTo(10.6, GY + 37.3); c.lineTo(12.7, GY + 34.8); }
        c.stroke();
        T(c, dead ? 'Some checks were not successful' : 'All checks have passed', 18, GY + 34, dead ? '#f85149' : '#3fb950');
        RR(c, W - 36, GY + 31.5, 28, 9, 3, '#21262d'); T(c, 'main', W - 30, GY + 34, '#e6edf3');
        nx = T(c, charObj().name.toLowerCase().split(' ')[0], 8, GY + 45, '#e6edf3'); T(c, ' feat: flap through pipe #' + (sc + 1), nx, GY + 45, '#8b949e');
        T(c, (Math.imul(sc + 7, 2654435761) >>> 4).toString(16).padStart(7, '0').slice(0, 7), W - 36, GY + 45, '#8b949e');
        RR(c, 8, GY + 55, W - 16, 3, 1.5, '#f1e05a'); R(c, 8 + (W - 16) * 0.72, GY + 55, (W - 16) * 0.2, 3, '#e34c26'); RR(c, 8 + (W - 16) * 0.92, GY + 55, (W - 16) * 0.08, 3, 1.5, '#563d7c');
      },
      coinDraw(c, x, y, t) { const k = Math.max(0.15, Math.abs(Math.cos(t * 4))); glow(c, x, y, 14, '#e3b341', 0.32); c.save(); c.translate(x, y); c.scale(k, 1); star5(c, 0, 0.6, 9, '#0d1117'); star5(c, 0, 0, 7.4, '#e3b341'); star5(c, -0.6, -0.6, 3.4, '#f7dc8a'); c.restore(); },
      ambient(dt, r) {
        if (r < dt * 1.4) amb.push({ k: 'sq', x: Math.random() * W, y: GY - 6, vx: 0, vy: -12 - Math.random() * 12, t: 0, life: 4, c: pick(['#0e4429', '#006d32', '#26a641', '#39d353']), s: 4 });
        else if (r < dt * 1.75) amb.push({ k: 'txt', x: 8, y: GY - 12, vx: 0, vy: -14, t: 0, life: 3.5, a: 0.9, txt: pick(['build: passing', '1 new star', 'deploy: pages', 'CI: 128 passed', 'dependabot opened a PR', 'issue #69 closed']), c: '#3fb950' });
      },
      deathFX(g) {
        tint('#f85149', 0.1);
        toastBox(ctx, '#f85149', [['X This branch has conflicts that must be resolved', '#f85149'], ['<<<<<<< HEAD', '#58a6ff'], ['  bird.fly()', '#e6edf3'], ['=======', '#8b949e'], ['  pipe.exist()', '#e6edf3'], ['>>>>>>> pipe', '#a371f7']], (g.deadT * 6) | 0);
      }
    },
    // ------------------------------------------------------------ GROK
    { id: 'grok', name: 'Grok', bgc: '#000000', mark(c, x, y, s) { mkGrok(c, x, y, s * 0.86, '#ffffff'); },
      desc: 'Deep space, pure black and white. Monoliths with a slash, an event horizon behind you, the answer is 42.', death: 'SPAGHETTIFIED', deathCol: '#ffffff',
      words: ['GROKKED', 'BASED', 'MAX TRUTH', '42', 'TO MARS', "DON'T PANIC", 'FUN MODE'], coin: '#ffffff', moveFrom: 8, tempo: 92, scale: [0, 2, 3, 7, 8, 12], root: 50,
      build() {
        const L = {};
        L.sky = mk(W, H, (g) => {
          R(g, 0, 0, W, H, '#000000');
          const rg = g.createRadialGradient(W / 2, GY * 0.46, 10, W / 2, GY * 0.46, 230); rg.addColorStop(0, 'rgba(255,255,255,.1)'); rg.addColorStop(0.5, 'rgba(255,255,255,.03)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
        });
        const r = rng(14); L.stars = []; for (let i = 0; i < 110; i++) L.stars.push([r() * W * 2, r() * (GY - 10), r() * 6, r() < 0.12 ? 1.5 : r() < 0.5 ? 1 : 0.5]);
        L.mark = mk(260, 260, (g) => mkGrok(g, 130, 130, 98, '#ffffff'));
        return L;
      },
      bg(c, L, sx, t) {
        c.drawImage(L.sky, 0, 0);
        for (const s of L.stars) { const x = ((s[0] - sx * 0.04) % (W * 2) + W * 2) % (W * 2); if (x > W) continue; const tw = 0.5 + 0.5 * Math.sin(t * 3 + s[2]); R(c, x, s[1], s[3], s[3], 'rgba(255,255,255,' + (0.2 + tw * 0.8) + ')'); }
        const cx = W / 2, cy = GY * 0.46;
        glow(c, cx, cy, 130, '#ffffff', 0.07 + 0.025 * Math.sin(t * 1.5));
        c.globalAlpha = 0.16; c.drawImage(L.mark, cx - 130, cy - 130); c.globalAlpha = 1;
        for (let i = 0; i < 22; i++) {
          const a = t * (0.45 + (i % 5) * 0.11) + i * 1.7, rr = 84 + (i * 17) % 56, u = Math.cos(a) * rr, v = Math.sin(a) * rr * 0.3;
          R(c, cx + (u + v) * 0.707, cy + (v - u) * 0.707, i % 4 ? 1 : 1.5, i % 4 ? 1 : 1.5, 'rgba(255,255,255,' + (0.35 + 0.45 * Math.sin(a)) + ')');
        }
        topFade(c, '#000000', 50);
        mkGrok(c, 110, 14, 7.5, '#ffffff'); T(c, 'Grok', 124, 10, '#ffffff', 8);
      },
      pillar(c, x, y0, y1, top, p) {
        const h = y1 - y0, e = top ? y1 : y0;
        glow(c, x + PW / 2, e, 42, '#ffffff', 0.17);
        R(c, x, y0, PW, h, '#e7e7e7'); R(c, x + 1, y0, PW - 2, h, '#050505');
        c.save(); c.beginPath(); c.rect(x + 1, y0, PW - 2, h); c.clip(); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; c.beginPath();
        for (let i = -4; i < h / 12 + 6; i++) { const yy = top ? e - i * 12 : e + i * 12; c.moveTo(x, yy); c.lineTo(x + PW, yy - PW); }
        c.stroke(); c.restore();
        R(c, x - 1, top ? y1 - 3 : y0, PW + 2, 3, '#ffffff');
        const lb = ['THINK', 'SEARCH', 'FUN MODE', 'UNHINGED', 'BASED'][(p.seed >> 3) % 5], w = lb.length * 4 + 7, chy = top ? y1 - 17 : y0 + 8;
        RR(c, x + PW / 2 - w / 2, chy, w, 9, 4.5, '#e7e7e7'); RR(c, x + PW / 2 - w / 2 + 0.6, chy + 0.6, w - 1.2, 7.8, 3.9, '#050505'); TC(c, lb, x + PW / 2, chy + 2.5, '#ffffff');
        const my = top ? y1 - 36 : y0 + 36; if (top ? my > y0 + 4 : my < y1 - 6) { E(c, x + PW / 2, my, 11, 11, '#050505'); mkGrok(c, x + PW / 2, my, 8.5, '#ffffff'); }
      },
      ground(c, L, sx) {
        const sc = game ? game.score : 0, typing = game && game.state === 'play';
        R(c, 0, GY, W, GROUND, '#000000'); R(c, 0, GY, W, 0.5, '#ffffff');
        RR(c, 7, GY + 6, W - 14, 26, 13, '#3a3a3a'); RR(c, 7.6, GY + 6.6, W - 15.2, 24.8, 12.4, '#0a0a0a');
        const s = typing ? 'is this pipe real?' : 'What do you want to know?';
        T(c, s, 18, GY + 15, typing ? '#ffffff' : '#6b6b6b', 8);
        if (((now * 2) | 0) % 2) R(c, typing ? 20 + s.length * 8 : 15, GY + 14, 1, 10, '#ffffff');
        sendBtn(c, W - 21, GY + 19, 8);
        let x = 8;
        for (const [lb, on] of [['DeepSearch', 0], ['Think', typing ? 1 : 0], ['Fun mode: ON', 0]]) { const w = lb.length * 4 + 10; RR(c, x, GY + 36, w, 10, 5, on ? '#ffffff' : '#3a3a3a'); if (!on) RR(c, x + 0.6, GY + 36.6, w - 1.2, 8.8, 4.4, '#0a0a0a'); T(c, lb, x + 5, GY + 39, on ? '#000000' : '#d0d0d0'); x += w + 5; }
        T(c, 'Grok is ' + Math.max(1, 97 - sc * 3) + '% sure this bird survives.', 8, GY + 52, '#8a8a8a'); T(c, 'answer: 42', W - 48, GY + 52, '#4a4a4a');
      },
      coinDraw(c, x, y, t) { const k = Math.max(0.15, Math.abs(Math.cos(t * 4))); glow(c, x, y, 16, '#ffffff', 0.3); c.save(); c.translate(x, y); c.scale(k, 1); E(c, 0, 0, 8.4, 8.4, '#ffffff'); E(c, 0, 0, 7.4, 7.4, '#050505'); mkGrok(c, 0, 0, 5.6, '#ffffff'); c.restore(); },
      ambient(dt, r) { if (r < dt * 0.45) amb.push({ k: 'shoot', x: W + 10, y: Math.random() * GY * 0.5, vx: -250 - Math.random() * 80, vy: 80 + Math.random() * 30, t: 0, life: 1.3 }); },
      deathFX(g) {
        const u = clamp(g.deadT / 0.9, 0, 1), b = g.bird;
        if (u < 1) { const buf = grabFrame(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.7; ctx.translate(b.x * SC, b.y * SC); ctx.scale(1 - u * 0.5, 1 + u * 1.7); ctx.drawImage(buf, -b.x * SC, -b.y * SC); ctx.restore(); }
        for (let i = 0; i < 3; i++) { const rr = (1 - ((g.deadT * 1.2 + i / 3) % 1)) * 70; ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 0.55 - rr / 150) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, rr + 4, 0, Math.PI * 2); ctx.stroke(); }
        toastBox(ctx, '#ffffff', [['Thought for 0.42 seconds', '#8a8a8a'], ['Conclusion: the pipe was real.', '#ffffff'], ['Confidence: 100%. Skill: 0%.', '#ffffff'], ['Sources: trust me', '#8a8a8a']], (g.deadT * 4) | 0);
      }
    }
  );
  // carousel order + thumbnails for the classic worlds
  Object.assign(MAPS.find((m) => m.id === 'cloud'), { bgc: '#47b9ff', mark(c, x, y, s) { cloudBlob(c, x, y, s * 0.55, '#ffffff', '#d8f1ff'); } });
  Object.assign(MAPS.find((m) => m.id === 'code'), { bgc: '#1c1a17', glitch: true, mark(c, x, y, s) { c.save(); c.translate(x, y); for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 6); R(c, -s, -s * 0.11, s * 2, s * 0.22, '#d97757'); } c.restore(); } });
  Object.assign(MAPS.find((m) => m.id === 'city'), { bgc: '#6a1d74', mark(c, x, y, s) { E(c, x, y, s * 0.85, s * 0.85, '#ff8a3d'); E(c, x, y - s * 0.2, s * 0.7, s * 0.55, '#ffd36e'); for (let i = 0; i < 3; i++) R(c, x - s, y + s * 0.1 + i * s * 0.28, s * 2, s * 0.1, '#6a1d74'); } });
  Object.assign(MAPS.find((m) => m.id === 'moon'), { bgc: '#191047', mark(c, x, y, s) { E(c, x, y, s * 0.85, s * 0.85, '#efeaff'); E(c, x - s * 0.25, y - s * 0.2, s * 0.2, s * 0.2, '#d8d0f2'); E(c, x + s * 0.3, y + s * 0.25, s * 0.26, s * 0.22, '#d8d0f2'); } });
  const MAP_ORDER = ['code', 'gpt', 'grok', 'x', 'git', 'bnb', 'pump', 'tok', 'cloud', 'city', 'moon'];
  MAPS.sort((a, b) => MAP_ORDER.indexOf(a.id) - MAP_ORDER.indexOf(b.id));

  function tile(c, img, off, y, w) {
    const lw = w || img.width;
    let o = -(((off % lw) + lw) % lw);
    for (; o < W; o += lw) c.drawImage(img, Math.round(o), y || 0);
  }
  function codeLine(c, r, cols, x, yy) {
    let xx = x + 5 + ((r() * 3) | 0) * 4, rem = x + PW - 5 - xx;
    while (rem > 4) { const w = Math.min(rem, 3 + ((r() * 11) | 0)); R(c, xx, yy, w, 2, cols[(r() * cols.length) | 0]); xx += w + 2; rem -= w + 2; if (r() < 0.25) break; }
  }



  // ---------------------------------------------------------------- Claude Code style helpers (4px text = crisp on the 2x canvas)
  const CC = { txt: '#ece8e1', dim: '#8c8781', faint: '#5d5953', org: '#d97757', grn: '#7fd88f', red: '#ff8a96', blu: '#8bb3ff', pur: '#b392f0', gbg: '#183420', rbg: '#3a171d' };
  function spinStar(c, x, y, t, col) {
    const f = ((t * 8) | 0) % 6, s = [0.6, 1.2, 1.8, 2.4, 2.0, 1.4][f];
    c.fillStyle = col || CC.org;
    R(c, x - s, y - 0.4, s * 2, 0.8, c.fillStyle); R(c, x - 0.4, y - s, 0.8, s * 2, c.fillStyle);
    if (f >= 2) { c.save(); c.translate(x, y); c.rotate(Math.PI / 4); R(c, -s * 0.8, -0.4, s * 1.6, 0.8, col || CC.org); R(c, -0.4, -s * 0.8, 0.8, s * 1.6, col || CC.org); c.restore(); }
  }
  function tline(g, x, y, parts) {
    g.font = '4px ' + FONT; g.textBaseline = 'top';
    let cx = x;
    for (const p of parts) {
      if (typeof p === 'string') { g.fillStyle = CC.txt; g.fillText(p, cx, y); cx += p.length * 4; continue; }
      if (p.dot) { E(g, cx + 1.6, y + 2, 1.4, 1.4, p.dot); cx += 5; continue; }
      if (p.elbow) { R(g, cx + 1, y - 1, 0.6, 3, CC.faint); R(g, cx + 1, y + 1.4, 2.4, 0.6, CC.faint); cx += 6; continue; }
      if (p.star) { spinStar(g, cx + 2, y + 2, p.t || 0.7, p.star); cx += 6; continue; }
      if (p.box !== undefined) { g.strokeStyle = CC.dim; g.lineWidth = 0.5; g.strokeRect(cx + 0.25, y + 0.25, 3.2, 3.2); if (p.box) { R(g, cx + 1, y + 1, 1.8, 1.8, CC.grn); } cx += 6; continue; }
      if (p.bg) { R(g, x - 2, y - 1, W - x - 4, 6, p.bg); continue; }
      g.fillStyle = p.c || CC.txt; g.fillText(p.s, cx, y); cx += p.s.length * 4;
    }
  }
  function drawTranscript(g, height) {
    const lines = [];
    const add = (...p) => lines.push(p);
    const blank = () => lines.push(null);
    const sess = [
      () => { add({ s: '> ', c: CC.dim }, { s: 'make the bird fly between the pipes', c: CC.dim }); blank(); },
      () => { add({ dot: CC.txt }, "I'll add flap physics and collisions."); blank(); },
      () => { add({ dot: CC.grn }, { s: 'Read', c: CC.txt }, { s: '(src/bird.ts)', c: CC.dim }); add('  ', { elbow: 1 }, { s: 'Read 128 lines (ctrl+r to expand)', c: CC.dim }); blank(); },
      () => {
        add({ dot: CC.org }, { s: 'Update', c: CC.txt }, { s: '(src/bird.ts)', c: CC.dim });
        add('  ', { elbow: 1 }, { s: 'Updated src/bird.ts with 2 additions and 1 removal', c: CC.dim });
        add({ bg: CC.gbg }, { s: '    12 ', c: CC.faint }, { s: '+ ', c: CC.grn }, { s: 'const lift = -372;', c: '#a9e7b4' });
        add({ bg: CC.rbg }, { s: '    13 ', c: CC.faint }, { s: '- ', c: CC.red }, { s: 'const lift = -300;', c: '#ffb3bb' });
        add({ bg: CC.gbg }, { s: '    14 ', c: CC.faint }, { s: '+ ', c: CC.grn }, { s: 'bird.flap(lift);', c: '#a9e7b4' });
        blank();
      },
      () => { add({ dot: CC.grn }, { s: 'Bash', c: CC.txt }, { s: '(npm test)', c: CC.dim }); add('  ', { elbow: 1 }, { s: 'PASS  ', c: CC.grn }, { s: '42 tests, 0 failed', c: CC.dim }); blank(); },
      () => { add({ dot: CC.org }, { s: 'Update Todos', c: CC.txt }); add('  ', { elbow: 1 }, { box: 1 }, { s: 'flap', c: CC.dim }); add('     ', { box: 1 }, { s: 'dodge the pipes', c: CC.dim }); add('     ', { box: 0 }, { s: 'get rich', c: CC.txt }); blank(); },
      () => { add({ star: CC.org }, { s: 'Flapping... ', c: '#e8936f' }, { s: '(12s · 1.2k tokens)', c: CC.dim }); blank(); },
      () => { add({ s: '> ', c: CC.dim }, { s: 'now make it go faster', c: CC.dim }); blank(); },
      () => { add({ dot: CC.blu }, { s: 'Grep', c: CC.txt }, { s: '("speed", src/)', c: CC.dim }); add('  ', { elbow: 1 }, { s: 'Found 3 matches', c: CC.dim }); blank(); },
      () => { add({ dot: CC.grn }, { s: 'Bash', c: CC.txt }, { s: '(git push origin main)', c: CC.dim }); add('  ', { elbow: 1 }, { s: 'main -> main', c: CC.dim }); blank(); },
      () => { add({ dot: CC.txt }, 'Done. The bird now ships at 60 fps.'); blank(); }
    ];
    // welcome box
    g.strokeStyle = CC.org; g.lineWidth = 0.75; g.beginPath(); if (g.roundRect) g.roundRect(6.5, 8.5, 150, 30, 3); else g.rect(6.5, 8.5, 150, 30); g.stroke();
    tline(g, 12, 14, [{ star: CC.org }, { s: 'Welcome to Claude Code!', c: CC.txt }]);
    tline(g, 12, 23, [{ s: '/help for help, /status for setup', c: CC.dim }]);
    tline(g, 12, 30, [{ s: 'cwd: ~/flappening', c: CC.dim }]);
    let y = 48, i = 0;
    while (y < height - 8) {
      lines.length = 0; sess[i % sess.length]();
      for (const ln of lines) { if (ln) tline(g, 8, y, ln); y += 7; if (y > height - 8) break; }
      i++;
    }
  }
  function drawToken(c, x, y, t) {
    const w = Math.max(1, Math.abs(Math.cos(t * 4)) * 6.5);
    glow(c, x, y, 14, '#d97757', 0.28);
    RR(c, x - w - 1, y - 7.5, (w + 1) * 2, 15, 3, OUTL); RR(c, x - w, y - 6.5, w * 2, 13, 2.5, '#d97757'); RR(c, x - w + 1, y - 5.5, Math.max(0.5, w * 2 - 2), 4, 2, '#f0a283');
    if (w > 3) spinStar(c, x, y + 1, t * 0.6 + 0.5, '#fff4ec');
  }

  // ---------------------------------------------------------------- pipe skins (any world)
  function capsule(c, x, y, w, h, col, lightC, darkC) {
    RR(c, x, y, w, h, Math.min(w, h) / 2, darkC); RR(c, x, y, w - 2, h - 1.5, Math.min(w, h) / 2, col); RR(c, x + 2, y + 1.5, w * 0.35, h - 4, Math.min(w, h) / 3, lightC);
  }
  const SKINS = [
    { id: 'default', name: 'World Default', desc: 'Each world brings its own: marble, terminals, neon towers, candles.' },
    { id: 'sausage', name: 'Sausage Stack', desc: 'Grilled links all the way up, mustard drizzle, a bun on top.',
      draw(c, x, y0, y1, top, p) {
        const cx = x + PW / 2, lw = 32, lh = 17;
        const edge = top ? y1 : y0;
        const n = Math.ceil((y1 - y0) / lh) + 1;
        for (let i = 0; i < n; i++) {
          const yy = top ? edge - 12 - (i + 1) * lh : edge + 12 + i * lh;
          if (yy > y1 + 2 || yy + lh < y0 - 2) continue;
          capsule(c, cx - lw / 2, yy, lw, lh + 1, '#c9522b', '#ec8a5f', '#8a3418');
          for (const gx of [-7, 1, 9]) { c.strokeStyle = '#7a2a14'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx + gx - 3, yy + 4); c.lineTo(cx + gx + 2, yy + lh - 4); c.stroke(); }
          R(c, cx - lw / 2 + 4, yy + lh - 0.5, lw - 8, 1.5, '#5a1e0e');
        }
        c.strokeStyle = '#ffd43b'; c.lineWidth = 1.6; c.beginPath();
        for (let yy = y0; yy <= y1; yy += 5) c.lineTo(cx + (((yy / 5) | 0) % 2 ? -6 : 6), yy);
        c.stroke();
        const by = top ? y1 - 14 : y0;
        RR(c, x - 1, by, PW + 2, 14, 6, '#b8752e'); RR(c, x, by + (top ? 0 : 1), PW, 12, 5, '#f2c27b'); RR(c, x + 4, by + (top ? 2 : 3), PW * 0.5, 3, 2, '#ffe2ad');
        for (let i = 0; i < 6; i++) E(c, x + 7 + i * 6, by + (top ? 8 : 6), 1.2, 0.7, '#fff6e0');
        c.strokeStyle = OUTL; c.lineWidth = 1; c.beginPath(); if (c.roundRect) c.roundRect(x - 0.5, by + 0.5, PW + 1, 13, 6); c.stroke();
      } },
    { id: 'rocket', name: 'Rocket Silo', desc: 'Every pipe is a rocket. Nose cones point right at you.',
      draw(c, x, y0, y1, top, p) {
        const bx = x + 7, bw = PW - 14, edge = top ? y1 : y0, cone = 18;
        const b0 = top ? y0 : y0 + cone, b1 = top ? y1 - cone : y1;
        R(c, bx, b0, bw, b1 - b0, '#eef1f8'); R(c, bx, b0, 4, b1 - b0, '#ffffff'); R(c, bx + bw - 6, b0, 6, b1 - b0, '#c6ccdb');
        for (let yy = top ? b1 - 14 : b0 + 8; top ? yy > y0 - 20 : yy < y1; yy += top ? -36 : 36) { R(c, bx, yy, bw, 4, '#ff4d4d'); E(c, x + PW / 2, yy + (top ? -12 : 16), 4, 4, '#4a5a7a'); E(c, x + PW / 2, yy + (top ? -12 : 16), 3, 3, '#58c4ff'); R(c, x + PW / 2 - 2, yy + (top ? -14 : 14), 1, 1, '#ffffff'); }
        if (top) { P(c, [bx, b1, bx + bw, b1, x + PW / 2, edge], '#ff4d4d'); P(c, [bx, b1, x + PW / 2 - 2, b1, x + PW / 2, edge], '#ff8a8a'); }
        else { P(c, [bx, b0, bx + bw, b0, x + PW / 2, edge], '#ff4d4d'); P(c, [bx, b0, x + PW / 2 - 2, b0, x + PW / 2, edge], '#ff8a8a'); }
        const fy = top ? b1 - 12 : b0 + 4;
        P(c, [bx, fy, bx - 6, fy + (top ? -10 : 10), bx, fy + (top ? -12 : 12)], '#ff4d4d'); P(c, [bx + bw, fy, bx + bw + 6, fy + (top ? -10 : 10), bx + bw, fy + (top ? -12 : 12)], '#ff4d4d');
        c.strokeStyle = OUTL; c.lineWidth = 1; c.strokeRect(bx + 0.5, b0 - (top ? 1 : 0), bw - 1, b1 - b0 + 1);
        c.beginPath(); if (top) { c.moveTo(bx, b1); c.lineTo(x + PW / 2, edge); c.lineTo(bx + bw, b1); } else { c.moveTo(bx, b0); c.lineTo(x + PW / 2, edge); c.lineTo(bx + bw, b0); } c.stroke();
        c.font = '8px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = '#ff4d4d';
        const ty = top ? b1 - 30 : b0 + 22; if ((top && ty > y0 + 4) || (!top && ty < y1 - 10)) { c.save(); c.translate(x + PW / 2, ty); c.fillText('69', 0, 0); c.restore(); }
        c.textAlign = 'left';
      } },
    { id: 'candy', name: 'Candy Canes', desc: 'Striped poles, wrapped sweets on top. Sugar rush included.',
      draw(c, x, y0, y1, top, p) {
        const bx = x + 9, bw = PW - 18;
        R(c, bx, y0, bw, y1 - y0, '#ffffff');
        c.save(); c.beginPath(); c.rect(bx, y0, bw, y1 - y0); c.clip();
        const cols = [['#ff3b5c', '#ffd1db'], ['#2ec4b6', '#c7fff8'], ['#9b5de5', '#e6d3ff']][p.seed % 3];
        for (let yy = y0 - 40; yy < y1 + 20; yy += 14) P(c, [bx - 4, yy, bx + bw + 4, yy + 12, bx + bw + 4, yy + 19, bx - 4, yy + 7], cols[0]);
        R(c, bx, y0, 3, y1 - y0, 'rgba(255,255,255,.5)'); R(c, bx + bw - 4, y0, 4, y1 - y0, 'rgba(0,0,0,.12)');
        c.restore();
        c.strokeStyle = OUTL; c.lineWidth = 1; c.strokeRect(bx + 0.5, y0 - 1, bw - 1, y1 - y0 + 2);
        const cy = top ? y1 - 9 : y0 + 9;
        P(c, [x + 2, cy - 7, x + 10, cy, x + 2, cy + 7], cols[1]); P(c, [x + PW - 2, cy - 7, x + PW - 10, cy, x + PW - 2, cy + 7], cols[1]);
        E(c, x + PW / 2, cy, 13, 9.5, OUTL); E(c, x + PW / 2, cy, 12, 8.5, cols[0]); E(c, x + PW / 2 - 3, cy - 3, 5, 3, '#ffffff');
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.4; c.beginPath(); c.arc(x + PW / 2, cy, 5, 0.3, 2.6); c.stroke();
      } },
    { id: 'cactus', name: 'Desert Cactus', desc: 'Spiky, green, blooming. Do not hug.',
      draw(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 1 : 2));
        const bx = x + 8, bw = PW - 16;
        const arms = [];
        for (let k = 0; k < 2; k++) { const ay = y0 + 30 + r() * Math.max(1, y1 - y0 - 60); if (y1 - y0 > 70) arms.push([ay, r() < 0.5 ? -1 : 1]); }
        for (const [ay, sd] of arms) {
          const ax = sd < 0 ? bx - 9 : bx + bw - 1;
          RR(c, sd < 0 ? ax : bx + bw - 3, ay, 12, 9, 4, '#2f9e4f'); RR(c, ax, ay - 20, 10, 26, 5, '#3cb95e'); R(c, ax + 2, ay - 18, 2, 22, '#6fe08b');
          c.strokeStyle = OUTL; c.lineWidth = 1; c.beginPath(); if (c.roundRect) c.roundRect(ax + 0.5, ay - 19.5, 9, 25, 5); c.stroke();
        }
        RR(c, bx, y0 - 8, bw, y1 - y0 + 16, 11, '#3cb95e');
        for (let fx = bx + 4; fx < bx + bw - 3; fx += 6) R(c, fx, y0, 1.2, y1 - y0, '#2f9e4f');
        R(c, bx + 3, y0, 2, y1 - y0, '#6fe08b');
        for (let i = 0; i < (y1 - y0) / 9; i++) { const sy = y0 + 4 + i * 9 + r() * 4, sx = bx + 2 + r() * (bw - 4); R(c, sx, sy, 1, 1, '#f4ffe8'); R(c, sx - 1, sy - 1, 1, 1, '#f4ffe8'); }
        c.strokeStyle = OUTL; c.lineWidth = 1; c.beginPath(); if (c.roundRect) c.roundRect(bx + 0.5, y0 - 7.5, bw - 1, y1 - y0 + 15, 11); c.stroke();
        const fy = top ? y1 + 1 : y0 - 1;
        for (let i = 0; i < 5; i++) { const a = i * 1.256; E(c, x + PW / 2 + Math.cos(a) * 4, fy + Math.sin(a) * 2.6, 3.2, 2.2, '#ff5ca8', a); }
        E(c, x + PW / 2, fy, 2.2, 1.8, '#ffd23f');
      } },
    { id: 'pencil', name: 'Giant Pencils', desc: 'Freshly sharpened. The tips point straight into the gap.',
      draw(c, x, y0, y1, top, p) {
        const bx = x + 6, bw = PW - 12, tip = 20, edge = top ? y1 : y0;
        const b0 = top ? y0 : y0 + tip, b1 = top ? y1 - tip : y1;
        const col = ['#ffd23f', '#38e0ff', '#ff4fa3', '#7dffb0'][p.seed % 4];
        R(c, bx, b0, bw, b1 - b0, col); R(c, bx + bw / 3, b0, 1, b1 - b0, 'rgba(0,0,0,.18)'); R(c, bx + bw * 2 / 3, b0, 1, b1 - b0, 'rgba(0,0,0,.18)'); R(c, bx, b0, 3, b1 - b0, 'rgba(255,255,255,.45)');
        c.font = '4px ' + FONT; c.fillStyle = 'rgba(27,16,48,.55)'; c.save(); c.translate(bx + bw / 2 + 2, (b0 + b1) / 2); c.rotate(Math.PI / 2); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FLAPPENING  HB', 0, 0); c.restore(); c.textAlign = 'left';
        const wy = top ? b1 : b0;
        P(c, [bx, wy, bx + bw, wy, x + PW / 2 + 4, edge + (top ? -6 : 6), x + PW / 2 - 4, edge + (top ? -6 : 6)], '#f2c891');
        P(c, [x + PW / 2 + 4, edge + (top ? -6 : 6), x + PW / 2 - 4, edge + (top ? -6 : 6), x + PW / 2, edge], '#3a3340');
        c.strokeStyle = OUTL; c.lineWidth = 1; c.strokeRect(bx + 0.5, b0 - (top ? 1 : 0), bw - 1, b1 - b0 + 1);
        c.beginPath(); c.moveTo(bx, wy); c.lineTo(x + PW / 2, edge); c.lineTo(bx + bw, wy); c.stroke();
      } },
    { id: 'gold', name: '$FLAP Stacks', desc: 'Towers of gold coins. Number go up. Number go down.',
      draw(c, x, y0, y1, top, p) {
        const r = rng(p.seed + (top ? 4 : 8));
        const edge = top ? y1 : y0;
        for (let yy = top ? edge - 6 : edge; top ? yy > y0 - 6 : yy < y1; yy += top ? -6 : 6) {
          const jx = (r() - 0.5) * 4;
          RR(c, x + 4 + jx, yy, PW - 8, 6, 3, '#a8720a'); RR(c, x + 4 + jx, yy, PW - 8, 4.5, 2.5, '#ffd23f'); R(c, x + 8 + jx, yy + 1, PW * 0.35, 1, '#fff2a8');
          R(c, x + 4 + jx + (PW - 8) * 0.7, yy + 1, 1, 3, '#e0a100');
        }
        const cy = top ? y1 - 6 : y0;
        RR(c, x + 2, cy - (top ? 0 : 2), PW - 4, 8, 4, '#ffd23f'); c.font = '8px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = '#a8720a'; c.fillText('$', x + PW / 2, cy - (top ? 0 : 2)); c.textAlign = 'left';
        if (((now * 3 + p.seed) | 0) % 5 === 0) { const sx = x + 6 + (p.seed % 30), sy = cy + 2; R(c, sx - 2, sy, 5, 1, '#ffffff'); R(c, sx, sy - 2, 1, 5, '#ffffff'); }
        glow(c, x + PW / 2, edge, 30, '#ffd23f', 0.18);
      } },
    { id: 'mix', name: 'Chaos Mix', desc: 'Every pipe is a surprise. Sausage, rocket, candy, cactus, pencil, gold.' }
  ];
  const skinObj = () => SKINS.find((s) => s.id === S.skin) || SKINS[0];
  function drawPillar(c, m, x, y0, y1, top, p) {
    let sk = S.skin;
    if (sk === 'mix') sk = p.mix || 'default';
    const s = SKINS.find((q) => q.id === sk);
    if (!s || !s.draw) m.pillar(c, x, y0, y1, top, p); else s.draw(c, x, y0, y1, top, p);
  }

  // ---------------------------------------------------------------- audio (all synthesised)
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, master = null, musicGain = null, musicTimer = null, nextNote = 0, step = 0;
  const S = {
    char: store.get('char', 'wurst'), map: store.get('map', 'cloud'), coins: store.get('coins', 0),
    owned: store.get('owned', ['wurst', 'moon', 'duck']), best: store.get('best', {}), sound: store.get('sound', true),
    name: store.get('name', ''), bestAny: store.get('bestAny', 0), skin: store.get('skin', 'default')
  };
  function audio() {
    if (!AC) return;
    if (!ac) {
      ac = new AC(); master = ac.createGain(); master.gain.value = S.sound ? 0.5 : 0; master.connect(ac.destination);
      musicGain = ac.createGain(); musicGain.gain.value = 0.3; musicGain.connect(master);
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
  function noise(dur, vol, hp) {
    if (!ac) return;
    const b = ac.createBuffer(1, Math.max(1, ac.sampleRate * dur | 0), ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; g.gain.value = vol;
    if (hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; s.connect(f); f.connect(g); } else s.connect(g);
    g.connect(master); s.start();
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const at = (d) => (ac ? ac.currentTime + d : 0);
  const FLAPS = {
    chirp() { tone(1400, 0.05, 'square', 0.04, 1.4); tone(1800, 0.06, 'square', 0.035, 1.2, at(0.05)); },
    boost() { noise(0.16, 0.12, 800); tone(180, 0.15, 'sawtooth', 0.05, 2); },
    quack() { tone(520, 0.08, 'square', 0.06, 0.6); tone(480, 0.09, 'square', 0.05, 0.6, at(0.09)); },
    coo() { tone(320, 0.14, 'triangle', 0.09, 0.8); },
    pop() { tone(620, 0.06, 'sine', 0.12, 1.8); },
    ding() { tone(1320, 0.18, 'triangle', 0.07); tone(1980, 0.12, 'sine', 0.03); },
    squawk() { tone(900, 0.12, 'sawtooth', 0.04, 0.6); },
    thud() { tone(110, 0.12, 'square', 0.1, 0.6); noise(0.06, 0.12); },
    meow() { tone(700, 0.08, 'sine', 0.08, 1.4); tone(900, 0.12, 'sine', 0.07, 0.6, at(0.08)); }
  };
  const SFX = {
    flap() { (FLAPS[charObj().sfx] || FLAPS.chirp)(); },
    score() { tone(988, 0.07, 'square', 0.045); tone(1319, 0.12, 'square', 0.045, 0, at(0.07)); },
    coin() { tone(1568, 0.05, 'square', 0.035); tone(2093, 0.1, 'square', 0.035, 0, at(0.05)); },
    power() { [0, 4, 7, 12].forEach((n, i) => tone(mtof(72 + n), 0.1, 'square', 0.05, 0, at(i * 0.06))); },
    fanfare() { [0, 4, 7, 12, 16].forEach((n, i) => tone(mtof(67 + n), 0.16, 'square', 0.05, 0, at(i * 0.07))); tone(mtof(79), 0.5, 'triangle', 0.06, 0, at(0.35)); },
    close() { noise(0.25, 0.1, 2000); tone(1700, 0.2, 'sine', 0.04, 0.6); },
    hit() { noise(0.22, 0.35); tone(150, 0.3, 'sawtooth', 0.12, 0.35); },
    shield() { tone(600, 0.2, 'triangle', 0.12, 2.2); noise(0.08, 0.15); },
    die() { tone(520, 0.6, 'triangle', 0.12, 0.25); },
    boom() { noise(0.4, 0.3); tone(90, 0.4, 'sine', 0.2, 0.5); },
    click() { tone(700, 0.04, 'square', 0.035); },
    swish() { noise(0.18, 0.08, 1200); }
  };
  function schedule() {
    if (!ac || !S.sound) return;
    const m = mapObj(); const spb = 60 / m.tempo / 2;
    while (nextNote < ac.currentTime + 0.25) {
      const bar = (step >> 3) % 4, s = step % 8;
      const prog = [0, 5, 3, 4][bar], sc = m.scale;
      const playing = game && game.state === 'play';
      if (s % 2 === 0) tone(mtof(m.root - 24 + sc[prog % sc.length]), spb * 1.6, 'triangle', 0.09, 0, nextNote, musicGain);
      if (playing || s % 2 === 1) {
        const n = sc[(prog + [0, 2, 4, 2, 5, 4, 2, 1][s]) % sc.length] + (s > 3 ? 12 : 0);
        tone(mtof(m.root + n), spb * 0.9, 'square', 0.02, 0, nextNote, musicGain);
      }
      if (playing && (s === 0 || s === 4)) { const t0 = nextNote; setTimeout(() => { if (ac && S.sound) noise(0.04, 0.05); }, Math.max(0, (t0 - ac.currentTime) * 1000)); }
      if (playing && (s === 2 || s === 6)) { const t0 = nextNote; setTimeout(() => { if (ac && S.sound) noise(0.02, 0.025, 6000); }, Math.max(0, (t0 - ac.currentTime) * 1000)); }
      nextNote += spb; step++;
    }
  }
  function setSound(on) {
    S.sound = on; store.set('sound', on); $('#btn-sound').textContent = on ? '♪' : '×';
    if (master) master.gain.value = on ? 0.5 : 0;
  }

  // ---------------------------------------------------------------- state
  const charObj = () => CHARS.find((c) => c.id === S.char) || CHARS[0];
  const mapObj = () => MAPS.find((m) => m.id === S.map) || MAPS[0];
  const owns = (c) => S.owned.includes(c.id) || (c.unlock && S.bestAny >= c.unlock) || (!c.price && !c.unlock);
  let layers = {}, vignette = null;
  function buildLayers() {
    layers = {}; for (const m of MAPS) layers[m.id] = m.build();
    vignette = mk(W, H, (g) => { const gr = g.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.75); gr.addColorStop(0, 'rgba(10,4,30,0)'); gr.addColorStop(1, 'rgba(10,4,30,.42)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
  }

  let now = 0, game = null, menuScroll = 0;
  const parts = [], pops = [];
  let banner = null, trans = null, hudCoinBump = 0;

  function newGame() {
    const ch = charObj();
    game = {
      state: 'ready', t: 0, score: 0, coins: 0, speed: 112, scroll: 0, pillars: [], items: [], spawned: 0, lastCy: GY * 0.48,
      bird: { x: 74, y: GY * 0.45, vy: 0, rot: 0, ft: 0, f: 1, flapT: 0, sq: 0, blinkT: 2 + Math.random() * 2 },
      shield: 0, magnet: 0, inv: 0, deadT: 0, shake: 0, flash: 0, overShown: false, freeze: 0, slow: 0, flaps: 0,
      rubber: ch.id === 'duck', lives: ch.id === 'cat' ? 1 : 0, scorePop: 0, glitch: 0, bombs: [], combo: 0, comboPop: 0, fever: 0, ghosts: [], ghostT: 0, bolt: 0, boltNext: 5 + Math.random() * 6, boltX: 0
    };
    parts.length = 0; pops.length = 0; banner = null;
  }
  const perk = (id) => game && charObj().id === id;

  function spawnPillar() {
    const m = mapObj(), g = game, r = Math.random;
    const gap = Math.max(96, 134 - g.score * 0.85);
    const minC = 46 + gap / 2, maxC = GY - 34 - gap / 2;
    const cy = clamp(g.lastCy + (r() * 2 - 1) * 120, minC, maxC);
    g.lastCy = cy;
    const p = { x: W + 8, cy, gap, seed: (r() * 1e9) | 0, passed: false, amp: 0, ph: r() * 6.28, spd: 1.4 + r() * 1.2 };
    if (g.score >= m.moveFrom && r() < (m.id === 'moon' ? 0.75 : 0.5)) p.amp = Math.min(30, 10 + g.score * 0.5);
    if (S.skin === 'mix') p.mix = ['default', 'sausage', 'rocket', 'candy', 'cactus', 'pencil', 'gold'][(r() * 7) | 0];
    g.pillars.push(p);
    g.spawned++;
    let kind = null;
    if (g.spawned % 11 === 6) kind = 'shield'; else if (g.spawned % 17 === 12) kind = 'magnet'; else if (r() < 0.75) kind = 'coin';
    if (kind) g.items.push({ kind, p, dx: PW / 2, dy: 0, got: false, x: 0, y: 0 });
  }
  const pcy = (p) => p.cy + (p.amp ? Math.sin(now * p.spd + p.ph) * p.amp : 0);

  // ---------------------------------------------------------------- particles
  function addP(o) { if (parts.length < 420) parts.push(Object.assign({ life: 0.5, max: 0.5, s: 2, g: 0, kind: 'px', rot: 0, vr: 0 }, o)); }
  function burst(x, y, n, cols, spd, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (spd || 120) * (0.3 + Math.random());
      addP({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.6 + Math.random() * 0.5, max: 1.1, c: cols[i % cols.length], s: 2 + (Math.random() < 0.3 ? 1 : 0), g: 320, kind: kind || 'px', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
    }
  }
  function confetti(n) {
    const cols = ['#ffd23f', '#ff4fa3', '#38e0ff', '#7dffb0', '#ffffff', '#b98cff'];
    for (let i = 0; i < n; i++) addP({ x: Math.random() * W, y: -10 - Math.random() * 40, vx: (Math.random() - 0.5) * 60, vy: 40 + Math.random() * 80, life: 2.2, max: 2.2, c: cols[i % cols.length], s: 3, g: 60, kind: 'confetti', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
  }
  function ring(x, y, col, r0, r1, life) { addP({ x, y, vx: 0, vy: 0, r0, r1, c: col, life: life || 0.4, max: life || 0.4, kind: 'ring' }); }
  function pop(x, y, txt, col, size) { pops.push({ x, y, txt, col: col || '#ffffff', life: 1, size: size || 8 }); }

  function flapTrail() {
    const b = game.bird, ch = charObj(), id = ch.id;
    for (let i = 0; i < 3; i++) addP({ x: b.x - 10, y: b.y + 4, vx: -40 - Math.random() * 50, vy: 20 + Math.random() * 40, life: 0.4, max: 0.4, c: ch.puff, s: 2 });
    ring(b.x - 6, b.y + 4, '#ffffff', 4, 16, 0.3);
    if (id === 'wurst') for (let i = 0; i < 3; i++) addP({ x: b.x - 4 + i * 4, y: b.y + 10, vx: -30 + Math.random() * 20, vy: 10, g: 500, life: 0.7, max: 0.7, c: i % 2 ? '#ffd43b' : '#ff3b30', s: 2 });
    if (id === 'moon') { for (let i = 0; i < 6; i++) addP({ x: b.x - 18, y: b.y + 6, vx: -120 - Math.random() * 80, vy: (Math.random() - 0.5) * 60, life: 0.35, max: 0.35, c: i % 2 ? '#ffe14d' : '#ff6a1c', s: 3 }); }
    if (id === 'duck') { ring(b.x + 12, b.y - 6, '#bfefff', 2, 8, 0.4); if (game.flaps % 4 === 0) pop(b.x + 18, b.y - 18, 'QUACK', '#ffe066'); }
    if (id === 'capy') addP({ x: b.x + 4, y: b.y - 12, vx: -30, vy: -20, g: 60, life: 0.9, max: 0.9, c: '#7dd36b', s: 2, kind: 'leaf', rot: 0, vr: 6 });
    if (id === 'toast') for (let i = 0; i < 4; i++) addP({ x: b.x + (Math.random() - 0.5) * 16, y: b.y + 8, vx: (Math.random() - 0.5) * 40, vy: 20, g: 400, life: 0.6, max: 0.6, c: i % 2 ? '#c47a35' : '#ffe066', s: 1.5 });
    if (id === 'gull') addP({ x: b.x - 8, y: b.y, vx: -40, vy: 10, g: 40, life: 1.2, max: 1.2, c: '#ffffff', kind: 'feather', rot: 0, vr: 3 });
    if (id === 'brick') for (let i = 0; i < 4; i++) addP({ x: b.x + (Math.random() - 0.5) * 20, y: b.y + 10, vx: (Math.random() - 0.5) * 50, vy: 30, g: 600, life: 0.6, max: 0.6, c: '#c2452d', s: 2 });
    if (id === 'cat') addP({ x: b.x + 10, y: b.y - 14, vx: 10, vy: -40, g: -10, life: 0.8, max: 0.8, c: '#ff6b9a', kind: 'heart' });
    if (id === 'pigeon') addP({ x: b.x - 14, y: b.y + 6, vx: -60, vy: -10, life: 0.6, max: 0.6, c: 'rgba(200,205,215,.8)', kind: 'smoke', r0: 3, r1: 8 });
  }

  function flap() {
    audio();
    if (!game) return;
    const b = game.bird;
    if (game.state === 'ready') { game.state = 'play'; }
    if (game.state !== 'play') return;
    b.vy = perk('moon') ? -398 : -372; b.flapT = 0.28; b.sq = 1; game.flaps++;
    SFX.flap(); flapTrail();
  }

  function hitRect(cx, cy, r, x, y, w, h) {
    const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h);
    return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
  }

  function die() {
    const g = game; if (g.state !== 'play') return;
    g.state = 'dead'; g.deadT = 0; g.shake = 0.45; g.flash = 0.2; g.freeze = 0.14; g.glitch = mapObj().glitch ? 0.9 : 0;
    SFX.hit(); setTimeout(() => SFX.die(), 260);
    const ch = charObj();
    burst(g.bird.x, g.bird.y, 26, [ch.puff, '#ffffff', '#ff4fa3', '#ffd23f'], 170);
    for (let i = 0; i < 6; i++) addP({ x: g.bird.x, y: g.bird.y, vx: (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 60, g: 120, life: 1.6, max: 1.6, c: '#ffffff', kind: 'feather', rot: Math.random() * 6, vr: 4 });
    ring(g.bird.x, g.bird.y, '#ffffff', 6, 46, 0.45);
    S.coins += g.coins; store.set('coins', S.coins);
    const m = mapObj(), prev = S.best[m.id] || 0;
    g.newBest = g.score > prev;
    if (g.newBest) { S.best[m.id] = g.score; store.set('best', S.best); }
    if (g.score > S.bestAny) { S.bestAny = g.score; store.set('bestAny', S.bestAny); }
    updateCoins();
  }

  function gainCoins(n, x, y) {
    const g = game;
    const mult = (perk('pigeon') || perk('shark') ? 2 : 1) * (g.fever > 0 ? 2 : 1);
    g.coins += n * mult;
    addP({ kind: 'coinfly', x0: x, y0: y, x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, c: mapObj().coin });
  }

  function onPass(p, cy) {
    const g = game, b = g.bird, m = mapObj();
    p.passed = true; g.score++; g.scorePop = 1; SFX.score();
    const top = cy - p.gap / 2, bot = cy + p.gap / 2;
    const edge = Math.min(b.y - top, bot - b.y);
    const pw = perk('toast') ? 14 : 9;
    const isPerfect = Math.abs(b.y - cy) < pw, isClose = !isPerfect && edge < 15;
    if (isPerfect || isClose) { g.combo++; g.comboPop = 1; } else g.combo = 0;
    if ((g.combo >= 3 || g.score % 25 === 0) && g.fever <= 0) startFever();
    if (isPerfect) { gainCoins(1, b.x, b.y); pop(b.x, b.y - 24, 'PERFECT', '#7dffb0'); ring(b.x, b.y, '#7dffb0', 8, 30, 0.35); }
    else if (edge < 15) { g.slow = 0.32; SFX.close(); pop(b.x + 6, b.y - 24, 'CLOSE!', '#ff4fa3', 16); ring(b.x, b.y, '#ff4fa3', 6, 36, 0.4); }
    else if (g.score % 5 === 0 || Math.random() < 0.3) pop(b.x + 10, b.y - 22, m.words[(Math.random() * m.words.length) | 0], '#ffffff');
    if (perk('wurst') && g.score % 5 === 0) { gainCoins(1, b.x, b.y); pop(b.x - 10, b.y + 18, 'SNACK +1$', '#ffd43b'); }
    if (perk('brick')) gainCoins(1, b.x, b.y);
    if (perk('pigeon') && g.score % 10 === 0) g.bombs.push({ x: b.x, y: b.y + 10, vy: 0 });
    if (g.score % 10 === 0) {
      banner = { txt: g.score + '!', sub: ['ON FIRE', 'UNSTOPPABLE', 'MENACE', 'LEGEND', 'GOATED', 'NO WAY'][Math.min(5, g.score / 10 - 1)], t: 0 };
      confetti(70); g.flash = 0.08; SFX.fanfare();
    }
  }

  function startFever() {
    const g = game; g.fever = perk('burger') ? 12 : 6; g.combo = 0;
    banner = { txt: 'FEVER!', sub: 'COINS X2  ·  ' + g.fever + ' SECONDS', t: 0 };
    confetti(60); g.flash = 0.1; SFX.fanfare(); SFX.power();
  }

  // ---------------------------------------------------------------- update
  function update(dtReal) {
    now += dtReal;
    let dt = dtReal;
    if (game && game.slow > 0) { game.slow -= dtReal; dt *= 0.38; }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { if (p.kind === 'coinfly') hudCoinBump = 1; parts.splice(i, 1); continue; }
      if (p.kind === 'coinfly') { const u = ease(1 - p.life / p.max); p.x = p.x0 + (16 - p.x0) * u; p.y = p.y0 + (84 - p.y0) * u - Math.sin(u * Math.PI) * 40; continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.kind === 'feather') p.vx += Math.sin(now * 5 + p.rot) * 30 * dt;
    }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.life -= dt; p.y -= 26 * dt; if (p.life <= 0) pops.splice(i, 1); }
    if (banner) { banner.t += dt; if (banner.t > 1.6) banner = null; }
    hudCoinBump = Math.max(0, hudCoinBump - dt * 4);
    if (trans) { trans.t += dtReal; if (!trans.fired && trans.t >= trans.dur / 2) { trans.fired = true; trans.mid(); } if (trans.t >= trans.dur) trans = null; }
    ambientUpdate(dt);
    if (!game) { menuScroll += 60 * dt; return; }
    const g = game, b = g.bird, m = mapObj(), ch = charObj();
    g.t += dt; g.fever = Math.max(0, g.fever - dt); g.comboPop = Math.max(0, g.comboPop - dt * 3); g.bolt = Math.max(0, g.bolt - dtReal);
    g.ghostT += dt; if (g.ghostT > 0.035) { g.ghostT = 0; g.ghosts.push({ x: b.x, y: b.y, rot: b.rot, f: b.f }); if (g.ghosts.length > 8) g.ghosts.shift(); }
    if (m.id === 'city' && g.state === 'play') { g.boltNext -= dt; if (g.boltNext < 0) { g.bolt = 0.3; g.boltX = 30 + Math.random() * (W - 60); g.boltNext = 7 + Math.random() * 9; setTimeout(() => noise(0.9, 0.22), 250); } }
    g.shake = Math.max(0, g.shake - dt); g.flash = Math.max(0, g.flash - dt); g.scorePop = Math.max(0, g.scorePop - dt * 3); g.glitch = Math.max(0, g.glitch - dt);
    b.ft += dt * (b.flapT > 0 ? 22 : 11); b.flapT = Math.max(0, b.flapT - dt); b.f = (b.ft | 0) % 6; b.sq = Math.max(0, b.sq - dt * 5);
    b.blinkT -= dt; if (b.blinkT < -0.12) b.blinkT = 2 + Math.random() * 3;
    if (ch.trail === 'flame' && g.state !== 'dead' && Math.random() < 0.8) addP({ x: b.x - 16, y: b.y + 6 + (Math.random() - 0.5) * 3, vx: -70 - Math.random() * 50, vy: (Math.random() - 0.5) * 20, life: 0.28, max: 0.28, c: Math.random() < 0.5 ? '#ffb21e' : '#ff5a1e', s: 2 });
    if (ch.trail === 'jet' && g.state !== 'dead' && Math.random() < 0.8) for (const ox of [-4, 4]) addP({ x: b.x + ox - 1, y: b.y + 14, vx: -40 + (Math.random() - 0.5) * 20, vy: 60, life: 0.22, max: 0.22, c: Math.random() < 0.5 ? '#ffe14d' : '#ff8a1e', s: 2 });
    if (ch.trail === 'pack' && g.state !== 'dead' && Math.random() < 0.85) for (const ox of [-12, -8]) addP({ x: b.x + ox, y: b.y + 9, vx: -50 + (Math.random() - 0.5) * 20, vy: 70, life: 0.22, max: 0.22, c: Math.random() < 0.5 ? '#ffe14d' : '#ff8a1e', s: 2 });
    if (ch.trail === 'smoke' && g.state === 'play' && Math.random() < 0.3) addP({ x: b.x - 14, y: b.y + 4, vx: -50, vy: -10, life: 0.6, max: 0.6, c: 'rgba(200,205,215,.7)', kind: 'smoke', r0: 2, r1: 6 });
    for (const bm of g.bombs) {
      bm.vy += 600 * dt; bm.y += bm.vy * dt; bm.x -= g.speed * dt * 0.4;
      if (bm.y > GY - 4 && !bm.done) { bm.done = true; SFX.boom(); g.shake = Math.max(g.shake, 0.2); burst(bm.x, GY - 4, 24, ['#ffb21e', '#ff5a1e', '#fff3b0', '#4a4a4a'], 180); ring(bm.x, GY - 4, '#ffb21e', 6, 50, 0.5); pop(bm.x, GY - 40, 'KABOOM', '#ffb21e', 16); }
    }
    g.bombs = g.bombs.filter((bm) => !bm.done);
    if (g.freeze > 0) { g.freeze -= dtReal; return; }
    if (g.state === 'ready') { g.scroll += g.speed * dt; b.y = GY * 0.45 + Math.sin(g.t * 5) * 5; b.rot = 0; return; }
    if (g.state === 'play') {
      let sp = 112 + Math.min(50, g.score * 1.15);
      if (perk('capy')) sp *= 0.9; if (perk('shark')) sp *= 1.15;
      g.speed = sp;
      const grav = perk('brick') ? 1510 : 1350;
      b.vy = Math.min(520, b.vy + grav * dt); b.y += b.vy * dt;
      if (b.y < 6) { b.y = 6; b.vy = 0; }
      b.rot += (clamp(b.vy / 520 * 1.25, -0.42, 1.35) - b.rot) * Math.min(1, dt * 10);
      g.scroll += g.speed * dt;
      g.inv = Math.max(0, g.inv - dt); g.magnet = Math.max(0, g.magnet - dt);
      if (g.speed > 128 && Math.random() < 0.35) addP({ kind: 'streak', x: W + 10, y: Math.random() * GY, vx: -g.speed * 3, vy: 0, life: 0.5, max: 0.5, c: 'rgba(255,255,255,.35)', len: 14 + Math.random() * 20 });
      const last = g.pillars[g.pillars.length - 1];
      if (!last || last.x < W - 158) spawnPillar();
      for (const p of g.pillars) {
        p.x -= g.speed * dt;
        const cy = pcy(p);
        if (!p.passed && p.x + PW < b.x) onPass(p, cy);
        if (g.inv <= 0) {
          const hit = hitRect(b.x, b.y, 9, p.x + 2, -50, PW - 4, cy - p.gap / 2 + 50) || hitRect(b.x, b.y, 9, p.x + 2, cy + p.gap / 2, PW - 4, GY - cy - p.gap / 2);
          if (hit) {
            if (g.shield > 0 || g.lives > 0) {
              const nine = g.shield <= 0; if (nine) g.lives--; else g.shield = 0;
              g.inv = 1.1; SFX.shield(); g.shake = 0.2; burst(b.x, b.y, 16, ['#38e0ff', '#ffffff'], 150); ring(b.x, b.y, '#38e0ff', 8, 40, 0.4);
              pop(b.x, b.y - 24, nine ? '9 LIVES!' : 'SHIELD SAVED YOU', '#38e0ff');
            } else { die(); break; }
          }
        }
      }
      g.pillars = g.pillars.filter((p) => p.x > -PW - 10);
      const magR = g.magnet > 0 ? 150 : perk('gull') ? 70 : 0;
      for (const it of g.items) {
        if (it.got) continue;
        it.x = it.p.x + it.dx; it.y = pcy(it.p) + it.dy;
        if (magR && it.kind === 'coin') {
          const dx = b.x - it.x, dy = b.y - it.y, d = Math.hypot(dx, dy);
          if (d < magR) { it.dx += dx / d * 280 * dt; it.dy += dy / d * 280 * dt; it.x = it.p.x + it.dx; it.y = pcy(it.p) + it.dy; }
        }
        if (Math.hypot(b.x - it.x, b.y - it.y) < 16) {
          it.got = true;
          if (it.kind === 'coin') { gainCoins(1, it.x, it.y); SFX.coin(); burst(it.x, it.y, 8, [m.coin, '#ffffff'], 80, 'spark'); }
          else if (it.kind === 'shield') { g.shield = 1; SFX.power(); pop(b.x, b.y - 24, 'SHIELD!', '#38e0ff', 16); ring(b.x, b.y, '#38e0ff', 8, 40, 0.5); }
          else if (it.kind === 'magnet') { g.magnet = 8; SFX.power(); pop(b.x, b.y - 24, 'MAGNET!', '#ff4fa3', 16); ring(b.x, b.y, '#ff4fa3', 8, 40, 0.5); }
        }
      }
      g.items = g.items.filter((it) => !it.got && it.p.x > -PW - 10);
      if (b.y > GY - 10) {
        if (g.shield > 0 || g.rubber) {
          if (g.shield > 0) g.shield = 0; else { g.rubber = false; pop(b.x, b.y - 30, 'BOING!', '#ffe066', 16); }
          g.inv = 1.0; b.vy = -420; SFX.shield(); burst(b.x, b.y, 14, ['#38e0ff', '#ffffff'], 140);
        } else { b.y = GY - 10; die(); }
      }
    } else if (g.state === 'dead') {
      g.deadT += dt;
      b.vy = Math.min(620, b.vy + 1500 * dt); b.y = Math.min(GY - 10, b.y + b.vy * dt); b.rot = Math.min(1.57, b.rot + dt * 7);
      if (g.deadT > 0.85 && !g.overShown) { g.overShown = true; showOver(); }
    }
  }

  // ---------------------------------------------------------------- ambient per map
  const amb = [];
  function ambientUpdate(dt) {
    const m = mapObj();
    for (let i = amb.length - 1; i >= 0; i--) { const a = amb[i]; a.x += a.vx * dt; a.y += a.vy * dt; a.t += dt; if (a.x < -60 || a.x > W + 60 || a.y > H + 20 || a.t > a.life) amb.splice(i, 1); }
    const r = Math.random();
    if (m.id === 'cloud') {
      if (r < dt * 0.25) amb.push({ k: 'flock', x: W + 30, y: 40 + Math.random() * 120, vx: -26 - Math.random() * 12, vy: 0, t: 0, life: 30, n: 3 + (Math.random() * 3 | 0) });
      if (r < dt * 2.5) amb.push({ k: 'petal', x: Math.random() * W, y: -6, vx: -20 - Math.random() * 20, vy: 18 + Math.random() * 14, t: 0, life: 30, c: Math.random() < 0.5 ? '#ffb7d5' : '#ffffff' });
    } else if (m.id === 'city') {
      if (r < dt * 30) amb.push({ k: 'rain', x: Math.random() * (W + 80), y: -10, vx: -60, vy: 380, t: 0, life: 3 });
    } else if (m.id === 'moon') {
      if (r < dt * 0.15) amb.push({ k: 'rocket', x: -20, y: 60 + Math.random() * 150, vx: 30, vy: -6, t: 0, life: 20 });
    } else if (m.id === 'code') {
      if (r < dt * 0.35) amb.push({ k: 'log', x: 8, y: GY - 14, vx: 0, vy: -14, t: 0, life: 3.5, txt: ['$ git push', 'build ok', '+42 -7', 'tests 128/128', 'deploy: done', 'npm i vibes'][(Math.random() * 6) | 0] });
    } else if (m.ambient) m.ambient(dt, r);
  }
  function ambientDraw(c, m) {
    for (const a of amb) {
      if (a.k === 'flock') for (let i = 0; i < a.n; i++) { const fx = a.x + i * 9, fy = a.y + Math.abs(i - (a.n - 1) / 2) * 5, wv = Math.sin(now * 8 + i) * 2; c.strokeStyle = 'rgba(40,70,110,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx - 4, fy - 2 + wv); c.lineTo(fx, fy); c.lineTo(fx + 4, fy - 2 + wv); c.stroke(); }
      else if (a.k === 'petal') { c.save(); c.translate(a.x, a.y); c.rotate(now * 2 + a.x); R(c, -1.5, -1, 3, 2, a.c); c.restore(); }
      else if (a.k === 'rain') { c.strokeStyle = 'rgba(180,200,255,.28)'; c.lineWidth = 1; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(a.x + 2, a.y - 10); c.stroke(); }
      else if (a.k === 'rocket') { R(c, a.x, a.y, 8, 3, '#e6e2ff'); R(c, a.x + 8, a.y + 0.5, 2, 2, '#ff4d6d'); R(c, a.x - 4 - Math.random() * 3, a.y + 0.5, 4, 2, '#ffb21e'); glow(c, a.x - 3, a.y + 1.5, 8, '#ffb21e', 0.35); }
      else if (a.k === 'txt') { c.globalAlpha = clamp(1 - a.t / a.life, 0, 1) * (a.a || 0.7); T(c, a.txt, a.x, a.y, a.c, a.s); c.globalAlpha = 1; }
      else if (a.k === 'heart') { c.globalAlpha = clamp(1 - a.t / a.life, 0, 1); heart(c, a.x + Math.sin(a.t * 3 + a.s * 9) * 4, a.y, a.s, a.c); c.globalAlpha = 1; }
      else if (a.k === 'note') { c.globalAlpha = clamp(1 - a.t / a.life, 0, 1); mkNote(c, a.x + Math.sin(a.t * 4) * 3, a.y, 3.4, a.c); c.globalAlpha = 1; }
      else if (a.k === 'sq') { c.globalAlpha = clamp(1 - a.t / a.life, 0, 1) * 0.85; RR(c, a.x, a.y, a.s, a.s, 1, a.c); c.globalAlpha = 1; }
      else if (a.k === 'bub') { c.globalAlpha = clamp(1 - a.t / a.life, 0, 1) * 0.6; c.strokeStyle = a.c; c.lineWidth = 0.75; c.beginPath(); c.arc(a.x + Math.sin(a.t * 3 + a.s) * 3, a.y, a.s, 0, 6.3); c.stroke(); c.globalAlpha = 1; }
      else if (a.k === 'spark4') { const k = Math.sin(Math.PI * clamp(a.t / a.life, 0, 1)) * a.s; R(c, a.x - k, a.y - 0.4, k * 2, 0.8, a.c); R(c, a.x - 0.4, a.y - k, 0.8, k * 2, a.c); }
      else if (a.k === 'shoot') { c.strokeStyle = 'rgba(255,255,255,' + clamp(1 - a.t / a.life, 0, 1) + ')'; c.lineWidth = 1; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(a.x + 24, a.y - 8); c.stroke(); }
      else if (a.k === 'log') { c.font = '8px ' + FONT; c.textBaseline = 'top'; c.fillStyle = 'rgba(217,119,87,' + clamp(1 - a.t / a.life, 0, 1) * 0.7 + ')'; c.fillText(a.txt, a.x, a.y); }
    }
    if (m.id === 'cloud') {
      c.save(); c.globalCompositeOperation = 'lighter'; c.translate(206, 84); c.rotate(now * 0.08);
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.fillStyle = 'rgba(255,250,210,.06)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(160, -12); c.lineTo(160, 12); c.closePath(); c.fill(); }
      c.restore();
    }
    if (m.id === 'city' && game && game.state !== 'ready') {
      const stars = Math.min(5, Math.floor(game.score / 5));
      if (stars >= 2) {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const [bx, sp] of [[60, 0.7], [210, -0.9]]) { const a = -Math.PI / 2 + Math.sin(now * sp) * 0.5; c.fillStyle = 'rgba(255,255,230,.08)'; c.beginPath(); c.moveTo(bx, GY); c.lineTo(bx + Math.cos(a - 0.08) * 500, GY + Math.sin(a - 0.08) * 500); c.lineTo(bx + Math.cos(a + 0.08) * 500, GY + Math.sin(a + 0.08) * 500); c.closePath(); c.fill(); }
        c.restore();
      }
      if (stars >= 4) { const hx = ((now * 30) % (W + 120)) - 60, hy = 36 + Math.sin(now) * 4; R(c, hx, hy, 16, 5, '#120820'); R(c, hx + 12, hy - 3, 2, 3, '#120820'); R(c, hx - 6, hy + 1, 6, 1.5, '#120820'); R(c, hx - 2 + ((now * 20) | 0) % 2 * 20, hy - 4, 20, 1, '#120820'); E(c, hx + 8, hy + 6, 1.5, 1.5, ((now * 4) | 0) % 2 ? '#ff2a2a' : '#2a6bff'); }
    }
  }

  // ---------------------------------------------------------------- rendering
  function drawSprite(c, img, x, y, rot, sx, sy) {
    c.save(); c.translate(Math.round(x * 2) / 2, Math.round(y * 2) / 2); if (rot) c.rotate(rot); if (sx) c.scale(sx, sy || sx);
    c.drawImage(img, -20, -17, 40, 32); c.restore();
  }
  function outlinedText(c, txt, x, y, size, fill, align) {
    c.font = size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'top';
    const o = size >= 16 ? 2 : 1;
    c.fillStyle = OUTL;
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o], [0, o + 1], [o, o + 1], [-o, o + 1]]) c.fillText(txt, x + dx, y + dy);
    c.fillStyle = fill; c.fillText(txt, x, y);
    c.textAlign = 'left';
  }
  function drawCoin(c, x, y, col, t) {
    if (S.map === 'code') { drawToken(c, x, y, t); return; }
    const cm = mapObj(); if (cm.coinDraw) { cm.coinDraw(c, x, y, t); return; }
    const w = Math.max(1, Math.abs(Math.cos(t * 4)) * 6);
    glow(c, x, y, 14, col, 0.22);
    E(c, x, y + 1, w + 1, 7.5, OUTL); E(c, x, y, w, 6.5, col); E(c, x + 0.5, y + 0.5, w * 0.62, 4.4, 'rgba(0,0,0,.16)');
    if (w > 3) { c.font = '8px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff'; c.fillText('$', x + 0.5, y + 1); c.textAlign = 'left'; }
    R(c, x - w * 0.5, y - 5, 1, 2, '#ffffff');
    if (((t * 3) | 0) % 4 === 0) { const s = (t * 3) % 1; R(c, x + 4, y - 7 - s * 2, 1, 3, '#ffffff'); R(c, x + 3, y - 6 - s * 2, 3, 1, '#ffffff'); }
  }
  function drawPower(c, x, y, kind, t) {
    const bob = Math.sin(t * 5) * 2;
    if (kind === 'shield') {
      glow(c, x, y + bob, 22, '#38e0ff', 0.35);
      E(c, x, y + bob, 10, 10, 'rgba(56,224,255,.25)'); c.strokeStyle = '#38e0ff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y + bob, 9, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = OUTL; c.lineWidth = 1; c.beginPath(); c.arc(x, y + bob, 10.5, 0, Math.PI * 2); c.stroke();
      P(c, [x - 4, y - 4 + bob, x + 4, y - 4 + bob, x + 4, y + 1 + bob, x, y + 5 + bob, x - 4, y + 1 + bob], '#ffffff');
    } else {
      glow(c, x, y + bob, 22, '#ff4fa3', 0.35);
      E(c, x, y + bob, 10, 10, 'rgba(255,79,163,.25)');
      c.lineWidth = 4; c.strokeStyle = OUTL; c.beginPath(); c.arc(x, y + bob - 1, 5, Math.PI, 0, true); c.stroke();
      c.lineWidth = 2.6; c.strokeStyle = '#ff4fa3'; c.beginPath(); c.arc(x, y + bob - 1, 5, Math.PI, 0, true); c.stroke();
      R(c, x - 6.3, y + bob - 4, 2.6, 3, '#ffffff'); R(c, x + 3.7, y + bob - 4, 2.6, 3, '#ffffff');
    }
  }
  function drawParts(c) {
    for (const p of parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'ring') { const u = 1 - a; c.globalAlpha = a; c.strokeStyle = p.c; c.lineWidth = 2 * a + 0.5; c.beginPath(); c.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * ease(u), 0, Math.PI * 2); c.stroke(); continue; }
      c.globalAlpha = p.kind === 'confetti' ? Math.min(1, a * 3) : a;
      if (p.kind === 'confetti') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); R(c, -p.s / 2, -1, p.s * Math.abs(Math.cos(p.rot * 2)) + 0.5, 2, p.c); c.restore(); }
      else if (p.kind === 'feather') { c.save(); c.translate(p.x, p.y); c.rotate(Math.sin(p.rot) * 0.8); E(c, 0, 0, 4, 1.4, p.c); R(c, -4, -0.2, 8, 0.6, '#cfd6e6'); c.restore(); }
      else if (p.kind === 'leaf') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); E(c, 0, 0, 3, 1.6, p.c); c.restore(); }
      else if (p.kind === 'heart') { const x = p.x, y = p.y; E(c, x - 1.5, y, 2, 2, p.c); E(c, x + 1.5, y, 2, 2, p.c); P(c, [x - 3.4, y + 0.6, x + 3.4, y + 0.6, x, y + 4.4], p.c); }
      else if (p.kind === 'smoke') { E(c, p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - a), p.r0 + (p.r1 - p.r0) * (1 - a), p.c); }
      else if (p.kind === 'spark') { R(c, p.x - 2, p.y - 0.5, 4, 1, p.c); R(c, p.x - 0.5, p.y - 2, 1, 4, p.c); }
      else if (p.kind === 'streak') { R(c, p.x, p.y, p.len, 1, p.c); }
      else if (p.kind === 'coinfly') { c.globalAlpha = 1; drawCoin(c, p.x, p.y, p.c, now * 3); }
      else R(c, Math.round(p.x), Math.round(p.y), p.s, p.s, p.c);
    }
    c.globalAlpha = 1;
  }

  function render() {
    const m = mapObj(), L = layers[m.id];
    const g = game;
    const sx = g ? g.scroll : menuScroll;
    ctx.setTransform(SC, 0, 0, SC, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (g && g.shake > 0) { const k = g.shake / 0.45; ctx.translate((Math.random() - 0.5) * 7 * k, (Math.random() - 0.5) * 7 * k); }
    m.bg(ctx, L, sx, now);
    ambientDraw(ctx, m);
    if (g) {
      for (const p of g.pillars) {
        const cy = pcy(p);
        drawPillar(ctx, m, Math.round(p.x), -4, Math.round(cy - p.gap / 2), true, p);
        drawPillar(ctx, m, Math.round(p.x), Math.round(cy + p.gap / 2), GY, false, p);
      }
      for (const it of g.items) { if (it.kind === 'coin') drawCoin(ctx, it.x, it.y, m.coin, now + it.p.seed % 7); else drawPower(ctx, it.x, it.y, it.kind, now); }
      for (const bm of g.bombs) { E(ctx, bm.x, bm.y, 3.5, 2.2, '#2b2b2b'); R(ctx, bm.x - 5, bm.y - 1, 2, 2, '#2b2b2b'); }
    }
    m.ground(ctx, L, sx);
    drawParts(ctx);
    const ch = charObj();
    if (g) {
      const b = g.bird;
      const blink = b.blinkT < 0 && g.state !== 'dead';
      const img = g.state === 'dead' ? ch.blink[0] : blink ? ch.blink[b.f < 3 ? 0 : 1] : ch.frames[b.f];
      const sq = b.sq;
      if (g.fever > 0 && g.state === 'play' && g.ghosts.length > 2) {
        for (let i = 1; i < g.ghosts.length; i++) {
          const a = g.ghosts[i - 1], q = g.ghosts[i], off = (g.ghosts.length - i) * -6;
          for (let k = 0; k < 6; k++) { ctx.strokeStyle = 'hsl(' + (k * 60 + now * 400) % 360 + ',100%,62%)'; ctx.globalAlpha = 0.85 * i / g.ghosts.length; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a.x - 12 + off, a.y - 5 + k * 1.8); ctx.lineTo(q.x - 12 + off - 6, q.y - 5 + k * 1.8); ctx.stroke(); }
        }
        ctx.globalAlpha = 1;
      }
      if ((g.fever > 0 || g.speed > 140) && g.state === 'play') for (let i = 0; i < g.ghosts.length - 1; i += 2) { const q = g.ghosts[i]; ctx.globalAlpha = 0.18 * (i + 1) / g.ghosts.length; drawSprite(ctx, ch.frames[q.f], q.x - (g.ghosts.length - i) * 3, q.y, q.rot, 1.12); }
      ctx.globalAlpha = 1;
      if (ch.trail === 'flame' && g.state !== 'dead') glow(ctx, b.x - 16, b.y + 6, 22, '#ff8a1e', 0.45);
      if (ch.trail === 'jet' && g.state !== 'dead') glow(ctx, b.x, b.y + 16, 16, '#ffb21e', 0.4);
      if (ch.trail === 'pack' && g.state !== 'dead') glow(ctx, b.x - 10, b.y + 12, 16, '#ffb21e', 0.4);
      if (!(g.inv > 0 && ((now * 16) | 0) % 2)) drawSprite(ctx, img, b.x, b.y, b.rot, 1.12 * (1 - sq * 0.14), 1.12 * (1 + sq * 0.16));
      if (g.state === 'dead' && g.deadT > 0.15 && m.id === 'cloud') for (let i = 0; i < 3; i++) { const a = now * 5 + i * 2.1; starTiny(ctx, b.x + Math.cos(a) * 12, b.y - 14 + Math.sin(a) * 4); }
      if (g.shield > 0) { ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now * 8); ctx.strokeStyle = '#38e0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 19, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; glow(ctx, b.x, b.y, 26, '#38e0ff', 0.18); }
      if (g.magnet > 0) { ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, 24 + (now * 40) % 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    } else {
      for (let i = 0; i < 3; i++) {
        const per = 9, tt = (now + i * per / 3) % per, k = Math.floor((now + i * per / 3) / per);
        const pc = CHARS[(k * 3 + i * 5) % CHARS.length];
        if (pc === ch) continue;
        const px = -30 + tt / per * (W + 60), py = 110 + i * 64 + Math.sin(now * 2 + i) * 10;
        drawSprite(ctx, pc.frames[((now * 11 + i) | 0) % 6], px, py, Math.sin(now * 2 + i) * 0.15);
      }
      const bob = Math.sin(now * 3) * 6;
      glow(ctx, W / 2, GY - 182 + bob, 70, '#ffffff', 0.18);
      drawSprite(ctx, ch.frames[((now * 11) | 0) % 6], W / 2, GY - 190 + bob, 0, 2);
    }
    for (const p of pops) {
      const a = clamp(p.life * 2, 0, 1), sc = p.life > 0.85 ? back((1 - p.life) / 0.15) : 1;
      ctx.globalAlpha = a; ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc); outlinedText(ctx, p.txt, 0, 0, p.size, p.col); ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (m.id === 'code') { ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 0.5); }
    if (g && g.bolt > 0) {
      ctx.fillStyle = 'rgba(230,235,255,' + g.bolt * 1.4 + ')'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); let lx = g.boltX, ly = 0; ctx.moveTo(lx, ly); const rr = rng((g.boltX * 100) | 0); while (ly < GY - 120) { lx += (rr() - 0.5) * 30; ly += 14 + rr() * 16; ctx.lineTo(lx, ly); } ctx.stroke();
      glow(ctx, g.boltX, 60, 120, '#cfd8ff', 0.5);
    }
    ctx.drawImage(vignette, 0, 0);
    if (g && g.fever > 0) {
      const a = 0.28 + 0.12 * Math.sin(now * 10), w = 10;
      for (let i = 0; i < 4; i++) {
        const hue = (now * 220 + i * 90) % 360, col = 'hsla(' + hue + ',100%,60%,' + a + ')';
        const gr = i === 0 ? ctx.createLinearGradient(0, 0, w, 0) : i === 1 ? ctx.createLinearGradient(W, 0, W - w, 0) : i === 2 ? ctx.createLinearGradient(0, 0, 0, w) : ctx.createLinearGradient(0, GY, 0, GY - w);
        gr.addColorStop(0, col); gr.addColorStop(1, 'hsla(' + hue + ',100%,60%,0)'); ctx.fillStyle = gr;
        if (i === 0) ctx.fillRect(0, 0, w, GY); else if (i === 1) ctx.fillRect(W - w, 0, w, GY); else if (i === 2) ctx.fillRect(0, 0, W, w); else ctx.fillRect(0, GY - w, W, w);
      }
    }
    if (g) drawHUD(g, m);
    if (g && g.state === 'dead') deathFX(g, m);
    if (g && g.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + clamp(g.flash / 0.2, 0, 1) * 0.55 + ')'; ctx.fillRect(0, 0, W, H); }
    drawTrans();
  }
  function starTiny(c, x, y) { R(c, x - 2, y - 0.5, 4, 1, '#ffe066'); R(c, x - 0.5, y - 2, 1, 4, '#ffe066'); R(c, x - 0.5, y - 0.5, 1, 1, '#ffffff'); }
  function drawHUD(g, m) {
    const sp = 1 + g.scorePop * 0.45;
    if (g.state !== 'dead' || g.deadT < 0.85) {
      ctx.save(); ctx.translate(W / 2, 44 + 12); ctx.scale(sp, sp); outlinedText(ctx, String(g.score), 0, -12, 24, g.scorePop > 0.5 ? '#ffe066' : '#ffffff'); ctx.restore();
    }
    if (m.id === 'city') {
      const stars = Math.min(5, Math.floor(g.score / 5));
      for (let i = 0; i < 5; i++) starIcon(ctx, W - 16 - i * 13, 46, i < stars);
      if (stars >= 3 && g.state === 'play') {
        const red = ((now * 4) | 0) % 2;
        const gr = ctx.createLinearGradient(0, 0, 34, 0); gr.addColorStop(0, red ? 'rgba(255,40,60,.4)' : 'rgba(40,120,255,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 34, GY);
        const g2 = ctx.createLinearGradient(W, 0, W - 34, 0); g2.addColorStop(0, red ? 'rgba(40,120,255,.4)' : 'rgba(255,40,60,.4)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(W - 34, 0, 34, GY);
      }
    }
    if (g.state === 'play' || g.state === 'ready') {
      ctx.save(); ctx.translate(16, 84); const k = 1 + hudCoinBump * 0.4; ctx.scale(k, k); drawCoin(ctx, 0, 0, m.coin, 0); ctx.restore();
      outlinedText(ctx, '+' + g.coins, 26, 80, 8, hudCoinBump > 0.3 ? '#ffe066' : '#ffffff', 'left');
    }
    if (g.magnet > 0) R(ctx, W / 2 - 30, 82, 60 * g.magnet / 8, 3, '#ff4fa3');
    if (g.combo >= 2 && g.state === 'play') { ctx.save(); ctx.translate(W / 2, g.fever > 0 ? 110 : 92); const k = 1 + g.comboPop * 0.5; ctx.scale(k, k); outlinedText(ctx, 'COMBO x' + g.combo, 0, 0, 8, g.combo >= 3 ? '#ff4fa3' : '#ffd23f'); ctx.restore(); }
    if (g.fever > 0 && g.state === 'play') { const fw = 90 * g.fever / (perk('burger') ? 12 : 6); for (let i = 0; i < fw; i += 3) R(ctx, W / 2 - 45 + i, 88, 3, 3, 'hsl(' + ((i * 4 + now * 300) % 360) + ',100%,60%)'); outlinedText(ctx, 'FEVER', W / 2, 96, 8, '#ffffff'); }
    if (g.state === 'ready' && m.id === 'code') {
      const bx = 22, by = GY * 0.18, bw = W - 44;
      RR(ctx, bx, by, bw, 70, 4, 'rgba(18,17,16,.92)');
      ctx.strokeStyle = CC.org; ctx.lineWidth = 1; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx + 0.5, by + 0.5, bw - 1, 69, 4); ctx.stroke();
      spinStar(ctx, bx + 12, by + 14, now, CC.org); ctx.font = '8px ' + FONT; ctx.textBaseline = 'top'; ctx.fillStyle = CC.txt; ctx.fillText('Welcome to', bx + 22, by + 10);
      ctx.fillStyle = CC.org; ctx.fillText('Flappening Code', bx + 22, by + 22);
      tline(ctx, bx + 10, by + 40, [{ s: '/flap ', c: CC.org }, { s: 'tap or space to start', c: CC.dim }]);
      tline(ctx, bx + 10, by + 50, [{ s: 'perk: ', c: CC.dim }, { s: charObj().perk, c: CC.grn }]);
      tline(ctx, bx + 10, by + 60, [{ s: 'cwd: ~/flappening', c: CC.faint }]);
      const k = ((now * 2) | 0) % 2;
      drawHand(ctx, W / 2 + 34, GY * 0.64 + 16 + (k ? 0 : 3));
    } else if (g.state === 'ready') {
      const k = ((now * 2) | 0) % 2;
      outlinedText(ctx, 'GET READY', W / 2, GY * 0.22, 16, '#ffd23f');
      outlinedText(ctx, m.name.toUpperCase(), W / 2, GY * 0.22 + 26, 8, '#ffffff');
      outlinedText(ctx, charObj().perk, W / 2, GY * 0.22 + 42, 8, '#7dffb0');
      outlinedText(ctx, k ? 'TAP / SPACE' : 'TO FLAP', W / 2, GY * 0.64, 8, '#ffffff');
      drawHand(ctx, W / 2 + 34, GY * 0.64 + 16 + (k ? 0 : 3));
    }
    if (banner) {
      const u = banner.t, s = u < 0.3 ? back(u / 0.3) : u > 1.3 ? 1 - ease((u - 1.3) / 0.3) : 1;
      ctx.save(); ctx.translate(W / 2, GY * 0.34); ctx.scale(s * 1.6, s * 1.6); ctx.rotate(Math.sin(now * 6) * 0.05);
      outlinedText(ctx, banner.txt, 0, -14, 24, '#ffd23f'); ctx.restore();
      ctx.save(); ctx.translate(W / 2, GY * 0.34 + 32); ctx.scale(s, s); outlinedText(ctx, banner.sub, 0, 0, 8, '#ff4fa3'); ctx.restore();
    }
  }
  let glitchBuf = null;
  function deathFX(g, m) {
    if (m.id === 'city') { ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'hsl(0,0%,50%)'; ctx.globalAlpha = clamp(g.deadT * 2, 0, 1); ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (m.id === 'moon') {
      const u = clamp(g.deadT / 0.8, 0, 1);
      ctx.fillStyle = 'rgba(234,57,67,' + 0.18 * (1 - Math.abs(Math.sin(now * 8)) * 0.5) + ')'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#ea3943'; ctx.lineWidth = 3; ctx.beginPath();
      const pts = [[0, 90], [40, 70], [70, 96], [100, 60], [130, 74], [150, 50], [170, 120], [200, 210], [230, 330], [270, 460]];
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) { if (pts[i][0] / W > u) { const a = pts[i - 1], b = pts[i], k = (u * W - a[0]) / (b[0] - a[0]); ctx.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); break; } ctx.lineTo(pts[i][0], pts[i][1]); }
      ctx.stroke(); glow(ctx, u * W, 90 + u * 300, 30, '#ea3943', 0.4);
    }
    if (m.glitch && g.glitch > 0) {
      if (!glitchBuf || glitchBuf.width !== cvs.width || glitchBuf.height !== cvs.height) glitchBuf = mk(cvs.width, cvs.height);
      const bg = glitchBuf.getContext('2d'); bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, glitchBuf.width, glitchBuf.height); bg.drawImage(cvs, 0, 0);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < 9; i++) { const y = Math.random() * cvs.height, h = 6 + Math.random() * 40, dx = (Math.random() - 0.5) * 50; ctx.drawImage(glitchBuf, 0, y, cvs.width, h, dx, y, cvs.width, h); }
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(glitchBuf, 6, 0); ctx.restore();
      ctx.setTransform(SC, 0, 0, SC, 0, 0);
      ctx.fillStyle = 'rgba(255,40,80,.12)'; ctx.fillRect(0, 0, W, H);
    }
    if (m.deathFX) m.deathFX(g);
    if (m.id === 'code') {
      const n = Math.floor(g.deadT * 4);
      const y = GY - 40;
      RR(ctx, 6, y - 6, W - 12, 40, 3, 'rgba(18,17,16,.9)');
      if (n >= 0) tline(ctx, 12, y, [{ dot: CC.red }, { s: 'Bash', c: CC.txt }, { s: '(flap --through pipe #' + (g.score + 1) + ')', c: CC.dim }]);
      if (n >= 1) tline(ctx, 12, y + 8, ['  ', { elbow: 1 }, { s: 'Error: bird collided with a pipe', c: CC.red }]);
      if (n >= 2) tline(ctx, 12, y + 16, ['  ', { elbow: 1 }, { s: 'Interrupted by user', c: CC.red }]);
      if (n >= 3) tline(ctx, 12, y + 24, [{ s: '> ', c: CC.dim }, { s: 'try again', c: CC.txt }]);
    }
  }
  function starIcon(c, x, y, on) {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 2.6 : 6; pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.lineWidth = 2; c.strokeStyle = OUTL; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.stroke();
    P(c, pts, on ? '#ffffff' : 'rgba(255,255,255,.18)'); if (on) glow(c, x, y, 10, '#ffffff', 0.3);
  }
  function drawHand(c, x, y) {
    R(c, x - 1, y - 1, 8, 13, OUTL); R(c, x, y, 6, 11, '#ffe0c2'); R(c, x + 4, y + 4, 8, 11, OUTL); R(c, x + 5, y + 5, 6, 9, '#ffe0c2'); R(c, x - 2, y + 9, 14, 8, OUTL); R(c, x - 1, y + 10, 12, 6, '#ffe0c2');
  }

  // ---------------------------------------------------------------- transitions (pixel iris on the fx layer)
  function transition(mid) { if (trans) { mid(); return; } trans = { t: 0, dur: 0.7, mid, fired: false }; SFX.swish(); }
  function drawTrans() {
    const w = fx.width, h = fx.height;
    fxc.setTransform(1, 0, 0, 1, 0, 0); fxc.clearRect(0, 0, w, h);
    if (!trans) return;
    const u = trans.t / trans.dur, k = u < 0.5 ? 1 - ease(u * 2) : ease((u - 0.5) * 2);
    const maxR = Math.hypot(w, h) / 2, r = maxR * k;
    const cell = Math.max(6, Math.round(w / 60));
    fxc.fillStyle = '#120a24';
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) { if (Math.hypot(x + cell / 2 - w / 2, y + cell / 2 - h * 0.45) > r) fxc.fillRect(x, y, cell, cell); }
  }

  // ---------------------------------------------------------------- logo (animated)
  function drawLogo(g, t, staticMode) {
    const w = g.canvas.width, h = g.canvas.height, s = w / 200;
    g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, 200, 72);
    g.font = '16px ' + FONT; g.textBaseline = 'top'; g.textAlign = 'left';
    const txt = 'FLAPPENING', x0 = 100 - txt.length * 8;
    const ys = [];
    for (let i = 0; i < txt.length; i++) ys.push(16 + (staticMode ? 0 : Math.round(Math.sin(t * 5 - i * 0.55) * 2.2)));
    g.fillStyle = OUTL;
    for (let i = 0; i < txt.length; i++) for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 6; dy++) g.fillText(txt[i], x0 + i * 16 + dx, ys[i] + dy);
    for (let i = 0; i < txt.length; i++) { g.fillStyle = '#a3300f'; g.fillText(txt[i], x0 + i * 16, ys[i] + 3); g.fillStyle = '#d4511a'; g.fillText(txt[i], x0 + i * 16, ys[i] + 2); g.fillText(txt[i], x0 + i * 16, ys[i] + 1); }
    for (let i = 0; i < txt.length; i++) {
      const gr = g.createLinearGradient(0, ys[i], 0, ys[i] + 16); gr.addColorStop(0, '#fff6a0'); gr.addColorStop(0.45, '#ffd23f'); gr.addColorStop(0.5, '#ffad1f'); gr.addColorStop(1, '#ff6a2b');
      g.fillStyle = gr; g.fillText(txt[i], x0 + i * 16, ys[i]);
    }
    if (!staticMode) {
      const sx = ((t * 120) % 400) - 100;
      g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,.75)';
      g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + 10, 0); g.lineTo(sx - 10, 72); g.lineTo(sx - 20, 72); g.closePath(); g.fill(); g.restore();
    }
    g.font = '8px ' + FONT; g.textAlign = 'center';
    const sub = 'FLAP. DIE. REPEAT.';
    g.fillStyle = OUTL; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 2], [1, 1], [-1, 1]]) g.fillText(sub, 100 + dx, 48 + dy);
    g.fillStyle = '#ffffff'; g.fillText(sub, 100, 48);
    g.textAlign = 'left';
  }
  function coinIcon(c) { const g = c.getContext('2d'); g.clearRect(0, 0, 9, 9); E(g, 4.5, 4.5, 4.4, 4.4, OUTL); E(g, 4.5, 4.5, 3.4, 3.4, '#ffd23f'); R(g, 3, 2, 1, 2, '#fff6c2'); }

  // ---------------------------------------------------------------- UI screens
  const screens = ['menu', 'chars', 'maps', 'pipes', 'lb', 'over', 'pause'];
  let current = 'menu';
  function show(name) { current = name; for (const s of screens) $('#scr-' + s).classList.toggle('on', s === name); }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => (t.style.display = 'none'), 1600); }
  function updateCoins() { $('#coins').textContent = S.coins; $('#c-coins') && ($('#c-coins').textContent = S.coins); }
  function refreshMenu() {
    $('#menu-char').textContent = charObj().name.toUpperCase();
    $('#menu-map').textContent = 'MAP: ' + mapObj().name.toUpperCase() + '  ·  PIPES: ' + skinObj().name.toUpperCase() + '  ·  BEST: ' + (S.best[S.map] || 0);
  }
  function goMenu() { transition(() => { game = null; show('menu'); refreshMenu(); $('#btn-pause').style.visibility = 'hidden'; }); }
  function startGame(fast) {
    audio();
    const go = () => { newGame(); show(null); $('#btn-pause').style.visibility = 'visible'; };
    if (fast) go(); else transition(go);
  }

  // flyer carousel
  let cIdx = Math.max(0, CHARS.findIndex((c) => c.id === S.char));
  const stage = $('#c-stage'), sg = stage.getContext('2d');
  function openChars() { cIdx = Math.max(0, CHARS.findIndex((c) => c.id === S.char)); syncChar(); show('chars'); }
  function syncChar() {
    const c = CHARS[cIdx], own = owns(c);
    $('#c-name').textContent = own ? c.name.toUpperCase() : '???';
    $('#c-tag').textContent = own ? c.tag : 'Locked flyer. ' + (c.unlock ? 'Score ' + c.unlock + ' on any map.' : 'Costs ' + c.price + ' coins.');
    $('#c-perk').textContent = c.perk;
    $('#c-stats').innerHTML = ['SPEED', 'DRIP', 'CHAOS'].map((k, i) => '<div class="sb"><span>' + k + '</span><i>' + '<b></b>'.repeat(c.stats[i]) + '<u></u>'.repeat(5 - c.stats[i]) + '</i></div>').join('');
    const act = $('#c-act');
    act.className = 'btn big' + (S.char === c.id ? ' cyan' : own ? '' : ' pink');
    act.textContent = S.char === c.id ? 'FLYING' : own ? 'SELECT' : c.unlock ? 'LOCKED' : 'BUY ' + c.price + ' $';
    $('#c-count').textContent = (cIdx + 1) + ' / ' + CHARS.length;
    const th = $('#c-thumbs'); th.innerHTML = '';
    CHARS.forEach((ch, i) => {
      const cv = document.createElement('canvas'); cv.width = 80; cv.height = 64; cv.className = 'px th' + (i === cIdx ? ' on' : '') + (owns(ch) ? '' : ' lk');
      const g = cv.getContext('2d'); g.drawImage(ch.frames[0], 0, 0);
      if (!owns(ch)) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#120a24'; g.fillRect(0, 0, 80, 64); }
      cv.onclick = () => { cIdx = i; SFX.click(); syncChar(); };
      th.appendChild(cv);
    });
    const on = th.children[cIdx]; if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function charAction() {
    const c = CHARS[cIdx];
    if (owns(c)) { S.char = c.id; store.set('char', c.id); SFX.power(); stageBurst = 1; syncChar(); refreshMenu(); return; }
    if (c.unlock) { toast('SCORE ' + c.unlock + ' ON ANY MAP'); SFX.click(); return; }
    if (S.coins >= c.price) { S.coins -= c.price; S.owned.push(c.id); store.set('owned', S.owned); store.set('coins', S.coins); S.char = c.id; store.set('char', c.id); updateCoins(); SFX.fanfare(); stageBurst = 1.4; toast('UNLOCKED ' + c.name.toUpperCase()); syncChar(); refreshMenu(); }
    else { toast('NEED ' + (c.price - S.coins) + ' MORE $'); SFX.click(); }
  }
  let stageBurst = 0;
  function drawStage() {
    const w = stage.width, h = stage.height, c = CHARS[cIdx], own = owns(c);
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.imageSmoothingEnabled = false; sg.clearRect(0, 0, w, h);
    const gr = sg.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, w * 0.6); gr.addColorStop(0, own ? '#5a3fb0' : '#2a1d5c'); gr.addColorStop(1, '#170d34'); sg.fillStyle = gr; sg.fillRect(0, 0, w, h);
    sg.save(); sg.translate(w / 2, h * 0.42); sg.rotate(now * 0.25); sg.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) { sg.rotate(Math.PI / 6); sg.fillStyle = 'rgba(255,220,140,.05)'; sg.beginPath(); sg.moveTo(0, 0); sg.lineTo(w, -26); sg.lineTo(w, 26); sg.closePath(); sg.fill(); }
    sg.restore();
    sg.fillStyle = 'rgba(0,0,0,.35)'; sg.beginPath(); sg.ellipse(w / 2, h * 0.84, w * 0.26, h * 0.05, 0, 0, Math.PI * 2); sg.fill();
    sg.fillStyle = '#3b2a7a'; sg.fillRect(w * 0.22, h * 0.8, w * 0.56, h * 0.06); sg.fillStyle = '#5b47a8'; sg.fillRect(w * 0.22, h * 0.8, w * 0.56, h * 0.018); sg.fillStyle = '#24164a'; sg.fillRect(w * 0.22, h * 0.86, w * 0.56, h * 0.06);
    const bob = Math.sin(now * 3) * 6, sc = 3.2 * (1 + stageBurst * 0.15);
    const img = c.frames[((now * 11) | 0) % 6];
    if (own) sg.drawImage(img, w / 2 - 40 * sc, h * 0.42 - 32 * sc + bob, 80 * sc, 64 * sc);
    else {
      const sil = mk(80, 64, (g) => { g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#0d0820'; g.fillRect(0, 0, 80, 64); });
      sg.drawImage(sil, w / 2 - 40 * sc, h * 0.42 - 32 * sc + bob, 80 * sc, 64 * sc);
      sg.font = (w / 9 | 0) + 'px ' + FONT; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillStyle = '#ffd23f'; sg.fillText('?', w / 2, h * 0.42 + bob);
    }
    if (stageBurst > 0) { stageBurst = Math.max(0, stageBurst - 0.03); sg.strokeStyle = 'rgba(255,210,63,' + stageBurst + ')'; sg.lineWidth = 6; sg.beginPath(); sg.arc(w / 2, h * 0.45, (1.4 - stageBurst) * w * 0.5, 0, Math.PI * 2); sg.stroke(); }
    for (let i = 0; i < 6; i++) { const a = now * 0.7 + i, x = w / 2 + Math.cos(a * 1.3) * w * 0.38, y = h * 0.45 + Math.sin(a) * h * 0.3, k = (Math.sin(now * 4 + i) + 1) / 2; sg.fillStyle = 'rgba(255,240,180,' + k + ')'; sg.fillRect(x - 4, y - 1, 8, 2); sg.fillRect(x - 1, y - 4, 2, 8); }
  }
  function swipe(el, fn) {
    let x0 = null;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    el.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 30) fn(dx < 0 ? 1 : -1); });
  }

  // map carousel
  let mIdx = Math.max(0, MAPS.findIndex((m) => m.id === S.map));
  const mstage = $('#m-stage'), mg = mstage.getContext('2d');
  let mworld = null, mdemo = null;
  function openMaps() { mIdx = Math.max(0, MAPS.findIndex((m) => m.id === S.map)); syncMap(); show('maps'); }
  function syncMap() {
    const m = MAPS[mIdx];
    $('#m-name').textContent = m.name.toUpperCase(); $('#m-desc').textContent = m.desc; $('#m-best').textContent = 'BEST ' + (S.best[m.id] || 0) + '   ·   DEATH: ' + m.death;
    const act = $('#m-act'); act.className = 'btn big' + (S.map === m.id ? ' cyan' : ''); act.textContent = S.map === m.id ? 'SELECTED' : 'FLY HERE';
    $('#m-count').textContent = (mIdx + 1) + ' / ' + MAPS.length;
    const th = $('#m-thumbs'); th.innerHTML = '';
    MAPS.forEach((mm, i) => {
      const cv = mk(60, 48, (g) => { R(g, 0, 0, 60, 48, mm.bgc || '#24164a'); if (mm.mark) mm.mark(g, 30, 24, 15); });
      cv.className = 'th' + (i === mIdx ? ' on' : ''); cv.title = mm.name;
      cv.onclick = () => { mIdx = i; SFX.click(); syncMap(); };
      th.appendChild(cv);
    });
    const onT = th.children[mIdx]; if (onT && onT.scrollIntoView) onT.scrollIntoView({ block: 'nearest', inline: 'center' });
    mdemo = { x: 0, pillars: [{ x: 160, cy: GY - 150, gap: 110, seed: 77, amp: 0 }, { x: 330, cy: GY - 175, gap: 110, seed: 1234, amp: 0 }, { x: 500, cy: GY - 135, gap: 110, seed: 999, amp: 0 }] };
  }
  function drawMapStage() {
    const m = MAPS[mIdx];
    if (!mworld || mworld.height !== H) mworld = mk(W, H);
    const g = mworld.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    mdemo.x += 1.6;
    m.bg(g, layers[m.id], mdemo.x, now);
    for (const p of mdemo.pillars) {
      let px = p.x - mdemo.x; while (px < -PW - 10) { p.x += 510; px = p.x - mdemo.x; }
      drawPillar(g, m, Math.round(px), -4, p.cy - p.gap / 2, true, p); drawPillar(g, m, Math.round(px), p.cy + p.gap / 2, GY, false, p);
    }
    m.ground(g, layers[m.id], mdemo.x);
    const ch = charObj(); const by = GY - 150 + Math.sin(now * 2.2) * 30;
    drawSprite(g, ch.frames[((now * 11) | 0) % 6], 80, by, Math.cos(now * 2.2) * 0.3);
    const w = mstage.width, h = mstage.height;
    mg.imageSmoothingEnabled = false; mg.clearRect(0, 0, w, h);
    const srcH = W * h / w; mg.drawImage(mworld, 0, Math.max(0, GY + 30 - srcH), W, srcH, 0, 0, w, h);
  }

  // pipes carousel
  let sIdx = Math.max(0, SKINS.findIndex((k) => k.id === S.skin));
  const pstage = $('#p-stage'), pg2 = pstage.getContext('2d');
  let pworld = null, pdemo = null;
  function openPipes() { sIdx = Math.max(0, SKINS.findIndex((k) => k.id === S.skin)); syncPipe(); show('pipes'); }
  function syncPipe() {
    const k = SKINS[sIdx];
    $('#p-name').textContent = k.name.toUpperCase(); $('#p-desc').textContent = k.desc;
    $('#p-world').textContent = 'PREVIEW ON ' + mapObj().name.toUpperCase();
    const act = $('#p-act'); act.className = 'btn big' + (S.skin === k.id ? ' cyan' : ''); act.textContent = S.skin === k.id ? 'EQUIPPED' : 'USE THESE';
    $('#p-count').textContent = (sIdx + 1) + ' / ' + SKINS.length;
    const mixes = ['sausage', 'rocket', 'candy', 'cactus', 'pencil', 'gold'];
    pdemo = { x: 0, pillars: [0, 1, 2].map((i) => ({ x: 150 + i * 150, cy: GY - [150, 175, 135][i], gap: 110, seed: 77 + i * 911, amp: 0, mix: mixes[(i * 2 + sIdx) % 6] })) };
  }
  function drawPipeStage() {
    const m = mapObj(), k = SKINS[sIdx];
    if (!pworld || pworld.height !== H) pworld = mk(W, H);
    const g = pworld.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    pdemo.x += 1.4;
    m.bg(g, layers[m.id], pdemo.x, now);
    const saved = S.skin; S.skin = k.id;
    for (const p of pdemo.pillars) {
      let px = p.x - pdemo.x; while (px < -PW - 10) { p.x += 450; px = p.x - pdemo.x; }
      drawPillar(g, m, Math.round(px), -4, p.cy - p.gap / 2, true, p); drawPillar(g, m, Math.round(px), p.cy + p.gap / 2, GY, false, p);
    }
    S.skin = saved;
    m.ground(g, layers[m.id], pdemo.x);
    drawSprite(g, charObj().frames[((now * 11) | 0) % 6], 70, GY - 150 + Math.sin(now * 2.2) * 26, Math.cos(now * 2.2) * 0.3);
    const w = pstage.width, h = pstage.height;
    pg2.imageSmoothingEnabled = false; pg2.clearRect(0, 0, w, h);
    const srcH = W * h / w; pg2.drawImage(pworld, 0, Math.max(0, GY + 30 - srcH), W, srcH, 0, 0, w, h);
  }

  // leaderboard
  let lbMap = 'cloud', lbScope = 'local';
  function localLB(id) { const all = store.get('lb', {}); return all[id] || []; }
  async function buildLB() {
    $('#lb-tabs').innerHTML = '';
    MAPS.forEach((m) => { const b = document.createElement('button'); b.className = 'tab' + (lbMap === m.id ? ' on' : ''); b.textContent = (m.tab || m.name).toUpperCase(); b.onclick = () => { lbMap = m.id; SFX.click(); buildLB(); }; $('#lb-tabs').appendChild(b); });
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
    list.innerHTML = '';
    rows.slice(0, 20).forEach((r, i) => {
      const ch = CHARS.find((c) => c.id === r.c) || CHARS[0];
      const row = document.createElement('div'); row.className = 'lbrow';
      const cv = document.createElement('canvas'); cv.width = 80; cv.height = 64; cv.className = 'px'; cv.getContext('2d').drawImage(ch.frames[0], 0, 0);
      row.innerHTML = '<div class="rk">' + (i + 1) + '</div>';
      row.appendChild(cv);
      row.insertAdjacentHTML('beforeend', '<div>' + esc(r.n) + '<span class="ch">' + esc(ch.name.toUpperCase()) + '</span></div><div class="sc">' + r.s + '</div>');
      list.appendChild(row);
    });
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function medalFor(s) { return s >= 80 ? ['#9ff3ff', '#38c7e8', 'DIAMOND'] : s >= 40 ? ['#ffe27a', '#e0a100', 'GOLD'] : s >= 20 ? ['#eef2fb', '#a7b0c5', 'SILVER'] : s >= 10 ? ['#ffb98a', '#c46a2b', 'BRONZE'] : null; }
  function drawMedal(cv, s, t) {
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 34, 34);
    const md = medalFor(s);
    if (!md) { E(g, 17, 17, 14, 14, '#2c1d55'); E(g, 17, 17, 10, 10, '#24164a'); g.font = '8px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#6c55b0'; g.fillText('?', 17, 18); return; }
    P(g, [9, 0, 15, 0, 17, 10, 11, 10], '#ff4fa3'); P(g, [25, 0, 19, 0, 17, 10, 23, 10], '#38e0ff');
    E(g, 17, 20, 13, 13, OUTL); E(g, 17, 20, 12, 12, md[1]); E(g, 17, 20, 9, 9, md[0]);
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 2.6 : 6; pts.push(17 + Math.cos(a) * rr, 20 + Math.sin(a) * rr); }
    P(g, pts, md[1]); R(g, 11, 14, 2, 2, '#ffffff');
    const sx = ((t * 30) % 60) - 14; g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(sx, 8); g.lineTo(sx + 4, 8); g.lineTo(sx - 4, 34); g.lineTo(sx - 8, 34); g.closePath(); g.fill(); g.restore();
  }

  function qualifies(id, score) { const l = localLB(id); return score > 0 && (l.length < 10 || score > l[l.length - 1].s); }
  let countUp = null;
  function showOver() {
    const g = game, m = mapObj();
    $('#death-txt').textContent = m.death; $('#death-txt').style.color = m.deathCol; $('#death-txt').style.fontSize = 'calc(var(--u)*' + Math.min(20, Math.floor(232 / m.death.length)) + ')';
    $('#o-score').textContent = '0'; $('#o-best').textContent = S.best[m.id] || 0; $('#o-coins').textContent = '+' + g.coins;
    $('#o-new').style.display = g.newBest && g.score > 0 ? 'block' : 'none';
    const q = qualifies(m.id, g.score) || (CFG.leaderboardUrl && g.score > 0);
    $('#o-save').style.display = q ? 'flex' : 'none';
    $('#o-name').value = S.name; $('#o-saveb').disabled = false; $('#o-saveb').textContent = 'SAVE SCORE';
    show('over');
    $('#btn-pause').style.visibility = 'hidden';
    countUp = { t: 0, to: g.score };
    if (g.newBest && g.score > 0) { confetti(120); SFX.fanfare(); }
  }
  async function saveScore() {
    const g = game, m = mapObj();
    const n = ($('#o-name').value || '').toUpperCase().replace(/[^A-Z0-9 _.\-]/g, '').trim().slice(0, 12);
    if (!n) { toast('TYPE A NAME'); return; }
    S.name = n; store.set('name', n);
    const all = store.get('lb', {}); const l = all[m.id] || [];
    l.push({ n, s: g.score, c: S.char, d: Date.now() }); l.sort((a, b) => b.s - a.s); all[m.id] = l.slice(0, 10); store.set('lb', all);
    $('#o-saveb').disabled = true; $('#o-saveb').textContent = 'SAVED!'; SFX.power();
    if (CFG.leaderboardUrl) {
      try { await fetch(CFG.leaderboardUrl.replace(/\/$/, '') + '/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ map: m.id, name: n, score: g.score, char: S.char }) }); toast('SENT TO WORLD BOARD'); }
      catch (e) { toast('SAVED ON THIS DEVICE'); }
    } else toast('SAVED TO LEADERBOARD');
    lbMap = m.id;
  }
  function share() {
    const g = game, m = mapObj();
    const txt = 'I just scored ' + g.score + ' in FLAPPENING as ' + charObj().name + ' on ' + m.name + '.\n\nYour turn.';
    window.open('https://x.com/intent/post?text=' + encodeURIComponent(txt) + '&url=' + encodeURIComponent(CFG.shareUrl || location.href), '_blank', 'noopener');
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
    if (newH !== H && (!game || game.state !== 'play')) { H = newH; GY = H - GROUND; buildLayers(); if (game) newGame(); }
    if (cvs.width !== W * SC || cvs.height !== H * SC) { cvs.width = W * SC; cvs.height = H * SC; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fw = Math.round(aw * dpr), fh = Math.round(ah * dpr);
    if (fx.width !== fw || fx.height !== fh) { fx.width = fw; fx.height = fh; }
  }

  // ---------------------------------------------------------------- input
  function onPress(e) {
    if (e.target.closest && e.target.closest('button,input,.screen.on')) return;
    if (game && (game.state === 'ready' || game.state === 'play')) { e.preventDefault(); flap(); }
  }
  app.addEventListener('pointerdown', onPress, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter') saveScore(); return; }
    if (current === 'chars' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { cIdx = (cIdx + (e.code === 'ArrowRight' ? 1 : -1) + CHARS.length) % CHARS.length; syncChar(); return; }
    if (current === 'maps' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { mIdx = (mIdx + (e.code === 'ArrowRight' ? 1 : -1) + MAPS.length) % MAPS.length; syncMap(); return; }
    if (current === 'pipes' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { sIdx = (sIdx + (e.code === 'ArrowRight' ? 1 : -1) + SKINS.length) % SKINS.length; syncPipe(); return; }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (game && (game.state === 'ready' || game.state === 'play')) flap();
      else if (!game && current === 'menu') startGame();
      else if (game && game.state === 'dead' && game.overShown) startGame(true);
    }
    if ((e.code === 'KeyP' || e.code === 'Escape') && game && game.state === 'play') pause();
  });
  function pause() { if (!game || game.state !== 'play') return; game.state = 'paused'; show('pause'); }
  function resume() { if (game && game.state === 'paused') { game.state = 'play'; show(null); last = performance.now(); } }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  $('#btn-play').onclick = () => { SFX.click(); startGame(); };
  $('#btn-chars').onclick = () => { audio(); SFX.click(); openChars(); };
  $('#btn-maps').onclick = () => { audio(); SFX.click(); openMaps(); };
  $('#btn-pipes').onclick = () => { audio(); SFX.click(); openPipes(); };
  $('#p-prev').onclick = () => { sIdx = (sIdx - 1 + SKINS.length) % SKINS.length; SFX.click(); syncPipe(); };
  $('#p-next').onclick = () => { sIdx = (sIdx + 1) % SKINS.length; SFX.click(); syncPipe(); };
  $('#p-act').onclick = () => { S.skin = SKINS[sIdx].id; store.set('skin', S.skin); SFX.power(); syncPipe(); refreshMenu(); };
  swipe(pstage, (d) => { sIdx = (sIdx + d + SKINS.length) % SKINS.length; SFX.click(); syncPipe(); });
  $('#btn-lb').onclick = () => { audio(); SFX.click(); lbMap = S.map; buildLB(); show('lb'); };
  document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { SFX.click(); show('menu'); refreshMenu(); }));
  $('#c-prev').onclick = () => { cIdx = (cIdx - 1 + CHARS.length) % CHARS.length; SFX.click(); syncChar(); };
  $('#c-next').onclick = () => { cIdx = (cIdx + 1) % CHARS.length; SFX.click(); syncChar(); };
  $('#c-act').onclick = charAction;
  swipe(stage, (d) => { cIdx = (cIdx + d + CHARS.length) % CHARS.length; SFX.click(); syncChar(); });
  $('#m-prev').onclick = () => { mIdx = (mIdx - 1 + MAPS.length) % MAPS.length; SFX.click(); syncMap(); };
  $('#m-next').onclick = () => { mIdx = (mIdx + 1) % MAPS.length; SFX.click(); syncMap(); };
  $('#m-act').onclick = () => { S.map = MAPS[mIdx].id; store.set('map', S.map); amb.length = 0; SFX.power(); syncMap(); refreshMenu(); };
  swipe(mstage, (d) => { mIdx = (mIdx + d + MAPS.length) % MAPS.length; SFX.click(); syncMap(); });
  $('#o-retry').onclick = () => { SFX.click(); startGame(true); };
  $('#o-menu').onclick = () => { SFX.click(); goMenu(); };
  $('#o-share').onclick = share;
  $('#o-saveb').onclick = saveScore;
  $('#p-resume').onclick = resume;
  $('#p-menu').onclick = goMenu;
  $('#btn-pause').onclick = (e) => { e.stopPropagation(); pause(); };
  $('#btn-sound').onclick = (e) => { e.stopPropagation(); audio(); setSound(!S.sound); };

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  const logoG = $('#logo').getContext('2d');
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!game || game.state !== 'paused') {
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (let i = 0; i < n; i++) update(dt / n);
    }
    render();
    if (current === 'menu') drawLogo(logoG, now);
    if (current === 'chars') drawStage();
    if (current === 'maps') drawMapStage();
    if (current === 'pipes') drawPipeStage();
    if (current === 'over') {
      drawMedal($('#medal'), game ? game.score : 0, now);
      if (countUp) { countUp.t += dt; const v = Math.round(countUp.to * ease(countUp.t / 0.8)); $('#o-score').textContent = v; if (countUp.t > 0.8) countUp = null; }
    }
    requestAnimationFrame(frame);
  }

  async function boot() {
    try { await document.fonts.load('16px "Press Start 2P"'); await document.fonts.load('8px "Press Start 2P"'); } catch (e) { /* fallback font */ }
    layout(); buildLayers();
    document.querySelectorAll('.coinico').forEach(coinIcon);
    updateCoins(); setSound(S.sound); refreshMenu();
    $('#btn-pause').style.visibility = 'hidden';
    window.addEventListener('resize', layout);
    requestAnimationFrame((t) => { last = t; frame(t); });
  }

  window.FLAP = {
    get state() { return game ? game.state : 'menu'; }, get score() { return game ? game.score : 0; },
    start: startGame, flap, show, openChars, openMaps, openPipes, buildLB, setSkin(id) { S.skin = id; refreshMenu(); }, setMap(id) { S.map = id; amb.length = 0; refreshMenu(); }, setChar(id) { S.char = id; refreshMenu(); },
    logo(scale) { const c = mk(200 * scale, 72 * scale); drawLogo(c.getContext('2d'), 0, true); return c.toDataURL(); },
    sprite(id, f, scale) { const ch = CHARS.find((c) => c.id === id); const c = mk(80 * scale, 64 * scale); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(ch.frames[f || 0], 0, 0, 80 * scale, 64 * scale); return c.toDataURL(); },
    cheat(v) { if (game) game.score = v; }, fever() { if (game) startFever(); }, bolt() { if (game) { game.bolt = 0.3; game.boltX = 120; } }, give(n) { S.coins += n; store.set('coins', S.coins); updateCoins(); },
    get game() { return game; }, CHARS, MAPS, layers: () => layers, drawLogo, mk, GY: () => GY, H: () => H
  };
  boot();
})();
