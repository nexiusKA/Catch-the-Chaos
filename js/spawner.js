import { rand, randInt, choice } from './utils.js';
import { Drop } from './drop.js';

// ─── Machine definitions ──────────────────────────────────────────────────────

const MACHINE_DEFS = [
  { name: 'Orange Tabby', color: '#E8812A', accent: '#FFB347', stroke: '#4A3000', shape: 'cat' },
  { name: 'Gray Cat',     color: '#8A8A8A', accent: '#FFD0D0', stroke: '#444444', shape: 'cat' },
  { name: 'Black Cat',    color: '#2C2C2C', accent: '#FF88CC', stroke: '#666666', shape: 'cat' },
  { name: 'Snow Cat',     color: '#F5F0E8', accent: '#FFD0D0', stroke: '#999999', shape: 'cat' },
  { name: 'Tabby Cat',    color: '#9B5E3C', accent: '#FFB8A0', stroke: '#4A2800', shape: 'cat' },
];

// ─── Spawner class ────────────────────────────────────────────────────────────

export class Spawner {
  constructor(gameW, gameH, fartSound = null) {
    this.gameW = gameW;
    this.gameH = gameH;

    this.fartSound = fartSound;
    this.drops = [];

    // Build machines
    const count = MACHINE_DEFS.length;
    this.machines = MACHINE_DEFS.map((def, i) => ({
      x:          (gameW / count) * (i + 0.5),
      def,
      animTimer:  rand(0, Math.PI * 2),
      puffTimer:  rand(0, 1),
      puffInterval: rand(0.35, 1.1),
      active:     false,
      activeCooldown: 0,
      puffs:      [],
      jumpY:      0,
      jumpVY:     0,
      jumpTimer:  0,
    }));

    // Spawn timing
    this.spawnTimer    = 0;
    this.spawnInterval = 1.8; // seconds between drops
    this._baseInterval = 1.8;

    // Drop fall speed
    this.dropSpeed     = 145;
    this._baseSpeed    = 145;
  }

  // ── Difficulty ──────────────────────────────────────────────────────────────

  /**
   * @param {number} level  1-based, increases over time
   */
  setDifficulty(level) {
    this.spawnInterval = Math.max(0.32, this._baseInterval - (level - 1) * 0.13);
    this.dropSpeed     = Math.min(500, this._baseSpeed  + (level - 1) * 30);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  /**
   * @param {number}  dt
   * @param {number}  slowFactor     1 = normal, <1 = slow motion
   * @param {boolean} magnetActive
   * @param {{x,y}}   magnetCenter
   */
  update(dt, slowFactor = 1, magnetActive = false, magnetCenter = null) {
    // Machine animations
    for (const m of this.machines) {
      m.animTimer    += dt * 1.8;
      m.puffTimer    += dt;
      m.activeCooldown = Math.max(0, m.activeCooldown - dt);
      if (m.activeCooldown <= 0) m.active = false;

      // Jump animation (triggered on every fart / drop spawn)
      if (m.jumpTimer > 0) {
        m.jumpTimer -= dt;
        m.jumpVY    += 400 * dt;        // gravity pulls back down
        m.jumpY     += m.jumpVY * dt;
        if (m.jumpY >= 0) {             // landed back at resting position
          m.jumpY     = 0;
          m.jumpVY    = 0;
          m.jumpTimer = 0;
        }
      }

      if (m.puffTimer >= m.puffInterval) {
        m.puffTimer = 0;
        m.puffs.push({
          ox:   rand(-12, 12),
          y:    70,
          life: 1.0,
          vy:   rand(10, 22),
          size: rand(7, 16),
        });
      }
      m.puffs = m.puffs.filter(p => {
        p.y    += p.vy * dt;
        p.life -= dt * 1.2;
        return p.life > 0;
      });
    }

    // Spawn timer
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval;
      this._spawnDrop();
    }

    // Move drops
    for (const d of this.drops) {
      d.update(dt, slowFactor);

      // Magnet: pull good drops toward player
      if (magnetActive && magnetCenter && d.type === 'good') {
        const dx   = magnetCenter.x - d.x;
        const dy   = magnetCenter.y - d.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2 && dist < 220) {
          d.x += (dx / dist) * 130 * dt;
        }
      }
    }
  }

  // ── Spawn ────────────────────────────────────────────────────────────────────

  _spawnDrop() {
    const m     = choice(this.machines);
    const x     = m.x + rand(-14, 14);
    const speed = this.dropSpeed + rand(-22, 22);
    // spawn from the cat's rear (screen y ≈ machine centre 42 + relative 28)
    const drop  = new Drop(x, speed, this.gameW, this.gameH, 70);
    this.drops.push(drop);

    m.active         = true;
    m.activeCooldown = 0.22;

    // Fart-jump: cat leaps upward when releasing a drop
    m.jumpY     = 0;
    m.jumpVY    = -120;  // launch upward ~18 px peak
    m.jumpTimer = 0.8;   // safety cap; stops when it lands back

    // Play a random fart sound on every drop spawn
    if (this.fartSound) this.fartSound.playRandom();

    // Burst of stink puffs drifting downward from the cat's butt
    for (let i = 0; i < 5; i++) {
      m.puffs.push({
        ox:    rand(-14, 14),
        y:     70,
        life:  1.0,
        vy:    rand(20, 45),
        size:  rand(9, 20),
        color: `rgba(${randInt(110, 160)},${randInt(180, 230)},${randInt(40, 90)},`,
      });
    }
  }

  // ── Draw machines ────────────────────────────────────────────────────────────

  drawMachines(ctx) {
    for (const m of this.machines) {
      this._drawMachine(ctx, m);
    }
  }

  _drawMachine(ctx, m) {
    const bob = Math.sin(m.animTimer) * 3;
    ctx.save();
    ctx.translate(m.x, 42 + bob + m.jumpY);

    this._drawCat(ctx, m);

    // Puff clouds drifting downward from the cat's rear
    for (const p of m.puffs) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.5;
      if (p.color) {
        ctx.fillStyle = p.color + (p.life * 0.5).toFixed(2) + ')';
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#AAFFAA';
      }
      ctx.beginPath();
      ctx.arc(p.ox, p.y - 42 - bob - m.jumpY, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  _drawCat(ctx, m) {
    const { color, accent, stroke } = m.def;
    const active     = m.active;
    const t          = m.animTimer;
    const earWiggle  = active ? Math.sin(t * 10) * 4 : 0;
    const strokeColor = stroke || '#333';

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 2;

    // ── Tail (curled to the right, peeking out beside the body) ──
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(24, 4, 7, 20, 0.45, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // ── Body (seated oval) ──
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 6, 19, 24, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // ── Head ──
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -28, 18, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // ── Left ear ──
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-16, -38 + earWiggle);
    ctx.lineTo(-7,  -58 + earWiggle);
    ctx.lineTo(-1,  -38 + earWiggle);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // inner left ear
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-13, -39 + earWiggle);
    ctx.lineTo(-7,  -54 + earWiggle);
    ctx.lineTo(-3,  -39 + earWiggle);
    ctx.closePath();
    ctx.fill();

    // ── Right ear ──
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(1,  -38 - earWiggle);
    ctx.lineTo(10, -58 - earWiggle);
    ctx.lineTo(16, -38 - earWiggle);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // inner right ear
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(3,  -39 - earWiggle);
    ctx.lineTo(10, -54 - earWiggle);
    ctx.lineTo(13, -39 - earWiggle);
    ctx.closePath();
    ctx.fill();

    // ── Eyes ──
    const eyeY = -30;
    if (active) {
      // Wide surprised eyes when dropping
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(-7, eyeY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 7, eyeY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-7, eyeY, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 7, eyeY, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      // Normal slit-pupil cat eyes
      ctx.fillStyle = '#7CFC00';
      ctx.beginPath(); ctx.arc(-7, eyeY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 7, eyeY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(-7, eyeY, 1.5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( 7, eyeY, 1.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Eye shine
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(-9, eyeY - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 5, eyeY - 2, 1.5, 0, Math.PI * 2); ctx.fill();

    // ── Nose ──
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-2.5, -24);
    ctx.lineTo( 2.5, -24);
    ctx.lineTo( 0,   -21);
    ctx.closePath();
    ctx.fill();

    // ── Mouth ──
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.quadraticCurveTo(-4, -18, -6, -19);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.quadraticCurveTo( 4, -18,  6, -19);
    ctx.stroke();

    // ── Whiskers ──
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth   = 1;
    [[-6, -24, -20, -26], [-6, -22, -20, -22], [-6, -20, -20, -18]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
    [[ 6, -24,  20, -26], [ 6, -22,  20, -22], [ 6, -20,  20, -18]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });

    // ── Front paws ──
    ctx.fillStyle   = color;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.ellipse(-10, 27, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse( 10, 27, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // ── Active: strain lines near butt ──
    if (active) {
      ctx.strokeStyle = 'rgba(139,115,85,0.65)';
      ctx.lineWidth   = 2;
      for (let i = 0; i < 3; i++) {
        const yOff = 30 + i * 5;
        ctx.beginPath();
        ctx.moveTo(-8, yOff);
        ctx.quadraticCurveTo(0, yOff + 3, 8, yOff);
        ctx.stroke();
      }
    }
  }
}
