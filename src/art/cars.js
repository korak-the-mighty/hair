/* Neon Drive — the hero 80s supercar (with driver) and background traffic. */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;

  // ===========================================================================
  // Hero car — white flat-12 wedge with side strakes, facing left.
  // Local coords: 300 x 76, ground contact on row 75.
  // ===========================================================================
  const HW = 300, HH = 76;
  const WHEEL_R = 21;
  const WHEELS = [[66, 54], [246, 54]];

  const TOP = [
    [1, 42], [4, 39.5], [14, 37.6], [34, 35.2], [60, 31.8], [84, 28.6], [100, 26.4], [104, 26],
    [140, 2], [146, 1.2], [196, 1.2], [203, 2.2], [212, 4.6],
    [232, 9.5], [252, 13.4], [272, 15.8], [288, 17.2], [295, 18.6], [298, 21],
  ];

  function topY(x) {
    if (x <= TOP[0][0]) return TOP[0][1];
    for (let i = 1; i < TOP.length; i++) {
      if (x <= TOP[i][0]) {
        const a = TOP[i - 1], b = TOP[i];
        return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
      }
    }
    return 22;
  }

  function arch(pts, cx, cy, r, sill) {
    const a0 = Math.asin((sill - cy) / r);
    const a1 = -Math.PI - a0;
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }

  function bodyPolygon() {
    const pts = TOP.slice();
    pts.push([299, 30], [299, 50], [298, 58], [296, 61.5], [272, 62]);
    arch(pts, WHEELS[1][0], WHEELS[1][1], 24.5, 62);
    pts.push([220, 62], [92, 62]);
    arch(pts, WHEELS[0][0], WHEELS[0][1], 24.5, 62);
    pts.push([40, 62], [8, 61.5], [3, 60], [0.6, 55], [0.4, 46]);
    return pts;
  }

  // Driver: solid profile facing left (forehead, wraparound shades, nose,
  // lips, chin, jaw, ear, neck) with a blond mullet, pastel jacket.
  // Origin placed at car-local (144, 5); rows past the beltline are clipped.
  const DRIVER = [
    '......kkkkkk......',
    '....kkhHHHHhkk....',
    '...khHHHhhhhhhk...',
    '..khHhhhhhhhhhdk..',
    '..khhhhhhhhhhhddk.',
    '.khhhhhhhhhhhhdddk',
    '.kShhhhshhhhhhdddk',
    '..SSSssssshhhhdddk',
    '.GGGGGGGGGehhhdddk',
    '..GgGGssszeehhdddk',
    'SSSSssssszeehhdddk',
    '..SSsssssszzhhdddk',
    '.SSSssssszzzhhdddk',
    '..SSsssszzzzhhddk.',
    '..Ssssszzzzzhhdddk',
    '....zzzzzzzzhhdddk',
    '......nnnnnnhhddk.',
    '......nnnnnhhdddk.',
    '.....cwnnnnbhddk..',
    '...cwbbbbbbbbbbBB.',
    '..cwbbbwbbbbbbbbBB',
  ];
  const DRIVER_PAL = {
    H: rgb('#fff2b0'), h: rgb('#f2c662'), d: rgb('#c48c36'), k: rgb('#7a4e22'),
    S: rgb('#f8c6a6'), s: rgb('#e49c7c'), z: rgb('#b06a54'), e: rgb('#c4705a'), n: rgb('#a8624e'),
    G: rgb('#0c0a14'), g: rgb('#ff7ad8'),
    c: rgb('#e4f2ff'), w: rgb('#ffffff'), b: rgb('#96c2f0'), B: rgb('#5c80bc'),
  };
  const DRIVER_O = [144, 5];

  function genDriver() {
    const w = DRIVER[0].length, h = DRIVER.length;
    const pb = new ND.PB(w, h);
    DRIVER.forEach((row, y) => {
      if (row.length !== w) throw new Error('driver row ' + y + ' has length ' + row.length);
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const c = DRIVER_PAL[ch];
        pb.set(x, y, ND.pack(c[0], c[1], c[2]));
      });
    });
    return { c: pb.canvas(), x: DRIVER_O[0], y: DRIVER_O[1] };
  }

  // The driver's arm out of the window: sleeve resting on the door sill,
  // forearm hanging outside, cigarette between the fingers. Frames cover
  // the forearm's swing; the ember is drawn live.
  function genDriverArm() {
    const OX = 128, OY = 19, AW = 30, AH = 32, N = 11;
    const th0 = -0.08, th1 = 0.34;
    const skin = rgb('#e8a282'), skinL = rgb('#f8c6a6'), skinD = rgb('#a8604c');
    const sleeve = rgb('#96c2f0'), sleeveL = rgb('#d4ecff'), sleeveD = rgb('#5c80bc');
    const frames = [];
    for (let f = 0; f < N; f++) {
      const th = th0 + (f / (N - 1)) * (th1 - th0);
      const ux = -Math.sin(th), uy = Math.cos(th);
      const E = [146.2 - OX, 28.4 - OY];
      const Wr = [E[0] + ux * 10.5, E[1] + uy * 10.5];
      const Hd = [Wr[0] + ux * 2.3, Wr[1] + uy * 2.3];
      // forearm + hand silhouette, shaded by exposure (lit from the front/left)
      const arm = new ND.PB(AW, AH);
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        arm.disc(E[0] + (Wr[0] - E[0]) * t, E[1] + (Wr[1] - E[1]) * t, 2.05 - t * 0.5, 1);
      }
      arm.disc(Hd[0], Hd[1], 1.95, 1);
      arm.disc(Hd[0] - 0.8, Hd[1] + 1.1, 1.1, 1); // curled fingers
      const pb = new ND.PB(AW, AH);
      for (let y = 0; y < AH; y++)
        for (let x = 0; x < AW; x++) {
          if (!arm.get(x, y)) continue;
          const lf = arm.get(x - 1, y), rt = arm.get(x + 1, y);
          const c = !lf ? skinL : !rt ? skinD : skin;
          pb.set(x, y, ND.pack(c[0], c[1], c[2]));
        }
      // watch band across the wrist
      const px = uy, py = -ux;
      for (let k = -1.6; k <= 1.6; k += 0.5) {
        const wx = Wr[0] - ux * 0.8 + px * k, wy = Wr[1] - uy * 0.8 + py * k;
        pb.set(Math.round(wx), Math.round(wy), ND.pack(...(k < 0 ? [255, 214, 90] : [184, 138, 32])));
      }
      // rolled sleeve resting on the sill (drawn over the elbow)
      const sc = [149 - OX, 25.6 - OY];
      for (let y = -3; y <= 3; y++)
        for (let x = -6; x <= 6; x++) {
          const d = (x * x) / 27 + (y * y) / 8.5;
          if (d > 1) continue;
          let c = x < -2 ? sleeveL : x > 2 ? sleeveD : sleeve;
          if (y >= 2) c = ND.mix(c, sleeveD, 0.5);
          if ((x + 6) % 4 === 1 && y < 2) c = [255, 255, 255];
          pb.set(Math.round(sc[0] + x), Math.round(sc[1] + y), ND.pack(c[0], c[1], c[2]));
        }
      // cuff
      for (let x = -3; x <= 1; x++) pb.set(Math.round(sc[0] + x - 1), Math.round(sc[1] + 2), ND.pack(228, 242, 255));
      // cigarette: filter at the fingers, paper pointing forward and down
      const ca = 0.42 - th * 0.35;
      const dx = -Math.cos(ca), dy = Math.sin(ca);
      const C0 = [Hd[0] - 1.3, Hd[1] + 0.9];
      pb.set(Math.round(C0[0]), Math.round(C0[1]), ND.pack(216, 150, 80));
      for (let k = 1; k <= 4; k++) pb.set(Math.round(C0[0] + dx * k), Math.round(C0[1] + dy * k), ND.pack(246, 242, 232));
      const tip = [OX + C0[0] + dx * 5, OY + C0[1] + dy * 5];
      frames.push({ c: pb.canvas(), tip, th });
    }
    return { frames, ox: OX, oy: OY, th0, th1, N };
  }

  function genHeroCar() {
    const pb = new ND.PB(HW, HH), gl = new ND.PB(HW, HH);
    const poly = bodyPolygon();
    const P = (c) => ND.pack(c[0], c[1], c[2]);

    // ---- underbody shadow between the wheels (we see the dark road under the car)
    for (let y = 60; y < 73; y++)
      for (let x = 30; x < 286; x++) {
        const a = ND.clamp(1 - (y - 60) / 13, 0, 1) * 0.92;
        pb.set(x, y, ND.pack(10, 6, 18, a * 255));
      }

    // ---- body paint
    // bright upper flank, a crisp "horizon" reflection, darker lower flank
    const ramp = [
      [0, rgb('#ffffff')], [0.1, rgb('#f7f4fd')], [0.46, rgb('#e9e4f6')], [0.52, rgb('#dcd6ee')],
      [0.535, rgb('#b9b1d6')], [0.62, rgb('#c4bcdf')], [0.82, rgb('#a69ec6')], [0.93, rgb('#8a82ac')], [1, rgb('#645c86')],
    ];
    const tintTop = rgb('#ffc8ee'), tintLow = rgb('#7fc8ff'), tintWarm = rgb('#ffae8a'), tintMag = rgb('#e89aff');
    pb.polyFn(poly, (x, y) => {
      const ty = topY(x);
      const dt = y - ty;
      let c;
      if (dt < 3.5 && x < 292) {
        // upper surfaces: hood, roof, deck — reflect the pink sky glow
        c = ND.mix(rgb('#fff0fa'), tintTop, 0.3 + (dt / 3.5) * 0.35);
        if (dt < 1) c = rgb('#ffffff');
      } else {
        const t = ND.clamp((y - 24) / 38, 0, 1);
        c = ND.grad(ramp, t);
        // environment tints: pink neon from above-behind, cyan from the street, warm lamps low
        c = ND.mix(c, tintTop, ND.clamp(0.28 - t * 0.5, 0, 0.28) * (0.4 + (x / HW) * 0.6));
        c = ND.mix(c, tintMag, ND.clamp(1 - Math.abs(t - 0.62) * 5, 0, 1) * 0.16);
        c = ND.mix(c, tintLow, ND.clamp((t - 0.55) * 0.9, 0, 0.3) * (1 - (x / HW) * 0.7));
        c = ND.mix(c, tintWarm, ND.clamp((t - 0.6) * 0.6, 0, 0.2) * (x / HW));
        // shoulder crease highlight
        if (Math.abs(dt - 4.5) < 0.6 && (x < 104 || x > 208)) c = ND.mix(c, [255, 255, 255], 0.7);
        if (Math.abs(dt - 5.5) < 0.6 && (x < 104 || x > 208)) c = ND.scale(c, 0.93);
        // front fender / rear haunch curvature: darker as the surface turns away
        const fx = Math.min(1, x / 18), rx = Math.min(1, (HW - x) / 14);
        c = ND.scale(c, 0.82 + 0.18 * Math.min(fx, rx));
      }
      if (y >= 61) c = rgb('#4e4870');
      pb.dset(x, y, c, 255, 6);
    });
    // lower body character line
    for (let x = 12; x < 290; x++) {
      if (x > 40 && x < 92) continue;
      if (x > 220 && x < 272) continue;
      pb.set(x, 57, ND.pack(150, 142, 186));
      pb.set(x, 58, ND.pack(118, 110, 158));
    }

    // tail face (slightly darker vertical plane)
    for (let y = 21; y < 61; y++) {
      pb.dset(298, y, rgb('#b4b0cc'), 255, 6);
      pb.dset(297, y, rgb('#d0cce0'), 255, 6);
    }
    // front bumper face / nose lip
    for (let y = 43; y < 61; y++) pb.dset(0, y, rgb('#bdb9d4'), 255, 6);
    pb.hline(4, 44, 60, P(rgb('#3a3654')));
    pb.hline(3, 42, 61, P(rgb('#24203a')));
    for (let x = 6; x < 38; x += 3) pb.set(x, 58, P(rgb('#5a5678'))); // lower grille slots

    // wheel arch interiors (dark) + lip highlight
    for (const [wx, wy] of WHEELS) {
      pb.discFn(wx, wy, 24.5, (x, y, d) => {
        if (y > 62) return;
        if (d > 0.96) pb.set(x, y, P(rgb('#e8e4f4')));
        else pb.set(x, y, P(d > 0.9 ? rgb('#2a2440') : rgb('#110d1a')));
      });
    }

    // ---- greenhouse
    // windshield seen edge-on: dark glass wedge with neon reflections
    // windshield seen from the side: smooth tinted glass between the rake and
    // the A-pillar, one soft reflection band
    const shield = [[101, 26.6], [104, 26], [140, 2], [146, 1.4], [146, 3.6], [143.5, 3.6], [113.5, 26.6]];
    pb.polyFn(shield, (x, y) => {
      let c = ND.mix(rgb('#30285e'), rgb('#141030'), ND.clamp((y - 2) / 24, 0, 1));
      pb.set(x, y, ND.pack(c[0], c[1], c[2]));
    });
    // frame highlight: the top pixel of each glass column (inside the outline)
    for (let x = 102; x <= 146; x++) {
      for (let y = 0; y < 28; y++) {
        const i = y * HW + x;
        if (pb.d[i] >>> 24 && y >= Math.floor(topY(x)) && ND.clamp(x, 101, 146) === x) {
          const inShield = y > topY(x) - 0.5 && y < topY(x) + 1.5;
          if (inShield) { pb.set(x, y, P(rgb('#eeeaf8'))); break; }
        }
      }
    }
    const glassDoor = [[114.5, 26], [144.5, 4], [172, 4], [172, 26]];
    const glassRear = [[176, 4], [197, 4], [202, 6], [206, 14], [208, 26], [176, 26]];
    pb.polyFn(glassRear, (x, y) => {
      const v = (y - 4) / 22;
      let c = ND.mix(rgb('#3a2f6a'), rgb('#140f28'), v);
      if ((x + y) % 11 < 2) c = ND.mix(c, rgb('#b09ad8'), 0.25);
      pb.set(x, y, ND.pack(c[0], c[1], c[2], 190));
    });
    pb.polyFn(glassDoor, (x, y) => {
      const v = (y - 4) / 22;
      const c = ND.mix(rgb('#2a2250'), rgb('#120e22'), v);
      pb.set(x, y, ND.pack(c[0], c[1], c[2], 165)); // open window: we see through to the far side
    });
    // A-pillar: one slim dark post with a lit leading edge
    pb.lineFn(113, 26, 143, 4, (x, y) => {
      pb.set(x, y, P(rgb('#8e88b0')));
      pb.set(x + 1, y, P(rgb('#1a1628')));
    });
    // B-pillar
    for (let y = 3; y < 27; y++) {
      pb.set(173, y, P(rgb('#1c1830')));
      pb.set(174, y, P(rgb('#2c2842')));
      pb.set(175, y, P(rgb('#48446a')));
    }
    // window frame / beltline rubber
    pb.hline(106, 208, 26, P(rgb('#1e1a2e')));
    pb.hline(106, 208, 27, P(rgb('#fdfbff')));
    // roof edge
    pb.hline(139, 200, 3, P(rgb('#cfc8e4')));
    // fuel filler on the buttress
    pb.discFn(216, 15, 4.2, (x, y, d) => { if (d > 0.72) pb.set(x, y, P(rgb('#b8b2d0'))); });
    pb.set(213, 13, P(rgb('#ffffff')));

    // ---- interior visible through the open window
    // steering wheel + dash
    // steering wheel rim and dash, inside the cabin behind the A-pillar
    pb.thick(136, 13, 138, 23, 0.9, P(rgb('#0e0a16')));
    pb.thick(121, 23, 140, 21, 1.1, P(rgb('#16121e')));
    // seat back / headrest
    for (let y = 6; y < 26; y++) for (let x = 162; x < 171; x++) {
      if (y < 9 && (x < 164 || x > 168)) continue;
      pb.set(x, y, P(x === 162 ? rgb('#3a3450') : rgb('#1a1626')));
    }

    // ---- side strakes
    for (let i = 0; i < 7; i++) {
      const y = 35 + i * 3;
      const xs = Math.round(111 + i * 0.6), xe = Math.round(196 - i * 0.4);
      for (let x = xs; x <= xe; x++) {
        const intake = x > 176;
        pb.set(x, y, P(intake ? rgb('#f2f0f8') : rgb('#ffffff')));
        pb.set(x, y + 1, P(intake ? rgb('#8e8aaa') : rgb('#d6d2e6')));
        if (x > xs) pb.set(x, y + 2, P(intake ? rgb('#0e0b16') : rgb('#6a6688')));
      }
      pb.set(xe + 1, y + 1, P(rgb('#b0acc8')));
    }
    // door shut lines
    pb.lineFn(105, 28, 107, 60, (x, y) => pb.set(x, y, P(rgb('#9894b4'))));
    for (let y = 28; y < 60; y++) if (y < 35 || y > 56) pb.set(173, y, P(rgb('#9894b4')));

    // ---- side mirror on the A-pillar
    pb.line(122, 19, 124, 19, P(rgb('#2a2440')));
    pb.polyFn([[115, 15.5], [120.5, 15], [122.5, 16.5], [122, 20.5], [116, 20.5], [114.5, 19]], (x, y) => {
      const c = y < 17 ? rgb('#ffffff') : y < 19 ? rgb('#e6e2f2') : rgb('#b4aed0');
      pb.set(x, y, P(c));
    });
    pb.hline(116, 121, 21, P(rgb('#4a4470')));

    // ---- lights
    const amber = rgb('#ffa21e'), red = rgb('#ff2438');
    for (let y = 45; y <= 48; y++) for (let x = 1; x <= 6; x++) { pb.set(x, y, P(ND.mix(amber, [255, 240, 200], x < 3 ? 0.4 : 0))); gl.set(x, y, ND.pack(255, 150, 30)); }
    for (let x = 28; x <= 33; x++) { pb.set(x, 46, P(amber)); pb.set(x, 47, P(ND.scale(amber, 0.75))); gl.set(x, 46, ND.pack(200, 110, 20)); }
    for (let y = 27; y <= 41; y++) for (let x = 293; x <= 298; x++) {
      const louvre = (y - 27) % 3 === 2;
      const c = louvre ? ND.scale(red, 0.35) : ND.mix(red, [255, 200, 200], x > 296 ? 0.3 : 0);
      pb.set(x, y, P(c));
      if (!louvre) gl.set(x, y, ND.pack(255, 30, 50));
    }
    for (let x = 277; x <= 282; x++) { pb.set(x, 44, P(red)); gl.set(x, 44, ND.pack(200, 20, 40)); }

    const body = ND.sprite(pb, gl);
    body.glowPts = { tail: [296, 34], front: [3, 46] };

    // Paint mask for live environment reflections: strongest on the upper
    // flank above the paint's horizon line, faint on the lower flank.
    const mask = new ND.PB(HW, HH);
    mask.polyFn(poly, (x, y) => {
      if (y > 60) return;
      const dt = y - topY(x);
      const a = dt < 3.5 ? 0.2 : y < 44 ? 0.3 : 0.55 + ND.clamp((y - 44) / 14, 0, 1) * 0.45;
      mask.set(x, y, ND.pack(255, 255, 255, a * 255));
    });
    for (const g of [shield, glassDoor, glassRear]) mask.polyFn(g, (x, y) => mask.set(x, y, 0));
    for (const [wx, wy] of WHEELS) mask.discFn(wx, wy, 24.5, (x, y) => { if (y <= 62) mask.set(x, y, 0); });
    mask.rect(176, 34, 24, 24, 0);
    mask.rect(0, 44, 8, 6, 0);
    mask.rect(290, 25, 10, 20, 0);
    body.mask = mask.canvas();
    return body;
  }

  // Five-spoke star rims with motion blur; 12 frames cover 72 degrees.
  function genWheelFrames(R = WHEEL_R, spokes = 5, blur = 0.2) {
    const S = R * 2 + 1;
    const frames = [];
    const nF = 12;
    const period = (Math.PI * 2) / spokes;
    for (let f = 0; f < nF; f++) {
      const pb = new ND.PB(S, S);
      const th = (f / nF) * period;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const dx = x - R, dy = y - R;
          const d = Math.hypot(dx, dy);
          if (d > R + 0.4) continue;
          const ang = Math.atan2(dy, dx);
          const light = 0.5 - 0.5 * Math.cos(ang + Math.PI * 0.75); // lit from upper-left
          let c;
          const rr = d / R;
          if (rr > 0.9) {
            c = ND.mix(rgb('#100c16'), rgb('#3a344c'), Math.pow(light, 3) * 0.9);
          } else if (rr > 0.71) {
            c = ND.mix(rgb('#1a1524'), rgb('#2c2638'), light * 0.8);
            if (rr > 0.86 && rr < 0.9) c = ND.mix(c, rgb('#3c364e'), 0.5);
          } else if (rr > 0.66) {
            c = ND.mix(rgb('#7a7a92'), rgb('#f0f0fa'), light);
          } else {
            // rim face: spokes with motion blur
            let cover = 0;
            const samples = 4;
            for (let k = 0; k < samples; k++) {
              const a = ang - th - (k / samples) * blur; // trail lies behind a counter-clockwise spin
              let m = ((a % period) + period) % period;
              if (m > period / 2) m -= period;
              const halfW = (2.9 - d * 0.07) / Math.max(1.5, d);
              if (Math.abs(m) < halfW + 0.02 && d > 3) cover++;
            }
            cover /= samples;
            let gap = rgb('#1c1828');
            if (d > 7 && d < 12.5) gap = ND.mix(rgb('#3c3850'), rgb('#56526a'), light * 0.5); // brake disc
            if (d > 8 && d < 12.5 && ang > -1.0 && ang < -0.2) gap = rgb('#2a2636'); // caliper (fixed)
            const spoke = ND.mix(rgb('#8c8ca4'), rgb('#e6e6f2'), light);
            c = ND.mix(gap, spoke, cover);
            if (d <= 4.6) c = ND.mix(rgb('#8c8ca4'), rgb('#dcdcea'), light);
            if (d <= 2.6) c = rgb('#f2c230');
            if (d <= 1.0) c = rgb('#3a2a10');
          }
          pb.set(x, y, ND.pack(c[0], c[1], c[2]));
        }
      frames.push(pb.canvas());
    }
    return { frames, R, S, period };
  }

  // ===========================================================================
  // Traffic — boxy 80s cars at background-lane scale, facing left.
  // ===========================================================================
  const TW = 162, TH = 48, TG = 47;
  const PROFILES = {
    sedan: {
      top: [[0, 27], [3, 22], [16, 20], [40, 18.5], [50, 17.5], [60, 8], [64, 6.5], [100, 6.5], [106, 8], [116, 17.5], [146, 18.5], [157, 19.5], [160, 22]],
      windows: [[[53, 17], [62, 9], [80, 9], [80, 17]], [[83, 9], [99, 9], [104, 11], [112, 17], [83, 17]]],
    },
    coupe: {
      top: [[0, 26], [3, 21.5], [20, 19.5], [46, 18], [60, 9], [66, 7], [92, 7], [122, 14.5], [150, 17.5], [158, 19], [160, 22]],
      windows: [[[53, 17], [62, 10], [84, 9], [84, 17]], [[87, 9], [92, 9], [114, 15.5], [87, 16]]],
    },
    wagon: {
      top: [[0, 27], [3, 22], [16, 20], [40, 18.5], [50, 17.5], [60, 8], [64, 6.5], [146, 6.5], [152, 9], [156, 18.5], [160, 22]],
      windows: [[[53, 17], [62, 9], [80, 9], [80, 17]], [[83, 9], [110, 9], [110, 17], [83, 17]], [[113, 9], [144, 9], [148, 12], [150, 17], [113, 17]]],
    },
  };
  const TRAFFIC_COLS = [rgb('#7a1424'), rgb('#b8bccc'), rgb('#1a1822'), rgb('#1c2a58'), rgb('#1a7078'), rgb('#24483a'), rgb('#5a1a3a'), rgb('#b08a48'), rgb('#3a1a60')];

  function trafficTop(top, x) {
    if (x <= top[0][0]) return top[0][1];
    for (let i = 1; i < top.length; i++) {
      if (x <= top[i][0]) {
        const a = top[i - 1], b = top[i];
        return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
      }
    }
    return 22;
  }

  function genTraffic(seed, opts = {}) {
    const r = ND.rng(seed);
    const kind = opts.kind || r.pick(['sedan', 'sedan', 'coupe', 'wagon', 'coupe']);
    const special = opts.special || (r.chance(0.08) ? 'taxi' : r.chance(0.05) ? 'police' : null);
    const prof = PROFILES[special ? 'sedan' : kind];
    let base = opts.color || (special === 'taxi' ? rgb('#f0b818') : special === 'police' ? rgb('#16161e') : r.pick(TRAFFIC_COLS));
    const pb = new ND.PB(TW, TH), gl = new ND.PB(TW, TH);
    const P = (c) => ND.pack(c[0], c[1], c[2]);
    const wheels = [[32, 37], [128, 37]];
    const pts = prof.top.slice();
    pts.push([160, 32], [158, 37], [142, 37.5]);
    arch(pts, 128, 37, 12.5, 37.5);
    pts.push([114, 37.5], [46, 37.5]);
    arch(pts, 32, 37, 12.5, 37.5);
    pts.push([18, 37.5], [2, 37], [0, 33]);
    pb.polyFn(pts, (x, y) => {
      const ty = trafficTop(prof.top, x);
      const dt = y - ty;
      let c;
      if (dt < 1.2) c = ND.mix(ND.scale(base, 1.5), [255, 200, 240], 0.35);
      else {
        const t = ND.clamp((y - 17) / 21, 0, 1);
        c = ND.scale(base, 1.18 - t * 0.62);
        c = ND.mix(c, [255, 120, 220], 0.08 * (1 - t));
      }
      if (special === 'police' && y > 19 && y < 31 && x > 50 && x < 112) c = ND.scale(rgb('#e8e8f0'), 1.05 - (y - 19) / 40);
      pb.dset(x, y, c, 255, 8);
    });
    // chrome trim + bumpers
    pb.hline(4, 156, 29, P(ND.mix(base, [220, 220, 240], 0.5)));
    for (let y = 26; y < 35; y++) { pb.set(0, y, P(rgb('#9a9ab0'))); pb.set(1, y, P(rgb('#c8c8d8'))); pb.set(159, y, P(rgb('#9a9ab0'))); pb.set(160, y, P(rgb('#6a6a80'))); }
    pb.hline(2, 158, 37, P(rgb('#221c2c')));
    // arches
    for (const [wx, wy] of wheels) pb.discFn(wx, wy, 12.5, (x, y, d) => { if (y <= 37) pb.set(x, y, P(d > 0.9 ? ND.scale(base, 0.5) : rgb('#0e0a14'))); });
    // windows with occupants
    const occupants = r.int(1, 2);
    prof.windows.forEach((w, wi) => {
      pb.polyFn(w, (x, y) => {
        const v = (y - 8) / 10;
        let c = ND.mix(rgb('#3a3068'), rgb('#120e24'), v);
        if ((x + y * 2) % 17 < 2) c = ND.mix(c, rgb('#a898d8'), 0.3);
        pb.set(x, y, P(c));
      });
      if (wi < occupants) {
        const hx = wi === 0 ? 70 : 92, hy = 12;
        pb.disc(hx, hy, 2.6, P(rgb('#241a2a')));
        pb.rect(hx - 3, hy + 2, 7, 4, P(rgb('#1e1624')));
      }
    });
    // pillars
    for (let y = 8; y < 18; y++) { pb.set(81, y, P(ND.scale(base, 0.45))); pb.set(82, y, P(ND.scale(base, 0.6))); }
    // lights
    for (let y = 21; y <= 27; y++) for (let x = 155; x <= 160; x++) {
      const c = rgb('#ff2a3c');
      pb.set(x, y, P(y === 24 ? ND.scale(c, 0.6) : c));
      gl.set(x, y, ND.pack(255, 30, 50));
    }
    for (let y = 22; y <= 26; y++) for (let x = 0; x <= 2; x++) {
      pb.set(x, y, P(rgb('#fff6d8')));
      gl.set(x, y, ND.pack(255, 240, 200));
    }
    pb.set(5, 27, P(rgb('#ffa21e'))); gl.set(5, 27, ND.pack(200, 120, 20));
    // taxi sign / police bar
    let bar = null;
    if (special === 'taxi') {
      pb.rect(74, 2, 14, 5, P(rgb('#ffe890')));
      for (let x = 74; x < 88; x++) for (let y = 2; y < 7; y++) gl.set(x, y, ND.pack(200, 170, 70));
      const mk = ND.textMask('TAXI', { small: true, gap: 0 });
      for (let y = 0; y < mk.h; y++) for (let x = 0; x < mk.w; x++) if (mk.m[y * mk.w + x] && y < 5) pb.set(75 + x, 2 + y, P(rgb('#402808')));
    }
    if (special === 'police') {
      pb.rect(72, 3, 20, 3, P(rgb('#2a2a3a')));
      bar = { x: 72, y: 3, w: 20 };
    }
    // wheels (4 frames of a simple hubcap)
    const wheelFrames = [];
    for (let f = 0; f < 4; f++) {
      const w = new ND.PB(21, 21);
      for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
        const d = Math.hypot(x - 10, y - 10), a = Math.atan2(y - 10, x - 10);
        if (d > 10.4) continue;
        let c = d > 6.2 ? rgb('#141018') : ND.mix(rgb('#6a6a84'), rgb('#c8c8dc'), 0.5 - 0.5 * Math.cos(a + 2.3));
        if (d <= 6.2 && d > 3 && Math.cos((a - (f / 4) * (Math.PI / 2)) * 4) > 0.7) c = rgb('#3a3a50');
        if (d <= 1.4) c = rgb('#2a2a3a');
        w.set(x, y, P(c));
      }
      wheelFrames.push(w.canvas());
    }
    return {
      body: ND.sprite(pb, gl),
      wheels,
      wheelFrames,
      bar,
      w: TW,
      h: TH,
      ground: TG,
      special,
    };
  }

  // Door window glass (rolled up in the rain): tint, highlights, raindrops.
  function genWindowGlass(seed) {
    const r = ND.rng(seed);
    const poly = [[114.5, 26], [144.5, 4], [172, 4], [172, 26]];
    const pb = new ND.PB(HW, 28);
    pb.polyFn(poly, (x, y) => {
      let a = 60, c = [150, 140, 215];
      const s = x + y * 1.3;
      if (s % 23 < 3) { a = 125; c = [235, 225, 255]; }
      else if (s % 23 < 5) { a = 90; c = [255, 150, 230]; }
      pb.set(x, y, ND.pack(c[0], c[1], c[2], a));
    });
    for (let i = 0; i < 11; i++) {
      const x = r.int(122, 170), y = r.int(7, 22);
      if (!pb.alpha(x, y)) continue;
      pb.set(x, y, ND.pack(235, 230, 255, 150));
      for (let k = 1; k < r.int(2, 4); k++) if (pb.alpha(x, y + k)) pb.set(x, y + k, ND.pack(200, 195, 240, 90));
    }
    return pb.canvas();
  }

  ND.genHeroCar = genHeroCar;
  ND.genWindowGlass = genWindowGlass;
  ND.genDriver = genDriver;
  ND.genDriverArm = genDriverArm;
  ND.genWheelFrames = genWheelFrames;
  ND.genTraffic = genTraffic;
  ND.HERO = { W: HW, H: HH, WHEELS, WHEEL_R, topY };
})();
