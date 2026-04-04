// ─── Random helpers ─────────────────────────────────────────────────────────

export function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Canvas helpers ──────────────────────────────────────────────────────────

/**
 * Draw a rounded rectangle path (compatible with all modern browsers).
 */
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── Particle system ─────────────────────────────────────────────────────────

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = rand(-130, 130);
    this.vy = rand(-200, -60);
    this.life = 1.0;
    this.decay = rand(1.6, 3.2);
    this.size = rand(4, 11);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 280 * dt; // gravity
    this.life -= this.decay * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0, this.size * this.life), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isDead() {
    return this.life <= 0;
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  burst(x, y, colors, count = 14) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, choice(colors)));
    }
  }

  update(dt) {
    this.particles = this.particles.filter(p => {
      p.update(dt);
      return !p.isDead();
    });
  }

  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
  }
}

// ─── Screen shake ────────────────────────────────────────────────────────────

export class ScreenShake {
  constructor() {
    this.intensity = 0;
    this.duration = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  trigger(intensity, duration) {
    this.intensity = Math.max(this.intensity, intensity);
    this.duration = Math.max(this.duration, duration);
  }

  update(dt) {
    if (this.duration > 0) {
      this.duration = Math.max(0, this.duration - dt);
      const scale = this.duration > 0 ? 1 : 0;
      this.offsetX = rand(-this.intensity, this.intensity) * scale;
      this.offsetY = rand(-this.intensity, this.intensity) * scale;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }
}

// ─── Audio manager ───────────────────────────────────────────────────────────

export class AudioManager {
  constructor() {
    this.enabled = true;
    this._ctx = null;
  }

  _getCtx() {
    if (!this._ctx) {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        this.enabled = false;
      }
    }
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  }

  /** Public accessor – returns the AudioContext, creating it if necessary. */
  getCtx() {
    return this._getCtx();
  }

  _tone(freq, type, duration, gain = 0.28, freqEnd = null) {
    if (!this.enabled) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, freqEnd),
        ctx.currentTime + duration
      );
    }
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  }

  playCatch() {
    this._tone(440, 'sine', 0.14, 0.28, 880);
  }

  playPissCatch() {
    this._tone(700, 'sine', 0.1, 0.1, 350);
  }

  playMiss() {
    this._tone(260, 'sawtooth', 0.3, 0.22, 80);
  }

  playBadCatch() {
    this._tone(160, 'square', 0.22, 0.35, 60);
    setTimeout(() => this._tone(100, 'sawtooth', 0.18, 0.2, 50), 80);
  }

  playSpecial() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._tone(f, 'sine', 0.18, 0.22), i * 70);
    });
  }

  playFeverActivate() {
    [440, 660, 880, 1100, 1320].forEach((f, i) => {
      setTimeout(() => this._tone(f, 'sine', 0.15, 0.25), i * 55);
    });
  }

  playSpawn() {
    this._tone(rand(70, 140), 'sawtooth', 0.1, 0.1, rand(35, 70));
  }

  playComboMilestone() {
    this._tone(660, 'triangle', 0.2, 0.28, 880);
  }
}

// ─── Popup text ──────────────────────────────────────────────────────────────

export class PopupText {
  constructor(text, x, y, color = '#FFD700', size = 24) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.life = 1.0;
    this.vy = -80;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.vy *= 0.92;
    this.life -= 2.2 * dt;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.font = `bold ${this.size}px "Arial Black", Arial`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }

  isDead() {
    return this.life <= 0;
  }
}
