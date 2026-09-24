/* Neon Drive — world simulation: parallax sequences, pedestrians, traffic, hero car. */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, H, CX, Y, SPEED } = ND;

  // ---------------------------------------------------------------------------
  // Cooperative job queue: heavy sprite generators are JS generators that yield
  // often, so building art is produced in small slices between frames.
  // ---------------------------------------------------------------------------
  class JobQueue {
    constructor() { this.jobs = []; }
    add(gen, done) { const j = { gen, done, finished: false }; this.jobs.push(j); return j; }
    finish(j) {
      if (j.finished) return;
      let r;
      do { r = j.gen.next(); } while (!r.done);
      j.finished = true;
      this.jobs.splice(this.jobs.indexOf(j), 1);
      j.done(r.value);
    }
    run(budgetMs) {
      const t0 = performance.now();
      while (this.jobs.length && performance.now() - t0 < budgetMs) {
        const j = this.jobs[0];
        const r = j.gen.next();
        if (r.done) {
          j.finished = true;
          this.jobs.shift();
          j.done(r.value);
        }
      }
    }
  }
  ND.JobQueue = JobQueue;

  // ---------------------------------------------------------------------------
  // Sequence layer: items laid out right-to-left in a layer coordinate `p`
  // (p = distance of the item's left edge from the layer origin). Screen x of
  // the left edge is round(D*f) + W - p, so everything drifts right as we
  // drive left and new items enter from the left edge.
  // ---------------------------------------------------------------------------
  class Seq {
    constructor(f, make, opts = {}) {
      this.f = f;
      this.make = make;
      this.items = [];
      this.cursor = opts.start != null ? opts.start : -(opts.margin || 80);
      this.margin = opts.margin || 80;
      this.look = opts.lookahead || 0;
      this.script = opts.script ? opts.script.slice() : [];
    }
    shift(D) { return Math.round(D * this.f); }
    x(it, D) { return this.shift(D) + W - it.p; }
    update(D) {
      const s = this.shift(D);
      while (s + W - this.cursor > -this.margin - this.look) {
        const it = this.script.length ? this.script.shift()(this) : this.make(this);
        it.p = this.cursor + it.w;
        this.cursor = it.p + (it.gap || 0);
        this.items.push(it);
        if (it.onSpawn) it.onSpawn(it);
      }
      while (this.items.length && this.x(this.items[0], D) > W + this.margin) {
        const it = this.items.shift();
        if (it.onRemove) it.onRemove(it);
      }
    }
  }
  ND.Seq = Seq;

  // ---------------------------------------------------------------------------
  class World {
    constructor(seed = 1985, opts = {}) {
      this.seed = seed;
      this.r = ND.rng(seed);
      this.tick = 0;
      this.D = 0;
      this.jobs = new JobQueue();
      this.buildCache = new Map();

      this.weather = new ND.Weather(seed + 99, opts.weather);
      this.rain = new ND.Rain(seed + 5);
      this.air = new ND.Aircraft(seed + 8);
      this.sky = new ND.Sky(seed + 1);
      this.makePools();
      this.makeSkyline();
      this.makeBuildings();
      this.makeCurb();
      this.makeForeground();
      this.walkers = [];
      this.traffic = [];
      this.hero = {
        body: ND.genHeroCar(),
        wheels: ND.genWheelFrames(),
        x: 206,
        y: Y.CAR - ND.HERO.H + 1,
        angle: 0,
        bob: 0,
      };
      this.nextWalker = 0;
      this.nextCar = 0;
      this.initialPopulation();
      this.update(0, true);
      // finish everything needed for the first frame synchronously
      while (this.jobs.jobs.length) this.jobs.finish(this.jobs.jobs[0]);
    }

    makePools() {
      const r = ND.rng(this.seed + 7);
      this.people = [];
      for (let i = 0; i < 26; i++) this.people.push(ND.genPerson(r.int(1, 1e9), i % 3 === 0 ? 'sil' : 'lit'));
      this.idlers = [];
      for (let i = 0; i < 18; i++) this.idlers.push(ND.genPerson(r.int(1, 1e9), i % 2 ? 'sil' : 'lit'));
      this.heroWalker = ND.genHeroWalker(4242);
      this.palms = [];
      for (let i = 0; i < 7; i++) this.palms.push(ND.genPalm(r.int(1, 1e9), { h: i < 3 ? r.int(200, 240) : r.int(150, 210) }));
      this.lamps = [ND.genLamp(11, 'globe'), ND.genLamp(12, 'cobra'), ND.genLamp(13, 'globe')];
      this.planters = [];
      for (let i = 0; i < 5; i++) this.planters.push(ND.genPlanter(r.int(1, 1e9)));
      this.bushes = [];
      for (let i = 0; i < 8; i++) this.bushes.push(ND.genBush(r.int(1, 1e9)));
      this.trafficPool = [];
      for (let i = 0; i < 7; i++) this.trafficPool.push(ND.genTraffic(r.int(1, 1e9)));
      this.trafficPool.push(ND.genTraffic(77, { kind: 'coupe' }));
      this.trafficPool[0] = ND.genTraffic(99, { kind: 'coupe', color: [110, 16, 34] });
      this.lampHalo = ND.genHaloGlow(30, [255, 170, 80], 0.55);
      this.lampPool = ND.genPool(90, 18, [255, 170, 90], 0.55);
      this.spill = {};
    }

    spillFor(c) {
      const k = c.map((v) => v | 0).join(',');
      if (!this.spill[k]) this.spill[k] = ND.genSpill(c);
      return this.spill[k];
    }

    // --- skyline ---------------------------------------------------------------
    makeSkyline() {
      const fs = [0.0625, 0.125, 0.25];
      this.skyLayers = fs.map((f, d) => {
        const r = ND.rng(this.seed * 31 + d);
        let bridgeCooldown = 3;
        const T = (w, top, o = {}) => () => ND.genTower(r.int(1, 1e9), d, { w, top, ...o });
        const scripts = {
          1: [T(38, 112, { neon: 'cyan', gap: 6 }), T(44, 66, { neon: 'pink', mode: 'edges', gap: 10 }), T(34, 128, { gap: 22 }),
            T(40, 34, { style: 'flat', lit: 0.6, gap: 8 }), T(30, 96, { gap: 14 })],
          2: [T(52, 150, { gap: 4 }), T(46, 128, { neon: 'magenta', mode: 'edges', gap: 30 }), T(60, 164, { gap: 12 })],
        };
        return new Seq(f, () => {
          if (d === 2 && --bridgeCooldown <= 0 && r() < 0.18) {
            bridgeCooldown = 10;
            return ND.genBridge(r.int(1, 1e9));
          }
          return ND.genTower(r.int(1, 1e9), d);
        }, { margin: 60, start: 0, script: scripts[d] || [] });
      });
    }

    // --- street buildings ------------------------------------------------------
    makeBuildings() {
      const r = ND.rng(this.seed * 17 + 3);
      this.bRng = r;
      this.sinceHero = 0;
      const heroHotel = () => ({
        kind: 'hotel', key: 'colony', seed: 1985, w: 252, floors: 4, floorH: 38, groundH: 66, parapetH: 12, crownH: 0,
        pal: ND.PALETTES.lavender, neonA: 'pink', neonB: 'pink', finX: 108, finW: 18,
        blade: 'COLONY', bladeY: 34, bladeLetters: 'cyan', bladeBorder: 'blue', box: 'HOTEL', boxNeon: 'pink',
        canopyNeon: 'pink', store: 'restaurant', neonPalm: 22, litP: 0.35, roofNeon: false,
      });
      const heroBar = () => ({
        kind: 'bar', key: 'bar', seed: 77, w: 156, floors: 2, pal: ND.PALETTES.lilac, neonA: 'cyan', neonB: 'red', sign: 'BAR', store: 'bar', signDX: -6,
      });
      this.heroSpecs = { hotel: heroHotel, bar: heroBar };
      const self = this;
      const spawnSpec = (spec, gap) => (seq) => self.buildingItem(spec, gap);
      this.buildings = new Seq(0.5, () => this.randomBuilding(), {
        margin: 40,
        lookahead: 420,
        start: -30,
        script: [
          () => this.gapItem(240, 0),
          spawnSpec(heroBar(), 2),
          spawnSpec(heroHotel(), 0),
        ],
      });
    }

    pickName(list) {
      const r = this.bRng;
      this.recent = this.recent || [];
      let n;
      for (let k = 0; k < 12; k++) {
        n = r.pick(list);
        if (!this.recent.includes(n)) break;
      }
      this.recent.push(n);
      if (this.recent.length > 8) this.recent.shift();
      return n;
    }

    randomBuilding() {
      const r = this.bRng;
      this.sinceHero++;
      if (this.sinceHero > 18 && r() < 0.3) {
        this.sinceHero = 0;
        return this.buildingItem(this.heroSpecs.hotel(), r.int(0, 3));
      }
      const t = r();
      const gap = r() < 0.75 ? r.int(0, 3) : r.int(8, 22);
      if (t < 0.14) return this.gapItem(r.int(60, 220), 0);
      const seed = r.int(1, 1e9);
      let kind = t < 0.52 ? 'hotel' : t < 0.68 ? 'bar' : t < 0.92 ? 'shop' : 'motel';
      if (kind === this.lastKind && kind !== 'hotel') kind = 'hotel';
      this.sinceMotel = (this.sinceMotel || 0) + 1;
      if (kind === 'motel' && this.sinceMotel < 8) kind = 'shop';
      if (kind === 'motel') this.sinceMotel = 0;
      this.lastKind = kind;
      if (kind === 'hotel') return this.buildingItem({ kind, seed, w: r.int(170, 250), name: r() < 0.8 ? this.pickName(ND.NAMES.hotel) : null }, gap);
      if (kind === 'bar') return this.buildingItem({ kind, seed, w: r.int(120, 170), sign: this.pickName(ND.NAMES.bar) }, gap);
      if (kind === 'shop') return this.buildingItem({ kind, seed, w: r.int(110, 170), sign: this.pickName(ND.NAMES.shop) }, gap);
      return this.buildingItem({ kind, seed, w: r.int(170, 220), sign: r() < 0.7 ? 'MOTEL' : this.pickName(['INN', 'LODGE', 'MOTOR']) }, gap);
    }

    gapItem(w, gap) {
      return { w, gap, isGap: true, data: null, crowd: [], planters: [] };
    }

    buildingItem(spec, gap) {
      const it = { w: spec.w, gap, spec, data: null, crowd: [], planters: [] };
      const key = spec.key;
      const apply = (data) => {
        it.data = data;
        if (key) this.buildCache.set(key, data);
        this.populateBuilding(it);
      };
      if (key && this.buildCache.has(key)) {
        it.data = this.buildCache.get(key);
        it.onSpawn = () => this.populateBuilding(it);
      } else {
        it.job = this.jobs.add(ND.BUILDING_GEN[spec.kind](spec), apply);
      }
      return it;
    }

    populateBuilding(it) {
      const r = ND.rng((it.spec.seed | 0) + this.tick);
      it.crowd = [];
      it.planters = [];
      const d = it.data;
      const busy = d.kind === 'bar' || it.spec.store === 'restaurant' || it.spec.store === 'bar';
      for (const x of d.crowd) {
        if (r() > (busy ? 0.6 : 0.3)) continue;
        const p = r.pick(this.idlers);
        it.crowd.push({ x, p, face: r() < 0.5 ? 'idleR' : 'idleL', ph: r.int(0, 3), rate: r.int(28, 50), y: r.int(0, 3) });
      }
      if (d.kind === 'hotel' && r() < 0.8) {
        const n = r.int(1, 2);
        for (let i = 0; i < n; i++) it.planters.push({ x: r.int(0, it.w - 30), p: r.pick(this.planters) });
      }
      if (it.spec.key === 'colony') {
        it.planters = [{ x: 60, p: this.planters[0] }, { x: 150, p: this.planters[1] }];
      }
    }

    // --- curb: palms & lamps ------------------------------------------------------
    makeCurb() {
      const r = ND.rng(this.seed * 13 + 5);
      const palm = (i, gap) => () => ({ w: 16, gap, type: 'palm', palm: this.palms[i % this.palms.length], ph: r() * 8 });
      const lamp = (i, gap) => () => ({ w: 12, gap, type: 'lamp', lamp: this.lamps[i % this.lamps.length] });
      this.curb = new Seq(0.75, () => {
        const t = r();
        if (t < 0.55) return { w: 16, gap: r.int(40, 150), type: 'palm', palm: r.pick(this.palms), ph: r() * 8 };
        return { w: 12, gap: r.int(40, 120), type: 'lamp', lamp: r.pick(this.lamps) };
      }, {
        margin: 150,
        start: -60,
        script: [palm(3, 70), lamp(2, 88), lamp(0, 106), palm(4, 78), lamp(1, 69), palm(0, 159), palm(1, 60)],
      });
    }

    makeForeground() {
      const r = ND.rng(this.seed * 19 + 11);
      this.fg = new Seq(1.5, () => {
        const b = r.pick(this.bushes);
        return { w: b.width * 2, gap: r.int(-40, 160), img: b, dy: r.int(0, 18) };
      }, { margin: 240, start: -200 });
    }

    // --- pedestrians ----------------------------------------------------------------
    spawnWalker(atX, opts = {}) {
      const r = this.r;
      const lane = opts.lane != null ? opts.lane : r() < 0.5 ? 0 : 1;
      const y = lane === 0 ? 239 + r.int(0, 2) : 245 + r.int(0, 2);
      const f = ND.fAt(y);
      const dir = opts.dir || (r() < 0.5 ? 1 : -1); // +1 walks left (with traffic)
      const v = dir * r.range(0.85, 1.1);
      const x = atX != null ? atX : -40;
      const P = this.D - (x - CX) / f;
      const umb = opts.sprite === this.heroWalker ? -1 : r() < 0.78 ? r.int(0, 6) : -1;
      this.walkers.push({ P, v, f, y, dir, umb, sp: opts.sprite || r.pick(this.people), ph: r.int(0, 7), rate: Math.round(8 / Math.abs(v)) });
    }

    initialPopulation() {
      const r = this.r;
      this.spawnWalker(78, { lane: 0, dir: -1, sprite: this.heroWalker });
      this.spawnWalker(250, { lane: 1 });
      this.spawnWalker(420, { lane: 0 });
      this.spawnWalker(560, { lane: 1 });
      this.spawnWalker(20, { lane: 1 });
      // traffic: a dark red coupe just behind the hero car, like the reference
      this.spawnCar({ x: 520, v: SPEED - 0.25, sprite: this.trafficPool[0] });
      this.nextWalker = this.tick + r.int(60, 160);
      this.nextCar = this.tick + r.int(600, 1200);
    }

    // --- traffic ----------------------------------------------------------------------
    spawnCar(opts = {}) {
      const r = this.r;
      const f = ND.fAt(Y.FAR);
      const sprite = opts.sprite || r.pick(this.trafficPool);
      const v = opts.v != null ? opts.v : r() < 0.5 ? SPEED + r.range(0.25, 0.6) : SPEED - r.range(0.25, 0.7);
      let x = opts.x;
      if (x == null) x = v > SPEED ? W + 30 : -sprite.w - 30;
      const P = this.D - (x - CX) / f;
      // keep a safe distance from other cars
      for (const c of this.traffic) if (Math.abs(c.P - P) < 260) return false;
      this.traffic.push({ P, v, f, sp: sprite, wa: 0 });
      return true;
    }

    // --- update -----------------------------------------------------------------------
    update(dtTicks = 1, init = false) {
      if (!init) {
        this.tick++;
        this.D += SPEED;
      }
      const D = this.D;
      if (!init) {
        this.weather.update();
        this.rain.update(this.weather, D);
        this.air.update(this.tick, this.weather);
      }
      for (const l of this.skyLayers) l.update(D);
      this.buildings.update(D);
      this.curb.update(D);
      this.fg.update(D);

      // walkers
      for (const w of this.walkers) w.P += w.v * (init ? 0 : 1);
      this.walkers = this.walkers.filter((w) => {
        const x = CX + (D - w.P) * w.f;
        return x < W + 60 && x > -120;
      });
      if (!init && this.tick >= this.nextWalker) {
        if (this.walkers.length < 10 - this.weather.v.rain * 5) this.spawnWalker(null);
        this.nextWalker = this.tick + this.r.int(18, 90);
      }

      // traffic
      // car following: never drive into the car ahead (larger P = further along)
      const lane = this.traffic.slice().sort((a, b) => b.P - a.P);
      for (let i = 0; i < lane.length; i++) {
        const me = lane[i];
        if (me.v0 == null) me.v0 = me.v;
        const ahead = lane[i - 1];
        const gap = ahead ? ahead.P - ahead.sp.w / ahead.f - me.P : Infinity;
        if (gap < 60) me.v = Math.min(me.v, ahead.v - 0.05);
        else if (gap < 140) me.v += (Math.min(me.v0, ahead.v) - me.v) * 0.05;
        else me.v += (me.v0 - me.v) * 0.01;
      }
      for (const c of this.traffic) {
        c.P += c.v * (init ? 0 : 1);
        c.wa += c.v / 10;
      }
      this.traffic = this.traffic.filter((c) => {
        const x = CX + (D - c.P) * c.f;
        return x < W + 80 && x > -c.sp.w - 80;
      });
      if (!init && this.tick >= this.nextCar) {
        if (this.traffic.length < 2) this.spawnCar();
        this.nextCar = this.tick + this.r.int(420, 1400);
      }

      // hero car: wheel spin, gentle suspension and drift
      const hero = this.hero;
      hero.angle += SPEED / ND.HERO.WHEEL_R;
      const t = this.tick / 60;
      hero.dx = Math.round(Math.sin(t * 0.13) * 5 + Math.sin(t * 0.041 + 1) * 7);
      const bump = ND.hash(Math.floor(this.tick / 97), 5) < 0.35 && this.tick % 97 < 6;
      hero.bob = bump ? 1 : 0;
    }

    // run a slice of queued generation work
    work(budgetMs) { this.jobs.run(budgetMs); }
  }

  ND.World = World;
})();
