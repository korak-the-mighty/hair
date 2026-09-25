/* Nightdrive — distant skyline towers (3 depths) and the lit causeway bridge. */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;

  const BASE = 240; // screen row the tower sprites end at (hidden behind the street)

  const DEPTH = [
    { // far
      wmin: 14, wmax: 34, topMin: 70, topMax: 150, gapMin: -6, gapMax: 10,
      body: rgb('#12123a'), body2: rgb('#191a48'), rim: rgb('#24245a'),
      fog: rgb('#2f1c58'), fogBase: 0.28, fogK: 0.55,
      lit: 0.18, neon: 0.06, winScale: 1,
    },
    { // mid
      wmin: 20, wmax: 46, topMin: 46, topMax: 160, gapMin: -8, gapMax: 14,
      body: rgb('#141542'), body2: rgb('#1d1c52'), rim: rgb('#2d2c6c'),
      fog: rgb('#34205e'), fogBase: 0.12, fogK: 0.5,
      lit: 0.34, neon: 0.22, winScale: 1,
    },
    { // near city
      wmin: 30, wmax: 70, topMin: 104, topMax: 186, gapMin: -10, gapMax: 22,
      body: rgb('#171848'), body2: rgb('#221d57'), rim: rgb('#383479'),
      fog: rgb('#3a2262'), fogBase: 0.0, fogK: 0.4,
      lit: 0.42, neon: 0.35, winScale: 2,
    },
  ];

  const WIN_WARM = [rgb('#ffd67a'), rgb('#ffc861'), rgb('#fff1c9'), rgb('#ffe3a0')];
  const WIN_COOL = [rgb('#bfe8ff'), rgb('#8fdcff'), rgb('#e8f0ff')];
  const NEONS = ['pink', 'magenta', 'cyan', 'blue', 'pink', 'purple'];

  function genTower(seed, d, o = {}) {
    const r = ND.rng(seed);
    const P = DEPTH[d];
    const w = o.w || r.int(P.wmin, P.wmax);
    const top = o.top || r.int(P.topMin, P.topMax);
    const style = o.style || r.pick(['flat', 'flat', 'setback', 'spire', 'crown', 'slant', 'antenna', 'setback']);
    const extra = style === 'spire' || style === 'antenna' ? r.int(10, 26) : 0;
    const hh = BASE - top + extra;
    const pb = new ND.PB(w, hh), gl = new ND.PB(w, hh);
    const anims = [];
    const y0 = extra; // roof row inside the sprite
    const bodyH = hh - y0;

    // silhouette mask
    const inside = (x, y) => {
      if (y < y0) return false;
      const ry = y - y0;
      if (style === 'setback') {
        const s1 = Math.floor(bodyH * 0.12), inset = Math.floor(w * 0.18);
        if (ry < s1) return x >= inset && x < w - inset;
        const s2 = Math.floor(bodyH * 0.05);
        if (ry < s1 + s2) return x >= inset / 2 && x < w - inset / 2;
      }
      if (style === 'slant') {
        const sl = Math.floor(w * 0.6);
        return ry >= Math.floor((x / w) * sl * 0.8);
      }
      if (style === 'crown') {
        const ch = Math.floor(w * 0.45);
        if (ry < ch) {
          const half = (ry / ch) * (w / 2) + 1;
          return Math.abs(x - w / 2 + 0.5) < half;
        }
      }
      return true;
    };

    const tint = r.chance(0.3) ? 0.35 : 0;
    const coolWin = r.chance(0.28);
    for (let y = 0; y < hh; y++)
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        const sy = top - extra + y; // screen row
        const fogT = ND.clamp(P.fogBase + ((sy - top) / (BASE - top)) * P.fogK, 0, 0.85);
        let c = ND.mix(P.body, P.body2, (x / w) * 0.6 + tint * 0.4);
        if (x === w - 1 || !inside(x + 1, y)) c = P.rim;
        if (x === 0) c = ND.scale(c, 0.8);
        c = ND.mix(c, P.fog, fogT);
        pb.dset(x, y, c, 255, 6);
      }

    // windows
    const cw = P.winScale === 2 ? r.pick([3, 4]) : r.pick([2, 3]);
    const chh = P.winScale === 2 ? r.pick([3, 4]) : r.pick([2, 3]);
    const pattern = r.pick(['grid', 'grid', 'bands', 'cols']);
    const litP = o.lit || P.lit * r.range(0.5, 1.6);
    const floorLit = [];
    for (let y = y0 + 3; y < hh - 2; y += chh) floorLit.push(r() < litP * 1.2);
    let fi = 0;
    for (let y = y0 + 3; y < hh - 2; y += chh, fi++) {
      for (let x = 2; x < w - 2; x += cw) {
        if (!inside(x, y) || !inside(x + 1, y + 1) || !inside(x - 1, y)) continue;
        let on;
        if (pattern === 'bands') on = floorLit[fi] && r() < 0.85;
        else if (pattern === 'cols') on = ((x / cw) | 0) % 3 !== 1 && r() < litP * 1.3;
        else on = r() < litP;
        const sy = top - extra + y;
        const fogT = ND.clamp(P.fogBase + ((sy - top) / (BASE - top)) * P.fogK, 0, 0.85);
        const ww = cw - 1, wh = chh - 1;
        let wc;
        if (on) {
          wc = coolWin ? r.pick(WIN_COOL) : r.pick(WIN_WARM);
          wc = ND.mix(wc, P.fog, fogT * 0.8);
          if (d === 0) wc = ND.scale(wc, 0.62);
        } else {
          wc = ND.mix(ND.mix(P.body2, rgb('#3a3a78'), 0.35), P.fog, fogT);
        }
        for (let yy = 0; yy < wh; yy++)
          for (let xx = 0; xx < ww; xx++) {
            pb.dset(x + xx, y + yy, wc, 255, 6);
            if (on) gl.set(x + xx, y + yy, ND.pack(wc[0] * 0.35, wc[1] * 0.35, wc[2] * 0.35));
          }
      }
    }

    // neon trims
    if (o.neon || (!o.w && r() < P.neon)) {
      const [core, tube] = ND.NEON[o.neon || r.pick(NEONS)];
      const mode = o.mode || r.pick(['edges', 'edges', 'roof', 'right']);
      const len = r.chance(0.5) ? bodyH : Math.floor(bodyH * r.range(0.3, 0.6));
      const pts = new Set();
      for (let y = y0; y < y0 + len; y++) {
        let lx = 0; while (lx < w && !inside(lx, y)) lx++;
        let rx = w - 1; while (rx >= 0 && !inside(rx, y)) rx--;
        if (lx > rx) continue;
        if (mode === 'edges' || mode === 'roof') { pts.add(lx + ',' + y); pts.add(rx + ',' + y); }
        if (mode === 'right') pts.add(rx + ',' + y);
      }
      if (mode === 'roof' || mode === 'edges') {
        for (let x = 0; x < w; x++) {
          let y = 0; while (y < hh && !inside(x, y)) y++;
          if (y < hh) pts.add(x + ',' + y);
        }
      }
      const dimT = d === 0 ? 0.6 : 1;
      for (const k of pts) {
        const [x, y] = k.split(',').map(Number);
        const c = ND.mix(tube, core, 0.35);
        pb.set(x, y, ND.pack(c[0] * dimT, c[1] * dimT, c[2] * dimT));
        gl.set(x, y, ND.pack(tube[0] * 0.8 * dimT, tube[1] * 0.8 * dimT, tube[2] * 0.8 * dimT));
      }
    }

    // spire / antenna with blinking aircraft light
    if (style === 'spire' || style === 'antenna') {
      const ax = Math.floor(w / 2) - (style === 'antenna' ? r.int(-3, 3) : 0);
      const col = ND.pack(40, 36, 80);
      for (let y = 1; y < y0 + 2; y++) {
        pb.set(ax, y, col);
        if (style === 'spire' && y > y0 * 0.55) pb.set(ax - 1, y, col), pb.set(ax + 1, y, col);
      }
      anims.push({ type: 'blink', x: ax, y: 0, color: rgb('#ff3048'), period: r.range(1.2, 2.2), phase: r() });
    } else if (r() < 0.25) {
      anims.push({ type: 'blink', x: Math.floor(w / 2), y: y0 - 1, color: rgb('#ff3048'), period: r.range(1.4, 2.4), phase: r() });
    }

    return {
      spr: ND.sprite(pb, gl),
      w,
      y: top - extra,
      gap: o.gap != null ? o.gap : r.int(P.gapMin, P.gapMax),
      anims,
    };
  }

  // Long elevated causeway with lamps and moving car lights.
  function genBridge(seed) {
    const r = ND.rng(seed);
    const w = r.int(620, 820);
    const deckY = 168; // screen row of deck top
    const top = deckY - 16;
    const hh = BASE - top;
    const pb = new ND.PB(w, hh), gl = new ND.PB(w, hh);
    const dk = deckY - top;
    const deck = rgb('#1c1a4a'), deck2 = rgb('#2a2560'), pier = rgb('#181540'), under = rgb('#120f30');
    // piers
    const span = r.int(52, 70);
    for (let px = 20; px < w - 10; px += span) {
      for (let y = dk + 8; y < hh; y++)
        for (let x = px; x < px + 6; x++) {
          const fogT = ND.clamp((y - dk) / (hh - dk) * 0.6, 0, 0.7);
          pb.dset(x, y, ND.mix(x === px + 5 ? deck2 : pier, rgb('#3a2262'), fogT), 255, 6);
        }
    }
    // deck slab
    for (let y = dk; y < dk + 8; y++)
      for (let x = 0; x < w; x++) {
        let c = y === dk ? deck2 : y >= dk + 6 ? under : deck;
        pb.dset(x, y, c, 255, 6);
      }
    // parapet/rail line
    for (let x = 0; x < w; x++) pb.set(x, dk - 1, ND.pack(46, 40, 96));
    // soffit strip lights (cool) under the deck
    for (let x = 2; x < w; x += 4) {
      const c = rgb('#7fd6ff');
      pb.set(x, dk + 7, ND.pack(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8));
      gl.set(x, dk + 7, ND.pack(c[0] * 0.4, c[1] * 0.4, c[2] * 0.4));
    }
    // lamp posts with warm heads
    const lampEvery = r.int(20, 28);
    const lamps = [];
    for (let x = 6; x < w - 4; x += lampEvery) {
      for (let y = dk - 12; y < dk - 1; y++) pb.set(x, y, ND.pack(34, 30, 70));
      pb.set(x + 1, dk - 12, ND.pack(34, 30, 70));
      const lc = rgb('#ffcf7a');
      pb.set(x + 2, dk - 12, ND.pack(lc[0], lc[1], lc[2]));
      pb.set(x + 2, dk - 11, ND.pack(lc[0] * 0.8, lc[1] * 0.7, lc[2] * 0.5));
      gl.set(x + 2, dk - 12, ND.pack(255, 190, 90));
      gl.set(x + 2, dk - 11, ND.pack(200, 130, 60));
      gl.set(x + 1, dk - 12, ND.pack(120, 80, 40));
      gl.set(x + 3, dk - 12, ND.pack(120, 80, 40));
      lamps.push(x + 2);
    }
    // traffic lights on the deck, animated at draw time
    const cars = [];
    for (let i = 0; i < Math.floor(w / 60); i++) {
      cars.push({ dir: r() < 0.5 ? -1 : 1, off: r() * w, v: r.range(0.4, 0.9) });
    }
    return {
      spr: ND.sprite(pb, gl),
      w,
      y: top,
      gap: r.int(10, 60),
      anims: [{ type: 'bridgeCars', cars, y: dk - 3, w }],
      isBridge: true,
    };
  }

  ND.genTower = genTower;
  ND.genBridge = genBridge;
  ND.SKYLINE_BASE = BASE;
})();
