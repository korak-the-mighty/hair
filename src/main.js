/* Neon Drive — boot, fixed-step main loop and pixel-perfect presentation. */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, H } = ND;

  const params = new URLSearchParams(location.search);
  const seed = parseInt(params.get('seed') || '1985', 10);
  const debug = params.has('debug');

  const screen = document.getElementById('screen');
  const sctx = screen.getContext('2d', { alpha: false });
  const hud = document.getElementById('hud');
  const stats = document.getElementById('stats');

  let world, renderer, music, recorder;
  let paused = params.has('paused');

  // --- presentation: exact integer scale where possible, otherwise nearest
  // upscale to the next integer and a smooth downscale ("sharp bilinear").
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cw = window.innerWidth * dpr, ch = window.innerHeight * dpr;
    const s = Math.min(cw / W, ch / H);
    const exact = Math.abs(s - Math.round(s)) < 0.01 && Math.round(s) >= 1;
    const k = exact ? Math.round(s) : Math.max(1, Math.ceil(s));
    screen.width = W * k;
    screen.height = H * k;
    const cssW = (W * (exact ? k : s)) / dpr, cssH = (H * (exact ? k : s)) / dpr;
    screen.style.width = cssW + 'px';
    screen.style.height = cssH + 'px';
    screen.style.imageRendering = exact ? 'pixelated' : 'auto';
    sctx.imageSmoothingEnabled = false;
  }

  function present() {
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(renderer.scene, 0, 0, screen.width, screen.height);
    if (recorder && recorder.active) recorder.frame(renderer.scene);
  }

  // --- fixed 60 Hz simulation; dt snapped to the refresh interval to avoid
  // judder from timer noise.
  const STEP = 1000 / 60;
  let last = 0, acc = 0;
  let frames = 0, fpsT = 0, fps = 0, worst = 0, renderMs = 0;
  // performance bookkeeping (also drives adaptive quality)
  const perf = (ND.perf = { frames: 0, steps: [0, 0, 0, 0, 0, 0, 0], renderMax: 0, renderSum: 0, drops: 0, quality: 2 });
  let win = 0, winDrops = 0, winRender = 0;
  const forcedQ = params.get('q');

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    let dt = now - last;
    last = now;
    if (dt > 250) dt = STEP;
    const k = Math.round(dt / STEP);
    if (k >= 1 && Math.abs(dt - k * STEP) < 2.2) dt = k * STEP;
    if (!paused) acc += dt;
    let steps = 0;
    while (acc >= STEP - 0.01 && steps < 6) {
      world.update();
      acc -= STEP;
      steps++;
    }
    if (steps >= 6) acc = 0;
    if (steps > 0) {
      const t0 = performance.now();
      renderer.render();
      present();
      renderMs = performance.now() - t0;
      worst = Math.max(worst, renderMs);
    }
    if (!paused) {
      perf.frames++;
      perf.steps[Math.min(6, steps)]++;
      perf.renderMax = Math.max(perf.renderMax, renderMs);
      perf.renderSum += renderMs;
      if (k >= 2 && k < 10) { perf.drops++; winDrops++; }
      win++;
      winRender += renderMs;
      // adaptive quality: step detail down if this machine keeps missing frames
      if (win >= 180) {
        if (forcedQ == null && renderer.q > 0 && (winDrops > 18 || winRender / win > 11)) {
          renderer.q--;
          perf.quality = renderer.q;
          console.log('Neon Drive: quality ->', renderer.q);
        }
        win = winDrops = winRender = 0;
      }
    }
    // background generation of upcoming buildings, within the frame budget
    world.work(Math.max(1, 9 - renderMs));
    frames++;
    if (now - fpsT > 1000) {
      fps = (frames * 1000) / (now - fpsT);
      frames = 0;
      fpsT = now;
      if (debug) stats.textContent = `${fps.toFixed(0)} fps · render ${renderMs.toFixed(1)}ms · worst ${worst.toFixed(1)}ms · jobs ${world.jobs.jobs.length}`;
      worst = 0;
    }
  }

  // --- UI
  const toastEl = document.getElementById('toast');
  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }
  let hudTimer = 0;
  function showHud() {
    document.body.classList.remove('idle');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => document.body.classList.add('idle'), 2500);
  }
  function toggleFullscreen() {
    const el = document.documentElement;
    try {
      let p;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const fn = el.requestFullscreen || el.webkitRequestFullscreen;
        if (fn) p = fn.call(el);
      } else {
        const fn = document.exitFullscreen || document.webkitExitFullscreen;
        if (fn) p = fn.call(document);
      }
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* fullscreen not allowed here */ }
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    else if (e.key === ' ') { paused = !paused; e.preventDefault(); }
    else if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('nohud');
    else if (e.key === 'd' || e.key === 'D') stats.classList.toggle('show');
    else if (e.key === 'w' || e.key === 'W') { world.weather.cycle(); toast(world.weather.phase); }
    else if (e.key === 'l' || e.key === 'L') { renderer.letterOn = !renderer.letterOn; toast(renderer.letterOn ? 'letterbox on' : 'letterbox off'); }
    else if (e.key === 'g' || e.key === 'G') { renderer.grainOn = !renderer.grainOn; toast(renderer.grainOn ? 'grain on' : 'grain off'); }
    else if (e.key === 'm' || e.key === 'M') { const on = music.toggle(); soundHint(false); toast(on ? 'music on' : 'music off'); }
    else if (e.key === 'n' || e.key === 'N') { if (!music.ctx) music.start(); music.skip(); soundHint(false); toast('next track'); }
    else if (e.key === 't' || e.key === 'T') { renderer.titlesOn = !renderer.titlesOn; toast(renderer.titlesOn ? 'track titles on' : 'track titles off'); }
    else if (e.key === 'r' || e.key === 'R') toggleRecording();
    else startSound();
    showHud();
  });
  window.addEventListener('pointerdown', () => startSound());

  // --- sound starts with the first click / key press (browser autoplay rules)
  const hintEl = document.getElementById('soundhint');
  function soundHint(show) { if (hintEl) hintEl.classList.toggle('show', !!show); }
  function startSound() {
    if (!music || music.ctx || params.has('mute')) return;
    music.start();
    soundHint(false);
  }

  // --- recording
  const recEl = document.getElementById('rec');
  let recTimer = 0;
  async function toggleRecording() {
    if (!recorder) return;
    if (window.ND_PREVIEW) { toast('record from dist/neon-drive.html on your computer'); return; }
    if (recorder.active) {
      recorder.stop();
      recEl.classList.remove('show');
      clearInterval(recTimer);
      return;
    }
    startSound();
    try {
      const ok = await recorder.start(music, renderer.scene);
      if (!ok) return;
      recEl.classList.add('show');
      recTimer = setInterval(() => {
        const s = Math.floor(recorder.elapsed);
        recEl.textContent = `REC ${String(Math.floor(s / 3600)).padStart(1, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }, 250);
    } catch (e) {
      toast(e.message || 'recording failed');
    }
  }
  window.addEventListener('mousemove', showHud);
  screen.addEventListener('dblclick', toggleFullscreen);
  window.addEventListener('resize', resize);

  function boot() {
    const t0 = performance.now();
    world = new ND.World(seed, { weather: params.get('weather') });
    renderer = new ND.Renderer(world, { quality: params.get('q') != null ? +params.get('q') : undefined });
    ND.world = world;
    ND.renderer = renderer;
    music = ND.music = new ND.Music(seed, { style: params.get('style') });
    recorder = new ND.Recorder(params.get('rec') === '4k' ? 6 : params.get('rec') === '1440p' ? 4 : 3);
    recorder.onsaved = (name, streamed) => toast(streamed ? 'saved ' + name : 'downloading ' + name);
    // big moments: a drop during a storm brings the lightning with it
    ND.bus.on('drop', () => {
      const wx = world.weather;
      if (wx.v.storm > 0.5 && !wx.bolt) wx.strike();
    });
    soundHint(!params.has('mute'));
    resize();
    renderer.render();
    present();
    document.body.classList.add('ready');
    if (debug) stats.classList.add('show');
    console.log(`Neon Drive ready in ${(performance.now() - t0).toFixed(0)} ms`);
    showHud();
    requestAnimationFrame(frame);
  }

  // Let the loading text paint before the (synchronous) world build.
  requestAnimationFrame(() => setTimeout(boot, 30));
})();
