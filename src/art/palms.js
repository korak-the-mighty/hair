/* Neon Drive — palm trees (silhouettes with neon rim light, swaying crowns),
 * planter palms and shrubs. */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;

  const FRAMES = 8;

  const DARK = {
    frond: rgb('#130b1f'), frond2: rgb('#1b1029'), rachis: rgb('#1e1230'),
    trunk: rgb('#1c1128'), ring: rgb('#0e0816'), coco: rgb('#24121c'),
  };
  const RIMS = [rgb('#3e1646'), rgb('#1e2c52'), rgb('#341a50'), rgb('#4a183a'), rgb('#1a3450')];

  function drawFrond(pb, cx, cy, ang, L, droop, leaf, cols, rim, rimSide, seedN) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const pt = (s) => [cx + dx * L * s, cy + dy * L * s + droop * L * s * s];
    const steps = Math.ceil(L * 1.2);
    // leaflets first, rachis on top
    for (let i = 3; i <= steps; i++) {
      const s = i / steps;
      if (i % 2) continue;
      const [px, py] = pt(s);
      let tx = dx * L, ty = dy * L + 2 * droop * L * s;
      const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
      const nx = -ty, ny = tx;
      const ll = leaf * Math.sin(Math.PI * Math.min(1, s * 1.1)) * (1 - 0.35 * s) + 1;
      for (const side of [-1, 1]) {
        let lx = nx * side * 0.62 + tx * 0.55, ly = ny * side * 0.62 + ty * 0.55 + 0.75;
        const n = Math.hypot(lx, ly); lx /= n; ly /= n;
        const jitter = (ND.hash(i, side + 5, seedN) - 0.5) * 1.6;
        const ex = px + lx * (ll + jitter), ey = py + ly * (ll + jitter);
        const upper = ly < 0.2;
        pb.lineFn(px, py, ex, ey, (x, y, t) => {
          let c = t > 0.6 ? cols.frond2 : cols.frond;
          if (rim && ((side === rimSide && t > 0.45) || (upper && t > 0.6))) c = ND.mix(c, rim, 0.35 + t * 0.4);
          pb.set(x, y, ND.pack(c[0], c[1], c[2]));
        });
      }
    }
    for (let i = 0; i < steps; i++) {
      const [x0, y0] = pt(i / steps), [x1, y1] = pt((i + 1) / steps);
      const c = cols.rachis;
      pb.line(x0, y0, x1, y1, ND.pack(c[0], c[1], c[2]));
      if (i < steps * 0.3) pb.line(x0, y0 + 1, x1, y1 + 1, ND.pack(c[0], c[1], c[2]));
    }
  }

  // Tall street palm: trunk sprite + FRAMES crown sprites.
  function genPalm(seed, opts = {}) {
    const r = ND.rng(seed);
    const h = opts.h || r.int(150, 235);
    const lean = opts.lean != null ? opts.lean : r.range(-0.16, 0.16);
    const bend = r.range(-10, 10);
    const rim = r.pick(RIMS);
    const rimSide = r.chance(0.5) ? -1 : 1;
    const cols = opts.cols || DARK;
    // trunk
    const topDX = lean * h + bend * 0.2;
    const tw = Math.ceil(Math.abs(topDX) + Math.abs(bend) + 24);
    const bx = topDX < 0 ? tw - 12 : 12;
    const tpb = new ND.PB(tw, h + 2);
    let topX = bx;
    for (let yy = 0; yy <= h; yy++) {
      const s = yy / h;
      const xc = bx + lean * h * s + bend * Math.sin(Math.PI * s);
      if (yy === h) topX = xc;
      const half = (8.5 - 4 * s) / 2 + Math.max(0, 0.05 - s) * 40;
      const y = h - yy;
      for (let x = Math.floor(xc - half); x <= Math.ceil(xc + half); x++) {
        const u = (x - (xc - half)) / (2 * half);
        if (u < -0.1 || u > 1.1) continue;
        let c = cols.trunk;
        const ringRow = (yy + Math.round(u * 2.5)) % 5 === 0;
        if (ringRow) c = cols.ring;
        if (rimSide > 0 && u > 0.72) c = ND.mix(c, rim, ringRow ? 0.25 : 0.6);
        if (rimSide < 0 && u < 0.28) c = ND.mix(c, rim, ringRow ? 0.25 : 0.6);
        tpb.set(x, y, ND.pack(c[0], c[1], c[2]));
      }
    }
    const trunk = ND.sprite(tpb, null);
    // crown frames
    const L = opts.L || r.range(58, 80);
    const leaf = opts.leaf || r.range(12, 16);
    const S = Math.ceil((L + leaf) * 2 + 10);
    const cx = S / 2, cy = S / 2 - 6;
    const fronds = [];
    const nUp = r.int(9, 12), nDown = r.int(3, 5);
    for (let i = 0; i < nUp; i++) {
      const a = -Math.PI + (i + 0.5) / nUp * Math.PI + r.range(-0.12, 0.12);
      fronds.push({ a, L: L * r.range(0.75, 1.05), droop: r.range(0.45, 0.85), ph: r() * 6.28 });
    }
    for (let i = 0; i < nDown; i++) {
      const a = 0.35 + (i + 0.5) / nDown * (Math.PI - 0.7) + r.range(-0.15, 0.15);
      fronds.push({ a, L: L * r.range(0.5, 0.75), droop: r.range(0.1, 0.35), ph: r() * 6.28 });
    }
    // draw back-to-front: downward fronds first
    fronds.sort((p, q) => Math.sin(q.a) - Math.sin(p.a));
    const crowns = [];
    for (let k = 0; k < FRAMES; k++) {
      const pb = new ND.PB(S, S);
      const ph = (k / FRAMES) * Math.PI * 2;
      fronds.forEach((f, idx) => {
        const sway = Math.sin(ph + f.ph) * 0.045 + Math.sin(ph) * 0.03;
        drawFrond(pb, cx, cy, f.a + sway, f.L, f.droop + Math.sin(ph + f.ph + 1) * 0.04, leaf, cols, rim, rimSide, seed + idx);
      });
      // crown bulb + coconuts
      pb.disc(cx, cy + 2, 3.5, ND.pack(cols.frond[0], cols.frond[1], cols.frond[2]));
      for (let i = 0; i < 4; i++) {
        const c = cols.coco;
        pb.disc(cx - 3 + i * 2, cy + 5 + (i % 2), 1.6, ND.pack(c[0], c[1], c[2]));
      }
      crowns.push(pb.canvas());
    }
    return {
      trunk,
      crowns,
      S,
      bx,          // trunk base x inside trunk sprite
      h,
      topDX: topX - bx, // crown offset from base
      ccx: cx,
      ccy: cy,
    };
  }

  // Small planter palm / shrub, lit warmly by storefronts.
  function genPlant(seed, lit = true) {
    const r = ND.rng(seed);
    const S = 44;
    const pb = new ND.PB(S, S);
    const cols = lit
      ? { frond: rgb('#2e6a3a'), frond2: rgb('#86c860'), rachis: rgb('#2a4a2a') }
      : { frond: rgb('#120a1c'), frond2: rgb('#1d1230'), rachis: rgb('#1a1026') };
    const rim = lit ? rgb('#ffd070') : rgb('#4a1f5a');
    const n = r.int(7, 10);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + (i + 0.5) / n * Math.PI + r.range(-0.2, 0.2);
      drawFrond(pb, S / 2, S - 4, a, r.range(12, 19), r.range(0.5, 1.0), r.range(4, 6), cols, rim, r.chance(0.5) ? 1 : -1, seed + i);
    }
    return pb.canvas();
  }

  ND.genPalm = genPalm;
  ND.genPlant = genPlant;
  ND.PALM_FRAMES = FRAMES;
})();
