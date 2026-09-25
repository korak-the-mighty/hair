/* Nightdrive — pedestrians: procedural skeletal walk cycles and idle poses. */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;

  const FW = 30, FH = 60, FOOT = 57; // frame size and foot row
  const WALK_FRAMES = 8;

  const SKIN = [rgb('#f0b898'), rgb('#e2a07e'), rgb('#c07a58'), rgb('#8e5238'), rgb('#6a3a28')];
  const HAIR = [rgb('#f4cc68'), rgb('#e8b24a'), rgb('#5a3020'), rgb('#1c1018'), rgb('#2a1a14'), rgb('#9a3a1c'), rgb('#d0d0d8')];
  const TOPS = [rgb('#8fd0ff'), rgb('#ff9ad0'), rgb('#f4f0ff'), rgb('#ffe070'), rgb('#70f0c0'), rgb('#ff6a6a'), rgb('#b090ff'), rgb('#2a2a3a'), rgb('#ffffff')];
  const BOTTOMS = [rgb('#e8e0f0'), rgb('#26263a'), rgb('#3a4a8a'), rgb('#1a1a24'), rgb('#f0e8d8'), rgb('#6a5a8a')];
  const DRESSES = [rgb('#e0203a'), rgb('#ff4fa8'), rgb('#18121e'), rgb('#20c8d8'), rgb('#f0f0ff'), rgb('#ffcc30'), rgb('#9a40ff')];

  function makeLook(r, kind) {
    const female = r.chance(0.5);
    const look = {
      female,
      skin: r.pick(SKIN),
      hair: r.pick(HAIR),
      hairLong: female ? r.chance(0.8) : r.chance(0.12),
      top: r.pick(TOPS),
      bottom: r.pick(BOTTOMS),
      dress: female && r.chance(0.6) ? r.pick(DRESSES) : null,
      shoes: r.pick([rgb('#141018'), rgb('#f0f0f0'), rgb('#5a3020'), rgb('#e02040')]),
      jacket: !female && r.chance(0.35) ? r.pick([rgb('#f4f0f8'), rgb('#a8d8ff'), rgb('#ffc0e0'), rgb('#e8e0c8')]) : null,
      height: r.range(47, 53) * (female ? 0.97 : 1.02),
      build: r.range(0.9, 1.15),
      sil: kind === 'sil',
      rim: r.pick([rgb('#ff6ad0'), rgb('#6ad8ff'), rgb('#ffb060'), rgb('#c080ff')]),
      prop: r.chance(0.2) ? 'drink' : null,
    };
    if (look.sil) {
      look.silCol = r.pick([rgb('#2a1428'), rgb('#24122a'), rgb('#301a24')]);
      look.rim = r.pick([rgb('#ffb070'), rgb('#ff7ad0'), rgb('#ffd090')]);
    }
    return look;
  }

  // Pose: joint angles in radians (0 = straight down, +ve = forward).
  function walkPose(k) {
    const ph = (k / WALK_FRAMES) * Math.PI * 2;
    const leg = (p) => {
      const thigh = 0.46 * Math.sin(p);
      const knee = 0.12 + 0.85 * Math.pow(Math.max(0, Math.cos(p - 0.35)), 2);
      return { thigh, shin: thigh - knee };
    };
    const arm = (p) => {
      const up = -0.38 * Math.sin(p);
      return { up, fore: up + 0.3 + 0.15 * Math.max(0, -Math.sin(p)) };
    };
    return {
      bob: Math.round(Math.abs(Math.sin(ph)) * 1.2),
      near: leg(ph), far: leg(ph + Math.PI),
      armNear: arm(ph + Math.PI), armFar: arm(ph),
      lean: 0.04,
    };
  }

  function idlePose(k, variant) {
    const ph = (k / 4) * Math.PI * 2;
    const sway = Math.sin(ph) * 0.03;
    const p = {
      bob: 0,
      near: { thigh: 0.05 + sway, shin: 0.03 + sway },
      far: { thigh: -0.08 - sway, shin: -0.06 - sway },
      armNear: { up: 0.08, fore: 0.18 },
      armFar: { up: -0.05, fore: 0.1 },
      lean: sway,
    };
    if (variant === 'drink') p.armNear = { up: 0.55 + Math.sin(ph) * 0.1, fore: 2.3 };
    if (variant === 'talk') p.armNear = { up: 0.35 + Math.max(0, Math.sin(ph * 2)) * 0.25, fore: 1.4 };
    if (variant === 'pocket') { p.armNear = { up: -0.1, fore: 0.6 }; p.armFar = { up: -0.1, fore: 0.6 }; }
    return p;
  }

  function drawFigure(look, pose) {
    const pb = new ND.PB(FW, FH);
    const Hh = look.height;
    const s = Hh / 50;
    const cx = FW / 2 - 1;
    const foot = FOOT;
    const hipY = foot - 24 * s + pose.bob;
    const shY = foot - 40 * s + pose.bob;
    const headY = foot - Hh + 3.5 * s + pose.bob;
    const thighL = 12.5 * s, shinL = 12 * s, upL = 9 * s, foreL = 8.5 * s;
    const lean = pose.lean * 10;
    const hipX = cx, shX = cx + lean + 0.5;
    const sil = look.sil;

    const col = (c, shade = 1) => {
      const base = sil ? look.silCol : c;
      return ND.pack(base[0] * shade, base[1] * shade, base[2] * shade);
    };
    const limb = (x0, y0, a1, l1, a2, l2, r1, r2, c1, c2, shade) => {
      const x1 = x0 + Math.sin(a1) * l1, y1 = y0 + Math.cos(a1) * l1;
      const x2 = x1 + Math.sin(a2) * l2, y2 = y1 + Math.cos(a2) * l2;
      pb.thick(x0, y0, x1, y1, r1, col(c1, shade));
      pb.thick(x1, y1, x2, y2, r2, col(c2, shade));
      return [x2, y2];
    };
    const legCol = look.dress ? look.skin : look.bottom;
    const shoe = look.shoes;
    const drawLeg = (L, shade) => {
      const [ax, ay] = limb(hipX, hipY, L.thigh, thighL, L.shin, shinL, 1.7 * look.build, 1.2, legCol, look.dress ? look.skin : legCol, shade);
      pb.thick(ax - 0.5, ay, ax + 2.5 * s, ay + 0.5, 0.8, col(shoe, shade));
    };
    const armCol = look.jacket || (look.dress ? look.skin : look.top);
    const drawArm = (Ar, shade, front) => {
      const sleeve = look.jacket || (look.dress ? look.skin : look.top);
      const [hx, hy] = limb(shX, shY + 1, Ar.up, upL, Ar.fore, foreL, 1.3 * look.build, 1.0, sleeve, look.jacket ? look.jacket : look.skin, shade);
      pb.disc(hx, hy, 1.0, col(look.skin, shade));
      if (front && look.prop === 'drink') pb.rect(Math.round(hx), Math.round(hy) - 3, 2, 3, col(rgb('#ffd24a'), 1));
    };

    // far limbs
    drawArm(pose.armFar, 0.62, false);
    drawLeg(pose.far, 0.62);
    // torso
    const tw = 3.6 * look.build;
    const torso = [[shX - tw, shY], [shX + tw, shY], [hipX + tw * 0.85, hipY], [hipX - tw * 0.85, hipY]];
    const topCol = look.jacket || look.top;
    pb.polyFn(torso, (x, y) => pb.set(x, y, col(look.dress || topCol, 1)));
    if (look.dress) {
      const hem = hipY + 11 * s;
      const flare = [[hipX - tw * 0.9, hipY - 6], [hipX + tw * 0.9, hipY - 6], [hipX + tw * 1.3 + 1, hem], [hipX - tw * 1.3 - 1, hem]];
      pb.polyFn(flare, (x, y) => pb.set(x, y, col(look.dress, 1)));
    } else {
      pb.rect(Math.round(hipX - tw * 0.85), Math.round(hipY - 2), Math.round(tw * 1.7) + 1, 3, col(look.bottom, 1));
      if (look.jacket) pb.line(shX + 1, shY + 1, shX + 1, hipY - 2, col(look.top, 1));
    }
    drawLeg(pose.near, 1);
    // neck + head
    pb.rect(Math.round(shX - 1), Math.round(shY - 2), 2, 3, col(look.skin, 0.85));
    const hx = shX + 0.5, hy = headY;
    pb.disc(hx, hy, 3.1 * s, col(look.skin, 1));
    pb.set(Math.round(hx + 3.4 * s), Math.round(hy + 0.5), col(look.skin, 1)); // nose
    // hair
    const hc = look.hair;
    pb.discFn(hx - 0.6, hy - 1.2, 3.2 * s, (x, y) => {
      if (y <= hy - 0.5 || x < hx - 1) pb.set(x, y, col(hc, 1));
    });
    if (look.hairLong) {
      for (let y = Math.round(hy); y < Math.round(hy + 7 * s); y++) {
        pb.set(Math.round(hx - 3), y, col(hc, 0.9));
        pb.set(Math.round(hx - 2), y, col(hc, 1));
        if (y < hy + 5) pb.set(Math.round(hx - 1), y, col(hc, 1));
      }
    }
    drawArm(pose.armNear, 1, true);

    // shading: rim light on the facing edge, darker back edge
    const src = pb.d.slice();
    const rim = look.rim;
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const i = y * FW + x;
        if (!(src[i] >>> 24)) continue;
        const front = x + 1 < FW ? src[i + 1] >>> 24 : 0;
        const back = x > 0 ? src[i - 1] >>> 24 : 0;
        const up = y > 0 ? src[i - FW] >>> 24 : 0;
        const c = [src[i] & 255, (src[i] >> 8) & 255, (src[i] >> 16) & 255];
        let o = c;
        if (sil) {
          // backlit by the storefronts: warm rim on every outer edge
          if (!front || !back) o = ND.mix(c, rim, 0.5);
          else if (!up) o = ND.mix(c, rim, 0.35);
          else o = ND.mix(c, rim, 0.06 + 0.1 * (1 - y / FH));
        } else {
          if (!front) o = ND.mix(c, rim, 0.35);
          else if (!back) o = ND.scale(c, 0.75);
          if (!up) o = ND.mix(o, [255, 255, 255], 0.12);
        }
        pb.set(x, y, ND.pack(o[0], o[1], o[2]));
      }
    return pb;
  }

  // Returns {right:[canvas], left:[canvas]} walk frames plus idle frames.
  function genPerson(seed, kind = 'lit') {
    const r = ND.rng(seed);
    const look = makeLook(r, kind);
    const walkR = [], walkL = [];
    for (let k = 0; k < WALK_FRAMES; k++) {
      const pb = drawFigure(look, walkPose(k));
      walkR.push(pb.canvas());
      walkL.push(pb.flipped().canvas());
    }
    const variant = look.prop === 'drink' ? 'drink' : r.pick(['talk', 'pocket', 'rest', 'talk']);
    const idleR = [], idleL = [];
    for (let k = 0; k < 4; k++) {
      const pb = drawFigure(look, idlePose(k, variant));
      idleR.push(pb.canvas());
      idleL.push(pb.flipped().canvas());
    }
    return { walkR, walkL, idleR, idleL, look, w: FW, h: FH, foot: FOOT };
  }

  // The reference's woman in the red dress.
  function genHeroWalker(seed) {
    const r = ND.rng(seed);
    const look = makeLook(r, 'lit');
    Object.assign(look, {
      female: true, dress: rgb('#e41c34'), hair: rgb('#f6d27a'), hairLong: true,
      skin: rgb('#f0b494'), shoes: rgb('#e41c34'), height: 51, build: 0.95, rim: rgb('#ff7ad8'), prop: null,
    });
    const walkR = [], walkL = [];
    for (let k = 0; k < WALK_FRAMES; k++) {
      const pb = drawFigure(look, walkPose(k));
      walkR.push(pb.canvas());
      walkL.push(pb.flipped().canvas());
    }
    return { walkR, walkL, idleR: walkR.slice(0, 1), idleL: walkL.slice(0, 1), look, w: FW, h: FH, foot: FOOT };
  }

  ND.genPerson = genPerson;
  ND.genHeroWalker = genHeroWalker;
  ND.PERSON = { FW, FH, FOOT, WALK_FRAMES };
})();
