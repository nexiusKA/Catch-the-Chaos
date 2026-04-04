export class InputHandler {
  constructor() {
    this.keys = {};
    this._virtual = {}; // virtual button state set by touch controls

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);

    this._bindMobileButtons();
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
    // Prevent page scroll while playing
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  /** Wire up the on-screen left/right buttons. */
  _bindMobileButtons() {
    const btnLeft  = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    if (!btnLeft || !btnRight) return;

    const press = (code, el) => {
      this._virtual[code] = true;
      el.classList.add('pressed');
    };
    const release = (code, el) => {
      this._virtual[code] = false;
      el.classList.remove('pressed');
    };

    // Touch events (multi-touch aware)
    btnLeft.addEventListener('touchstart',  e => { e.preventDefault(); press('ArrowLeft', btnLeft); },   { passive: false });
    btnLeft.addEventListener('touchend',    e => { e.preventDefault(); release('ArrowLeft', btnLeft); }, { passive: false });
    btnLeft.addEventListener('touchcancel', e => { e.preventDefault(); release('ArrowLeft', btnLeft); }, { passive: false });

    btnRight.addEventListener('touchstart',  e => { e.preventDefault(); press('ArrowRight', btnRight); },   { passive: false });
    btnRight.addEventListener('touchend',    e => { e.preventDefault(); release('ArrowRight', btnRight); }, { passive: false });
    btnRight.addEventListener('touchcancel', e => { e.preventDefault(); release('ArrowRight', btnRight); }, { passive: false });

    // Mouse fallback (for desktop testing of the buttons)
    btnLeft.addEventListener('mousedown',  () => press('ArrowLeft', btnLeft));
    btnLeft.addEventListener('mouseup',    () => release('ArrowLeft', btnLeft));
    btnLeft.addEventListener('mouseleave', () => release('ArrowLeft', btnLeft));

    btnRight.addEventListener('mousedown',  () => press('ArrowRight', btnRight));
    btnRight.addEventListener('mouseup',    () => release('ArrowRight', btnRight));
    btnRight.addEventListener('mouseleave', () => release('ArrowRight', btnRight));
  }

  isDown(...codes) {
    return codes.some(c => !!this.keys[c] || !!this._virtual[c]);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
  }
}
