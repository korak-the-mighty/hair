#!/usr/bin/env node
/* Generates the Neon Drive vocal pack with ElevenLabs.
 *
 *   node tools/make-vocals.js [--force] [--only id,id]
 *
 * The key comes from ELEVENLABS_API_KEY, or, when it is stored as an API
 * credential in the cloud environment, the egress proxy attaches it to
 * requests for api.elevenlabs.io and the script never sees it.
 *
 * Reads tools/vocals.json and writes assets/vocals/<id>.mp3 plus
 * assets/vocals/pack.js (the clips as base64, so the page also works when
 * opened straight from disk). Hooks are text-to-speech; chops are sung
 * syllables from the Music API, with sound-generation and v3 TTS fallbacks;
 * robot lines are plain, steady speech that the page's vocoder sings; driver
 * lines are the hero driver's commentary, tagged by the moment he says them.
 * Requests go through curl so any HTTPS proxy in the environment is honoured;
 * the key is passed to curl on stdin, never on the command line.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'vocals.json'), 'utf8'));
const outDir = path.join(root, 'assets', 'vocals');
const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(',')) : null;

const KEY = process.env.ELEVENLABS_API_KEY || '';
const API = 'https://api.elevenlabs.io';

// curl wrapper: returns a Buffer, throws with the API's error text on failure
function call(method, url, body, accept = 'application/json') {
  const cfg = [`header = "Accept: ${accept}"`];
  if (KEY) cfg.push(`header = "xi-api-key: ${KEY}"`);
  if (body) cfg.push('header = "Content-Type: application/json"');
  const bodyFile = body ? path.join(outDir, '.req.json') : null;
  if (body) fs.writeFileSync(bodyFile, JSON.stringify(body));
  const argv = ['-sS', '--fail-with-body', '-X', method, '-K', '-', url, '--max-time', '180'];
  if (body) argv.push('--data-binary', '@' + bodyFile);
  try {
    return execFileSync('curl', argv, { input: cfg.join('\n'), maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const out = (e.stdout && e.stdout.toString()) || '';
    const err = (e.stderr && e.stderr.toString()) || e.message;
    if (/CONNECT|\b403\b.*tunnel|Proxy/i.test(err) && !out) throw new Error('The network policy blocked api.elevenlabs.io. Allow that domain under Network access in the environment settings.');
    if (/\b401\b|invalid_api_key|missing.*api.key/i.test(out)) throw new Error('ElevenLabs rejected the request: no valid key. Add it under API credentials (for api.elevenlabs.io) or as ELEVENLABS_API_KEY in the environment settings, then start a new session.');
    throw new Error(`${method} ${url.replace(API, '')} failed: ${(out || err).slice(0, 400)}`);
  } finally {
    if (bodyFile && fs.existsSync(bodyFile)) fs.unlinkSync(bodyFile);
  }
}
const json = (buf) => JSON.parse(buf.toString('utf8'));
const isAudio = (buf) => buf.length > 2000 && (buf.slice(0, 3).toString() === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0));

function pickVoices() {
  const list = json(call('GET', `${API}/v1/voices`)).voices || [];
  const out = {};
  for (const [role, v] of Object.entries(spec.voices)) {
    if (process.env[v.env]) { out[role] = process.env[v.env]; continue; }
    const hit = v.prefer.map((n) => list.find((x) => x.name && x.name.toLowerCase().startsWith(n.toLowerCase()))).find(Boolean);
    const gender = role === 'her' ? 'female' : 'male';
    const fallback = list.find((x) => x.labels && x.labels.gender === gender) || list[0];
    const voice = hit || fallback;
    if (!voice) throw new Error('No voices available on this ElevenLabs account.');
    out[role] = voice.voice_id;
    console.log(`voice ${role}: ${voice.name} (${voice.voice_id})`);
  }
  return out;
}

const STYLES = {
  whisper: { tag: '[whispers] ', settings: { stability: 0.3, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true } },
  breathy: { tag: '[softly] ', settings: { stability: 0.35, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true } },
  low: { tag: '', settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true } },
  // even, clearly articulated delivery: the vocoder supplies the pitch
  robot: { tag: '', v3: 1.0, settings: { stability: 0.95, similarity_boost: 0.8, style: 0, use_speaker_boost: true } },
  // the driver: thrilled, smooth, or leaning over to the camera
  hype: { tag: '[excited] ', v3: 0.0, settings: { stability: 0.3, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true } },
  cool: { tag: '[smooth, confident] ', v3: 0.5, settings: { stability: 0.45, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true } },
  aside: { tag: '[playfully, leaning in] ', v3: 0.5, settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true } },
};

function tts(voiceId, text, style) {
  const st = STYLES[style] || STYLES.breathy;
  const url = `${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  // v3 understands audio tags like [whispers]; fall back to multilingual v2 without them
  try {
    const buf = call('POST', url, { text: st.tag + text, model_id: 'eleven_v3', voice_settings: { stability: st.v3 != null ? st.v3 : 0.5, similarity_boost: st.settings.similarity_boost } }, 'audio/mpeg');
    if (isAudio(buf)) return buf;
  } catch (e) {
    console.warn('  v3 unavailable, using multilingual v2:', e.message.slice(0, 120));
  }
  return call('POST', url, { text, model_id: 'eleven_multilingual_v2', voice_settings: st.settings }, 'audio/mpeg');
}

function chop(c, voices) {
  const tries = [
    () => call('POST', `${API}/v1/music?output_format=mp3_44100_128`, { prompt: c.prompt, music_length_ms: 4000, model_id: 'music_v1' }, 'audio/mpeg'),
    () => call('POST', `${API}/v1/sound-generation?output_format=mp3_44100_128`, { text: c.prompt, duration_seconds: 3, prompt_influence: 0.75 }, 'audio/mpeg'),
    () => call('POST', `${API}/v1/text-to-speech/${voices.her}?output_format=mp3_44100_128`, { text: `[sings] ${c.syllable.replace(/(.)$/, '$1$1$1$1')}...`, model_id: 'eleven_v3' }, 'audio/mpeg'),
  ];
  for (const t of tries) {
    try {
      const buf = t();
      if (isAudio(buf)) return buf;
    } catch (e) {
      console.warn('  ', e.message.slice(0, 160));
    }
  }
  throw new Error(`could not generate chop "${c.id}"`);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const voices = pickVoices();
  const jobs = [
    ...spec.hooks.map((h) => ({ ...h, kind: 'hook' })),
    ...spec.chops.map((c) => ({ ...c, kind: 'chop', tags: ['drop'] })),
    ...(spec.robot || []).map((v) => ({ ...v, kind: 'robot', style: 'robot' })),
    ...(spec.driver || []).map((v) => ({ ...v, kind: 'driver', voice: 'driver' })),
  ].filter((j) => !only || only.has(j.id));
  for (const j of jobs) {
    const file = path.join(outDir, `${j.id}.mp3`);
    if (fs.existsSync(file) && !force) { console.log(`skip  ${j.id} (exists)`); continue; }
    process.stdout.write(`make  ${j.kind} ${j.id} ... `);
    const buf = j.kind === 'chop' ? chop(j, voices) : tts(voices[j.voice], j.text, j.style);
    fs.writeFileSync(file, buf);
    console.log(`${(buf.length / 1024).toFixed(0)} KB`);
  }
  // pack everything that exists into a script the page can load from disk
  const clips = [];
  for (const h of spec.hooks) {
    const f = path.join(outDir, `${h.id}.mp3`);
    if (fs.existsSync(f)) clips.push({ id: h.id, kind: 'hook', text: h.text, tags: h.tags, voice: h.voice, data: fs.readFileSync(f).toString('base64') });
  }
  for (const c of spec.chops) {
    const f = path.join(outDir, `${c.id}.mp3`);
    if (fs.existsSync(f)) clips.push({ id: c.id, kind: 'chop', text: c.syllable, tags: ['drop'], data: fs.readFileSync(f).toString('base64') });
  }
  for (const v of spec.robot || []) {
    const f = path.join(outDir, `${v.id}.mp3`);
    if (fs.existsSync(f)) clips.push({ id: v.id, kind: 'robot', text: v.text, voice: v.voice, tags: v.tags || [], data: fs.readFileSync(f).toString('base64') });
  }
  for (const v of spec.driver || []) {
    const f = path.join(outDir, `${v.id}.mp3`);
    if (fs.existsSync(f)) clips.push({ id: v.id, kind: 'driver', text: v.text.replace(/\[[^\]]*\]\s*/g, ''), tags: v.tags, data: fs.readFileSync(f).toString('base64') });
  }
  const pack = `/* Generated by tools/make-vocals.js — ElevenLabs vocal pack for the soundtrack. */\nwindow.ND_VOCALS = ${JSON.stringify({ made: new Date().toISOString(), clips })};\n`;
  fs.writeFileSync(path.join(outDir, 'pack.js'), pack);
  console.log(`pack  ${clips.length} clips -> assets/vocals/pack.js (${(pack.length / 1024).toFixed(0)} KB)`);
}

try {
  main();
} catch (e) {
  console.error('\n' + e.message);
  process.exit(1);
}
