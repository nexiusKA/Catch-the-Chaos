import { rand, randInt, roundRect } from './utils.js';

// ─── Drop types ──────────────────────────────────────────────────────────────

export const DROP_TYPES = Object.freeze({
  GOOD: 'good',
  BAD: 'bad',
  SPECIAL: 'special',
});

export const SPECIAL_EFFECTS = Object.freeze({
  MULTIPLIER: 'multiplier',
  WIDE_BUCKET: 'wide_bucket',
  SLOW_MO: 'slow_mo',
  MAGNET: 'magnet',
  SHIELD: 'shield',
});

const GOOD_COLORS = ['#7FFF00', '#00FFCC', '#FFD700', '#FF69B4', '#00BFFF'];
const BAD_COLORS  = ['#FF2222', '#FF5500', '#CC00FF'];
const SPEC_COLORS = ['#FFD700', '#7B68EE', '#FF1493', '#ADFF2F', '#00CED1'];

// Points awarded per good-drop variant
const GOOD_POINTS = [10, 20, 30];

// ─── Drop class ──────────────────────────────────────────────────────────────

export class Drop {
  /**
   * @param {number} x        horizontal spawn position
   * @param {number} speed    fall speed in px/s
   * @param {number} gameW
   * @param {number} gameH
   */
  constructor(x, speed, gameW, gameH) {
    this.x      = x;
    this.y      = -32;
    this.speed  = speed;
    this.gameW  = gameW;
    this.gameH  = gameH;

    this.caught = false;
    this.missed = false;

    this.wobble      = rand(0, Math.PI * 2);
    this.wobbleSpeed = rand(1.8, 4.5);
    this.rotation    = rand(0, Math.PI * 2);
    this.rotSpeed    = rand(-2.5, 2.5);
    this.age         = 0;

    // Weighted type selection
    const roll = Math.random();
    if (roll < 0.58) {
      this.type = DROP_TYPES.GOOD;
    } else if (roll < 0.82) {
      this.type = DROP_TYPES.BAD;
    } else {
      this.type = DROP_TYPES.SPECIAL;
    }

    this._initVisuals();
  }

  _initVisuals() {
    if (this.type === DROP_TYPES.GOOD) {
      this.color     = GOOD_COLORS[randInt(0, GOOD_COLORS.length - 1)];
      this.size      = rand(14, 22);
      this.shape     = randInt(0, 2); // 0=blob 1=capsule 2=star
      this.glowColor = this.color;
      this.points    = GOOD_POINTS[randInt(0, GOOD_POINTS.length - 1)];

    } else if (this.type === DROP_TYPES.BAD) {
      this.color     = BAD_COLORS[randInt(0, BAD_COLORS.length - 1)];
      this.size      = rand(16, 24);
      this.shape     = 3; // spiky
      this.glowColor = '#FF0000';
      this.points    = 0;

    } else {
      // Special
      const effects  = Object.values(SPECIAL_EFFECTS);
      this.effect    = effects[randInt(0, effects.length - 1)];
      this.color     = SPEC_COLORS[randInt(0, SPEC_COLORS.length - 1)];
      this.size      = rand(18, 26);
      this.shape     = 4; // orb
      this.glowColor = this.color;
      this.points    = 0;
    }
  }

  // ── update ──────────────────────────────────────────────────────────────────

  /**
   * @param {number} dt
   * @param {number} [slowFactor=1]
   */
  update(dt, slowFactor = 1) {
    this.y        += this.speed * slowFactor * dt;
    this.wobble   += this.wobbleSpeed * dt;
    this.rotation += this.rotSpeed    * dt;
    this.age      += dt;

    if (this.y > this.gameH + 44) {
      this.missed = true;
    }
  }

  // ── hit-box ─────────────────────────────────────────────────────────────────

  getCatchBox() {
    const s = this.size;
    return { x: this.x - s, y: this.y - s, w: s * 2, h: s * 2 };
  }

  // ── draw ────────────────────────────────────────────────────────────────────

  draw(ctx) {
    if (this.caught || this.missed) return;

    const wx = this.x + Math.sin(this.wobble) * 5;

    ctx.save();
    ctx.translate(wx, this.y);
    ctx.rotate(this.rotation);

    // Ambient glow
    const glowR = this.size * 1.9 + Math.sin(this.age * 3) * 3;
    const grd   = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    grd.addColorStop(0, this.glowColor + 'BB');
    grd.addColorStop(1, this.glowColor + '00');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Shape
    switch (this.shape) {
      case 0: this._drawBlob(ctx);    break;
      case 1: this._drawCapsule(ctx); break;
      case 2: this._drawStar(ctx, 5); break;
      case 3: this._drawSpiky(ctx);   break;
      default: this._drawOrb(ctx);    break;
    }

    ctx.restore();
  }

  // ── shape renderers ─────────────────────────────────────────────────────────

  _drawBlob(ctx) {
    const r = this.size;
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(r * 0.8, 0);
    ctx.bezierCurveTo(r, -r * 0.9, -r * 0.5, -r,   -r * 0.8, 0);
    ctx.bezierCurveTo(-r, r * 0.7,  r * 0.3,  r * 1.1, r * 0.8, 0);
    ctx.fill();
    ctx.stroke();
    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.15, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( r * 0.15, -r * 0.15, 2.5, 0, Math.PI * 2); ctx.fill();
    // Smile
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, r * 0.05, r * 0.25, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  _drawCapsule(ctx) {
    const r = this.size;
    const h = r * 1.5;
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 2;
    roundRect(ctx, -r * 0.5, -h * 0.5, r, h, r * 0.5);
    ctx.fill();
    ctx.stroke();
    // Shine stripe
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, -h * 0.22, r * 0.18, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mid line
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0);
    ctx.lineTo(r * 0.5,  0);
    ctx.stroke();
  }

  _drawStar(ctx, pts) {
    const r     = this.size;
    const inner = r * 0.42;
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const angle  = (i * Math.PI) / pts - Math.PI / 2;
      const radius = i % 2 === 0 ? r : inner;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  _drawSpiky(ctx) {
    const r      = this.size;
    const spikes = 8;
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = '#880000';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle  = (i * Math.PI) / spikes;
      const radius = i % 2 === 0 ? r : r * 0.55;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Angry eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.23, -r * 0.1, 4,   0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( r * 0.23, -r * 0.1, 4,   0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-r * 0.23, -r * 0.1, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( r * 0.23, -r * 0.1, 2.2, 0, Math.PI * 2); ctx.fill();
    // Frown
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, r * 0.15, r * 0.22, Math.PI + 0.2, -0.2);
    ctx.stroke();
  }

  _drawOrb(ctx) {
    const r   = this.size;
    const grd = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.35, this.color);
    grd.addColorStop(1, '#000033');
    ctx.fillStyle   = grd;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sparkle overlay
    ctx.save();
    ctx.rotate(-this.rotation); // counter-rotate so sparkle stays upright
    this._drawStar(ctx, 4);
    ctx.restore();

    // Label text
    const labels = {
      multiplier: '×2',
      wide_bucket: '↔',
      slow_mo: 'SLO',
      magnet: 'MAG',
      shield: 'SHD',
    };
    const label = labels[this.effect] || '?';
    ctx.fillStyle = '#fff';
    ctx.font      = `bold ${Math.round(r * 0.6)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.textBaseline = 'alphabetic';
  }
}
