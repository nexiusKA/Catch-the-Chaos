import { rand, randInt, roundRect } from './utils.js';

// ─── Drop types ──────────────────────────────────────────────────────────────

export const DROP_TYPES = Object.freeze({
  GOOD:    'good',
  BAD:     'bad',
  SPECIAL: 'special',
  PISS:    'piss',
});

export const SPECIAL_EFFECTS = Object.freeze({
  MULTIPLIER: 'multiplier',
  WIDE_BUCKET: 'wide_bucket',
  SLOW_MO: 'slow_mo',
  MAGNET: 'magnet',
  SHIELD: 'shield',
});

const GOOD_COLORS = ['#8B4513', '#A0522D', '#6B3A2A', '#7B4B2A', '#9B6133'];
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
   * @param {number} [spawnY=-32]
   * @param {string|null} [forceType=null]  force a specific DROP_TYPES value
   */
  constructor(x, speed, gameW, gameH, spawnY = -32, forceType = null) {
    this.x      = x;
    this.y      = spawnY;
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
    if (forceType) {
      this.type = forceType;
    } else if (roll < 0.58) {
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
      this.shape     = 0; // poop blob
      this.glowColor = '#88CC44'; // stink-green glow
      this.points    = GOOD_POINTS[randInt(0, GOOD_POINTS.length - 1)];

    } else if (this.type === DROP_TYPES.BAD) {
      this.color     = BAD_COLORS[randInt(0, BAD_COLORS.length - 1)];
      this.size      = rand(16, 24);
      this.shape     = 3; // spiky
      this.glowColor = '#FF0000';
      this.points    = 0;

    } else if (this.type === DROP_TYPES.PISS) {
      this.color     = '#FFD700';
      this.size      = rand(12, 20);
      this.shape     = 5; // piss droplet
      this.glowColor = '#FFEE44';
      this.points    = 15;

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
      case 0:
        ctx.save();
        ctx.rotate(-this.rotation); // keep poop upright despite wobble rotation
        ctx.scale(1, 1 + Math.sin(this.age * 9) * 0.05); // subtle bounce squish
        this._drawPoop(ctx);
        ctx.restore();
        break;
      case 1: this._drawCapsule(ctx); break;
      case 2: this._drawStar(ctx, 5); break;
      case 3: this._drawSpiky(ctx);   break;
      case 5:
        ctx.save();
        ctx.rotate(-this.rotation); // keep droplet upright
        ctx.scale(1, 1 + Math.sin(this.age * 7) * 0.06);
        this._drawPissDroplet(ctx);
        ctx.restore();
        break;
      default: this._drawOrb(ctx);    break;
    }

    ctx.restore();
  }

  // ── shape renderers ─────────────────────────────────────────────────────────

  _drawPoop(ctx) {
    const r        = this.size;
    const fontSize = Math.round(r * 2.4);

    // Draw poop emoji
    ctx.font         = `${fontSize}px Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💩', 0, 0);

    // Animated stink lines above the poop
    ctx.strokeStyle = 'rgba(130,210,50,0.72)';
    ctx.lineWidth   = 1.5;
    const sw = Math.sin(this.age * 5) * 3;
    [-r * 0.45, 0, r * 0.45].forEach(sx => {
      const baseY = -r * 1.3;
      ctx.beginPath();
      ctx.moveTo(sx + sw,      baseY);
      ctx.bezierCurveTo(
        sx + sw + 5, baseY - r * 0.22,
        sx + sw - 5, baseY - r * 0.44,
        sx + sw,     baseY - r * 0.62
      );
      ctx.stroke();
    });
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

    // Spiky danger ring around the poop
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = '#880000';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle  = (i * Math.PI) / spikes;
      const radius = i % 2 === 0 ? r * 1.5 : r * 0.85;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // 💩 emoji on top
    const fontSize = Math.round(r * 1.9);
    ctx.font         = `${fontSize}px Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💩', 0, 0);
  }

  _drawOrb(ctx) {
    const r = this.size;

    // Dashed golden sparkle ring
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth   = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 💩 emoji
    const fontSize = Math.round(r * 1.9);
    ctx.font         = `${fontSize}px Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💩', 0, 0);

    // Powerup label overlaid below the emoji
    const labels = {
      multiplier:  '×2',
      wide_bucket: '↔',
      slow_mo:     'SLO',
      magnet:      'MAG',
      shield:      'SHD',
    };
    const label = labels[this.effect] || '?';
    ctx.font         = `bold ${Math.round(r * 0.65)}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.strokeStyle  = '#000';
    ctx.lineWidth    = 3;
    ctx.strokeText(label, 0, r * 0.85);
    ctx.fillStyle = '#FFD700';
    ctx.fillText(label, 0, r * 0.85);
  }

  _drawPissDroplet(ctx) {
    const r = this.size;

    // Yellow teardrop shape
    ctx.fillStyle   = '#FFE000';
    ctx.strokeStyle = '#BB8800';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.75, 0, Math.PI * 2);
    // pointed tip at top
    ctx.moveTo(-r * 0.35, -r * 0.15);
    ctx.quadraticCurveTo(0, -r * 1.15, r * 0.35, -r * 0.15);
    ctx.arc(0, r * 0.1, r * 0.75, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Shine highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.18, -r * 0.2, r * 0.2, r * 0.35, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // 💦 emoji
    const fontSize = Math.round(r * 1.6);
    ctx.font         = `${fontSize}px Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💦', 0, r * 0.1);
  }
}
