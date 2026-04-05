// ─── Generic single-file sound player ────────────────────────────────────────

export class SoundPlayer {
  constructor(url) {
    this._url      = url;
    this._audioMgr = null;
    this._buffer   = null;
    this._loaded   = false;
  }

  /**
   * @param {import('./utils.js').AudioManager} audioMgr
   */
  init(audioMgr) {
    if (this._loaded || !audioMgr) return;
    this._audioMgr = audioMgr;
    const ctx = audioMgr.getCtx();
    if (!ctx) return;
    fetch(this._url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => { this._buffer = decoded; this._loaded = true; })
      .catch(() => {});
  }

  play(volume = 0.7, playbackRate = 1.0) {
    if (!this._loaded || !this._audioMgr) return;
    const ctx = this._audioMgr.getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = this._buffer;
    source.playbackRate.value = playbackRate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this._audioMgr.getMasterDest() || ctx.destination);
    source.start();
  }
}

// ─── Fart Sound Manager ──────────────────────────────────────────────────────

const FART_SOUND_FILES = [
  'assets/sounds/awful.mp3',
  'assets/sounds/super_blast.mp3',
  'assets/sounds/6_of_10.mp3',
  'assets/sounds/voice_09-03-2026_01-07-01.mp3',
  'assets/sounds/voice_28-03-2026_13-55-38.mp3',
  'assets/sounds/voice_28-03-2026_13-59-31.mp3',
  'assets/sounds/voice_28-03-2026_14-05-59.mp3',
];

export class FartSoundManager {
  constructor() {
    this._audioMgr = null;
    this._buffers  = [];
    this._loaded   = false;
  }

  /**
   * Preload all fart sound files. Must be called after an AudioContext exists
   * (i.e. after a user gesture has unlocked the browser's audio policy).
   * @param {import('./utils.js').AudioManager} audioMgr
   */
  init(audioMgr) {
    if (this._loaded || this._buffers.length > 0 || !audioMgr) return;
    this._audioMgr = audioMgr;
    const ctx = audioMgr.getCtx();
    if (!ctx) return;

    const promises = FART_SOUND_FILES.map(url =>
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then(buf => ctx.decodeAudioData(buf))
        .catch(() => null) // skip files that fail to load
    );

    Promise.all(promises).then(buffers => {
      this._buffers = buffers.filter(Boolean);
      this._loaded  = this._buffers.length > 0;
    });
  }

  /**
   * Play a random fart sound with slight pitch and volume variation.
   * Overlapping calls are fully supported – each call creates an independent source.
   */
  playRandom() {
    if (!this._loaded || this._buffers.length === 0 || !this._audioMgr) return;
    const ctx = this._audioMgr.getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const buf    = this._buffers[Math.floor(Math.random() * this._buffers.length)];
    const source = ctx.createBufferSource();
    source.buffer = buf;

    // Slight random pitch variation to keep repeated sounds from feeling stale
    source.playbackRate.value = 0.88 + Math.random() * 0.26; // 0.88 – 1.14×

    // Volume: balanced so overlapping sounds don't clip harshly
    const gain       = ctx.createGain();
    gain.gain.value  = 0.45 + Math.random() * 0.2; // 0.45 – 0.65

    source.connect(gain);
    gain.connect(this._audioMgr.getMasterDest() || ctx.destination);
    source.start();
  }
}
