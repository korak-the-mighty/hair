/* Neon Drive — cinematic effects: volumetric lamp cones, headlight beams,
 * film grain, umbrellas, and night aircraft (planes + a searchlight helicopter). */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, H, rgb } = ND;

  const dq = (a, x, y, levels = 12) => Math.floor(a * levels + ND.bayer(x, y)) / levels;

  // Downward light cone for street lamps (additive).
  function genCone(w, h, color) {
    const pb = new ND.PB(w, h);
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1);
      const half = 2 + (w / 2 - 2) * Math.pow(t, 0.85);
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - w / 2 + 0.5) / half;
        if (dx >= 1) continue;
        const a = dq((1 - dx * dx) * Math.pow(1 - t, 1.25) * (0.35 + 0.65 * Math.exp(-t * 3)), x, y);
        if (a > 0) pb.set(x, y, ND.pack(color[0] * a, color[1] * a, color[2] * a));
      }
    }
    return pb.canvas();
  }

  // Horizontal beam pointing left: apex on the right edge, centred vertically.
  function genBeam(len, spread, color, falloff = 1.1) {
    const h = spread * 2 + 1;
    const pb = new ND.PB(len, h);
    for (let x = 0; x < len; x++) {
      const t = (len - 1 - x) / (len - 1);
      const half = 1 + (spread - 1) * Math.pow(t, 0.8);
      for (let y = 0; y < h; y++) {
        const dy = Math.abs(y - spread) / half;
        if (dy >= 1) continue;
        const a = dq((1 - dy * dy) * Math.pow(1 - t, falloff), x, y);
        if (a > 0) pb.set(x, y, ND.pack(color[0] * a, color[1] * a, color[2] * a));
      }
    }
    return pb.canvas();
  }

  // Elongated pool of light on the road ahead of a car.
  function genGroundBeam(len, h, color) {
    const pb = new ND.PB(len, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < len; x++) {
        const u = x / (len - 1); // 0 far ahead (left), 1 at the car
        const v = (y - h / 2 + 0.5) / (h / 2);
        const width = 0.35 + 0.65 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.5);
        const d = Math.abs(v) / width;
        if (d >= 1) continue;
        const a = dq((1 - d * d) * Math.pow(u, 0.9) * (1 - Math.pow(u, 12)), x, y);
        if (a > 0) pb.set(x, y, ND.pack(color[0] * a, color[1] * a, color[2] * a));
      }
    return pb.canvas();
  }

  // Film grain frames (sparse light/dark specks, alpha baked in).
  function genGrain(n, seed) {
    const r = ND.rng(seed);
    const frames = [];
    for (let k = 0; k < n; k++) {
      const pb = new ND.PB(W, H);
      for (let i = 0; i < W * H; i++) {
        const v = r();
        if (v < 0.2) pb.d[i] = ND.pack(0, 0, 8, 8 + r() * 12);
        else if (v > 0.88) pb.d[i] = ND.pack(255, 240, 255, 3 + r() * 6);
      }
      frames.push(pb.canvas());
    }
    return frames;
  }

  // Umbrellas: dome + ribs + scalloped hem + J handle. 24x21, dome centre x=12.
  function genUmbrellas() {
    const cols = [rgb('#e02838'), rgb('#18121e'), rgb('#ff6ab0'), rgb('#2a3a80'), rgb('#ffc830'), rgb('#20c0c8'), rgb('#f0f0f8')];
    return cols.map((c, ci) => {
      const pb = new ND.PB(24, 21);
      const half = [3, 6, 8, 9, 10, 11, 11];
      for (let y = 0; y < 7; y++)
        for (let x = 12 - half[y]; x <= 11 + half[y]; x++) {
          const u = (x - 12 + half[y]) / (2 * half[y]);
          let k = 0.7 + 0.5 * (1 - u) - y * 0.03;
          if (y === 0) k += 0.2;
          if ((x - 12) % 5 === 0 && y > 1) k *= 0.8; // ribs
          const cc = ci === 6 ? ND.mix(c, [180, 170, 230], 0.3) : c;
          pb.set(x, y, ND.pack(cc[0] * k, cc[1] * k, cc[2] * k, ci === 6 ? 170 : 255));
        }
      for (let x = 1; x < 23; x++) if (x % 5 !== 1) pb.set(x, 7, ND.pack(c[0] * 0.6, c[1] * 0.6, c[2] * 0.6));
      for (let y = 7; y < 19; y++) pb.set(12, y, ND.pack(40, 30, 50));
      pb.set(11, 19, ND.pack(40, 30, 50)); pb.set(10, 18, ND.pack(40, 30, 50));
      pb.set(12, 0, ND.pack(60, 50, 70));
      return pb.canvas();
    });
  }

  // Helicopter silhouette facing left (rotor drawn live).
  function genHeli() {
    const rows = [
      '........................',
      '........................',
      '....####...............#',
      '..#######.............##',
      '.##..#####..........###.',
      '##....#################.',
      '##########.###..........',
      '.########...............',
      '..######................',
      '..#....#................',
      '##########..............',
    ];
    const pb = new ND.PB(24, rows.length);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '#') return;
      const rim = y < 5 && (rows[y - 1] || '')[x] !== '#';
      pb.set(x, y, ND.pack(...(rim ? [58, 42, 92] : [14, 10, 24])));
    }));
    // cockpit glass glint
    pb.set(3, 4, ND.pack(90, 150, 200)); pb.set(4, 4, ND.pack(70, 110, 170));
    return pb.canvas();
  }

  // Night aircraft: blinking planes high up, and a helicopter sweeping a
  // searchlight over the skyline.
  class Aircraft {
    constructor(seed) {
      this.r = ND.rng(seed);
      this.items = [];
      this.nextPlane = 60 * this.r.range(15, 45);
      this.nextHeli = 60 * this.r.range(70, 140);
      this.heli = genHeli();
      this.searchBeam = (() => {
        // vertical cone, apex at top-centre
        const w = 40, h = 170;
        const pb = new ND.PB(w, h);
        for (let y = 0; y < h; y++) {
          const t = y / (h - 1), half = 1 + (w / 2 - 1) * t;
          for (let x = 0; x < w; x++) {
            const dx = Math.abs(x - w / 2 + 0.5) / half;
            if (dx >= 1) continue;
            const a = dq((1 - dx * dx) * Math.pow(1 - t, 0.9), x, y);
            if (a > 0) pb.set(x, y, ND.pack(230 * a, 236 * a, 255 * a));
          }
        }
        return pb.canvas();
      })();
    }
    update(tick, weather) {
      const r = this.r;
      if (tick >= this.nextPlane) {
        const dir = r() < 0.5 ? -1 : 1;
        this.items.push({ kind: 'plane', x: dir < 0 ? W + 10 : -10, y: r.range(14, 70), vx: dir * r.range(0.18, 0.34) + 0.06, ph: r() * 100 });
        this.nextPlane = tick + 60 * r.range(40, 120);
      }
      if (tick >= this.nextHeli && weather.v.storm < 0.4) {
        const dir = r() < 0.5 ? -1 : 1;
        this.items.push({ kind: 'heli', x: dir < 0 ? W + 30 : -30, y: r.range(14, 44), vx: dir * r.range(0.4, 0.6) + 0.12, ph: r() * 100, dir });
        this.nextHeli = tick + 60 * r.range(150, 320);
      }
      for (const it of this.items) it.x += it.vx;
      this.items = this.items.filter((it) => it.x > -60 && it.x < W + 60);
    }
    draw(R, kind, weather) {
      const { c, g, tick } = R;
      for (const it of this.items) {
        if (it.kind !== kind) continue;
        const x = Math.round(it.x), y = Math.round(it.y);
        const t = tick + it.ph * 60;
        if (kind === 'plane') {
          c.fillStyle = '#1a1430';
          c.fillRect(x - 2, y, 5, 1);
          const strobe = t % 80 < 3, beacon = t % 64 < 8;
          if (strobe) { c.fillStyle = '#ffffff'; c.fillRect(x - 3, y, 1, 1); c.fillRect(x + 3, y, 1, 1); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x - 4, y - 1, 3, 3); g.fillRect(x + 2, y - 1, 3, 3); }
          if (beacon) { c.fillStyle = '#ff3040'; c.fillRect(x, y - 1, 1, 1); g.fillStyle = 'rgba(255,40,60,0.9)'; g.fillRect(x - 1, y - 2, 3, 3); }
          c.fillStyle = 'rgba(255,240,200,0.7)'; c.fillRect(x + (it.vx < 0 ? -2 : 2), y, 1, 1);
        } else {
          // searchlight first (behind the body)
          const ang = Math.sin(t * 0.006) * 0.55 + Math.sin(t * 0.0021) * 0.25;
          const beamA = 0.22 + weather.v.fog * 0.45 + weather.v.rain * 0.2;
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = Math.min(0.75, beamA);
          c.translate(x + 7, y + 9);
          c.rotate(ang);
          c.drawImage(this.searchBeam, -20, 0);
          c.restore();
          g.save();
          g.globalAlpha = 0.25;
          g.translate(x + 7, y + 9);
          g.rotate(ang);
          g.drawImage(this.searchBeam, -20, 0);
          g.restore();
          // body (flip when flying right)
          c.save();
          if (it.dir > 0) { c.translate(x + 24, y); c.scale(-1, 1); c.drawImage(this.heli, 0, 0); }
          else c.drawImage(this.heli, x, y);
          c.restore();
          // rotor blur
          c.fillStyle = 'rgba(40,30,70,0.8)';
          const span = t % 4 < 2 ? 26 : 18;
          c.fillRect(x + 7 - span / 2, y + 1, span, 1);
          if (t % 50 < 6) { c.fillStyle = '#ff3040'; c.fillRect(x + 12, y + 2, 1, 1); g.fillStyle = 'rgba(255,40,60,1)'; g.fillRect(x + 11, y + 1, 3, 3); }
          g.fillStyle = 'rgba(255,255,255,0.8)';
          g.fillRect(x + 6, y + 8, 3, 2);
        }
      }
    }
  }

  ND.genCone = genCone;
  ND.genBeam = genBeam;
  ND.genGroundBeam = genGroundBeam;
  ND.genGrain = genGrain;
  ND.genUmbrellas = genUmbrellas;
  ND.Aircraft = Aircraft;
})();
