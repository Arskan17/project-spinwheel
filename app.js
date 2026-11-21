import {
  addProject, removeProject, confirmPick, toggleDone, returnToWheel,
  loadState, saveState, STORAGE_KEY,
  pickIndex, targetRotation, indexAtPointer, sliceColors, easeOutCubic,
} from './logic.js';

const PAINTS = ['#EF5B3E', '#F2A541', '#2FA59A', '#4E86E4', '#B76AD4', '#7FBF5A'];
const C = {
  booth: '#2C2557', boothRaised: '#362E68', bulb: '#FFD166', bulbOff: '#5C4C3A',
  ticket: '#F3E9D2', ink: '#231C48', dusk: '#1F1A3D',
};
const FONT = '"Bricolage Grotesque", system-ui, sans-serif';
const TAU = Math.PI * 2;
const SPIN_MS = 4500;
const SPIN_MS_REDUCED = 600;

const $ = (id) => document.getElementById(id);
const el = {
  wheel: $('wheel'), canvas: $('wheel-canvas'), pointer: $('pointer'), spin: $('spin'),
  empty: $('wheel-empty'), side: $('side'),
  form: $('add-form'), input: $('add-input'), addError: $('add-error'),
  wheelList: $('wheel-list'), wheelCount: $('wheel-count'),
  pileList: $('pile-list'), pileCount: $('pile-count'), pileEmpty: $('pile-empty'),
  saveNote: $('save-note'), announce: $('announce'),
  dialog: $('result'), resultName: $('result-name'), keep: $('result-keep'), again: $('result-again'),
};

const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

let state = loadState(storage);
let rotation = 0;
let spinning = false;
let arrivingId = null;

function rand() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

// ---------- State changes ----------

function commit(next, message) {
  state = next;
  const saved = saveState(storage, state);
  el.saveNote.textContent = saved
    ? 'Saved in this browser.'
    : 'This browser blocks saving, so changes last only until you close the tab.';
  el.saveNote.classList.toggle('warn', !saved);
  render();
  if (message) el.announce.textContent = message;
}

// ---------- Rendering ----------

function render() {
  renderWheelList();
  renderPile();
  const n = state.wheel.length;
  el.spin.hidden = n === 0;
  el.spin.disabled = spinning || n === 0;
  el.empty.hidden = n > 0;
  drawWheel();
}

function make(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function renderWheelList() {
  const colors = sliceColors(state.wheel.length, PAINTS.length);
  el.wheelCount.textContent = state.wheel.length;
  el.wheelList.replaceChildren(...state.wheel.map((p, i) => {
    const swatch = make('span', { className: 'swatch' });
    swatch.style.background = PAINTS[colors[i]];
    const remove = make('button', {
      type: 'button', className: 'remove', textContent: '✕', title: 'Remove',
    });
    remove.dataset.action = 'remove';
    remove.dataset.id = p.id;
    remove.setAttribute('aria-label', `Remove ${p.name}`);
    return make('li', { className: 'wheel-item' }, [
      swatch, make('span', { className: 'name', textContent: p.name }), remove,
    ]);
  }));
}

function renderPile() {
  const doneCount = state.pile.filter((p) => p.done).length;
  el.pileCount.textContent = state.pile.length
    ? `${doneCount} of ${state.pile.length} done`
    : '';
  el.pileEmpty.hidden = state.pile.length > 0;
  el.pileList.replaceChildren(...state.pile.map((p) => {
    const box = make('input', { type: 'checkbox', checked: p.done });
    box.dataset.action = 'toggle';
    box.dataset.id = p.id;
    box.setAttribute('aria-label', `Mark ${p.name} as done`);
    const toggle = make('label', { className: 'done-toggle' }, [box, make('span', { textContent: 'Done' })]);

    const body = make('div', { className: 'ticket-body' }, [
      make('span', { className: 'name', textContent: p.name }),
      make('span', { className: 'meta', textContent: `Picked ${dateFmt.format(p.pickedAt)}` }),
    ]);

    const back = make('button', { type: 'button', className: 'back', textContent: 'Back to wheel' });
    back.dataset.action = 'back';
    back.dataset.id = p.id;
    back.setAttribute('aria-label', `Put ${p.name} back on the wheel`);

    const classes = ['ticket', p.done && 'done', p.id === arrivingId && 'arrive'].filter(Boolean);
    return make('li', { className: classes.join(' ') }, [toggle, body, back]);
  }));
}

// ---------- Canvas ----------

function resizeCanvas() {
  const size = el.canvas.clientWidth;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.canvas.width = Math.round(size * dpr);
  el.canvas.height = Math.round(size * dpr);
  drawWheel();
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid).trimEnd() + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + '…';
}

function drawWheel(now = performance.now()) {
  const ctx = el.canvas.getContext('2d');
  const size = el.canvas.width;
  if (!size) return;
  const R = size / 2;
  const cx = R;
  const rim = R * 0.09;
  const face = R - rim;

  ctx.clearRect(0, 0, size, size);

  // Frame with marquee bulbs. They chase while the wheel spins.
  ctx.beginPath();
  ctx.arc(cx, cx, R - 1, 0, TAU);
  ctx.fillStyle = C.booth;
  ctx.fill();

  const bulbs = 24;
  const chase = spinning && !reducedMotion.matches ? Math.floor(now / 85) : null;
  for (let k = 0; k < bulbs; k++) {
    const a = (k / bulbs) * TAU - Math.PI / 2;
    const lit = chase === null || (k + chase) % 3 === 0;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * (R - rim / 2), cx + Math.sin(a) * (R - rim / 2), rim * 0.2, 0, TAU);
    ctx.fillStyle = lit ? C.bulb : C.bulbOff;
    ctx.shadowColor = lit ? 'rgb(255 209 102 / 0.8)' : 'transparent';
    ctx.shadowBlur = lit ? rim * 0.5 : 0;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  const n = state.wheel.length;
  if (n === 0) {
    ctx.beginPath();
    ctx.arc(cx, cx, face, 0, TAU);
    ctx.fillStyle = C.boothRaised;
    ctx.fill();
    ctx.setLineDash([R * 0.02, R * 0.03]);
    ctx.strokeStyle = 'rgb(201 195 238 / 0.22)';
    ctx.lineWidth = Math.max(1, R * 0.006);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * face * 0.62, cx + Math.sin(a) * face * 0.62);
      ctx.lineTo(cx + Math.cos(a) * face * 0.95, cx + Math.sin(a) * face * 0.95);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    return;
  }

  const w = TAU / n;
  const colors = sliceColors(n, PAINTS.length);
  const startOf = (i) => -Math.PI / 2 + rotation + i * w;

  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.arc(cx, cx, face, startOf(i), startOf(i) + w);
    ctx.closePath();
    ctx.fillStyle = PAINTS[colors[i]];
    ctx.fill();
  }

  if (n > 1) {
    ctx.strokeStyle = C.dusk;
    ctx.lineWidth = Math.max(2, R * 0.008);
    for (let i = 0; i < n; i++) {
      const a = startOf(i);
      ctx.beginPath();
      ctx.moveTo(cx, cx);
      ctx.lineTo(cx + Math.cos(a) * face, cx + Math.sin(a) * face);
      ctx.stroke();
    }
    // Pegs the pointer clicks past.
    ctx.fillStyle = C.ticket;
    for (let i = 0; i < n; i++) {
      const a = startOf(i);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (face - R * 0.025), cx + Math.sin(a) * (face - R * 0.025), R * 0.012, 0, TAU);
      ctx.fill();
    }
  }

  ctx.beginPath();
  ctx.arc(cx, cx, face, 0, TAU);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(2, R * 0.012);
  ctx.stroke();

  // Labels, read from the hub outward; flipped on the left half so they stay upright.
  const outer = face - R * 0.07;
  const inner = R * 0.27;
  const room = outer - inner;
  const fontSize = Math.max(R * 0.034, Math.min(R * 0.068, w * face * 0.62 * 0.5));
  ctx.fillStyle = C.ink;
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const mid = startOf(i) + w / 2;
    const flip = Math.cos(mid) < 0;
    const name = state.wheel[i].name;
    // Shrink up to 20% to fit before truncating with an ellipsis.
    ctx.font = `700 ${fontSize}px ${FONT}`;
    const natural = ctx.measureText(name).width;
    if (natural > room) {
      ctx.font = `700 ${Math.max(fontSize * 0.8, (fontSize * room) / natural)}px ${FONT}`;
    }
    const label = fitText(ctx, name, room);
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(flip ? mid + Math.PI : mid);
    ctx.textAlign = flip ? 'left' : 'right';
    ctx.fillText(label, flip ? -outer : outer, 0);
    ctx.restore();
  }
}

// ---------- Spinning ----------

function tickPointer() {
  el.pointer.classList.remove('tick');
  void el.pointer.offsetWidth; // restart the animation
  el.pointer.classList.add('tick');
}

function spin() {
  const n = state.wheel.length;
  if (spinning || n === 0 || el.dialog.open) return;

  const index = pickIndex(n, rand);
  const pickedId = state.wheel[index].id;
  const from = rotation;
  const to = targetRotation(rotation, index, n, rand);
  const duration = reducedMotion.matches ? SPIN_MS_REDUCED : SPIN_MS;

  spinning = true;
  el.side.inert = true;
  el.spin.disabled = true;

  const t0 = performance.now();
  let lastIndex = indexAtPointer(from, n);
  const frame = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    rotation = from + (to - from) * easeOutCubic(t);
    const current = indexAtPointer(rotation, n);
    if (current !== lastIndex) {
      lastIndex = current;
      if (!reducedMotion.matches) tickPointer();
    }
    drawWheel(now);
    if (t < 1) requestAnimationFrame(frame);
    else finishSpin(pickedId, to);
  };
  requestAnimationFrame(frame);
}

function finishSpin(pickedId, to) {
  rotation = to % TAU;
  spinning = false;
  el.side.inert = false;
  render();
  const picked = state.wheel.find((p) => p.id === pickedId);
  if (!picked) return;
  el.resultName.textContent = picked.name;
  el.dialog.dataset.id = pickedId;
  el.dialog.showModal();
}

// ---------- Events ----------

el.spin.addEventListener('click', spin);

el.keep.addEventListener('click', () => {
  const id = el.dialog.dataset.id;
  const picked = state.wheel.find((p) => p.id === id);
  el.dialog.close();
  if (!picked) return;
  arrivingId = id;
  commit(confirmPick(state, id, Date.now()), `${picked.name} moved to working on and done.`);
  arrivingId = null;
  if (state.wheel.length === 0) el.input.focus();
});

el.again.addEventListener('click', () => {
  el.dialog.close();
  spin();
});

el.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const typed = el.input.value;
  const { state: next, error } = addProject(state, typed);
  if (error === 'empty') {
    el.addError.textContent = 'Type a project name first.';
    return;
  }
  if (error === 'duplicate') {
    el.addError.textContent = `“${typed.trim()}” is already on the wheel.`;
    return;
  }
  el.addError.textContent = '';
  el.input.value = '';
  commit(next, `${next.wheel.at(-1).name} added to the wheel.`);
});

el.input.addEventListener('input', () => { el.addError.textContent = ''; });

function focusAfterRemoval(list, selector, index, fallback) {
  const items = list.querySelectorAll(selector);
  (items[Math.min(index, items.length - 1)] || fallback).focus();
}

el.wheelList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="remove"]');
  if (!btn) return;
  const index = state.wheel.findIndex((p) => p.id === btn.dataset.id);
  const name = state.wheel[index]?.name;
  commit(removeProject(state, btn.dataset.id), `${name} removed.`);
  focusAfterRemoval(el.wheelList, '.remove', index, el.input);
});

el.pileList.addEventListener('change', (e) => {
  if (e.target.dataset.action !== 'toggle') return;
  const id = e.target.dataset.id;
  commit(toggleDone(state, id));
  el.pileList.querySelector(`[data-action="toggle"][data-id="${CSS.escape(id)}"]`)?.focus();
});

el.pileList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="back"]');
  if (!btn) return;
  const index = state.pile.findIndex((p) => p.id === btn.dataset.id);
  const name = state.pile[index]?.name;
  commit(returnToWheel(state, btn.dataset.id), `${name} is back on the wheel.`);
  focusAfterRemoval(el.pileList, '.back', index, el.input);
});

// Keep two open tabs in step.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || spinning) return;
  state = loadState(storage);
  render();
});

new ResizeObserver(resizeCanvas).observe(el.wheel);
document.fonts?.ready.then(() => drawWheel());
render();
