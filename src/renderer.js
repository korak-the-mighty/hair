/* Neon Drive — frame renderer: layered composition, emissive buffer, wet-road
 * reflections, bloom and final presentation at integer pixel scale. */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, H, CX, Y } = ND;
  const CURB = Y.CURB;
  const RH = H - CURB;

  function smoothCtx(cv) {
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = true;
    return x;
  }

  // Mode-7 style ground texture for the road: alpha = how much the asphalt
  // hides the reflection (puddles are nearly transparent = mirror-like).
  function makeRoadTexture(seed) {
    const T = 1024;
    const pb = new ND.PB(T, RH);
    for (let j = 0; j < RH; j++) {
      const y = CURB + j;
      const f = ND.fAt(y);
      const depth = 1 / f;
      for (let u = 0; u < T; u++) {
        const n = (a) => ND.fbm(a / 70, depth * 4.2, 4, seed);
        const k = u / T;
        const nn = n(u) * (1 - k) + n(u - T) * k; // periodic blend
        let a = 0.62;
        const puddle = ND.clamp((nn - 0.5) * 7, 0, 1);
        a = a * (1 - puddle * 0.88);
        let c = [12, 8, 22];
        const g = ND.hash(u, j, seed);
        if (g < 0.06) { c = [38, 30, 52]; a = Math.max(a, 0.55); }
        else if (g > 0.95) { a = Math.max(0, a - 0.2); }
        // gutter along the curb
        if (j < 5) { a = Math.max(a, 0.72 - j * 0.08); c = [10, 6, 16]; }
        // lane dashes
        if (y >= 298 && y <= 300 && u % 72 < 38) {
          c = y === 298 ? [255, 196, 96] : [214, 140, 40];
          a = 0.85;
        }
        pb.set(u, j, ND.pack(c[0], c[1], c[2], a * 255));
      }
    }
    return { canvas: pb.canvas(), T };
  }

  function makeSidewalkTexture(seed) {
    const T = 1024, SH = CURB - Y.BUILD;
    const pb = new ND.PB(T, SH);
    for (let j = 0; j < SH; j++) {
      const t = j / (SH - 1);
      for (let u = 0; u < T; u++) {
        let c = ND.mix([76, 42, 84], [58, 32, 72], t);
        const n = ND.fbm(u / 40, j / 3, 3, seed) - 0.5;
        c = ND.scale(c, 1 + n * 0.25);
        if (u % 48 < 3) c = ND.scale(c, 0.55);        // expansion joints
        if (j === 0) c = ND.scale(c, 0.7);             // building base shadow
        if (ND.hash(u, j, seed) < 0.04) c = ND.scale(c, 1.3);
        pb.dset(u, j, c, 255, 8);
      }
    }
    return { canvas: pb.canvas(), T, SH };
  }

  // Draws a horizontally tiling texture row with ground-plane perspective.
  function mode7Row(ctx, tex, T, row, y, D, f, n = 1) {
    const sw = W / f;
    let u0 = (-D - CX / f) % T;
    if (u0 < 0) u0 += T;
    if (u0 + sw <= T) {
      ctx.drawImage(tex, u0, row, sw, n, 0, y, W, n);
    } else {
      const w1 = T - u0;
      const dx = Math.round(w1 * f);
      ctx.drawImage(tex, u0, row, w1, n, 0, y, dx, n);
      ctx.drawImage(tex, 0, row, sw - w1, n, dx, y, W - dx, n);
    }
  }

  class Renderer {
    constructor(world, opts = {}) {
      this.world = world;
      this.opts = opts;
      this.scene = ND.canvas(W, H);
      this.c = ND.ctx(this.scene);
      this.glowC = ND.canvas(W, H);
      this.g = ND.ctx(this.glowC);

      this.bl = [ND.canvas(W / 2, H / 2), ND.canvas(W / 4, H / 4), ND.canvas(W / 8, Math.ceil(H / 8)), ND.canvas(W / 16, Math.ceil(H / 16))];
      this.blx = this.bl.map(smoothCtx);

      this.K = 1.45;
      this.TOPB = CURB - Math.ceil(RH * this.K) - 8;
      this.BH = CURB - this.TOPB;
      this.upper = ND.canvas(W, this.BH);
      this.upx = ND.ctx(this.upper);
      this.mix = ND.canvas(W, this.BH);
      this.mx = ND.ctx(this.mix);
      this.mb = [ND.canvas(W, Math.ceil(this.BH / 2)), ND.canvas(W, Math.ceil(this.BH / 4)), ND.canvas(W, Math.ceil(this.BH / 8))];
      this.mbx = this.mb.map(smoothCtx);
      this.wet = { ripple: 1, mirror: 1, streak: 1 };
      this.rsrc = ND.canvas(W, this.BH);
      this.rsx = ND.ctx(this.rsrc);
      this.fresnel = (() => {
        const pb = new ND.PB(W, RH);
        for (let j = 0; j < RH; j++)
          for (let x = 0; x < W; x++) {
            const a = ND.clamp(0.12 + (j / RH) * 0.55, 0, 1);
            const q = Math.floor(a * 16 + ND.bayer(x, j)) / 16;
            pb.set(x, j, ND.pack(12, 8, 24, q * 255));
          }
        return pb.canvas();
      })();
      this.refl = ND.canvas(W, RH);
      this.rx = ND.ctx(this.refl);
      this.strip = ND.canvas(W, 26);
      this.sx = ND.ctx(this.strip);

      this.carC = ND.canvas(ND.HERO.W, ND.HERO.H);
      this.carX = ND.ctx(this.carC);
      this.trafC = ND.canvas(162, 48);
      this.trafX = ND.ctx(this.trafC);

      this.road = makeRoadTexture(world.seed + 3);
      this.walk = makeSidewalkTexture(world.seed + 4);
      this.vignette = ND.genVignette(W, H);
      this.vigTop = 110;
      this.vigSide = 190;
      this.haze = this.makeHaze();
      this.bloom = opts.bloom != null ? opts.bloom : 0.62;
      // quality: 2 = full, 1 = coarser ground/reflection rows, 0 = minimal
      this.q = opts.quality != null ? opts.quality : 2;
    }

    makeHaze() {
      const pb = new ND.PB(W, 120);
      for (let y = 0; y < 120; y++)
        for (let x = 0; x < W; x++) {
          const t = y / 119;
          const a = Math.sin(t * Math.PI) * 0.16 + t * 0.06;
          const q = Math.floor(a * 20 + ND.bayer(x, y)) / 20;
          if (q > 0) pb.set(x, y, ND.pack(120, 50, 140, q * 255));
        }
      return pb.canvas();
    }

    // Draw a sprite into the colour buffer; it occludes glow behind it and
    // contributes its own emissive pixels.
    spr(s, x, y) {
      this.c.drawImage(s.c, x, y);
      this.occlude(s.c, x, y);
      if (s.g) this.g.drawImage(s.g, x, y);
    }
    occlude(img, x, y, w, h) {
      const g = this.g;
      g.globalCompositeOperation = 'destination-out';
      if (w) g.drawImage(img, x, y, w, h);
      else g.drawImage(img, x, y);
      g.globalCompositeOperation = 'lighter';
    }

    render() {
      const w = this.world, c = this.c, g = this.g;
      const t = w.tick / 60;
      const R = { c, g, t, tick: w.tick, D: w.D, r: this };
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';

      w.sky.draw(R);
      this.drawSkyline(R);
      this.drawBuildings(R);
      this.drawSidewalk(R);
      this.drawStreetLife(R);
      this.drawCurb(R);
      this.drawRoad(R);
      this.drawTraffic(R);
      this.drawHero(R);
      this.drawForeground(R);
      this.post(R);
    }

    // ---------------------------------------------------------------------------
    drawSkyline(R) {
      const { c, g } = R;
      const w = this.world;
      w.skyLayers.forEach((layer, d) => {
        for (const it of layer.items) {
          const x = layer.x(it, R.D);
          if (x > W || x + it.w < 0) continue;
          this.spr(it.spr, x, it.y);
          for (const a of it.anims) this.anim(R, a, x, it.y);
        }
        if (d === 1) c.drawImage(this.haze, 0, 128);
      });
      c.globalAlpha = 0.7;
      c.drawImage(this.haze, 0, 150);
      c.globalAlpha = 1;
    }

    anim(R, a, ox, oy) {
      const { c, g, t } = R;
      switch (a.type) {
        case 'blink': {
          const ph = (t / a.period + a.phase) % 1;
          if (ph < 0.12) {
            c.fillStyle = ND.css(a.color);
            c.fillRect(ox + a.x, oy + a.y, 1, 1);
            g.fillStyle = ND.css(a.color, 0.9);
            g.fillRect(ox + a.x - 1, oy + a.y, 3, 1);
            g.fillRect(ox + a.x, oy + a.y - 1, 1, 3);
          }
          break;
        }
        case 'bridgeCars': {
          for (const car of a.cars) {
            let px = (car.off + R.tick * car.v * car.dir) % a.w;
            if (px < 0) px += a.w;
            const x = Math.round(ox + px), y = oy + a.y + (car.dir > 0 ? 1 : 0);
            if (car.dir > 0) {
              c.fillStyle = '#ff3a4a'; c.fillRect(x, y, 2, 1);
              g.fillStyle = 'rgba(255,40,60,0.8)'; g.fillRect(x - 1, y, 4, 1);
            } else {
              c.fillStyle = '#fff4d0'; c.fillRect(x, y, 2, 1);
              g.fillStyle = 'rgba(255,240,200,0.8)'; g.fillRect(x - 1, y, 4, 1);
            }
          }
          break;
        }
        case 'flicker': {
          let off = false;
          if (a.slow) off = Math.floor(t * 0.8 + a.seed) % 2 === 1;
          else {
            const k = Math.floor(t * 12);
            const burst = ND.hash(Math.floor(t * 0.5), a.seed | 0) < a.rate * 4;
            off = burst && ND.hash(k, (a.seed | 0) + 1) < 0.45;
          }
          if (off && a.off) {
            c.drawImage(a.off, ox + a.x, oy + a.y);
            g.globalCompositeOperation = 'destination-out';
            g.fillStyle = '#000';
            g.fillRect(ox + a.x, oy + a.y, a.w, a.h);
            g.globalCompositeOperation = 'lighter';
          }
          break;
        }
        case 'chase': {
          const step = Math.floor(t * a.speed);
          c.fillStyle = ND.css(a.color);
          g.fillStyle = ND.css(a.glow, 0.9);
          for (let i = 0; i < a.pts.length; i++) {
            if ((i + step) % 3) continue;
            const [px, py] = a.pts[i];
            c.fillRect(ox + px, oy + py, 1, 1);
            g.fillRect(ox + px - 1, oy + py, 3, 1);
          }
          break;
        }
        case 'tv': {
          const k = Math.floor(t * 8 + a.seed);
          const v = ND.hash(k, a.seed | 0);
          const col = v < 0.5 ? [90, 140, 255] : v < 0.8 ? [150, 200, 255] : [255, 255, 255];
          c.globalAlpha = 0.35 + v * 0.3;
          c.fillStyle = ND.css(col);
          c.fillRect(ox + a.x, oy + a.y, a.w, a.h);
          c.globalAlpha = 1;
          g.fillStyle = ND.css(col, 0.25);
          g.fillRect(ox + a.x, oy + a.y, a.w, a.h);
          break;
        }
      }
    }

    // ---------------------------------------------------------------------------
    drawBuildings(R) {
      const w = this.world, layer = w.buildings;
      for (const it of layer.items) {
        if (it.isGap) continue;
        const x = layer.x(it, R.D);
        if (x > W || x + it.w < 0) continue;
        if (!it.data) w.jobs.finish(it.job);
        const d = it.data;
        this.spr(d.spr, x, d.y);
        for (const a of d.anims) this.anim(R, a, x, d.y);
      }
    }

    drawSidewalk(R) {
      const { c, g } = R;
      const w = this.world;
      const y0 = Y.BUILD, SH = this.walk.SH;
      // wet reflection source: the bottom of the buildings
      this.sx.clearRect(0, 0, W, 26);
      this.sx.drawImage(this.scene, 0, y0 - 26, W, 26, 0, 0, W, 26);
      const rs = this.q >= 2 ? 1 : 2;
      for (let j = 0; j < SH; j += rs) {
        const y = y0 + j;
        mode7Row(c, this.walk.canvas, this.walk.T, j, y, R.D, ND.fAt(y), Math.min(rs, SH - j));
      }
      // mirrored building bases
      for (let j = 1; j < SH; j++) {
        c.globalAlpha = 0.32 * (1 - j / SH);
        const sy = 25 - Math.floor(j * 1.3);
        if (sy < 0) break;
        c.drawImage(this.strip, 0, sy, W, 1, 0, y0 + j, W, 1);
      }
      c.globalAlpha = 1;
      // storefront light spilling onto the wet pavement
      c.globalCompositeOperation = 'lighter';
      const layer = w.buildings;
      for (const it of layer.items) {
        if (!it.data) continue;
        const x = layer.x(it, R.D);
        if (x > W || x + it.w < 0) continue;
        for (const p of it.data.pools) {
          c.globalAlpha = p.s;
          c.drawImage(w.spillFor(p.c), x + p.x0 - 4, y0, p.x1 - p.x0 + 8, SH);
        }
      }
      c.globalAlpha = 1;
      // lamp pools
      const curb = w.curb;
      for (const it of curb.items) {
        if (it.type !== 'lamp') continue;
        const x = curb.x(it, R.D);
        if (x < -60 || x > W + 60) continue;
        c.drawImage(w.lampPool, x - 45, CURB - 12);
      }
      c.globalCompositeOperation = 'source-over';
    }

    drawStreetLife(R) {
      const { c } = R;
      const w = this.world, layer = w.buildings;
      const FOOT = ND.PERSON.FOOT, FW = ND.PERSON.FW;
      // planters and patio crowds move with the buildings (f = 0.5)
      for (const it of layer.items) {
        if (!it.data || it.isGap) continue;
        const x = layer.x(it, R.D);
        if (x > W + 40 || x + it.w < -40) continue;
        for (const p of it.planters) {
          const img = p.p;
          c.drawImage(img.c, x + p.x, 236 - img.h);
          this.occlude(img.c, x + p.x, 236 - img.h);
        }
        for (const cr of it.crowd) {
          const fr = Math.floor(R.tick / cr.rate + cr.ph) % 4;
          const img = cr.p[cr.face][fr];
          const px = x + cr.x - FW / 2, py = 232 + cr.y - FOOT;
          c.drawImage(img, px, py);
          this.occlude(img, px, py);
        }
      }
      // walkers, back to front
      const walkers = w.walkers.slice().sort((a, b) => a.y - b.y);
      for (const p of walkers) {
        const x = Math.round(CX + (R.D - p.P) * p.f);
        if (x < -30 || x > W + 30) continue;
        const fr = Math.floor(R.tick / p.rate + p.ph) % 8;
        const img = (p.dir > 0 ? p.sp.walkL : p.sp.walkR)[fr];
        c.drawImage(img, x - FW / 2, p.y - FOOT);
        this.occlude(img, x - FW / 2, p.y - FOOT);
      }
    }

    drawCurb(R) {
      const { c, g, t } = R;
      const w = this.world, curb = w.curb;
      const base = CURB - 1;
      for (const it of curb.items) {
        const x = curb.x(it, R.D);
        if (it.type === 'lamp') {
          const L = it.lamp;
          if (x < -40 || x > W + 40) continue;
          const lx = x - L.baseX, ly = base - L.h + 2;
          this.spr(L.spr, lx, ly);
          g.drawImage(w.lampHalo, lx + L.light[0] - 30, ly + L.light[1] - 30);
        } else {
          const P = it.palm;
          if (x < -P.S || x > W + P.S) continue;
          const tx = x - P.bx, ty = base - P.h;
          c.drawImage(P.trunk.c, tx, ty);
          this.occlude(P.trunk.c, tx, ty);
          const fr = Math.floor(t * 2.2 + it.ph) % ND.PALM_FRAMES;
          const img = P.crowns[fr];
          const cx = x + Math.round(P.topDX) - Math.round(P.ccx), cy = ty - Math.round(P.ccy);
          c.drawImage(img, cx, cy);
          this.occlude(img, cx, cy);
        }
      }
      // the curb itself
      c.fillStyle = '#b388c0';
      c.fillRect(0, CURB, W, 1);
      c.fillStyle = '#3a2248';
      c.fillRect(0, CURB + 1, W, 1);
      c.fillStyle = '#1e1028';
      c.fillRect(0, CURB + 2, W, 2);
    }

    // ---------------------------------------------------------------------------
    drawRoad(R) {
      const { c, g, t } = R;
      const wet = this.wet;
      const TOPB = this.TOPB, BH = this.BH;
      // snapshot the band of the upper world that the road can reflect
      this.upx.drawImage(this.scene, 0, TOPB, W, BH, 0, 0, W, BH);
      // mix colour + emissive light, then smear it vertically (wet asphalt
      // scatters reflections into long streaks)
      const mx = this.mx;
      mx.globalCompositeOperation = 'source-over';
      mx.clearRect(0, 0, W, BH);
      mx.globalAlpha = 0.34 * wet.mirror;
      mx.drawImage(this.upper, 0, 0);
      mx.globalCompositeOperation = 'lighter';
      mx.globalAlpha = 1.2 * wet.streak;
      mx.drawImage(this.glowC, 0, TOPB, W, BH, 0, 0, W, BH);
      mx.globalAlpha = 1;
      const mb = this.mb, mbx = this.mbx;
      let src = this.mix;
      for (let i = 0; i < mb.length; i++) {
        mbx[i].clearRect(0, 0, W, mb[i].height);
        mbx[i].drawImage(src, 0, 0, W, src.height, 0, 0, W, mb[i].height);
        src = mb[i];
      }
      const sx = this.rsx;
      sx.globalCompositeOperation = 'source-over';
      sx.globalAlpha = 1;
      sx.fillStyle = '#0c0818';
      sx.fillRect(0, 0, W, BH);
      sx.globalAlpha = 0.16 * wet.mirror;
      sx.drawImage(this.upper, 0, 0);
      sx.globalCompositeOperation = 'lighter';
      this.rsx.imageSmoothingEnabled = true;
      sx.globalAlpha = 1;
      sx.drawImage(mb[2], 0, 0, W, mb[2].height, 0, 0, W, BH);
      sx.globalAlpha = 0.45;
      sx.drawImage(mb[0], 0, 0, W, mb[0].height, 0, 0, W, BH);
      this.rsx.imageSmoothingEnabled = false;
      sx.globalAlpha = 1;
      sx.globalCompositeOperation = 'source-over';

      // mirror it row by row with ripple distortion
      const rx = this.rx;
      rx.globalCompositeOperation = 'source-over';
      rx.fillStyle = '#0c0818';
      rx.fillRect(0, 0, W, RH);
      const K = this.K;
      const rstep = this.q >= 2 ? 1 : 2;
      for (let j = 0; j < RH; j += rstep) {
        const q = j / RH;
        const jit = (ND.noise(j * 0.7, t * 2.2, 5) - 0.5) * 3 * q;
        const sy = CURB - 1 - Math.floor((j + 1) * K + jit) - TOPB;
        if (sy < 0) break;
        const amp = (0.6 + q * 3.2) * wet.ripple;
        const dx = Math.round((ND.noise(j * 0.33, t * 0.9, 9) - 0.5) * 2 * amp + (ND.noise(j * 1.3, t * 3.1, 11) - 0.5) * amp * 0.8);
        rx.drawImage(this.rsrc, 0, sy, W, 1, dx, j, W, rstep);
      }
      // Fresnel: reflections fade as we look more steeply down at the road
      rx.drawImage(this.fresnel, 0, 0);

      c.fillStyle = '#0c0818';
      c.fillRect(0, CURB + 4, W, RH - 4);
      c.drawImage(this.refl, 0, 4, W, RH - 4, 0, CURB + 4, W, RH - 4);
      g.globalAlpha = 0.35;
      g.drawImage(this.refl, 0, 4, W, RH - 4, 0, CURB + 4, W, RH - 4);
      g.globalAlpha = 1;
      // asphalt with ground-plane perspective (puddles let reflections through)
      const ms = this.q >= 2 ? 1 : 2;
      for (let j = 4; j < RH; j += ms) {
        const y = CURB + j;
        mode7Row(c, this.road.canvas, this.road.T, j, y, R.D, ND.fAt(y), Math.min(ms, RH - j));
      }
    }

    // Draws a sprite canvas mirrored below groundY, row by row with ripples.
    reflect(img, x, groundY, h, alpha, t, rows) {
      const c = this.c;
      const n = Math.min(rows || h, H - groundY - 1);
      const st = this.q >= 2 ? 1 : 2;
      for (let k = 0; k < n; k += st) {
        const sy = h - 1 - k;
        if (sy < 0) break;
        const y = groundY + 1 + k;
        const amp = (0.5 + ((y - CURB) / RH) * 2.6) * this.wet.ripple;
        const dx = Math.round((ND.noise(y * 0.33, t * 0.9, 9) - 0.5) * 2 * amp + (ND.noise(y * 1.3, t * 3.1, 11) - 0.5) * amp * 0.8);
        c.globalAlpha = alpha * (1 - k / (n * 1.15));
        c.drawImage(img, 0, sy, img.width, 1, x + dx, y, img.width, st);
      }
      c.globalAlpha = 1;
    }

    drawTraffic(R) {
      const w = this.world;
      const tx = this.trafX;
      for (const car of w.traffic) {
        const x = Math.round(CX + (R.D - car.P) * car.f);
        const S = car.sp;
        if (x > W + 10 || x + S.w < -10) continue;
        tx.clearRect(0, 0, S.w, S.h);
        tx.drawImage(S.body.c, 0, 0);
        const fr = Math.floor(car.wa) % 4;
        for (const [wx, wy] of S.wheels) tx.drawImage(S.wheelFrames[fr], wx - 10, wy - 10);
        const y = Y.FAR - S.ground;
        this.reflect(this.trafC, x, Y.FAR, S.h, 0.3, R.t, 30);
        this.c.drawImage(this.trafC, x, y);
        this.occlude(this.trafC, x, y);
        if (S.body.g) this.g.drawImage(S.body.g, x, y);
        if (S.bar) {
          const on = Math.floor(R.t * 6) % 2;
          const col = on ? '#ff2040' : '#3060ff';
          this.c.fillStyle = col;
          this.c.fillRect(x + S.bar.x + (on ? 0 : 10), y + S.bar.y, 10, 3);
          this.g.fillStyle = col;
          this.g.fillRect(x + S.bar.x + (on ? -4 : 8), y + S.bar.y - 2, 14, 7);
        }
        // tail light streak on the wet road
        this.g.fillStyle = 'rgba(255,30,50,0.35)';
        this.g.fillRect(x + S.w - 6, Y.FAR + 2, 5, 22);
      }
    }

    drawHero(R) {
      const w = this.world, h = w.hero;
      const cx = this.carX, HW = ND.HERO.W, HH = ND.HERO.H;
      cx.clearRect(0, 0, HW, HH);
      cx.drawImage(h.body.c, 0, h.bob);
      const WF = h.wheels;
      const fr = Math.floor(((h.angle % WF.period) + WF.period) % WF.period / WF.period * WF.frames.length) % WF.frames.length;
      for (const [wx, wy] of ND.HERO.WHEELS) cx.drawImage(WF.frames[fr], wx - WF.R, wy - WF.R);
      const x = h.x + (h.dx || 0), y = h.y;
      this.reflect(this.carC, x, Y.CAR, HH, 0.34, R.t, 80);
      this.c.drawImage(this.carC, x, y);
      this.occlude(this.carC, x, y);
      this.g.drawImage(h.body.g, x, y + h.bob);
      // light streaks on the road below tail and marker lights
      const g = this.g;
      g.fillStyle = 'rgba(255,30,50,0.45)';
      g.fillRect(x + 293, Y.CAR + 3, 6, 40);
      g.fillStyle = 'rgba(255,150,30,0.35)';
      g.fillRect(x + 1, Y.CAR + 6, 6, 26);
    }

    drawForeground(R) {
      const w = this.world, fg = w.fg, c = this.c;
      for (const it of fg.items) {
        const x = fg.x(it, R.D);
        if (x > W || x + it.w < 0) continue;
        const img = it.img;
        const y = H - img.height * 2 + 10 + it.dy;
        c.drawImage(img, x, y, img.width * 2, img.height * 2);
        this.occlude(img, x, y, img.width * 2, img.height * 2);
      }
    }

    // ---------------------------------------------------------------------------
    post(R) {
      const c = this.c;
      // bloom: downsample chain, then accumulate back up
      const bl = this.bl, bx = this.blx;
      bx[0].globalCompositeOperation = 'source-over';
      bx[0].clearRect(0, 0, bl[0].width, bl[0].height);
      bx[0].drawImage(this.glowC, 0, 0, bl[0].width, bl[0].height);
      const levels = this.q >= 1 ? bl.length : 3;
      for (let i = 1; i < levels; i++) {
        bx[i].globalCompositeOperation = 'source-over';
        bx[i].clearRect(0, 0, bl[i].width, bl[i].height);
        bx[i].drawImage(bl[i - 1], 0, 0, bl[i].width, bl[i].height);
      }
      for (let i = levels - 1; i > 0; i--) {
        bx[i - 1].globalCompositeOperation = 'lighter';
        bx[i - 1].drawImage(bl[i], 0, 0, bl[i - 1].width, bl[i - 1].height);
      }
      c.imageSmoothingEnabled = true;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = this.bloom;
      c.drawImage(bl[0], 0, 0, W, H);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.imageSmoothingEnabled = false;
      // vignette: only its non-empty border strips
      const v = this.vignette, vt = this.vigTop, vs = this.vigSide;
      c.drawImage(v, 0, 0, W, vt, 0, 0, W, vt);
      c.drawImage(v, 0, H - vt, W, vt, 0, H - vt, W, vt);
      c.drawImage(v, 0, vt, vs, H - 2 * vt, 0, vt, vs, H - 2 * vt);
      c.drawImage(v, W - vs, vt, vs, H - 2 * vt, W - vs, vt, vs, H - 2 * vt);
    }
  }

  ND.Renderer = Renderer;
})();
