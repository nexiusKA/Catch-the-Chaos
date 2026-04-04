import { rand, randInt, choice, roundRect } from './utils.js';
import { Drop } from './drop.js';

// ─── Machine definitions ──────────────────────────────────────────────────────

const MACHINE_DEFS = [
  { name: 'Fart Cannon',    color: '#FF6600', accent: '#FFAA00', shape: 'cannon'  },
  { name: 'Chaos Pipe',     color: '#44AA44', accent: '#88FF88', shape: 'pipe'    },
  { name: 'Goofy Machine',  color: '#6644CC', accent: '#BB88FF', shape: 'machine' },
  { name: 'Cloud Vent',     color: '#88BBFF', accent: '#FFFFFF', shape: 'cloud'   },
  { name: 'Slime Nozzle',   color: '#AADD00', accent: '#EEFF44', shape: 'pipe'    },
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

      if (m.puffTimer >= m.puffInterval) {
        m.puffTimer = 0;
        m.puffs.push({
          ox:   rand(-12, 12),
          y:    58,
          life: 1.0,
          vy:   rand(-18, -8),
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
    const drop  = new Drop(x, speed, this.gameW, this.gameH);
    this.drops.push(drop);

    m.active         = true;
    m.activeCooldown = 0.22;

    // Play a random fart sound on every drop spawn
    if (this.fartSound) this.fartSound.playRandom();

    // Burst of stink puffs from the nozzle
    for (let i = 0; i < 5; i++) {
      m.puffs.push({
        ox:    rand(-14, 14),
        y:     58,
        life:  1.0,
        vy:    rand(-35, -15),
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
    ctx.translate(m.x, 42 + bob);

    switch (m.def.shape) {
      case 'cannon':  this._drawCannon (ctx, m); break;
      case 'pipe':    this._drawPipe   (ctx, m); break;
      case 'machine': this._drawMachineBox(ctx, m); break;
      case 'cloud':   this._drawCloud  (ctx, m); break;
    }

    // Puff clouds
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
      ctx.arc(p.ox, p.y - 42 - bob, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  _drawCannon(ctx, m) {
    const { color, accent } = m.def;
    const active = m.active;

    ctx.strokeStyle = '#333';
    ctx.lineWidth   = 2;

    // Main round body
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, -10, 23, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Barrel (pointing down)
    ctx.fillStyle = '#333';
    ctx.fillRect(-8, 6, 16, 32);
    ctx.strokeRect(-8, 6, 16, 32);

    // Barrel tip flare
    ctx.fillStyle = active ? '#AAFFAA' : accent;
    ctx.beginPath(); ctx.ellipse(0, 38, 13, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Bolts
    ctx.fillStyle = accent;
    [-11, 11].forEach(ox => {
      ctx.beginPath(); ctx.arc(ox, -10, 4.5, 0, Math.PI * 2); ctx.fill();
    });

    // Goofy eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-7, -15, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 7, -15, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = active ? '#FF0000' : '#333';
    ctx.beginPath(); ctx.arc(-5, -14, 3,   0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 9, -14, 3,   0, Math.PI * 2); ctx.fill();

    // Active smoke burst
    if (active) {
      ctx.fillStyle = 'rgba(160,255,140,0.72)';
      ctx.beginPath(); ctx.arc(0, 46, 11, 0, Math.PI * 2); ctx.fill();
    }
  }

  _drawPipe(ctx, m) {
    const { color, accent } = m.def;
    const active = m.active;

    ctx.strokeStyle = '#333';
    ctx.lineWidth   = 2.5;

    // Pipe body
    ctx.fillStyle = color;
    roundRect(ctx, -11, -32, 22, 62, 11);
    ctx.fill(); ctx.stroke();

    // Flange ring
    ctx.fillStyle = accent;
    ctx.fillRect(-16, -4, 32, 8);
    ctx.strokeRect(-16, -4, 32, 8);

    // Nozzle
    ctx.fillStyle = '#444';
    ctx.beginPath(); ctx.ellipse(0, 30, 15, 6, 0, 0, Math.PI * 2); ctx.fill();

    // Pressure gauge
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -22, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
    // Needle
    const needle = m.animTimer * 0.6;
    ctx.strokeStyle = active ? '#FF0000' : '#444';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(Math.cos(needle) * 5, -22 + Math.sin(needle) * 5);
    ctx.stroke();

    // Active drip
    if (active) {
      ctx.fillStyle = 'rgba(120,240,120,0.8)';
      ctx.beginPath(); ctx.arc(0, 38, 8, 0, Math.PI * 2); ctx.fill();
    }
  }

  _drawMachineBox(ctx, m) {
    const { color, accent } = m.def;
    const active = m.active;

    ctx.strokeStyle = '#333';
    ctx.lineWidth   = 2;

    // Box body
    ctx.fillStyle = color;
    roundRect(ctx, -26, -28, 52, 58, 7);
    ctx.fill(); ctx.stroke();

    // Buttons
    const btnColors = [accent, '#FF4444', '#44FF44', '#4466FF'];
    [[-11, -10], [5, -10], [-11, 0], [5, 0]].forEach(([bx, by], i) => {
      ctx.fillStyle = btnColors[i];
      ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
    });

    // Screen
    ctx.fillStyle = active ? '#00FF88' : '#001122';
    ctx.fillRect(-20, -25, 40, 18);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.strokeRect(-20, -25, 40, 18);
    if (active) {
      ctx.fillStyle    = '#001100';
      ctx.font         = 'bold 9px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CHAOS!', 0, -16);
      ctx.textBaseline = 'alphabetic';
    }

    // Output chute
    ctx.fillStyle = '#333';
    ctx.fillRect(-9, 28, 18, 10);
  }

  _drawCloud(ctx, m) {
    const { color, accent } = m.def;
    const active = m.active;

    ctx.fillStyle   = active ? accent : color;
    ctx.strokeStyle = '#aac';
    ctx.lineWidth   = 2;

    // Cloud puffs
    [[0, 0, 24], [-20, 9, 17], [20, 9, 17], [-9, 17, 15], [9, 17, 15]].forEach(([px, py, pr]) => {
      ctx.beginPath(); ctx.arc(px, py - 16, pr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });

    // Vent hole
    ctx.fillStyle = '#6688AA';
    ctx.beginPath(); ctx.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Drip on active
    if (active) {
      ctx.fillStyle = 'rgba(130,230,130,0.85)';
      ctx.beginPath(); ctx.arc(0, 16, 8, 0, Math.PI * 2); ctx.fill();
    }
  }
}
