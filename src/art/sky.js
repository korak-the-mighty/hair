/* Nightdrive — night sky: dithered gradient, stars, moon, drifting clouds. */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, rgb } = ND;

  const SKY_H = 250;

  function makeSkyGradient(r) {
    const pb = new ND.PB(W, SKY_H);
    const stops = [
      [0.0, rgb('#060518')],
      [0.25, rgb('#0b0a2a')],
      [0.5, rgb('#151039')],
      [0.7, rgb('#231546')],
      [0.84, rgb('#3a1a5a')],
      [0.95, rgb('#57216a')],
      [1.0, rgb('#6a2a70')],
    ];
    for (let y = 0; y < SKY_H; y++) {
      for (let x = 0; x < W; x++) {
        // a little large-scale variation so the gradient breathes
        const n = (ND.fbm(x / 140, y / 60, 3, 7) - 0.5) * 0.08;
        const t = ND.clamp(y / 232 + n, 0, 1);
        pb.dset(x, y, ND.grad(stops, t), 255, 6);
      }
    }
    // static dim stars
    const stars = [];
    for (let i = 0; i < 170; i++) {
      const x = r.int(0, W - 1), y = Math.floor(Math.pow(r(), 1.6) * 150);
      const b = r.range(0.25, 0.8) * (1 - y / 190);
      const tint = r.pick([rgb('#ffffff'), rgb('#cfd8ff'), rgb('#ffe8d0'), rgb('#e0d0ff')]);
      pb.blend(x, y, tint, b);
      if (r() < 0.12) stars.push({ x, y, tint, b: b + 0.3, p: r.range(1.5, 5), ph: r() * 6.28 });
    }
    return { canvas: pb.canvas(), stars };
  }

  function makeMoon() {
    const R = 13;
    const S = R * 2 + 3;
    const pb = new ND.PB(S, S), gl = new ND.PB(S, S);
    const cx = S / 2 - 0.5, cy = S / 2 - 0.5;
    const base = rgb('#fbe9a6'), limb = rgb('#e9c874'), mare = rgb('#d7b565'), mare2 = rgb('#c7a45a');
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / R;
        if (d > 1.02) continue;
        let c = ND.mix(base, limb, Math.pow(d, 3));
        const n = ND.fbm((x + 3) / 6, (y + 9) / 6, 3, 21);
        if (n > 0.56) c = ND.mix(c, mare, 0.85);
        if (n > 0.66) c = mare2;
        if (d > 0.93) c = ND.mix(c, limb, 0.6);
        pb.dset(x, y, c, 255, 8);
        gl.dset(x, y, ND.scale(c, 0.55), 255, 8);
      }
    return ND.sprite(pb, gl);
  }

  function makeHalo(radius, color, strength) {
    const S = radius * 2;
    const pb = new ND.PB(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - radius + 0.5, y - radius + 0.5) / radius;
        if (d >= 1) continue;
        const a = Math.pow(1 - d, 2.2) * strength;
        // dithered alpha steps for a pixel-art halo
        const q = Math.floor(a * 10 + ND.bayer(x, y)) / 10;
        if (q > 0) pb.blend(x, y, color, q);
      }
    return pb.canvas();
  }

  function makeCloud(r, w, h, seed, lit) {
    const pb = new ND.PB(w, h);
    const body = rgb('#1b1540'), body2 = rgb('#272057'), rim = lit ? rgb('#8a7596') : rgb('#453a78');
    const dens = (x, y) => {
      const ex = (x - w / 2) / (w / 2), ey = (y - h * 0.6) / (h * 0.55);
      const env = 1 - (ex * ex + ey * ey * (ey > 0 ? 2.2 : 1));
      return ND.fbm(x / 22, y / 8, 4, seed) * 0.9 + env * 0.55 - 0.62;
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = dens(x, y);
        if (d <= 0) continue;
        if (d < 0.06 && ND.bayer(x, y) > d / 0.06) continue; // dithered feathered edge
        const above = dens(x, y - 2);
        let c = ND.mix(body, body2, ND.clamp(d * 3, 0, 1));
        if (above < d - 0.04) c = ND.mix(c, rim, ND.clamp((d - above) * 5, 0, 0.9));
        pb.dset(x, y, c, 235, 6);
      }
    return pb.canvas();
  }

  class Sky {
    constructor(seed) {
      const r = ND.rng(seed);
      const g = makeSkyGradient(r);
      this.canvas = g.canvas;
      this.stars = g.stars;
      this.moon = makeMoon();
      this.moonX = 548;
      this.moonY = 44;
      this.halo = makeHalo(70, rgb('#b89acb'), 0.22);
      this.haloInner = makeHalo(30, rgb('#ffe9b0'), 0.35);
      this.clouds = [];
      const specs = [
        { w: 260, h: 34, x: 420, y: 18, v: 0.035, lit: true },
        { w: 200, h: 26, x: 90, y: 34, v: 0.03 },
        { w: 320, h: 40, x: 240, y: 70, v: 0.05 },
        { w: 170, h: 22, x: 560, y: 86, v: 0.045, lit: true },
        { w: 240, h: 30, x: -40, y: 104, v: 0.06 },
        { w: 280, h: 34, x: 380, y: 128, v: 0.07 },
      ];
      specs.forEach((s, i) => {
        this.clouds.push({ ...s, img: makeCloud(r, s.w, s.h, 100 + i * 13, s.lit) });
      });
    }

    draw(R) {
      const { c, g } = R;
      c.drawImage(this.canvas, 0, 0);
      c.fillStyle = '#6a2a70';
      c.fillRect(0, SKY_H, W, ND.H - SKY_H);

      // twinkling stars (hidden as the clouds close in)
      const clear = R.weather ? ND.clamp(1 - R.weather.v.cloud * 0.95, 0, 1) : 1;
      for (const s of this.stars) {
        const tw = 0.5 + 0.5 * Math.sin(R.t * s.p + s.ph);
        const a = ND.clamp(s.b * (0.35 + 0.65 * tw), 0, 1) * clear;
        if (a < 0.03) continue;
        c.fillStyle = ND.css(s.tint, a);
        c.fillRect(s.x, s.y, 1, 1);
        if (tw > 0.93 && s.b > 0.7) {
          c.fillStyle = ND.css(s.tint, a * 0.5);
          c.fillRect(s.x - 1, s.y, 3, 1);
          c.fillRect(s.x, s.y - 1, 1, 3);
        }
      }

      // moon and halo
      const mx = this.moonX, my = this.moonY;
      const moonA = R.weather ? ND.clamp(1 - R.weather.v.cloud * 0.8, 0.15, 1) : 1;
      c.globalAlpha = moonA;
      c.drawImage(this.halo, mx - 70, my - 70);
      c.drawImage(this.haloInner, mx - 30, my - 30);
      c.globalAlpha = Math.min(1, moonA * 1.3);
      c.drawImage(this.moon.c, mx - this.moon.w / 2, my - this.moon.h / 2);
      c.globalAlpha = 1;
      g.globalAlpha = moonA;
      g.drawImage(this.moon.g, mx - this.moon.w / 2, my - this.moon.h / 2);
      g.globalAlpha = 1;

      // clouds drift slowly to the right (we travel left)
      for (const cl of this.clouds) {
        const span = W + cl.w;
        let x = cl.x + (R.cloudShift != null ? R.cloudShift : R.tick) * cl.v;
        x = ((((x + cl.w) % span) + span) % span) - cl.w;
        const xi = Math.round(x);
        c.drawImage(cl.img, xi, cl.y);
        // clouds occlude the moon glow
        g.globalCompositeOperation = 'destination-out';
        g.globalAlpha = 0.6;
        g.drawImage(cl.img, xi, cl.y);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'lighter';
      }
    }
  }

  ND.Sky = Sky;
  ND.makeHalo = makeHalo;
})();
