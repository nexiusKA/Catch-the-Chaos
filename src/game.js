import { ParticleSystem, ScreenShake, AudioManager, PopupText, rand } from './utils.js';
import { FartSoundManager, SoundPlayer } from './soundManager.js';
import { Player } from './player.js';
import { Spawner } from './spawner.js';
import { InputHandler } from './input.js';
import { UI } from './ui.js';
import { DROP_TYPES } from './drop.js';

// ─── Game states ─────────────────────────────────────────────────────────────

export const STATES = Object.freeze({
  MENU:      'menu',
  PLAYING:   'playing',
  GAME_OVER: 'game_over',
});

// ─── Game class ───────────────────────────────────────────────────────────────

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.width  = canvas.width;
    this.height = canvas.height;

    // Persistent subsystems
    this.input     = new InputHandler();
    this.audio     = new AudioManager();
    this.fartSound = new FartSoundManager();
    this.ui        = new UI(this);

    // Special-event sound players (loaded after first user gesture)
    this.sndKuhpop   = new SoundPlayer('assets/sounds/platsch_kuhpop.mp3');
    this.sndPiss     = new SoundPlayer('assets/sounds/piss.mp3');

    // Touch-to-start / touch-to-restart support for mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.audio._getCtx();
      const touch = e.touches[0];
      const pos   = this._canvasPos(touch.clientX, touch.clientY);
      if (this.state === STATES.MENU) {
        if (this._hitSoundBtn(pos)) { this.audio.toggleMute(); return; }
        if (this._hitSlider(pos))   { this._sliderDrag = true; this._setVolumeFromX(pos.x); return; }
        if (this._hitStartBtn(pos)) {
          this.fartSound.init(this.audio);
          this.sndKuhpop.init(this.audio);
          this.sndPiss.init(this.audio);
          this.startGame();
        }
      } else if (this.state === STATES.GAME_OVER) {
        this.startGame();
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (this._sliderDrag) {
        e.preventDefault();
        const pos = this._canvasPos(e.touches[0].clientX, e.touches[0].clientY);
        this._setVolumeFromX(pos.x);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', () => { this._sliderDrag = false; });

    // Mouse interactions for sound controls on the menu
    this._sliderDrag = false;
    canvas.addEventListener('mousedown', (e) => {
      if (this.state !== STATES.MENU) return;
      const pos = this._canvasPos(e.clientX, e.clientY);
      if (this._hitSoundBtn(pos)) { this.audio._getCtx(); this.audio.toggleMute(); return; }
      if (this._hitSlider(pos))   { this._sliderDrag = true; this._setVolumeFromX(pos.x); return; }
      if (this._hitStartBtn(pos)) {
        this.audio._getCtx();
        this.fartSound.init(this.audio);
        this.sndKuhpop.init(this.audio);
        this.sndPiss.init(this.audio);
        this.startGame();
      }
    });
    canvas.addEventListener('mousemove', (e) => {
      if (this._sliderDrag && this.state === STATES.MENU) {
        this._setVolumeFromX(this._canvasPos(e.clientX, e.clientY).x);
      }
    });
    canvas.addEventListener('mouseup',    () => { this._sliderDrag = false; });
    canvas.addEventListener('mouseleave', () => { this._sliderDrag = false; });

    // Session-specific subsystems (re-created on restart)
    this.player   = null;
    this.spawner  = null;
    this.particles = new ParticleSystem();
    this.shake     = new ScreenShake();
    this.popups    = [];

    // Scores / state
    this.state         = STATES.MENU;
    this.score         = 0;
    this.lives         = 3;
    this.combo         = 0;
    this.maxCombo      = 0;
    this.multiplier    = 1;
    this.elapsed       = 0;
    this.difficultyLevel = 1;
    this.highScore     = parseInt(localStorage.getItem('catchChaosHi') || '0', 10);

    // Fever mode
    this.feverMode  = false;
    this.feverMeter = 0;
    this.feverMax   = 12;

    // Piss event
    this.pissEventActive    = false;
    this.pissEventTimer     = 0;
    this.pissEventDuration  = 18; // seconds
    this.popsCaught         = 0;
    this.pissEventThreshold = 10; // set randomly on startGame

    // Tornado event
    this.tornadoEventActive   = false;
    this.tornadoEventTimer    = 0;
    this.tornadoEventDuration = 14;
    this.tornadoPopsCounter   = 0;
    this.tornadoThreshold     = 15;

    // Golden Rain event
    this.goldenRainActive   = false;
    this.goldenRainTimer    = 0;
    this.goldenRainDuration = 12;

    // Menu decoration spawner (for background eye-candy)
    this._menuSpawner  = new Spawner(this.width, this.height);
    this._menuSpawner.spawnInterval = 1.2;

    // Loop control
    this._lastTime = null;
    this._raf      = null;
    this._t        = 0; // monotonic timer for animations
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /** Start / restart a new game session. */
  startGame() {
    this.state          = STATES.PLAYING;
    this.score          = 0;
    this.lives          = 3;
    this.combo          = 0;
    this.maxCombo       = 0;
    this.multiplier     = 1;
    this.elapsed        = 0;
    this.difficultyLevel = 1;
    this.feverMode      = false;
    this.feverMeter     = 0;
    this.particles      = new ParticleSystem();
    this.shake          = new ScreenShake();
    this.popups         = [];

    // Piss event reset
    this.pissEventActive   = false;
    this.pissEventTimer    = 0;
    this.popsCaught        = 0;
    this.pissEventThreshold = Math.floor(Math.random() * 21) + 10; // 10–30

    // Tornado event reset
    this.tornadoEventActive  = false;
    this.tornadoEventTimer   = 0;
    this.tornadoPopsCounter  = 0;
    this.tornadoThreshold    = Math.floor(Math.random() * 16) + 15; // 15–30

    // Golden Rain reset
    this.goldenRainActive = false;
    this.goldenRainTimer  = 0;

    this.player  = new Player(this.width, this.height);
    this.spawner = new Spawner(this.width, this.height, this.fartSound, this.sndPiss);
  }

  /** Kick off the animation loop (called once from main.js). */
  run() {
    this._lastTime = performance.now();
    const tick = (ts) => {
      const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
      this._lastTime = ts;
      this._t += dt;
      this._update(dt);
      this._render();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  // ─── Sound-controls helpers ───────────────────────────────────────────────────

  /** Convert client (screen) coordinates to logical canvas coordinates. */
  _canvasPos(clientX, clientY) {
    const rect   = this.canvas.getBoundingClientRect();
    const cw     = this.canvas.clientWidth  || this.width;
    const ch     = this.canvas.clientHeight || this.height;
    return {
      x: (clientX - rect.left) * (this.width  / cw),
      y: (clientY - rect.top)  * (this.height / ch),
    };
  }

  _hitStartBtn(pos) {
    const b = this.ui.startBtnBounds;
    if (!b) return false;
    return pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h;
  }

  _hitSoundBtn(pos) {
    const b = this.ui.soundBtnBounds;
    if (!b) return false;
    return pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h;
  }

  _hitSlider(pos) {
    const s    = this.ui.sliderBounds;
    if (!s) return false;
    const SLOP = 12; // extra vertical hit area for easier touch targeting
    return pos.x >= s.x && pos.x <= s.x + s.w && pos.y >= s.y - SLOP && pos.y <= s.y + s.h + SLOP;
  }

  _setVolumeFromX(x) {
    const s = this.ui.sliderBounds;
    if (!s) return;
    this.audio.setVolume(Math.max(0, Math.min(1, (x - s.x) / s.w)));
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  _update(dt) {
    this.shake.update(dt);

    if (this.state === STATES.MENU) {
      this._menuSpawner.update(dt, 1, false, null);
      // Remove drops that fell off screen
      this._menuSpawner.drops = this._menuSpawner.drops.filter(d => !d.missed && !d.caught);

      if (this.input.isDown('Space', 'Enter')) {
        this.audio._getCtx(); // unlock AudioContext on first interaction
        this.fartSound.init(this.audio); // preload fart sounds
        this.sndKuhpop.init(this.audio);
        this.sndPiss.init(this.audio);
        this.startGame();
      }
      return;
    }

    if (this.state === STATES.GAME_OVER) {
      if (this.input.isDown('Space', 'KeyR', 'Enter')) {
        this.startGame();
      }
      return;
    }

    // ── PLAYING ──

    this.elapsed += dt;
    this._updateDifficulty();

    // Player
    this.player.update(dt, this.input);

    // Spawner
    const slowFactor   = this.player.hasPowerup('slow_mo') ? 0.35 : 1;
    const magnetActive = this.player.hasPowerup('magnet');
    const mc           = this.player.getCenter();
    this.spawner.update(dt, slowFactor, magnetActive, mc);

    // Collisions & miss processing
    this._processDrops();

    // Fever meter decay
    if (this.feverMode) {
      this.feverMeter = Math.max(0, this.feverMeter - dt * 1.6);
      if (this.feverMeter === 0) {
        this.feverMode  = false;
        this.multiplier = this.player.hasPowerup('multiplier') ? 2 : 1;
      }
    }

    // Piss event countdown
    if (this.pissEventActive) {
      this.pissEventTimer -= dt;
      if (this.pissEventTimer <= 0) {
        this._endPissEvent();
      }
    }

    // Tornado event countdown
    this.spawner.tornadoMode = this.tornadoEventActive;
    if (this.tornadoEventActive) {
      this.tornadoEventTimer -= dt;
      if (this.tornadoEventTimer <= 0) {
        this._endTornadoEvent();
      }
    }

    // Golden Rain countdown
    this.spawner.goldenRainMode = this.goldenRainActive;
    if (this.goldenRainActive) {
      this.goldenRainTimer -= dt;
      if (this.goldenRainTimer <= 0) {
        this._endGoldenRain();
      }
    }

    // Particles & popups
    this.particles.update(dt);
    this.popups = this.popups.filter(p => { p.update(dt); return !p.isDead(); });
  }

  _updateDifficulty() {
    const newLevel = Math.floor(this.elapsed / 20) + 1;
    if (newLevel !== this.difficultyLevel) {
      this.difficultyLevel = newLevel;
      this.spawner.setDifficulty(this.difficultyLevel);
    }
  }

  // ─── Collision & drop processing ──────────────────────────────────────────────

  _processDrops() {
    const catchBox = this.player.getCatchBox();

    for (const drop of this.spawner.drops) {
      if (drop.caught) continue;

      if (!drop.missed) {
        const db = drop.getCatchBox();
        if (this._overlaps(catchBox, db)) {
          drop.caught = true;
          this._onCatch(drop);
        }
      } else {
        // Fell off-screen without being caught
        drop.caught = true; // mark processed
        if (drop.type === DROP_TYPES.GOOD) {
          this._onMissedGood(drop);
        }
      }
    }

    // Clean up processed drops
    this.spawner.drops = this.spawner.drops.filter(d => !d.caught);
  }

  _overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ─── Catch handlers ──────────────────────────────────────────────────────────

  _onCatch(drop) {
    const px = drop.x;
    const py = drop.y;

    if (drop.type === DROP_TYPES.GOOD) {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // Score
      const pts = drop.points * this.multiplier * (this.feverMode ? 2 : 1);
      this.score += pts;

      // Fever meter charge
      this.feverMeter = Math.min(this.feverMax, this.feverMeter + 1);
      if (this.feverMeter >= this.feverMax && !this.feverMode) {
        this._activateFever();
      }

      // Particles & popup
      this.particles.burst(px, py, ['#FFD700', '#7FFF00', '#00FFCC', '#FF69B4'], 14);
      this.sndKuhpop.play(0.65, 0.9 + Math.random() * 0.2);

      const label = this.combo > 1 ? `×${this.combo}  +${pts}` : `+${pts}`;
      const col   = this.combo >= 10 ? '#FF6600' : this.combo >= 5 ? '#FFD700' : '#FFFFFF';
      const sz    = this.combo >= 5 ? 26 : 20;
      this.popups.push(new PopupText(label, px, py - 20, col, sz));

      if (this.combo > 0 && this.combo % 5 === 0) {
        this.shake.trigger(5, 0.28);
        this.audio.playComboMilestone();
      }

      this.player.squishCatch();
      this.player.triggerStink();

      // Track pops and check for piss event trigger
      if (!this.pissEventActive) {
        this.popsCaught++;
        if (this.popsCaught >= this.pissEventThreshold) {
          this._triggerPissEvent();
        }
      }

      // Tornado event trigger (independent counter, not during piss/golden rain)
      if (!this.pissEventActive && !this.tornadoEventActive && !this.goldenRainActive) {
        this.tornadoPopsCounter++;
        if (this.tornadoPopsCounter >= this.tornadoThreshold) {
          this._triggerTornadoEvent();
        }
      }

      // Golden Rain trigger on combo milestone (every 15 consecutive catches)
      if (this.combo > 0 && this.combo % 15 === 0 &&
          !this.goldenRainActive && !this.pissEventActive && !this.tornadoEventActive) {
        this._triggerGoldenRain();
      }

    } else if (drop.type === DROP_TYPES.PISS) {
      // Catch during piss event — ×3 bonus points
      const pts = drop.points * 3;
      this.score += pts;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      this.particles.burst(px, py, ['#FFD700', '#FFE840', '#FFFF80', '#FFFFC0'], 16);
      this.audio.playPissCatch();
      this.popups.push(new PopupText(`×3  +${pts}`, px, py - 20, '#FFE840', 24));
      this.player.squishCatch();

    } else if (drop.type === DROP_TYPES.GOLDEN) {
      // Golden Rain drop — high value, charges fever faster
      const pts = drop.points * this.multiplier;
      this.score += pts;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      this.feverMeter = Math.min(this.feverMax, this.feverMeter + 2);
      if (this.feverMeter >= this.feverMax && !this.feverMode) {
        this._activateFever();
      }

      this.particles.burst(px, py, ['#FFD700', '#FFEE00', '#FFF0A0', '#FFFFFF'], 20);
      this.audio.playSpecial();
      this.popups.push(new PopupText(`⭐ +${pts}`, px, py - 20, '#FFD700', 26));
      this.player.squishCatch();

    } else if (drop.type === DROP_TYPES.BAD) {
      if (this.player.hasPowerup('ghost')) {
        // Ghost: phase right through the bad drop
        this.particles.burst(px, py, ['#FFFFFF', '#AAAAFF', '#DDDDFF'], 10);
        this.popups.push(new PopupText('👻 PHASED!', px, py - 20, '#DDDDFF', 22));
        this.audio.playCatch();
      } else if (this.player.hasPowerup('shield')) {
        // Shield absorbs it
        delete this.player.powerups['shield'];
        this.particles.burst(px, py, ['#00FFFF', '#0088FF', '#FFFFFF'], 14);
        this.popups.push(new PopupText('BLOCKED! 🛡', px, py - 20, '#00FFFF', 24));
        this.shake.trigger(4, 0.2);
        this.audio.playCatch();
      } else {
        this._loseLife(px, py);
      }

    } else {
      // SPECIAL powerup drop
      if (drop.effect === 'extra_life') {
        // Instant +1 life — not a timed perk
        this.lives = Math.min(this.lives + 1, 6);
        this.particles.burst(px, py, ['#FF4488', '#FF88BB', '#FFFFFF', '#FFD700'], 22);
        this.shake.trigger(3, 0.15);
        this.audio.playSpecial();
        this.popups.push(new PopupText('❤ EXTRA LIFE!', px, py - 20, '#FF4488', 28));
        return;
      }

      this.player.applyPowerup(drop.effect);
      if (drop.effect === 'multiplier') {
        this.multiplier = 2;
      }
      this.particles.burst(px, py, ['#FFD700', '#FFFFFF', '#FF69B4', '#00FFCC'], 20);
      this.shake.trigger(4, 0.22);
      this.audio.playSpecial();

      const names = {
        multiplier:  '×2  SCORE!',
        wide_bucket: 'BIG BUCKET!',
        slow_mo:     'SLOW-MO!',
        magnet:      'MAGNET!',
        shield:      'SHIELD UP!',
        speed_boost: 'TURBO! ⚡',
        ghost:       'GHOST! 👻',
      };
      this.popups.push(new PopupText(names[drop.effect] || 'BONUS!', px, py - 20, '#FFD700', 26));
    }
  }

  _onMissedGood(drop) {
    if (this.combo > 0) {
      this.combo = 0;
      this.popups.push(new PopupText('MISSED!', drop.x, this.height - 90, '#FF8888', 20));
    }
    // Gently shrink fever meter
    this.feverMeter = Math.max(0, this.feverMeter - 0.5);
  }

  _loseLife(px, py) {
    this.lives--;
    this.combo      = 0;
    this.feverMode  = false;
    this.multiplier = 1;
    this.feverMeter = Math.max(0, this.feverMeter - 4);

    this.particles.burst(px, py, ['#FF2222', '#FF6600', '#880000'], 22);
    this.shake.trigger(14, 0.5);
    this.audio.playBadCatch();
    this.popups.push(new PopupText('OUCH! 💥', px, py - 20, '#FF2222', 30));
    this.player.squishHurt();

    if (this.lives <= 0) {
      this._triggerGameOver();
    }
  }

  _triggerPissEvent() {
    this.pissEventActive  = true;
    this.pissEventTimer   = this.pissEventDuration;
    this.spawner.pissMode = true;
    this.spawner.drops    = []; // clear existing drops
    this.player.pissModeActive = true;

    this.shake.trigger(8, 0.45);
    this.particles.burst(this.width / 2, this.height / 2,
      ['#FFD700', '#FFE840', '#FFFF80', '#FFFFF0'], 28);
    this.popups.push(
      new PopupText('🍵 PISS EVENT! 🍵', this.width / 2, this.height / 2, '#FFE840', 36)
    );
  }

  _endPissEvent() {
    this.pissEventActive  = false;
    this.spawner.pissMode = false;
    this.spawner.drops    = []; // clear piss drops
    this.player.pissModeActive = false;
    // Set a new threshold for the next piss event
    this.popsCaught        = 0;
    this.pissEventThreshold = Math.floor(Math.random() * 21) + 10; // 10–30

    this.popups.push(
      new PopupText('Back to normal…', this.width / 2, this.height / 2 + 40, '#AAAAFF', 22)
    );
  }

  _triggerTornadoEvent() {
    this.tornadoEventActive  = true;
    this.tornadoEventTimer   = this.tornadoEventDuration;
    this.spawner.tornadoMode = true;

    this.shake.trigger(10, 0.5);
    this.particles.burst(this.width / 2, this.height / 2,
      ['#8844FF', '#AA66FF', '#DDBBFF', '#FFFFFF'], 26);
    this.popups.push(
      new PopupText('💨 TORNADO! 💨', this.width / 2, this.height / 2, '#BB88FF', 38)
    );
  }

  _endTornadoEvent() {
    this.tornadoEventActive  = false;
    this.spawner.tornadoMode = false;
    this.tornadoPopsCounter  = 0;
    this.tornadoThreshold    = Math.floor(Math.random() * 16) + 15; // 15–30

    this.popups.push(
      new PopupText('Storm passed…', this.width / 2, this.height / 2 + 40, '#AAAAFF', 22)
    );
  }

  _triggerGoldenRain() {
    this.goldenRainActive       = true;
    this.goldenRainTimer        = this.goldenRainDuration;
    this.spawner.goldenRainMode = true;
    this.spawner.drops          = []; // clear existing drops for pure golden rain

    this.shake.trigger(8, 0.4);
    this.particles.burst(this.width / 2, this.height / 2,
      ['#FFD700', '#FFEE00', '#FFF0A0', '#FFFFFF'], 30);
    this.popups.push(
      new PopupText('⭐ GOLDEN RAIN! ⭐', this.width / 2, this.height / 2, '#FFD700', 36)
    );
  }

  _endGoldenRain() {
    this.goldenRainActive       = false;
    this.spawner.goldenRainMode = false;
    this.spawner.drops          = [];

    this.popups.push(
      new PopupText('Rain dried up…', this.width / 2, this.height / 2 + 40, '#FFCC44', 22)
    );
  }

  _activateFever() {
    this.feverMode  = true;
    this.multiplier = this.player.hasPowerup('multiplier') ? 4 : 3;
    this.audio.playFeverActivate();
    this.shake.trigger(7, 0.4);
    this.popups.push(
      new PopupText('🔥 FEVER MODE! 🔥', this.width / 2, this.height / 2, '#FF6600', 38)
    );
  }

  _triggerGameOver() {
    this.state = STATES.GAME_OVER;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('catchChaosHi', String(this.highScore));
    }
    this.shake.trigger(16, 0.8);
    this.audio.playMiss();
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  _render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.shake.offsetX, this.shake.offsetY);

    this._drawBackground(ctx);

    if (this.state === STATES.MENU) {
      // Decorative drops in background
      for (const d of this._menuSpawner.drops) d.draw(ctx);
      this._menuSpawner.drawMachines(ctx);
      this.ui.drawMenu(ctx, this._t);

    } else {
      // Game world
      this.spawner.drawMachines(ctx);
      for (const d of this.spawner.drops) d.draw(ctx);
      this.player.draw(ctx);
      this.particles.draw(ctx);
      for (const p of this.popups) p.draw(ctx);

      this.ui.drawHUD(ctx);

      if (this.feverMode) this._drawFeverOverlay(ctx);
      if (this.pissEventActive) this._drawPissOverlay(ctx);
      if (this.tornadoEventActive) this._drawTornadoOverlay(ctx);
      if (this.goldenRainActive) this._drawGoldenRainOverlay(ctx);
      if (this.state === STATES.GAME_OVER) this.ui.drawGameOver(ctx, this._t);
    }

    ctx.restore();
  }

  _drawBackground(ctx) {
    const W = this.width;
    const H = this.height;

    // Gradient sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (this.pissEventActive) {
      sky.addColorStop(0, '#2a2800');
      sky.addColorStop(1, '#1a1800');
    } else if (this.tornadoEventActive) {
      sky.addColorStop(0, '#1a0a2e');
      sky.addColorStop(1, '#280a3a');
    } else if (this.goldenRainActive) {
      sky.addColorStop(0, '#2a2200');
      sky.addColorStop(1, '#1a1600');
    } else if (this.feverMode) {
      sky.addColorStop(0, '#330022');
      sky.addColorStop(1, '#110033');
    } else {
      sky.addColorStop(0, '#1a1a2e');
      sky.addColorStop(0.55, '#16213e');
      sky.addColorStop(1,   '#0f3460');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Static stars (deterministic positions)
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let i = 0; i < 32; i++) {
      const sx = ((i * 139 + 47) % W);
      const sy = ((i * 101 + 17) % (H * 0.68));
      const sr = 0.8 + (i % 3) * 0.55;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Machine platform shelf
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(0, 0, W, 66);
    ctx.fillStyle = '#3a3a6a';
    ctx.fillRect(0, 64, W, 4);

    // Cartoon toilet + person silhouettes (one per machine slot)
    this._drawToiletRow(ctx, W);

    // Ground
    ctx.fillStyle = '#1a5a1a';
    ctx.fillRect(0, H - 32, W, 32);
    ctx.fillStyle = '#2a8a2a';
    ctx.fillRect(0, H - 32, W, 5);
  }

  /** Draw a row of 5 simplified cartoon toilet silhouettes at the top shelf. */
  _drawToiletRow(ctx, W) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const mx = Math.round((W / count) * (i + 0.5));
      ctx.save();
      ctx.translate(mx, 66); // bottom of shelf
      ctx.fillStyle = '#10102a';

      // Toilet tank (tall rectangle at back)
      ctx.fillRect(-9, -46, 18, 26);

      // Toilet bowl (oval)
      ctx.beginPath();
      ctx.ellipse(0, -22, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pedestal
      ctx.fillRect(-7, -14, 14, 10);

      // Person body (rounded blob sitting on bowl)
      ctx.beginPath();
      ctx.arc(1, -36, 11, 0, Math.PI * 2);
      ctx.fill();

      // Person head
      ctx.beginPath();
      ctx.arc(1, -51, 8, 0, Math.PI * 2);
      ctx.fill();

      // Dangling legs
      ctx.fillRect(-13, -25, 6, 12);
      ctx.fillRect(7,   -25, 6, 12);

      // Tiny feet
      ctx.beginPath();
      ctx.ellipse(-10, -13, 5, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(10, -13, 5, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  _drawFeverOverlay(ctx) {
    const t = this._t;
    ctx.save();
    ctx.globalAlpha = 0.07 + Math.sin(t * 12) * 0.04;
    ctx.fillStyle   = '#FF6600';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#FF6600';
    ctx.lineWidth   = 6;
    ctx.globalAlpha = 0.45 + Math.sin(t * 10) * 0.3;
    ctx.strokeRect(3, 3, this.width - 6, this.height - 6);
    ctx.restore();
  }

  _drawTornadoOverlay(ctx) {
    const t   = this._t;
    const pct = Math.max(0, this.tornadoEventTimer / this.tornadoEventDuration);

    ctx.save();
    ctx.globalAlpha = 0.06 + Math.sin(t * 9) * 0.03;
    ctx.fillStyle   = '#AA66FF';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#8844FF';
    ctx.lineWidth   = 6;
    ctx.globalAlpha = 0.4 + Math.sin(t * 11) * 0.25;
    ctx.strokeRect(3, 3, this.width - 6, this.height - 6);
    ctx.restore();

    const barW = (this.width - 20) * pct;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(10, 76, this.width - 20, 6);
    ctx.fillStyle = '#AA66FF';
    ctx.fillRect(10, 76, barW, 6);
    ctx.fillStyle = '#DDBBFF';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('💨 TORNADO!  DODGE!', this.width / 2, 73);
    ctx.restore();
  }

  _drawGoldenRainOverlay(ctx) {
    const t   = this._t;
    const pct = Math.max(0, this.goldenRainTimer / this.goldenRainDuration);

    ctx.save();
    ctx.globalAlpha = 0.06 + Math.sin(t * 8) * 0.03;
    ctx.fillStyle   = '#FFD700';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth   = 6;
    ctx.globalAlpha = 0.4 + Math.sin(t * 10) * 0.25;
    ctx.strokeRect(3, 3, this.width - 6, this.height - 6);
    ctx.restore();

    const barW = (this.width - 20) * pct;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(10, 76, this.width - 20, 6);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(10, 76, barW, 6);
    ctx.fillStyle = '#FFF0A0';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('⭐ GOLDEN RAIN!  ×1 PTS', this.width / 2, 73);
    ctx.restore();
  }

  _drawPissOverlay(ctx) {
    const t   = this._t;
    const pct = Math.max(0, this.pissEventTimer / this.pissEventDuration);

    ctx.save();
    ctx.globalAlpha = 0.06 + Math.sin(t * 8) * 0.03;
    ctx.fillStyle   = '#FFE840';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth   = 6;
    ctx.globalAlpha = 0.4 + Math.sin(t * 9) * 0.25;
    ctx.strokeRect(3, 3, this.width - 6, this.height - 6);
    ctx.restore();

    // Timer bar and label at the top
    const barW = (this.width - 20) * pct;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(10, 76, this.width - 20, 6);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(10, 76, barW, 6);
    ctx.fillStyle = '#FFE840';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('🍵 PISS EVENT  ×3 PTS', this.width / 2, 73);
    ctx.restore();
  }
}
