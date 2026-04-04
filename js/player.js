import { clamp, lerp, roundRect } from './utils.js';

export const POWERUP_DURATION = 8; // seconds

export class Player {
  constructor(gameW, gameH) {
    this.gameW = gameW;
    this.gameH = gameH;

    // Position — centred horizontally, near bottom
    this.x = gameW / 2;
    this.y = gameH - 58;

    this.vx           = 0;
    this.speed        = 330;
    this.acceleration = 2200;

    // Bucket base width
    this.baseBucketW = 72;
    this.bucketH     = 32;

    // Active powerup timers  { effectName: secondsRemaining }
    this.powerups = {};

    // Visual squish for catch feedback
    this.squishX = 1;
    this.squishY = 1;

    // Stink animation timer (seconds remaining after catching a poop)
    this.stinkTimer = 0;
  }

  // ── Powerups ──────────────────────────────────────────────────────────────

  hasPowerup(name) {
    return (this.powerups[name] || 0) > 0;
  }

  applyPowerup(name) {
    this.powerups[name] = POWERUP_DURATION;
  }

  get effectiveBucketW() {
    return this.hasPowerup('wide_bucket') ? this.baseBucketW * 1.75 : this.baseBucketW;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt, input) {
    // Horizontal acceleration
    let targetVx = 0;
    if (input.isDown('ArrowLeft', 'KeyA'))  targetVx = -this.speed;
    if (input.isDown('ArrowRight', 'KeyD')) targetVx =  this.speed;

    const blend = Math.min(1, (this.acceleration / this.speed) * dt);
    this.vx = lerp(this.vx, targetVx, blend);
    this.x  = clamp(this.x + this.vx * dt, 30, this.gameW - 30);

    // Powerup countdown
    for (const key of Object.keys(this.powerups)) {
      this.powerups[key] -= dt;
      if (this.powerups[key] <= 0) delete this.powerups[key];
    }

    // Squish spring back
    this.squishX = lerp(this.squishX, 1, dt * 10);
    this.squishY = lerp(this.squishY, 1, dt * 10);

    // Stink timer countdown
    if (this.stinkTimer > 0) this.stinkTimer = Math.max(0, this.stinkTimer - dt);
  }

  squishCatch() {
    this.squishX = 1.35;
    this.squishY = 0.70;
  }

  /** Trigger the stink reaction (disgusted face + green cloud). */
  triggerStink() {
    this.stinkTimer = 1.6; // seconds
  }

  squishHurt() {
    this.squishX = 0.70;
    this.squishY = 1.40;
  }

  // ── Hit-boxes ─────────────────────────────────────────────────────────────

  getCatchBox() {
    const bw = this.effectiveBucketW;
    return {
      x: this.x - bw / 2,
      y: this.y + 6,
      w: bw,
      h: this.bucketH,
    };
  }

  getCenter() {
    return { x: this.x, y: this.y };
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  draw(ctx) {
    const cx = Math.round(this.x);
    const cy = Math.round(this.y);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.squishX, this.squishY);
    this._drawBody(ctx);
    ctx.restore();

    // Stink cloud (drawn outside squish so it floats freely)
    if (this.stinkTimer > 0) {
      this._drawStinkEffect(ctx, cx, cy);
    }

    // Shield aura (drawn outside squish transform so it doesn't warp)
    if (this.hasPowerup('shield')) {
      ctx.save();
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth   = 3;
      ctx.globalAlpha = 0.55 + Math.sin(Date.now() / 180) * 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy - 14, 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this._drawPowerupBars(ctx, cx, cy);
  }

  _drawBody(ctx) {
    const bw      = this.effectiveBucketW;
    const bh      = this.bucketH;
    const stinking = this.stinkTimer > 0;

    // ── Legs ──
    ctx.fillStyle = '#2244BB';
    ctx.fillRect(-14, 12, 11, 22);
    ctx.fillRect(  3, 12, 11, 22);

    // ── Shoes ──
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(-8,  34, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 8,  34, 9, 5, 0, 0, Math.PI * 2); ctx.fill();

    // ── Shirt/body ──
    ctx.fillStyle = stinking ? '#3a6633' : '#4488FF'; // goes green-ish when stinking
    roundRect(ctx, -22, -18, 44, 34, 8);
    ctx.fill();

    // ── Arm (left — holds bucket) ──
    ctx.strokeStyle = '#FFD27F';
    ctx.lineWidth   = 8;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.lineTo(-bw / 2 + 4, 8);
    ctx.stroke();

    // ── Arm (right — raised for fun, or holding nose when stinking) ──
    ctx.beginPath();
    ctx.moveTo(22, -4);
    if (stinking) {
      // Arm raised to cover nose
      ctx.lineTo(14, -28);
    } else {
      ctx.lineTo(32, -16);
    }
    ctx.stroke();

    // ── Bucket ──
    ctx.fillStyle   = '#FF9900';
    ctx.strokeStyle = '#884400';
    ctx.lineWidth   = 2;
    // Trapezoidal body
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + 6, 7);
    ctx.lineTo( bw / 2 - 6, 7);
    ctx.lineTo( bw / 2,     7 + bh);
    ctx.lineTo(-bw / 2,     7 + bh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Rim
    ctx.fillStyle = '#FFBB44';
    ctx.fillRect(-bw / 2 + 3, 5, bw - 6, 6);
    ctx.strokeStyle = '#884400';
    ctx.strokeRect(-bw / 2 + 3, 5, bw - 6, 6);
    // Handle arc
    ctx.strokeStyle = '#AA6600';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 5, bw * 0.28, Math.PI, 0);
    ctx.stroke();
    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(-bw / 2 + 8, 13, bw - 16, bh - 6);

    // ── Head ──
    ctx.fillStyle = stinking ? '#d4c070' : '#FFD27F'; // slightly green-tinted when stinking
    ctx.beginPath(); ctx.arc(0, -30, 20, 0, Math.PI * 2); ctx.fill();

    // ── Hair ──
    ctx.fillStyle = '#4A2800';
    ctx.beginPath();
    ctx.ellipse(0, -46, 17, 9, 0, Math.PI, 0);
    ctx.fill();

    if (stinking) {
      // ── Disgusted eyes (squinted X-eyes) ──
      ctx.strokeStyle = '#222';
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
      // Left X eye
      ctx.beginPath(); ctx.moveTo(-10, -34); ctx.lineTo(-4, -28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4,  -34); ctx.lineTo(-10, -28); ctx.stroke();
      // Right X eye
      ctx.beginPath(); ctx.moveTo(4,  -34); ctx.lineTo(10, -28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -34); ctx.lineTo(4,  -28); ctx.stroke();

      // ── Wavy disgusted mouth ──
      ctx.strokeStyle = '#222';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -20);
      ctx.bezierCurveTo(-4, -24,  0, -16,  4, -20);
      ctx.bezierCurveTo( 8, -24, 10, -18, 12, -21);
      ctx.stroke();

      // ── Hand over nose ──
      ctx.fillStyle = '#FFD27F';
      ctx.beginPath();
      ctx.ellipse(14, -30, 7, 5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c8a060';
      ctx.lineWidth = 1;
      ctx.stroke();

    } else {
      // ── Normal eyes ──
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-7, -32, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 7, -32, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-5, -33, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 9, -33, 1.8, 0, Math.PI * 2); ctx.fill();

      // ── Grin ──
      ctx.strokeStyle = '#222';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, -26, 9, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
  }

  /** Animated green stink cloud floating above the player. */
  _drawStinkEffect(ctx, cx, cy) {
    const t       = Date.now() / 1000;
    const alpha   = Math.min(1, this.stinkTimer / 0.4); // fade in fast, fade out at end
    const fadeOut = Math.min(1, this.stinkTimer / 0.6);

    ctx.save();
    ctx.globalAlpha = alpha * fadeOut * 0.85;

    // Floating puff clouds
    const puffs = [
      { ox: -18, baseY: -68, size: 14, phase: 0 },
      { ox:   0, baseY: -80, size: 18, phase: 1.2 },
      { ox:  18, baseY: -68, size: 14, phase: 2.4 },
    ];

    for (const p of puffs) {
      const fy = p.baseY - Math.sin(t * 2.2 + p.phase) * 6; // gentle float
      const grd = ctx.createRadialGradient(cx + p.ox, cy + fy, 0, cx + p.ox, cy + fy, p.size);
      grd.addColorStop(0, 'rgba(100,210,50,0.7)');
      grd.addColorStop(1, 'rgba(60,160,20,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx + p.ox, cy + fy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wavy stink lines
    ctx.strokeStyle = 'rgba(110,220,40,0.8)';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    const sw = Math.sin(t * 5) * 4;
    [-12, 0, 12].forEach((sx, i) => {
      const baseY = cy - 55 - i * 4;
      ctx.beginPath();
      ctx.moveTo(cx + sx + sw,     baseY);
      ctx.bezierCurveTo(
        cx + sx + sw + 6, baseY - 10,
        cx + sx + sw - 6, baseY - 20,
        cx + sx + sw,     baseY - 30
      );
      ctx.stroke();
    });

    // 🤢 emoji floating up
    const emojiY = cy - 90 - (1 - this.stinkTimer / 1.6) * 30;
    ctx.globalAlpha = alpha * fadeOut;
    ctx.font = '22px Arial';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🤢', cx + 26, emojiY);

    ctx.restore();
  }

  _drawPowerupBars(ctx, cx, cy) {
    const defs = {
      multiplier:  { label: '×2',  color: '#FFD700' },
      wide_bucket: { label: '↔',   color: '#00FFCC' },
      slow_mo:     { label: 'SLO', color: '#AAFFAA' },
      magnet:      { label: 'MAG', color: '#FF88FF' },
      shield:      { label: 'SHD', color: '#00FFFF' },
    };

    const active = Object.keys(this.powerups).filter(k => this.powerups[k] > 0);
    if (active.length === 0) return;

    const barW  = 30;
    const barH  = 7;
    const gap   = 4;
    const total = active.length * (barW + gap) - gap;
    let ix      = cx - total / 2;

    ctx.save();
    active.forEach(key => {
      const def = defs[key];
      const pct = Math.max(0, Math.min(1, this.powerups[key] / POWERUP_DURATION));

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(ix, cy - 82, barW, barH);
      // Fill
      ctx.fillStyle = def.color;
      ctx.fillRect(ix, cy - 82, barW * pct, barH);
      // Border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1;
      ctx.strokeRect(ix, cy - 82, barW, barH);
      // Label
      ctx.fillStyle    = '#fff';
      ctx.font         = 'bold 9px Arial';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, ix + barW / 2, cy - 82 + barH / 2);

      ix += barW + gap;
    });
    ctx.restore();
  }
}
