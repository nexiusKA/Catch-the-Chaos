import { Game } from './game.js';

const CANVAS_W = 480;
const CANVAS_H = 700;

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;

  function resize() {
    const scaleX = window.innerWidth  / CANVAS_W;
    const scaleY = window.innerHeight / CANVAS_H;
    const scale  = Math.min(scaleX, scaleY, 1);
    canvas.style.width  = Math.floor(CANVAS_W * scale) + 'px';
    canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
  }

  resize();
  window.addEventListener('resize', resize);

  const game = new Game(canvas);
  game.run();
});
