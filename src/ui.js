import { roundRect } from './utils.js';

export class UI {
  constructor(game) {
    this.game            = game;
    this.soundBtnBounds  = null;
    this.sliderBounds    = null;
  }

  // ─── HUD (in-game overlay) ──────────────────────────────────────────────────

  drawHUD(ctx) {
    const g = this.game;
    const W = g.width;
    const H = g.height;

    // Bottom bar background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, H - 32, W, 32);

    // Score (left)
    ctx.fillStyle    = '#FFD700';
    ctx.font         = 'bold 18px "Arial Black", Arial';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SCORE: ${g.score}`, 10, H - 16);

    // Lives (centre)
    ctx.font         = 'bold 18px Arial';
    ctx.textAlign    = 'center';
    // Draw each heart individually for colour
    const heartSpacing = 24;
    const heartsStartX = W / 2 - (3 * heartSpacing) / 2 + heartSpacing / 2;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < g.lives ? '#FF4444' : '#444';
      ctx.fillText('♥', heartsStartX + i * heartSpacing, H - 16);
    }

    // Combo (right of centre)
    if (g.combo > 1) {
      const comboSize = Math.min(22, 13 + g.combo);
      ctx.font      = `bold ${comboSize}px "Arial Black", Arial`;
      ctx.fillStyle = g.feverMode ? '#FF6600' : g.combo > 4 ? '#FFD700' : '#FFFFFF';
      ctx.textAlign = 'right';
      ctx.fillText(`×${g.combo} COMBO`, W - 90, H - 16);
    }

    // High score (far right)
    ctx.fillStyle    = '#888';
    ctx.font         = '13px Arial';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`BEST:${g.highScore}`, W - 6, H - 16);

    // Top-left: level
    ctx.fillStyle    = '#AAFFAA';
    ctx.font         = 'bold 13px Arial';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`LVL ${g.difficultyLevel}`, 8, 78);

    this._drawFeverMeter(ctx);
  }

  _drawFeverMeter(ctx) {
    const g  = this.game;
    const W  = 130;
    const H  = 9;
    const x  = g.width / 2 - W / 2;
    const y  = 66;

    // Track
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, x, y, W, H, 4);
    ctx.fill();

    // Fill
    const pct  = Math.max(0, Math.min(1, g.feverMeter / g.feverMax));
    const fillW = pct * W;
    if (fillW > 2) {
      const grd = ctx.createLinearGradient(x, 0, x + W, 0);
      grd.addColorStop(0, '#FF4400');
      grd.addColorStop(1, '#FFCC00');
      ctx.fillStyle = g.feverMode ? '#FF8800' : grd;
      roundRect(ctx, x, y, fillW, H, 4);
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = '#FF6600';
    ctx.lineWidth   = 1;
    roundRect(ctx, x, y, W, H, 4);
    ctx.stroke();

    // Label
    ctx.fillStyle    = '#FF9900';
    ctx.font         = `bold 9px Arial`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(g.feverMode ? '🔥 FEVER MODE!' : 'FEVER', g.width / 2, y - 2);
  }

  // ─── Menu ───────────────────────────────────────────────────────────────────

  drawMenu(ctx, t) {
    const g = this.game;
    const W = g.width;
    const H = g.height;

    ctx.save();
    ctx.textAlign = 'center';

    // Title shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font      = 'bold 54px "Arial Black", Arial';
    ctx.fillText('CATCH THE', W / 2 + 4, H * 0.28 + 4);
    ctx.fillText('CHAOS! 💨', W / 2 + 4, H * 0.28 + 64);

    // Title gradient
    const tg = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.38);
    tg.addColorStop(0, '#FFD700');
    tg.addColorStop(0.5, '#FF6600');
    tg.addColorStop(1,   '#FF0066');
    ctx.fillStyle = tg;
    ctx.font      = 'bold 54px "Arial Black", Arial';
    ctx.fillText('CATCH THE', W / 2, H * 0.28);
    ctx.fillText('CHAOS! 💨', W / 2, H * 0.28 + 60);

    // Sub-tagline
    ctx.fillStyle = '#AAFFAA';
    ctx.font      = '16px Arial';
    ctx.fillText('Catch the blobs · Dodge the spikes!', W / 2, H * 0.28 + 96);

    // Controls hint
    ctx.fillStyle = '#FFD700';
    ctx.font      = 'bold 15px Arial';
    ctx.fillText('← / → or A / D to move  |  ◀ ▶ on mobile', W / 2, H * 0.28 + 124);

    // Blinking prompt
    const pulse = 0.7 + Math.sin(t * 4) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#FFFFFF';
    ctx.font        = 'bold 20px "Arial Black", Arial';
    ctx.fillText('SPACE / ENTER / Tap to play!', W / 2, H * 0.65);
    ctx.globalAlpha = 1;

    // Sound controls (mute button + volume slider)
    this._drawSoundControls(ctx, W, H);

    // High score
    if (g.highScore > 0) {
      ctx.fillStyle = '#FFD700';
      ctx.font      = 'bold 16px Arial';
      ctx.fillText(`🏆  Best score: ${g.highScore}`, W / 2, H * 0.72);
    }

    // Legend
    this._drawLegend(ctx, W / 2, H * 0.82);

    // Version tag (bottom-right)
    ctx.fillStyle    = 'rgba(255,255,255,0.35)';
    ctx.font         = '11px Arial';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'alphabetic';
    // __APP_VERSION__ is replaced at build time by esbuild; fall back to 'dev'
    // when running directly from source so the render loop doesn't crash.
    const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
    ctx.fillText(appVersion, W - 8, H - 8);

    ctx.restore();
  }

  _drawSoundControls(ctx, W, H) {
    const audio   = this.game.audio;
    const muted   = audio.muted;
    const volume  = audio.volume;

    // Layout: mute button + volume slider, centred horizontally
    const cy      = H * 0.555;          // vertical centre of the row
    const btnW    = 30;  const btnH = 26;
    const slW     = 148; const slH  = 10;
    const gap     = 10;
    const totalW  = btnW + gap + slW;
    const startX  = W / 2 - totalW / 2;

    // ── Mute button ──────────────────────────────────────────────────────
    const bx = startX;
    const by = cy - btnH / 2;
    // Store bounds for hit-testing
    this.soundBtnBounds = { x: bx, y: by, w: btnW, h: btnH };

    ctx.fillStyle   = muted ? 'rgba(180,30,30,0.85)' : 'rgba(30,140,60,0.85)';
    ctx.strokeStyle = muted ? '#FF6666' : '#66FF99';
    ctx.lineWidth   = 1.5;
    roundRect(ctx, bx, by, btnW, btnH, 6);
    ctx.fill(); ctx.stroke();

    ctx.font         = '16px Arial';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#FFFFFF';
    ctx.fillText(muted ? '🔇' : '🔊', bx + btnW / 2, cy);

    // ── Volume slider ────────────────────────────────────────────────────
    const sx = startX + btnW + gap;
    const sy = cy - slH / 2;
    // Store bounds for hit-testing
    this.sliderBounds = { x: sx, y: sy, w: slW, h: slH };

    // Track (background)
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, sx, sy, slW, slH, 5);
    ctx.fill();

    // Track fill
    const fillW = volume * slW;
    if (fillW > 2) {
      const grd = ctx.createLinearGradient(sx, 0, sx + slW, 0);
      grd.addColorStop(0, '#44AAFF');
      grd.addColorStop(1, '#AA44FF');
      ctx.fillStyle = muted ? '#555' : grd;
      roundRect(ctx, sx, sy, fillW, slH, 5);
      ctx.fill();
    }

    // Track border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 1;
    roundRect(ctx, sx, sy, slW, slH, 5);
    ctx.stroke();

    // Thumb
    const tx = sx + volume * slW;
    ctx.fillStyle = muted ? '#777' : '#FFFFFF';
    ctx.beginPath();
    ctx.arc(tx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = muted ? '#999' : '#AADDFF';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Volume percentage label
    ctx.font         = 'bold 11px Arial';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle    = 'rgba(200,200,200,0.8)';
    ctx.fillText(`${Math.round(volume * 100)}%`, sx + slW + 18, cy + 4);
  }

  _drawLegend(ctx, cx, cy) {
    const items = [
      { color: '#7FFF00', label: 'Catch these  → points' },
      { color: '#FF2222', label: 'Avoid these  → lose a life' },
      { color: '#FFD700', label: 'Special  → power-up!' },
    ];
    ctx.font      = '13px Arial';
    ctx.textAlign = 'left';
    items.forEach((item, i) => {
      const y = cy + i * 20;
      ctx.fillStyle = item.color;
      ctx.beginPath(); ctx.arc(cx - 90, y - 4, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#CCC';
      ctx.fillText(item.label, cx - 80, y);
    });
  }

  // ─── Game Over ───────────────────────────────────────────────────────────────

  drawGameOver(ctx, t) {
    const g = this.game;
    const W = g.width;
    const H = g.height;

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.textAlign = 'center';

    // Panel
    const panelW = 340;
    const panelH = 310;
    const panelX = W / 2 - panelW / 2;
    const panelY = H / 2 - panelH / 2;
    ctx.fillStyle   = 'rgba(10,10,40,0.96)';
    ctx.strokeStyle = '#FF6600';
    ctx.lineWidth   = 4;
    roundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.fill();
    ctx.stroke();

    // Game Over title
    ctx.fillStyle = '#FF4444';
    ctx.font      = 'bold 46px "Arial Black", Arial';
    ctx.fillText('GAME OVER', W / 2, panelY + 62);

    // Score
    ctx.fillStyle = '#FFD700';
    ctx.font      = 'bold 26px Arial';
    ctx.fillText(`Score:  ${g.score}`, W / 2, panelY + 108);

    // Max combo
    ctx.fillStyle = '#AAAAAA';
    ctx.font      = '18px Arial';
    ctx.fillText(`Best combo: ×${g.maxCombo}`, W / 2, panelY + 138);

    // Level reached
    ctx.fillStyle = '#AAFFAA';
    ctx.font      = '16px Arial';
    ctx.fillText(`Level reached: ${g.difficultyLevel}`, W / 2, panelY + 164);

    // High score
    if (g.score > 0 && g.score >= g.highScore) {
      ctx.fillStyle = '#FFD700';
      ctx.font      = 'bold 19px "Arial Black", Arial';
      ctx.fillText('🏆  NEW HIGH SCORE!  🏆', W / 2, panelY + 198);
    } else {
      ctx.fillStyle = '#888';
      ctx.font      = '15px Arial';
      ctx.fillText(`High score: ${g.highScore}`, W / 2, panelY + 198);
    }

    // Restart prompt (pulsing)
    const pulse = 0.7 + Math.sin(t * 4) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#FFFFFF';
    ctx.font        = 'bold 18px "Arial Black", Arial';
    ctx.fillText('SPACE / R / Tap  to restart', W / 2, panelY + 256);
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}
