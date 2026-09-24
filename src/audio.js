/* Neon Drive — endless generative night-drive disco soundtrack (Web Audio).
 *
 * Everything is synthesised live: four-on-the-floor drums with an 80s gated
 * snare, disco octave bass, sidechain-pumped supersaw chords, arps through a
 * ping-pong delay and a soaring lead. Each track is composed on the fly (key,
 * tempo, progression, motif) and follows an arc built on anticipation:
 * intro → verse → build → drop → breakdown → a longer build → the final drop
 * with a key lift → outro. Rain, thunder and tyre hiss follow the weather.
 */
(function () {
  'use strict';
  const ND = window.ND;

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const MINOR = [0, 2, 3, 5, 7, 8, 10];
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Chord loops as natural-minor scale degrees (0 = i). Degree 4 is played as a
  // major V (harmonic minor) when `dom` is set.
  const PROGS = [
    { d: [0, 5, 2, 6] }, { d: [0, 6, 5, 6] }, { d: [5, 6, 0, 0] }, { d: [0, 3, 5, 4], dom: true },
    { d: [0, 5, 3, 4], dom: true }, { d: [3, 5, 0, 6] }, { d: [0, 2, 6, 5] }, { d: [5, 2, 6, 0] },
    { d: [5, 6, 2, 0] }, { d: [3, 6, 2, 5] }, { d: [0, 5, 6, 4], dom: true }, { d: [5, 4, 0, 6], dom: true },
  ];

  const RHYTHMS = [
    [[0, 3], [3, 3], [6, 2], [8, 4], [12, 2], [14, 2], [16, 6], [22, 2], [24, 6], [30, 2]],
    [[0, 2], [2, 2], [4, 4], [10, 2], [12, 4], [16, 2], [18, 2], [20, 6], [28, 4]],
    [[2, 2], [4, 2], [6, 4], [12, 4], [18, 2], [20, 2], [22, 4], [28, 2], [30, 2]],
    [[0, 6], [6, 2], [8, 6], [14, 2], [16, 4], [20, 4], [24, 8]],
    [[0, 8], [8, 4], [12, 4], [16, 12], [28, 4]],
    [[0, 3], [3, 3], [6, 4], [10, 2], [12, 4], [16, 3], [19, 3], [22, 4], [26, 6]],
  ];
  const ARPS = [
    [0, 1, 2, 3, 0, 1, 2, 3], [0, 2, 1, 3, 0, 2, 1, 3], [0, 1, 2, 3, 2, 1, 0, 1],
    [0, 3, 2, 3, 1, 3, 2, 3], [3, 2, 1, 0, 3, 2, 1, 0], [0, 0, 2, 1, 3, 1, 2, 1],
  ];
  const WORDS_A = ['Midnight', 'Neon', 'Chrome', 'Velvet', 'Magenta', 'Electric', 'Crystal', 'Ocean', 'Laser', 'Violet', 'Golden', 'Satin', 'Cobalt', 'Cherry', 'Silver', 'Tropic', 'Lunar', 'Infinite', 'Silent'];
  const WORDS_B = ['Causeway', 'Boulevard', 'Afterglow', 'Overdrive', 'Riviera', 'Mirage', 'Heatwave', 'Skyline', 'Horizon', 'Nightcall', 'Arcade', 'Coastline', 'Getaway', 'Afterhours', 'Parallel', 'Cruise', 'Satellite', 'Palms', 'Motel', 'Signal'];

  // ---------------------------------------------------------------------------
  // Composition
  // ---------------------------------------------------------------------------
  function makeTrack(r, prevTonic, index) {
    let tonic;
    do tonic = r.int(0, 11); while (tonic === prevTonic);
    const bpm = r.pick([108, 110, 112, 114, 115, 116, 118, 120, 122]);
    const verse = r.pick(PROGS);
    let drop = r() < 0.55 ? verse : r.pick(PROGS);
    const chordBars = r() < 0.55 ? 1 : 2;
    const buildBars = 8;
    const longBuild = r() < 0.65 ? 16 : 8; // the second wait is usually longer
    const sections = [
      { name: 'intro', bars: r() < 0.5 ? 16 : 8, energy: 0.25 },
      { name: 'verse', bars: 16, energy: 0.55 },
      { name: 'build', bars: buildBars, energy: 0.7 },
      { name: 'drop', bars: 16, energy: 1.0 },
      { name: 'break', bars: r() < 0.5 ? 16 : 8, energy: 0.3 },
      { name: 'build', bars: longBuild, energy: 0.75, second: true },
      { name: 'drop', bars: r() < 0.5 ? 24 : 16, energy: 1.0, final: true },
      { name: 'outro', bars: 16, energy: 0.4 },
    ];
    let bar = 0;
    for (const s of sections) { s.start = bar; bar += s.bars; }
    const rhythm = r.pick(RHYTHMS);
    const motif = [];
    let deg = r.pick([0, 2, 4]);
    for (let i = 0; i < rhythm.length; i++) {
      const [st, len] = rhythm[i];
      if (i > 0) {
        const up = st < 16 ? 0.62 : 0.38;
        const mag = r() < 0.65 ? 1 : r() < 0.7 ? 2 : 3;
        deg += r() < up ? mag : -mag;
        deg = ND.clamp(deg, -2, 9);
      }
      motif.push({ st, len, deg, strong: st % 4 === 0 });
    }
    motif[motif.length - 1].deg = r.pick([0, 2, 4, 7]);
    const name = `${r.pick(WORDS_A)} ${r.pick(WORDS_B)}`;
    return {
      index, name, bpm, tonic, key: `${NOTE_NAMES[tonic]} minor`,
      verse, drop, chordBars, sections, totalBars: bar,
      motif, answer: motif.map((n, i) => (i >= motif.length - 3 ? { ...n, deg: n.deg + r.pick([-2, -1, 1, 2]) } : n)),
      arp: r.pick(ARPS),
      lift: r() < 0.6 ? 2 : r() < 0.5 ? 1 : 3,
      leadWave: r.pick(['sawtooth', 'sawtooth', 'square']),
      bassOct: r.pick([true, true, false]),
      padBright: r.range(0.45, 0.8),
      swingHat: r() < 0.3,
    };
  }

  // Scale degree -> MIDI in a given octave register around `center`.
  function degMidi(tonic, deg, center) {
    const o = Math.floor(deg / 7);
    const i = ((deg % 7) + 7) % 7;
    let m = tonic + MINOR[i] + 12 * o;
    while (m < center - 6) m += 12;
    while (m > center + 6) m -= 12;
    return m;
  }

  function chordPcs(tonic, d, dom) {
    const deg = (k) => MINOR[((d + k) % 7 + 7) % 7] + 12 * Math.floor((d + k) / 7);
    const tones = [deg(0), deg(2), deg(4), deg(d === 0 || d === 3 ? 8 : 6)]; // m9 on i / iv, 7ths elsewhere
    if (dom && ((d % 7) + 7) % 7 === 4) tones[1] += 1; // major V
    return tones.map((t) => tonic + t);
  }

  function voice(pcs, prev, lo = 55) {
    // choose the inversion closest to the previous voicing
    const base = pcs.map((p) => { let m = p; while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; }).sort((a, b) => a - b);
    const cands = [];
    for (let inv = 0; inv < base.length; inv++) {
      const v = base.map((m, i) => (i < inv ? m + 12 : m)).sort((a, b) => a - b);
      cands.push(v);
    }
    if (!prev) return cands[0];
    let best = cands[0], bd = Infinity;
    for (const v of cands) {
      const d = v.reduce((s, m, i) => s + Math.abs(m - (prev[i] || m)), 0);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Engine
  // ---------------------------------------------------------------------------
  class Music {
    constructor(seed = 1985) {
      this.seed = seed;
      this.r = ND.rng(seed * 13 + 7);
      this.ctx = null;
      this.enabled = false;
      this.trackIndex = 0;
      this.kicks = [];
      this.marks = [];
      this.listeners = [];
    }

    // ---- graph ----------------------------------------------------------------
    build(ctx, live = true) {
      this.ctx = ctx;
      const N = (this.n = {});
      N.master = ctx.createGain();
      N.master.gain.value = 0.78;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 10; comp.ratio.value = 2.4; comp.attack.value = 0.008; comp.release.value = 0.25;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      N.out = ctx.createGain();
      N.out.gain.value = 1;
      N.master.connect(comp).connect(lim).connect(N.out);
      N.out.connect(ctx.destination);
      if (live && ctx.createMediaStreamDestination) {
        N.rec = ctx.createMediaStreamDestination();
        N.out.connect(N.rec);
      }
      // music bus: sidechain duck -> sweepable low-pass
      N.duck = ctx.createGain();
      N.sweep = ctx.createBiquadFilter();
      N.sweep.type = 'lowpass'; N.sweep.frequency.value = 18000; N.sweep.Q.value = 0.9;
      N.music = ctx.createGain();
      N.music.gain.value = 0.9;
      N.music.connect(N.duck).connect(N.sweep).connect(N.master);
      N.lead = ctx.createGain();
      N.lead.gain.value = 0.9;
      N.lead.connect(N.sweep);
      N.drums = ctx.createGain();
      N.drums.gain.value = 0.95;
      N.drums.connect(N.master);
      // reverbs
      N.verb = ctx.createConvolver();
      N.verb.buffer = this.impulse(ctx, 3.4, 2.2, false);
      N.verbIn = ctx.createGain();
      N.verbOut = ctx.createGain();
      N.verbOut.gain.value = 0.55;
      const verbHP = ctx.createBiquadFilter();
      verbHP.type = 'highpass'; verbHP.frequency.value = 260;
      N.verbIn.connect(verbHP).connect(N.verb).connect(N.verbOut).connect(N.sweep);
      N.gated = ctx.createConvolver();
      N.gated.buffer = this.impulse(ctx, 0.34, 0, true);
      N.gatedIn = ctx.createGain();
      const gOut = ctx.createGain();
      gOut.gain.value = 0.7;
      N.gatedIn.connect(N.gated).connect(gOut).connect(N.master);
      // ping-pong delay (dotted eighth, set per track)
      N.delayIn = ctx.createGain();
      const dl = (N.dl = ctx.createDelay(2)), dr = (N.dr = ctx.createDelay(2));
      const fb = ctx.createGain(); fb.gain.value = 0.42;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
      const merger = ctx.createChannelMerger(2);
      N.delayIn.connect(dl);
      dl.connect(dr);
      dr.connect(dlp).connect(fb).connect(dl);
      dl.connect(merger, 0, 0);
      dr.connect(merger, 0, 1);
      const dOut = ctx.createGain(); dOut.gain.value = 0.5;
      merger.connect(dOut).connect(N.sweep);
      // noise buffers
      this.white = this.noise(ctx, 2, 'white');
      this.pink = this.noise(ctx, 4, 'pink');
      this.brown = this.noise(ctx, 6, 'brown');
      // ambience
      N.amb = ctx.createGain();
      N.amb.gain.value = 1;
      N.amb.connect(N.master);
      this.buildAmbience(ctx);
    }

    impulse(ctx, secs, decay, gated) {
      const sr = ctx.sampleRate, len = Math.floor(sr * secs);
      const buf = ctx.createBuffer(2, len, sr);
      const r = ND.rng(99);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const env = gated ? (t < 0.8 ? 0.9 - t * 0.3 : Math.max(0, (1 - t) * 3.5)) : Math.pow(1 - t, decay);
          lp += ((r() * 2 - 1) - lp) * (gated ? 0.6 : 0.35 + 0.5 * (1 - t));
          d[i] = lp * env * (i < sr * 0.004 && !gated ? i / (sr * 0.004) : 1);
        }
      }
      return buf;
    }

    noise(ctx, secs, kind) {
      const sr = ctx.sampleRate, len = Math.floor(sr * secs);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const r = ND.rng(kind.length * 31);
      let b0 = 0, b1 = 0, b2 = 0, br = 0;
      for (let i = 0; i < len; i++) {
        const w = r() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'pink') {
          b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
          d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
        } else {
          br = (br + 0.02 * w) / 1.02;
          d[i] = br * 3.5;
        }
      }
      return buf;
    }

    buildAmbience(ctx) {
      const N = this.n;
      // rain
      const rain = ctx.createBufferSource();
      rain.buffer = this.pink; rain.loop = true;
      N.rainLP = ctx.createBiquadFilter(); N.rainLP.type = 'lowpass'; N.rainLP.frequency.value = 2400;
      const rainHP = ctx.createBiquadFilter(); rainHP.type = 'highpass'; rainHP.frequency.value = 350;
      N.rainG = ctx.createGain(); N.rainG.gain.value = 0;
      rain.connect(rainHP).connect(N.rainLP).connect(N.rainG).connect(N.amb);
      rain.start();
      // tyres hissing on the wet road
      const hiss = ctx.createBufferSource();
      hiss.buffer = this.white; hiss.loop = true;
      const hissBP = ctx.createBiquadFilter(); hissBP.type = 'bandpass'; hissBP.frequency.value = 3800; hissBP.Q.value = 0.6;
      N.hissG = ctx.createGain(); N.hissG.gain.value = 0;
      hiss.connect(hissBP).connect(N.hissG).connect(N.amb);
      hiss.start();
      // the flat-12 idling under it all
      const e1 = ctx.createOscillator(), e2 = ctx.createOscillator();
      e1.type = 'sawtooth'; e1.frequency.value = 41;
      e2.type = 'sawtooth'; e2.frequency.value = 82.6;
      const eLP = ctx.createBiquadFilter(); eLP.type = 'lowpass'; eLP.frequency.value = 150; eLP.Q.value = 2;
      const eG = ctx.createGain(); eG.gain.value = 0.035;
      const wob = ctx.createOscillator(); wob.frequency.value = 0.23;
      const wobG = ctx.createGain(); wobG.gain.value = 1.4;
      wob.connect(wobG).connect(e1.frequency);
      e1.connect(eLP); e2.connect(eLP); eLP.connect(eG).connect(N.amb);
      e1.start(); e2.start(); wob.start();
    }

    // ---- life cycle ---------------------------------------------------------------
    start() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.enabled = true;
        this.n.out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.2);
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC({ latencyHint: 'playback' });
      this.build(ctx, true);
      this.enabled = true;
      this.newTrack();
      this.nextTime = ctx.currentTime + 0.15;
      this.startTicker();
      ND.bus.on('lightning', (e) => this.thunder(e));
    }
    toggle() {
      if (!this.ctx || !this.enabled) { this.start(); return true; }
      this.enabled = false;
      this.n.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      return false;
    }
    startTicker() {
      const tick = () => this.pump();
      try {
        // worker timers keep ticking in background tabs
        const src = 'let id=setInterval(()=>postMessage(0),25);';
        this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        this.worker.onmessage = tick;
      } catch (e) {
        setInterval(tick, 25);
      }
    }
    pump() {
      const ctx = this.ctx;
      if (!ctx) return;
      const ahead = document.hidden ? 1.5 : 0.35;
      this.scheduleUntil(ctx.currentTime + ahead);
      this.updateAmbience();
    }
    newTrack() {
      const prev = this.track;
      this.track = makeTrack(this.r, prev ? prev.tonic : -1, this.trackIndex++);
      this.bar = 0;
      this.stepIdx = 0;
      this.prevVoicing = null;
      this.prevLead = null;
      const T = this.track;
      this.stepDur = 60 / T.bpm / 4;
      if (this.n.dl) {
        const t = this.ctx.currentTime;
        this.n.dl.delayTime.setValueAtTime(this.stepDur * 3, Math.max(t, this.nextTime || t));
        this.n.dr.delayTime.setValueAtTime(this.stepDur * 3, Math.max(t, this.nextTime || t));
      }
      this.marks.push({ t: this.nextTime || 0, type: 'track', track: T });
      this.emit('track', T);
    }
    skip() {
      if (!this.ctx) return;
      // fade what is ringing, then start fresh on the next step
      this.n.sweep.frequency.setTargetAtTime(300, this.ctx.currentTime, 0.1);
      this.newTrack();
      this.nextTime = this.ctx.currentTime + 0.4;
    }
    on(fn) { this.listeners.push(fn); }
    emit(type, data) { for (const f of this.listeners) f(type, data); }

    // ---- sequencer ----------------------------------------------------------------
    section() {
      const T = this.track;
      for (const s of T.sections) if (this.bar < s.start + s.bars) return s;
      return T.sections[T.sections.length - 1];
    }

    scheduleUntil(tEnd) {
      while (this.nextTime < tEnd) {
        this.step(this.nextTime);
        this.nextTime += this.stepDur;
        if (++this.stepIdx >= 16) {
          this.stepIdx = 0;
          this.bar++;
          if (this.bar >= this.track.totalBars) {
            this.newTrack();
          }
        }
      }
    }

    chordAt(bar, prog) {
      const T = this.track;
      const idx = Math.floor(bar / T.chordBars) % 4;
      return { deg: prog.d[idx], dom: prog.dom, idx };
    }

    step(t) {
      const T = this.track, s = this.section(), k = this.stepIdx;
      const sb = this.bar - s.start; // bar within section
      const lastBar = sb === s.bars - 1;
      const prog = s.name === 'drop' || (s.name === 'build' && s.second) ? T.drop : T.verse;
      const ch = this.chordAt(this.bar, prog);
      const lift = s.final ? T.lift : 0;
      const tonic = T.tonic + lift;
      const pcs = chordPcs(tonic, ch.deg, ch.dom);
      const beat = k % 4 === 0;
      const secT = (sb * 16 + k) / (s.bars * 16);
      const N = this.n;

      // section starts: filter moves, marks for the visuals
      if (k === 0 && sb === 0) {
        this.marks.push({ t, type: 'section', name: s.name, final: !!s.final, energy: s.energy });
        if (s.name === 'drop') {
          this.impact(t, s.final ? 1.2 : 1);
          this.crash(t, 1);
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(18000, t);
          this.marks.push({ t, type: 'drop', final: !!s.final });
        }
        if (s.name === 'break') {
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(3000, t);
          N.sweep.frequency.exponentialRampToValueAtTime(900, t + this.stepDur * 16 * 2);
          this.downlifter(t + this.stepDur * 2, this.stepDur * 32);
        }
        if (s.name === 'intro') {
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(420, t);
          N.sweep.frequency.exponentialRampToValueAtTime(5000, t + this.stepDur * 16 * s.bars);
        }
        if (s.name === 'build') {
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(s.second ? 700 : 1400, t);
          N.sweep.frequency.exponentialRampToValueAtTime(16000, t + this.stepDur * 16 * s.bars);
          this.riser(t, this.stepDur * 16 * s.bars);
        }
        if (s.name === 'verse' || s.name === 'outro') {
          N.sweep.frequency.cancelScheduledValues(t);
          N.sweep.frequency.setValueAtTime(s.name === 'verse' ? 7000 : 12000, t);
          if (s.name === 'outro') N.sweep.frequency.exponentialRampToValueAtTime(500, t + this.stepDur * 16 * s.bars);
        }
      }

      // section loudness: quiet intros and breakdowns make the drops land
      if (k === 0 && sb === 0) {
        const G = N.music.gain;
        const L = { intro: 0.6, verse: 0.72, build: 0.72, drop: 1, break: 0.66, outro: 0.8 }[s.name];
        G.cancelScheduledValues(t);
        G.setValueAtTime(L, t);
        if (s.name === 'build') G.linearRampToValueAtTime(0.95, t + this.stepDur * 16 * s.bars - this.stepDur * 4);
        if (s.name === 'outro') G.linearRampToValueAtTime(0.25, t + this.stepDur * 16 * s.bars);
      }
      // --- the wait: one beat of silence before every drop
      const gap = s.name === 'build' && lastBar && k >= 12;
      if (gap) {
        if (k === 12) {
          N.music.gain.cancelScheduledValues(t);
          N.music.gain.setValueAtTime(0.0001, t);
          N.lead.gain.setValueAtTime(0.0001, t);
          N.lead.gain.setValueAtTime(0.9, t + this.stepDur * 4);
        }
        return;
      }

      // ------------------------------------------------ drums
      const kickOn =
        (s.name === 'intro' && sb >= s.bars / 2) || s.name === 'verse' || s.name === 'drop' ||
        (s.name === 'build' && sb < s.bars - 2) || (s.name === 'outro' && sb < s.bars - 4);
      if (kickOn && beat) this.kick(t, s.name === 'drop' ? 1 : s.name === 'intro' ? 0.6 : 0.82, s.name === 'drop' ? 0.62 : 0.4);
      const clapOn = s.name === 'verse' || s.name === 'drop' || (s.name === 'outro' && sb < 8);
      if (clapOn && (k === 4 || k === 12)) this.snare(t, s.name === 'drop' ? 1 : 0.75, s.name === 'drop');
      // hats
      const hatsOn = s.name !== 'break' && !(s.name === 'intro' && sb < 2);
      if (hatsOn) {
        if (k % 4 === 2 && (s.name !== 'intro' || sb >= 4)) this.hat(t + (T.swingHat ? this.stepDur * 0.12 : 0), true, s.name === 'drop' ? 0.55 : 0.4);
        if (k % 2 === 0 && s.name !== 'intro') this.hat(t, false, 0.22 + (k % 4 === 0 ? 0.06 : 0));
        if (s.name === 'drop' && k % 2 === 1) this.hat(t, false, 0.12);
        if (s.name === 'intro' && k % 2 === 0) this.hat(t, false, 0.14);
      }
      // build: accelerating snare roll
      if (s.name === 'build') {
        const q = sb / s.bars;
        const div = q < 0.5 ? 4 : q < 0.75 ? 2 : 1;
        if (k % div === 0) {
          const v = 0.25 + 0.75 * secT;
          this.snare(t, v * 0.8, false, 1 + secT * 0.8);
          if (sb === s.bars - 2 && k >= 8) this.snare(t + this.stepDur / 2, v * 0.7, false, 1.9);
        }
      }
      // fills at phrase ends
      if ((s.name === 'drop' || s.name === 'verse') && sb % 8 === 7 && k >= 12 && !lastBar) this.snare(t, 0.5 + (k - 12) * 0.12, false, 1.2);
      if (s.name === 'drop' && sb % 8 === 0 && sb > 0 && k === 0) this.crash(t, 0.6);

      // ------------------------------------------------ bass
      const bassOn = s.name === 'verse' || s.name === 'drop' || s.name === 'build' || (s.name === 'outro' && sb < 8) || (s.name === 'intro' && sb >= s.bars - 4);
      const root = degMidi(tonic, ch.deg, 38);
      if (bassOn) {
        if (T.bassOct || s.name === 'drop') {
          if (k % 2 === 0) {
            const hi = k % 4 === 2;
            let m = root + (hi ? 12 : 0);
            // pickup into the next chord
            if (k === 14 && (this.bar + 1) % T.chordBars === 0) {
              const nx = this.chordAt(this.bar + 1, prog);
              m = degMidi(tonic, nx.deg, 38) + 12;
            }
            this.bass(t, m, this.stepDur * 1.7, hi ? 0.62 : 0.8, s.name === 'drop' ? 0.9 : 0.55);
          }
        } else if (k % 4 === 0 || k === 6 || k === 14) {
          this.bass(t, root + (k === 6 ? 12 : 0), this.stepDur * 3, 0.8, 0.5);
        }
      } else if (s.name === 'break' && k === 0 && this.bar % T.chordBars === 0) {
        this.bass(t, root, this.stepDur * 16 * T.chordBars * 0.95, 0.5, 0.2);
      }

      // ------------------------------------------------ chords
      if (k === 0 && this.bar % T.chordBars === 0) {
        const v = voice(pcs, this.prevVoicing, 55);
        this.prevVoicing = v;
        const dur = this.stepDur * 16 * T.chordBars;
        const big = s.name === 'drop';
        const bright = big ? 1 : s.name === 'build' ? 0.4 + secT * 0.6 : s.name === 'break' ? 0.35 : T.padBright * (s.name === 'verse' ? 0.7 : 0.5);
        const vel = s.name === 'outro' ? 0.26 * (1 - secT) + 0.05 : big ? 0.4 : s.name === 'verse' ? 0.2 : 0.26;
        this.pad(t, v, dur, bright, vel, big ? 5 : 3, big ? 0.03 : 0.5);
        if (s.final) this.pad(t, v.map((m) => m + 12), dur, 0.8, 0.12, 2, 0.05);
      }

      // ------------------------------------------------ arp
      const arpOn = s.name === 'verse' || s.name === 'build' || s.name === 'drop' || (s.name === 'intro' && sb >= 4) || s.name === 'break';
      if (arpOn && (s.name !== 'break' || k % 2 === 0)) {
        const v = voice(pcs, null, 64);
        const idx = T.arp[k % 8];
        const m = v[idx % v.length] + (k >= 8 && s.name === 'drop' ? 12 : 0);
        const bright = s.name === 'drop' ? 0.9 : s.name === 'break' ? 0.3 : 0.4 + secT * 0.4;
        this.arp(t, m, s.name === 'drop' ? 0.16 : s.name === 'break' ? 0.1 : 0.13, bright);
      }

      // ------------------------------------------------ lead
      const leadOn = s.name === 'drop' || (s.name === 'break' && sb >= 4) || (s.name === 'verse' && sb >= 8);
      if (leadOn) {
        const loopBars = 2;
        const pos = ((this.bar % loopBars) * 16) + k;
        const phrase = Math.floor(this.bar / loopBars) % 2 === 1 ? T.answer : T.motif;
        for (const n of phrase) {
          if (n.st !== pos) continue;
          if (s.name === 'break' && !n.strong) continue;
          if (s.name === 'verse' && n.len < 3 && !n.strong) continue;
          const chordDeg = ch.deg;
          let m = degMidi(tonic, chordDeg + n.deg, 76);
          if (n.strong) {
            // land strong beats on chord tones
            let best = m, bd = 99;
            for (const p of pcs) for (let o = -1; o <= 1; o++) {
              const c = p + 12 * Math.round((m - p) / 12) + o * 12;
              if (Math.abs(c - m) < bd) { bd = Math.abs(c - m); best = c; }
            }
            m = best;
          }
          if (s.final) m += 12 * (m < 76 ? 1 : 0);
          const dur = this.stepDur * n.len * (s.name === 'break' ? 1.8 : 0.95);
          const vel = s.name === 'drop' ? 0.34 : s.name === 'break' ? 0.22 : 0.2;
          this.lead(t, m, dur, vel, T.leadWave);
          if (s.final) this.lead(t, m - 12 + (MINOR.includes((m - 3 - tonic + 120) % 12) ? -3 : -4), dur, vel * 0.45, 'square');
          this.prevLead = m;
        }
      }
    }

    // ---- instruments ------------------------------------------------------------
    env(g, t, a, peak, d, sus, rel, end) {
      const p = g.gain;
      p.setValueAtTime(0.0001, t);
      p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      if (d) p.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + a + d);
      if (end != null) {
        p.setValueAtTime(Math.max(0.0002, peak * (d ? sus : 1)), Math.max(t + a + (d || 0), end - rel));
        p.exponentialRampToValueAtTime(0.0001, end);
      }
    }

    duckAt(t, depth) {
      const d = this.n.duck.gain;
      d.setValueAtTime(1 - depth, t);
      d.setTargetAtTime(1, t + 0.02, this.stepDur * 0.9);
    }

    kick(t, v, duck) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
      this.env(g, t, 0.003, 1.1 * v, 0.42, 0.001, 0, null);
      o.connect(g).connect(N.drums);
      o.start(t); o.stop(t + 0.5);
      const n = c.createBufferSource(); n.buffer = this.white;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const ng = c.createGain();
      this.env(ng, t, 0.001, 0.22 * v, 0.012, 0.01, 0, null);
      n.connect(hp).connect(ng).connect(N.drums);
      n.start(t, 0.1); n.stop(t + 0.03);
      this.duckAt(t, duck);
      this.kicks.push(t);
      if (this.kicks.length > 64) this.kicks.shift();
    }

    snare(t, v, big, pitch = 1) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700 * pitch; bp.Q.value = 0.7;
      const g = c.createGain();
      this.env(g, t, 0.001, 0.62 * v, 0.2, 0.01, 0, null);
      n.connect(bp).connect(g);
      g.connect(N.drums);
      const send = c.createGain(); send.gain.value = big ? 0.85 : 0.35;
      g.connect(send).connect(N.gatedIn);
      n.start(t, (t * 7.3) % 1.5); n.stop(t + 0.26);
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(160 * pitch, t + 0.06);
      this.env(og, t, 0.001, 0.4 * v, 0.1, 0.01, 0, null);
      o.connect(og).connect(N.drums);
      o.start(t); o.stop(t + 0.14);
      if (big) {
        // clap layer
        for (let i = 0; i < 3; i++) {
          const cn = c.createBufferSource(); cn.buffer = this.white;
          const cb = c.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = 1150; cb.Q.value = 1.2;
          const cg = c.createGain();
          const tt = t - 0.012 + i * 0.009;
          this.env(cg, tt, 0.001, 0.32 * v, 0.02, 0.05, 0, null);
          cn.connect(cb).connect(cg).connect(N.drums);
          cg.connect(send);
          cn.start(Math.max(0, tt), 0.5 + i * 0.1); cn.stop(tt + 0.05);
        }
      }
    }

    hat(t, open, v) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = open ? 6500 : 8000;
      const g = c.createGain();
      const len = open ? 0.24 : 0.035;
      this.env(g, t, 0.001, v * 0.5, len, 0.01, 0, null);
      let out = g;
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = open ? 0.25 : 0.35; g.connect(p); out = p; }
      n.connect(hp).connect(g);
      out.connect(N.drums);
      n.start(t, (t * 3.1) % 1.5); n.stop(t + len + 0.05);
    }

    crash(t, v) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4200;
      const g = c.createGain();
      this.env(g, t, 0.002, 0.42 * v, 2.4, 0.001, 0, null);
      n.connect(hp).connect(g).connect(N.drums);
      const s = c.createGain(); s.gain.value = 0.3; g.connect(s).connect(N.verbIn);
      n.start(t, 0); n.stop(t + 2.5);
    }

    impact(t, v) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 1.1);
      this.env(g, t, 0.004, 0.9 * v, 1.6, 0.001, 0, null);
      o.connect(g).connect(N.master);
      o.start(t); o.stop(t + 1.7);
    }

    riser(t, dur) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white; n.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + dur * 0.97);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      n.connect(bp).connect(g).connect(N.master);
      const s = c.createGain(); s.gain.value = 0.4; g.connect(s).connect(N.verbIn);
      n.start(t); n.stop(t + dur + 0.05);
      // pitch riser
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(1320, t + dur);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.97);
      og.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(og).connect(N.master);
      og.connect(s);
      o.start(t); o.stop(t + dur + 0.05);
    }

    downlifter(t, dur) {
      const c = this.ctx, N = this.n;
      const n = c.createBufferSource(); n.buffer = this.white; n.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
      bp.frequency.setValueAtTime(7000, t);
      bp.frequency.exponentialRampToValueAtTime(200, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp).connect(g).connect(N.verbIn);
      n.start(t); n.stop(t + dur);
    }

    bass(t, m, dur, v, bright) {
      const c = this.ctx, N = this.n;
      const f = hz(m);
      const o1 = c.createOscillator(), o2 = c.createOscillator();
      o1.type = 'sawtooth'; o1.frequency.value = f;
      o2.type = 'square'; o2.frequency.value = f; o2.detune.value = -6;
      const o2g = c.createGain(); o2g.gain.value = 0.45;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
      lp.frequency.setValueAtTime(260 + 2200 * bright, t);
      lp.frequency.setTargetAtTime(220 + 300 * bright, t + 0.005, 0.07);
      const g = c.createGain();
      this.env(g, t, 0.004, 0.36 * v, 0.12, 0.7, 0.03, t + dur);
      o1.connect(lp); o2.connect(o2g).connect(lp);
      lp.connect(g).connect(N.music);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    }

    pad(t, notes, dur, bright, v, voices, attack) {
      const c = this.ctx, N = this.n;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
      lp.frequency.setValueAtTime(500 + 5200 * bright * bright, t);
      const g = c.createGain();
      const rel = 1.6;
      this.env(g, t, attack, v / Math.sqrt(notes.length * voices) * 1.6, 0, 1, rel, t + dur + rel * 0.6);
      lp.connect(g).connect(N.music);
      const send = c.createGain(); send.gain.value = 0.42; g.connect(send).connect(N.verbIn);
      const det = voices === 5 ? [-16, -7, 0, 7, 16] : voices === 3 ? [-9, 0, 9] : [-6, 6];
      // spread detuned voices across two panned groups for width
      const sides = [-0.65, 0.65].map((pan) => {
        if (!c.createStereoPanner) return lp;
        const p = c.createStereoPanner();
        p.pan.value = pan;
        p.connect(lp);
        return p;
      });
      notes.forEach((m, ni) => {
        det.forEach((cents, vi) => {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = hz(m);
          o.detune.value = cents + (ni - 1.5) * 1.5;
          o.connect(sides[(vi + ni) % 2]);
          o.start(t);
          o.stop(t + dur + rel + 0.1);
        });
      });
    }

    arp(t, m, v, bright) {
      const c = this.ctx, N = this.n;
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = hz(m);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(700 + 5000 * bright, t);
      lp.frequency.exponentialRampToValueAtTime(380, t + 0.14);
      const g = c.createGain();
      this.env(g, t, 0.002, v * 0.5, 0.16, 0.05, 0, null);
      o.connect(lp).connect(g).connect(N.music);
      const s = c.createGain(); s.gain.value = 0.55; g.connect(s).connect(N.delayIn);
      o.start(t); o.stop(t + 0.22);
    }

    lead(t, m, dur, v, wave) {
      const c = this.ctx, N = this.n;
      const f = hz(m);
      const g = c.createGain();
      this.env(g, t, 0.012, v, 0.18, 0.78, 0.18, t + dur + 0.12);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.6;
      lp.frequency.setValueAtTime(5200, t);
      lp.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
      const lfo = c.createOscillator(); lfo.frequency.value = 5.6;
      const lfoG = c.createGain();
      lfoG.gain.setValueAtTime(0, t);
      lfoG.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.5, dur));
      lfo.connect(lfoG);
      const from = this.prevLead && Math.abs(this.prevLead - m) <= 7 ? hz(this.prevLead) : f;
      const oscs = [];
      for (const [type, det, gain] of [[wave, -8, 0.5], [wave, 8, 0.5], ['square', -1200, 0.22]]) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(from, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
        o.detune.value = det;
        lfoG.connect(o.frequency);
        const og = c.createGain(); og.gain.value = gain;
        o.connect(og).connect(lp);
        oscs.push(o);
      }
      lp.connect(g).connect(N.lead);
      const rs = c.createGain(); rs.gain.value = 0.38; g.connect(rs).connect(N.verbIn);
      const ds = c.createGain(); ds.gain.value = 0.3; g.connect(ds).connect(N.delayIn);
      const end = t + dur + 0.2;
      lfo.start(t); lfo.stop(end);
      for (const o of oscs) { o.start(t); o.stop(end); }
    }

    // ---- weather -------------------------------------------------------------------
    updateAmbience() {
      const w = ND.world && ND.world.weather;
      if (!w || !this.n) return;
      const t = this.ctx.currentTime;
      const rain = w.v.rain;
      this.n.rainG.gain.setTargetAtTime(rain * 0.3, t, 0.5);
      this.n.rainLP.frequency.setTargetAtTime(1600 + rain * 3200, t, 0.5);
      this.n.hissG.gain.setTargetAtTime(0.004 + rain * 0.05, t, 0.5);
      this.n.verbOut.gain.setTargetAtTime(0.55 + rain * 0.2, t, 1);
    }

    thunder(e) {
      if (!this.ctx || !this.enabled) return;
      const c = this.ctx, N = this.n;
      const delay = e.near ? 0.15 + Math.random() * 0.4 : 0.8 + Math.random() * 2.2;
      const t = c.currentTime + delay;
      const n = c.createBufferSource(); n.buffer = this.brown;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = e.near ? 900 : 380;
      lp.frequency.setTargetAtTime(160, t + 0.3, 1.2);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9 * e.intensity, t + (e.near ? 0.04 : 0.4));
      g.gain.setTargetAtTime(0.35 * e.intensity, t + 0.6, 0.6);
      g.gain.setTargetAtTime(0.0001, t + 2, 1.4);
      n.connect(lp).connect(g).connect(N.amb);
      const s = c.createGain(); s.gain.value = 0.3; g.connect(s).connect(N.verbIn);
      n.start(t, Math.random() * 1.5); n.stop(t + 7);
      if (e.near) {
        const cr = c.createBufferSource(); cr.buffer = this.white;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
        const cg = c.createGain();
        this.env(cg, t, 0.002, 0.35 * e.intensity, 0.35, 0.001, 0, null);
        cr.connect(hp).connect(cg).connect(N.amb);
        cr.start(t); cr.stop(t + 0.5);
      }
    }

    // ---- sync info for the visuals ------------------------------------------------------
    heard() {
      if (!this.ctx) return 0;
      return this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    }
    pulse() {
      if (!this.ctx || !this.enabled) return { playing: false, kick: 0, drop: 0, energy: 0 };
      const now = this.heard();
      let lastKick = -1;
      for (let i = this.kicks.length - 1; i >= 0; i--) if (this.kicks[i] <= now) { lastKick = this.kicks[i]; break; }
      const kick = lastKick < 0 ? 0 : Math.exp(-(now - lastKick) / 0.11);
      // consume marks that have become audible
      while (this.marks.length && this.marks[0].t <= now) {
        const m = this.marks.shift();
        if (m.type === 'section') this.curSection = m;
        if (m.type === 'drop') { this.lastDrop = m.t; this.lastDropFinal = m.final; ND.bus.emit('drop', m); }
        if (m.type === 'track') { this.shownTrack = m.track; this.trackShownAt = now; ND.bus.emit('track', m.track); }
      }
      const drop = this.lastDrop != null ? Math.exp(-(now - this.lastDrop) / (this.lastDropFinal ? 1.4 : 0.9)) : 0;
      return { playing: true, kick, drop, energy: this.curSection ? this.curSection.energy : 0, section: this.curSection && this.curSection.name, track: this.shownTrack, trackAge: now - (this.trackShownAt || -99) };
    }

    // ---- offline render (tests / previews) -------------------------------------------------
    async renderOffline(seconds, sr = 44100) {
      const ctx = new OfflineAudioContext(2, Math.floor(sr * seconds), sr);
      this.build(ctx, false);
      this.enabled = true;
      this.newTrack();
      this.nextTime = 0.05;
      this.scheduleUntil(seconds);
      return ctx.startRendering();
    }
  }

  ND.Music = Music;
  ND.makeTrack = makeTrack;
})();
