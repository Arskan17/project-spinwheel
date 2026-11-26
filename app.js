import {
  addProject, removeProject, confirmPick, toggleDone, returnToWheel,
  loadState, saveState, STORAGE_KEY,
  exportState, exportFileName, parseBackup, mergeBackup, parseNameList, addNames,
  drawCard,
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
const MAX_IMPORT_BYTES = 1024 * 1024;
const MODE_KEY = 'spinwheel:mode';
const FLY_MS = 260;

const $ = (id) => document.getElementById(id);
const el = {
  wheel: $('wheel'), canvas: $('wheel-canvas'), pointer: $('pointer'), spin: $('spin'),
  empty: $('wheel-empty'), side: $('side'),
  form: $('add-form'), input: $('add-input'), addError: $('add-error'),
  wheelList: $('wheel-list'), wheelCount: $('wheel-count'),
  pileList: $('pile-list'), pileCount: $('pile-count'), pileEmpty: $('pile-empty'),
  saveNote: $('save-note'), announce: $('announce'),
  dialog: $('result'), resultName: $('result-name'), keep: $('result-keep'), again: $('result-again'),
  exportBtn: $('export'), importBtn: $('import'), importFile: $('import-file'),
  modeSpin: $('mode-spin'), modeSwipe: $('mode-swipe'),
  deck: $('deck'), card: $('card'), cardName: $('card-name'), deckEmpty: $('deck-empty'),
  deckActions: $('deck-actions'), deckYes: $('deck-yes'), deckNo: $('deck-no'),
  backupStatus: $('backup-status'), importDialog: $('import-dialog'), importTitle: $('import-title'),
};

const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

let state = loadState(storage);
let rotation = 0;
let spinning = false;
let arrivingId = null;
let pendingImport = null;
let mode = (() => { try { return storage?.getItem(MODE_KEY) === 'swipe' ? 'swipe' : 'spin'; } catch { return 'spin'; } })();
let deck = [];
let cardId = null;
let flying = false;

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
  // Not `disabled` while spinning: a disabled button drops keyboard focus.
  el.spin.disabled = n === 0;
  el.spin.setAttribute('aria-disabled', String(spinning));
  el.empty.hidden = n > 0;
  renderMode();
  renderCard();
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

// ---------- Swipe mode ----------

function renderMode() {
  const swipe = mode === 'swipe';
  el.modeSpin.setAttribute('aria-pressed', String(!swipe));
  el.modeSwipe.setAttribute('aria-pressed', String(swipe));
  el.wheel.hidden = swipe;
  el.deck.hidden = !swipe;
}

// Keep the card valid: deal one if there's none, or if its project is gone.
function renderCard() {
  if (flying || mode !== 'swipe') return;
  const before = cardId;
  if (!state.wheel.some((p) => p.id === cardId)) {
    ({ id: cardId, deck } = drawCard(deck, state.wheel, rand, cardId));
  }
  const card = state.wheel.find((p) => p.id === cardId);
  el.card.hidden = !card;
  el.deckActions.hidden = !card;
  el.deckEmpty.hidden = Boolean(card);
  if (!card) return;
  el.cardName.textContent = card.name;
  if (cardId !== before && mode === 'swipe') dealAnimation();
}

function dealAnimation() {
  el.card.classList.remove('enter');
  void el.card.offsetWidth;
  el.card.classList.add('enter');
}

function setMode(next) {
  if (mode === next || spinning) return;
  mode = next;
  cardId = null; // each visit starts a fresh shuffle
  deck = [];
  try { storage?.setItem(MODE_KEY, mode); } catch { /* not saved, fine */ }
  render();
}

function setDrag(dx) {
  const w = el.card.offsetWidth || 1;
  el.card.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 18}deg)` : '';
  el.card.style.setProperty('--yes', String(Math.max(0, Math.min(1, dx / (w * 0.35)))));
  el.card.style.setProperty('--no', String(Math.max(0, Math.min(1, -dx / (w * 0.35)))));
}

// Fly the card off to one side, then act on it and deal the next one.
function decide(accept) {
  if (flying || !cardId) return;
  const id = cardId;
  const picked = state.wheel.find((p) => p.id === id);
  if (!picked) return;
  const hadFocus = el.deck.contains(document.activeElement);
  flying = true;
  setDrag(accept ? 1 : -1); // shows the stamp even from a button press
  el.card.style.setProperty(accept ? '--yes' : '--no', '1');
  el.card.classList.remove('settle', 'enter');
  el.card.classList.add('fly');
  el.card.style.transform = `translateX(${accept ? 140 : -140}%) rotate(${accept ? 18 : -18}deg)`;

  setTimeout(() => {
    flying = false;
    el.card.classList.remove('fly');
    setDrag(0);
    if (accept) {
      ({ id: cardId, deck } = drawCard(deck, state.wheel.filter((p) => p.id !== id), rand, id));
      arrivingId = id;
      commit(confirmPick(state, id, Date.now()), `${picked.name} moved to working on and done.`);
      arrivingId = null;
    } else {
      ({ id: cardId, deck } = drawCard(deck, state.wheel, rand, id));
      render();
      const next = state.wheel.find((p) => p.id === cardId);
      el.announce.textContent = next && next.id !== id ? `Skipped. Next: ${next.name}.` : 'Skipped.';
    }
    if (cardId) dealAnimation();
    if (hadFocus) (cardId ? el.card : el.input).focus();
  }, reducedMotion.matches ? 0 : FLY_MS);
}

let drag = null;

el.card.addEventListener('pointerdown', (e) => {
  if (flying || e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, id: e.pointerId };
  el.card.setPointerCapture(e.pointerId);
  el.card.classList.remove('settle', 'enter');
  el.card.classList.add('dragging');
});

el.card.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.dx = e.clientX - drag.x;
  setDrag(drag.dx);
});

function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.id) return;
  const { dx, t } = drag;
  drag = null;
  el.card.classList.remove('dragging');
  const speed = Math.abs(dx) / Math.max(1, performance.now() - t);
  const far = Math.abs(dx) > el.card.offsetWidth * 0.35;
  const flick = Math.abs(dx) > 40 && speed > 0.6;
  if (!cancelled && (far || flick)) {
    decide(dx > 0);
  } else {
    el.card.classList.add('settle');
    setDrag(0);
  }
}

el.card.addEventListener('pointerup', (e) => endDrag(e, false));
el.card.addEventListener('pointercancel', (e) => endDrag(e, true));
el.card.addEventListener('transitionend', () => el.card.classList.remove('settle'));

el.card.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { e.preventDefault(); decide(true); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); decide(false); }
});

el.deckYes.addEventListener('click', () => decide(true));
el.deckNo.addEventListener('click', () => decide(false));
el.modeSpin.addEventListener('click', () => setMode('spin'));
el.modeSwipe.addEventListener('click', () => setMode('swipe'));

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
  el.spin.setAttribute('aria-disabled', 'true');

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

// ---------- Backup and import ----------

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const describe = (s) => `${s.wheel.length} on the wheel, ${plural(s.pile.length, 'ticket')}`;

function setStatus(message, isError = false) {
  el.backupStatus.textContent = message;
  el.backupStatus.classList.toggle('warn', isError);
}

el.exportBtn.addEventListener('click', () => {
  const now = new Date();
  const blob = new Blob([exportState(state, now.getTime())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = make('a', { href: url, download: exportFileName(now) });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus(`Exported ${describe(state)}.`);
});

el.importBtn.addEventListener('click', () => el.importFile.click());

el.importFile.addEventListener('change', async () => {
  const file = el.importFile.files[0];
  el.importFile.value = ''; // so choosing the same file again still fires
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    setStatus('That file is too big to be a spinwheel backup or name list.', true);
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch {
    setStatus('Couldn’t read that file.', true);
    return;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.json') || text.trimStart().replace(/^﻿/, '').startsWith('{')) {
    importBackup(text);
  } else {
    importNames(text, name.endsWith('.csv'));
  }
});

function importBackup(text) {
  const incoming = parseBackup(text);
  if (!incoming) {
    setStatus('That file isn’t a spinwheel backup.', true);
    return;
  }
  if (!incoming.wheel.length && !incoming.pile.length) {
    setStatus('That backup has no projects in it.', true);
    return;
  }
  if (!state.wheel.length && !state.pile.length) {
    commit(incoming);
    setStatus(`Imported ${describe(incoming)}.`);
    return;
  }
  pendingImport = incoming;
  el.importTitle.textContent = describe(incoming);
  el.importDialog.returnValue = '';
  el.importDialog.showModal();
}

el.importDialog.addEventListener('close', () => {
  const incoming = pendingImport;
  pendingImport = null;
  if (!incoming) return;
  const choice = el.importDialog.returnValue;
  if (choice === 'replace') {
    commit(incoming);
    setStatus(`Replaced with the backup: ${describe(incoming)}.`);
  } else if (choice === 'merge') {
    const total = incoming.wheel.length + incoming.pile.length;
    const { state: next, added } = mergeBackup(state, incoming);
    commit(next);
    const skipped = total - added;
    setStatus(added
      ? `Added ${plural(added, 'project')} from the backup.${skipped ? ` ${skipped} ${skipped === 1 ? 'was' : 'were'} already here.` : ''}`
      : 'Nothing new: everything in that backup is already here.');
  } else {
    setStatus('Import cancelled.');
  }
  el.importBtn.focus();
});

function importNames(text, csv) {
  const names = parseNameList(text, { csv });
  if (!names.length) {
    setStatus('No project names found in that file.', true);
    return;
  }
  const { state: next, added, skipped } = addNames(state, names);
  if (!added) {
    setStatus(`Nothing new: ${names.length === 1 ? 'that project is' : `all ${names.length} are`} already on the wheel.`);
    return;
  }
  commit(next);
  setStatus(`Added ${plural(added, 'project')} to the wheel.${skipped ? ` Skipped ${skipped} already on it.` : ''}`);
}

// In the Chrome extension the page runs in the side panel; offer the big
// wheel in a tab. Tabs opened from here carry ?view=tab and skip the link.
if (location.protocol === 'chrome-extension:'
    && new URLSearchParams(location.search).get('view') !== 'tab') {
  $('open-tab').hidden = false;
}

// Keep two open tabs (or the side panel and a tab) in step.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || spinning) return;
  state = loadState(storage);
  render();
});

new ResizeObserver(resizeCanvas).observe(el.wheel);
document.fonts?.ready.then(() => drawWheel());
render();
