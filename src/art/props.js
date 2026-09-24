/* Neon Drive — street furniture: lamps, planters, foreground foliage, light pools. */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;

  // Street lamp. type 'globe' (Deco post) or 'cobra' (arm over the street).
  function genLamp(seed, type) {
    const r = ND.rng(seed);
    type = type || (r.chance(0.6) ? 'globe' : 'cobra');
    const h = r.int(112, 124);
    const w = type === 'cobra' ? 22 : 11;
    const pb = new ND.PB(w, h + 4), gl = new ND.PB(w, h + 4);
    const P = (c) => ND.pack(c[0], c[1], c[2]);
    const pole = rgb('#1e1630'), poleL = rgb('#3a2a52'), poleR = rgb('#130d1e');
    const px = type === 'cobra' ? w - 5 : 4;
    for (let y = 8; y < h + 4; y++) {
      pb.set(px, y, P(poleL));
      pb.set(px + 1, y, P(pole));
      pb.set(px + 2, y, P(poleR));
    }
    // base
    for (let y = h - 2; y < h + 4; y++) for (let x = px - 1; x <= px + 3; x++) pb.set(x, y, P(x === px - 1 ? poleL : pole));
    let light;
    if (type === 'globe') {
      // collar + globe
      pb.hline(px - 1, px + 3, 9, P(poleL));
      pb.hline(px - 1, px + 3, 10, P(pole));
      const gx = px + 1, gy = 4;
      pb.discFn(gx, gy, 3.6, (x, y, d) => {
        const c = ND.mix(rgb('#fffbe8'), rgb('#ffb454'), Math.pow(d, 1.5));
        pb.set(x, y, P(c));
        gl.set(x, y, ND.pack(255, 200 - d * 60, 120 - d * 80));
      });
      light = [gx, gy];
    } else {
      // curved arm to the left with a cobra head
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push([px + 1 - t * 14, 10 - Math.sin(t * Math.PI * 0.5) * 6]);
      }
      for (let i = 0; i + 1 < pts.length; i++) pb.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], P(poleL));
      const hx = Math.round(pts[10][0]), hy = Math.round(pts[10][1]);
      pb.rect(hx - 4, hy - 1, 8, 3, P(pole));
      pb.hline(hx - 4, hx + 3, hy - 1, P(poleL));
      for (let x = hx - 3; x <= hx + 2; x++) {
        pb.set(x, hy + 2, P(rgb('#fff0c0')));
        gl.set(x, hy + 2, ND.pack(255, 200, 110));
      }
      light = [hx, hy + 2];
    }
    return { spr: ND.sprite(pb, gl), w, h: h + 4, baseX: px + 1, light, type };
  }

  // Concrete planter with a lit tropical plant.
  function genPlanter(seed) {
    const r = ND.rng(seed);
    const w = r.int(26, 36), bh = r.int(12, 15);
    const plant = ND.genPlant(seed * 7 + 1, true);
    const H = bh + 34;
    const pb = new ND.PB(w + 8, H);
    const P = (c) => ND.pack(c[0], c[1], c[2]);
    for (let y = H - bh; y < H; y++)
      for (let x = 4; x < w + 4; x++) {
        let c = ND.mix(rgb('#b88aa0'), rgb('#5a3a5c'), (y - (H - bh)) / bh);
        if (y === H - bh) c = rgb('#e8c0c8');
        if (x === 4) c = ND.scale(c, 0.8);
        pb.dset(x, y, c, 255, 10);
      }
    const cv = pb.canvas();
    const ctx = cv.getContext('2d');
    ctx.drawImage(plant, Math.round((w + 8) / 2 - 22), H - bh - 40);
    ctx.drawImage(plant, Math.round((w + 8) / 2 - 22) + (r.chance(0.5) ? 6 : -6), H - bh - 36);
    return { c: cv, w: w + 8, h: H };
  }

  // Foreground foliage, authored at half resolution for a defocused look:
  // broad tropical leaves (banana / bird-of-paradise / palmetto) in silhouette,
  // their upper edges catching neon.
  function genBush(seed) {
    const r = ND.rng(seed);
    const w = r.int(70, 120), h = r.int(30, 46);
    const pb = new ND.PB(w, h);
    const fill = rgb('#0b0714'), fill2 = rgb('#120b1e');
    const rim = r.pick([rgb('#b43a8a'), rgb('#7a44c0'), rgb('#d04a78'), rgb('#4a6ad0')]);
    const vein = r.pick([rgb('#3a1440'), rgb('#26164a'), rgb('#44162e')]);
    const n = r.int(6, 11);
    const leaves = [];
    for (let i = 0; i < n; i++) {
      leaves.push({
        bx: r.range(w * 0.2, w * 0.8),
        ang: -Math.PI / 2 + r.range(-1.15, 1.15),
        L: r.range(h * 0.55, h * 1.1),
        W: r.chance(0.6) ? r.range(3.5, 6.5) : r.range(1.5, 2.5),
        droop: r.range(0.1, 0.6),
      });
    }
    leaves.sort((p, q) => q.L - p.L);
    for (const lf of leaves) {
      const pts = [];
      const N = 18;
      const P = (t) => {
        const x = lf.bx + Math.cos(lf.ang) * lf.L * t;
        const y = h - 1 + Math.sin(lf.ang) * lf.L * t + lf.droop * lf.L * t * t;
        return [x, y];
      };
      const side = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const [x, y] = P(t);
        const [x2, y2] = P(Math.min(1, t + 0.02));
        let tx = x2 - x, ty = y2 - y;
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const ww = lf.W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.7);
        pts.push([x - ty * ww, y + tx * ww]);
        side.push([x + ty * ww, y - tx * ww]);
      }
      const poly = pts.concat(side.reverse());
      pb.polyFn(poly, (x, y) => pb.set(x, y, ND.pack(...(ND.hash(x, y, seed) < 0.5 ? fill : fill2))));
      // rim on the upper edge and a midrib
      const upper = Math.sin(lf.ang) < 0 ? (Math.cos(lf.ang) < 0 ? pts : side) : pts;
      for (let i = 1; i < upper.length - 1; i++) {
        const [x, y] = upper[i];
        pb.set(Math.round(x), Math.round(y), ND.pack(...ND.mix(fill2, rim, 0.45 + 0.4 * (i / upper.length))));
      }
      if (lf.W > 3) for (let i = 1; i < N; i++) { const [x, y] = P(i / N); pb.set(Math.round(x), Math.round(y), ND.pack(...vein)); }
    }
    return pb.canvas();
  }

  // Soft pool of light for the ground (dithered ellipse).
  function genPool(w, h, color, strength) {
    const pb = new ND.PB(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x - w / 2 + 0.5) / (w / 2), dy = (y - h / 2 + 0.5) / (h / 2);
        const d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const a = Math.pow(1 - d, 1.6) * strength;
        const q = Math.floor(a * 12 + ND.bayer(x, y)) / 12;
        if (q > 0) pb.set(x, y, ND.pack(color[0] * q, color[1] * q, color[2] * q));
      }
    return pb.canvas();
  }

  // Vertical fade used for storefront spill on the sidewalk.
  function genSpill(color) {
    const w = 32, h = 26;
    const pb = new ND.PB(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ex = Math.min(1, Math.min(x + 1, w - x) / 6);
        const a = Math.pow(1 - y / h, 1.4) * ex * 0.55;
        const q = Math.floor(a * 12 + ND.bayer(x, y)) / 12;
        if (q > 0) pb.set(x, y, ND.pack(color[0] * q, color[1] * q, color[2] * q));
      }
    return pb.canvas();
  }

  // Glow halo sprite (for lamps) into the emissive buffer.
  function genHaloGlow(R, color, k) {
    const S = R * 2;
    const pb = new ND.PB(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - R + 0.5, y - R + 0.5) / R;
        if (d >= 1) continue;
        const a = Math.pow(1 - d, 2.4) * k;
        pb.set(x, y, ND.pack(color[0] * a, color[1] * a, color[2] * a));
      }
    return pb.canvas();
  }

  // Vignette (multiply-style darkening) for the final frame.
  function genVignette(W, H) {
    const pb = new ND.PB(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
        const d = Math.sqrt(dx * dx * 0.8 + dy * dy);
        const a = ND.clamp((d - 0.65) * 0.55, 0, 0.5);
        const q = Math.floor(a * 16 + ND.bayer(x, y)) / 16;
        if (q > 0) pb.set(x, y, ND.pack(8, 2, 16, q * 255));
      }
    return pb.canvas();
  }

  ND.genLamp = genLamp;
  ND.genPlanter = genPlanter;
  ND.genBush = genBush;
  ND.genPool = genPool;
  ND.genSpill = genSpill;
  ND.genHaloGlow = genHaloGlow;
  ND.genVignette = genVignette;
})();
