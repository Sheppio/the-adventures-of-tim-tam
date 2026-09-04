// Keyboard, mouse and thumbs.
export const keys = new Set();
export const pressed = new Set();   // cleared every frame: edge-triggered

export const touch = { left: false, right: false, jump: false, slap: false, boom: false };

const MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyJ: 'slap', KeyK: 'boom', KeyE: 'boom',
  KeyR: 'restart', KeyM: 'mute', KeyF: 'fullscreen', Enter: 'start', KeyH: 'help',
};

let holdsClear = () => {};

export function initInput(canvas, onAnyKey) {
  addEventListener('keydown', (e) => {
    const a = MAP[e.code];
    if (a) { e.preventDefault(); if (!keys.has(a)) pressed.add(a); keys.add(a); }
    if (onAnyKey) onAnyKey();
  });
  addEventListener('keyup', (e) => {
    const a = MAP[e.code];
    if (a) { e.preventDefault(); keys.delete(a); }
  });
  addEventListener('blur', () => { keys.clear(); holdsClear(); });

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (e.button === 0) { pressed.add('slap'); keys.add('slap'); }
    if (e.button === 2) { pressed.add('boom'); keys.add('boom'); }
    if (onAnyKey) onAnyKey();
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) keys.delete('slap');
    if (e.button === 2) keys.delete('boom');
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // On-screen buttons for phones. `data-btn` may name several actions, so a
  // single button can be "jump left"; held counts are tracked per action so
  // releasing the diagonal doesn't cancel a left/right button still under
  // another thumb.
  const holds = new Map();
  const clears = [];
  holdsClear = () => { holds.clear(); for (const c of clears) c(); };
  for (const el of document.querySelectorAll('[data-btn]')) {
    const acts = el.dataset.btn.split(/\s+/).filter(Boolean);
    // mouseleave fires whether or not this button was ever pressed, and a
    // stray release would decrement an action another button is holding.
    let isDown = false;
    const down = (e) => {
      e.preventDefault();
      if (isDown) return;
      isDown = true;
      for (const act of acts) {
        holds.set(act, (holds.get(act) || 0) + 1);
        touch[act] = true;
        if (!keys.has(act)) pressed.add(act);
        keys.add(act);
      }
      if (onAnyKey) onAnyKey();
    };
    const up = (e) => {
      e.preventDefault();
      if (!isDown) return;
      isDown = false;
      for (const act of acts) {
        const n = (holds.get(act) || 1) - 1;
        holds.set(act, Math.max(0, n));
        if (n <= 0) { touch[act] = false; keys.delete(act); }
      }
    };
    clears.push(() => { isDown = false; });
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }
}

export const held = (a) => keys.has(a);
export const justPressed = (a) => pressed.has(a);
export const endFrameInput = () => pressed.clear();
