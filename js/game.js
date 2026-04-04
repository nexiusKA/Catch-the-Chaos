import { ParticleSystem, ScreenShake, AudioManager, PopupText, rand } from './utils.js';
import { FartSoundManager } from './soundManager.js';
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

    this.player  = new Player(this.width, this.height);
    this.spawner = new Spawner(this.width, this.height, this.fartSound);
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

  // ─── Update ───────────────────────────────────────────────────────────────────

  _update(dt) {
    this.shake.update(dt);

    if (this.state === STATES.MENU) {
      this._menuSpawner.update(dt, 1, false, null);
      // Remove drops that fell off screen
      this._menuSpawner.drops = this._menuSpawner.drops.filter(d => !d.missed && !d.caught);

      if (this.input.isDown('Space', 'Enter')) {
        this.audio._getCtx(); // unlock AudioContext on first interaction
        this.fartSound.init(this.audio.getCtx()); // preload fart sounds
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
      this.audio.playCatch();

      const label = this.combo > 1 ? `×${this.combo}  +${pts}` : `+${pts}`;
      const col   = this.combo >= 10 ? '#FF6600' : this.combo >= 5 ? '#FFD700' : '#FFFFFF';
      const sz    = this.combo >= 5 ? 26 : 20;
      this.popups.push(new PopupText(label, px, py - 20, col, sz));

      if (this.combo > 0 && this.combo % 5 === 0) {
        this.shake.trigger(5, 0.28);
        this.audio.playComboMilestone();
      }

      this.player.squishCatch();

    } else if (drop.type === DROP_TYPES.BAD) {
      if (this.player.hasPowerup('shield')) {
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
      // SPECIAL
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
      if (this.state === STATES.GAME_OVER) this.ui.drawGameOver(ctx, this._t);
    }

    ctx.restore();
  }

  _drawBackground(ctx) {
    const W = this.width;
    const H = this.height;

    // Gradient sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (this.feverMode) {
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
}
