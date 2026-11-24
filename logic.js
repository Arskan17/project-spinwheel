// Pure state and spin logic for Project Spinwheel. No DOM access here.
// State shape: { wheel: [{ id, name }], pile: [{ id, name, done, pickedAt }] }

export const STORAGE_KEY = 'spinwheel:v1';
export const MAX_NAME_LENGTH = 60;

export function emptyState() {
  return { wheel: [], pile: [] };
}

function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
const cleanName = (name) => String(name ?? '').trim().slice(0, MAX_NAME_LENGTH).trim();

export function addProject(state, name) {
  const clean = cleanName(name);
  if (!clean) return { state, error: 'empty' };
  if (state.wheel.some((p) => sameName(p.name, clean))) return { state, error: 'duplicate' };
  return {
    state: { ...state, wheel: [...state.wheel, { id: newId(), name: clean }] },
    error: null,
  };
}

export function removeProject(state, id) {
  return { ...state, wheel: state.wheel.filter((p) => p.id !== id) };
}

export function confirmPick(state, id, now) {
  const item = state.wheel.find((p) => p.id === id);
  if (!item) return state;
  return {
    wheel: state.wheel.filter((p) => p.id !== id),
    pile: [{ id: item.id, name: item.name, done: false, pickedAt: now }, ...state.pile],
  };
}

export function toggleDone(state, id) {
  return {
    ...state,
    pile: state.pile.map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
  };
}

export function returnToWheel(state, id) {
  const item = state.pile.find((p) => p.id === id);
  if (!item) return state;
  return {
    wheel: [...state.wheel, { id: item.id, name: item.name }],
    pile: state.pile.filter((p) => p.id !== id),
  };
}

const isObj = (v) => v !== null && typeof v === 'object';
const validName = (v) => typeof v === 'string' && v.trim().length > 0;
const isWheelItem = (p) => isObj(p) && typeof p.id === 'string' && validName(p.name);
// Dates outside ±8.64e15 ms make Intl.DateTimeFormat throw while rendering.
const isTime = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 8.64e15;
const isPileItem = (p) => isWheelItem(p) && typeof p.done === 'boolean' && isTime(p.pickedAt);

// Keep only well-formed items and known fields. Returns null for non-objects.
function pickState(data) {
  if (!isObj(data) || Array.isArray(data)) return null;
  const wheel = Array.isArray(data.wheel) ? data.wheel.filter(isWheelItem) : [];
  const pile = Array.isArray(data.pile) ? data.pile.filter(isPileItem) : [];
  return {
    wheel: wheel.map(({ id, name }) => ({ id, name })),
    pile: pile.map(({ id, name, done, pickedAt }) => ({ id, name, done, pickedAt })),
  };
}

export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw == null) return emptyState();
    return pickState(JSON.parse(raw)) ?? emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ---- Chrome sync (extension only) ----
// chrome.storage.sync allows 8 KB per entry and 512 entries, so the state is
// stored as one small entry per project, not one big value. Edits to
// different projects on two computers then merge instead of overwriting.
// Entry: key SYNC_PREFIX + id, value { n: name, o: position } on the wheel,
// plus d (done) and t (pickedAt) for tickets.

export const SYNC_PREFIX = 'spinwheel:p:';
export const SYNC_MAX_PROJECTS = 500;

export function toSyncItems(state) {
  const items = {};
  state.wheel.forEach((p, o) => { items[SYNC_PREFIX + p.id] = { n: p.name, o }; });
  state.pile.forEach((p, o) => {
    items[SYNC_PREFIX + p.id] = { n: p.name, o, d: p.done, t: p.pickedAt };
  });
  return items;
}

// Only the project entries from everything chrome.storage.sync returned.
export function syncItemsOnly(all) {
  const items = {};
  if (!isObj(all)) return items;
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(SYNC_PREFIX) && key.length > SYNC_PREFIX.length) items[key] = value;
  }
  return items;
}

export function fromSyncItems(all) {
  const wheel = [];
  const pile = [];
  for (const [key, v] of Object.entries(syncItemsOnly(all))) {
    if (!isObj(v)) continue;
    const id = key.slice(SYNC_PREFIX.length);
    const o = Number.isFinite(v.o) ? v.o : Number.MAX_SAFE_INTEGER;
    if ('t' in v) pile.push({ o, id, item: { id, name: v.n, done: v.d, pickedAt: v.t } });
    else wheel.push({ o, id, item: { id, name: v.n } });
  }
  // Ties (two computers appending at once) break by id, the same everywhere.
  const ordered = (xs) => xs
    .sort((a, b) => a.o - b.o || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((x) => x.item);
  return pickState({ wheel: ordered(wheel), pile: ordered(pile) });
}

// What to write to get from one set of entries to the next.
export function syncChanges(prev, next) {
  const set = {};
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(value)) set[key] = value;
  }
  const remove = Object.keys(prev).filter((key) => !(key in next));
  return { set, remove };
}

// ---- Import and export ----
// A backup is the saved state plus a small header, as pretty-printed JSON.
// A name list is plain text, one project per line; for CSV the first column.

export const BACKUP_APP = 'project-spinwheel';
export const BACKUP_VERSION = 1;

const stripBom = (text) => String(text ?? '').replace(/^﻿/, '');
const pad2 = (n) => String(n).padStart(2, '0');

export function exportState(state, now) {
  return JSON.stringify({
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    wheel: state.wheel.map(({ id, name }) => ({ id, name })),
    pile: state.pile.map(({ id, name, done, pickedAt }) => ({ id, name, done, pickedAt })),
  }, null, 2) + '\n';
}

// Local date, so an evening export isn't named after tomorrow.
export function exportFileName(date) {
  return `spinwheel-${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.json`;
}

// Parse a backup file (or a raw localStorage value). Returns a clean state,
// or null when the text isn't JSON with a wheel or pile list.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(stripBom(text));
  } catch {
    return null;
  }
  if (!isObj(data) || (!Array.isArray(data.wheel) && !Array.isArray(data.pile))) return null;
  const picked = pickState(data);
  const ids = new Set();
  const firstId = (p) => !ids.has(p.id) && ids.add(p.id);
  const tidy = (list) =>
    list.map((p) => ({ ...p, name: cleanName(p.name) })).filter((p) => p.name && firstId(p));
  const wheel = [];
  for (const p of tidy(picked.wheel)) {
    if (!wheel.some((q) => sameName(q.name, p.name))) wheel.push(p);
  }
  return { wheel, pile: tidy(picked.pile) };
}

// Add a backup to the current state. Items whose id is already here are
// skipped, as are wheel names already on the wheel. The pile stays newest first.
export function mergeBackup(state, incoming) {
  const ids = new Set([...state.wheel, ...state.pile].map((p) => p.id));
  const wheel = [...state.wheel];
  for (const p of incoming.wheel) {
    if (ids.has(p.id) || wheel.some((q) => sameName(q.name, p.name))) continue;
    wheel.push(p);
    ids.add(p.id);
  }
  const newPile = incoming.pile.filter((p) => !ids.has(p.id));
  const pile = [...state.pile, ...newPile].sort((a, b) => b.pickedAt - a.pickedAt);
  const added = wheel.length - state.wheel.length + newPile.length;
  return { state: { wheel, pile }, added };
}

// Header cells skipped at the top of a CSV (English and German).
const NAME_HEADERS = new Set(['name', 'names', 'project', 'projects', 'projekt', 'projekte']);

// First field of a CSV line. Handles quotes ("a, b" and "say ""hi""") and
// comma, semicolon (Excel in many locales) or tab as the delimiter.
function firstCsvField(line) {
  const s = line.trimStart();
  if (!s.startsWith('"')) return s.split(/[,;\t]/)[0];
  let out = '';
  for (let i = 1; i < s.length; i++) {
    if (s[i] !== '"') out += s[i];
    else if (s[i + 1] === '"') { out += '"'; i++; }
    else break;
  }
  return out;
}

export function parseNameList(text, { csv = false } = {}) {
  const names = stripBom(text)
    .split(/\r\n|\n|\r/)
    .map((line) => (csv ? firstCsvField(line) : line).trim())
    .filter(Boolean);
  if (csv && names.length && NAME_HEADERS.has(names[0].toLowerCase())) names.shift();
  return names;
}

// Add names to the wheel with the same rules as typing them in.
export function addNames(state, names) {
  let next = state;
  let added = 0;
  for (const name of names) {
    const r = addProject(next, name);
    if (!r.error) { next = r.state; added++; }
  }
  return { state: next, added, skipped: names.length - added };
}

// ---- Swipe deck ----
// Swipe mode deals the wheel's projects one at a time in random order. A deck
// is the list of ids still to come this round; when it runs out, the whole
// wheel is shuffled into a new round.

export function shuffle(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Draw the next card. Ids no longer on the wheel are dropped. `lastId` (the
// card just shown) is never dealt straight back unless it's the only one left.
// Projects added mid-round join at the next reshuffle.
export function drawCard(deck, wheel, rand, lastId = null) {
  const onWheel = new Set(wheel.map((p) => p.id));
  let rest = deck.filter((id) => onWheel.has(id) && id !== lastId);
  if (!rest.length) {
    rest = shuffle([...onWheel], rand);
    if (rest.length > 1 && rest[0] === lastId) [rest[0], rest[1]] = [rest[1], rest[0]];
  }
  return { id: rest[0] ?? null, deck: rest.slice(1) };
}

// ---- Spin geometry ----
// Slice i spans [i*w, (i+1)*w) radians clockwise from the pointer (top) when
// the wheel's rotation is 0, with w = 2π/n. Rotating the wheel clockwise by r
// puts wheel-angle (-r mod 2π) under the pointer.

const TAU = Math.PI * 2;
const mod = (a, m) => ((a % m) + m) % m;

export function pickIndex(n, rand) {
  return Math.min(n - 1, Math.floor(rand() * n));
}

export function indexAtPointer(rotation, n) {
  const w = TAU / n;
  return Math.min(n - 1, Math.floor(mod(-rotation, TAU) / w));
}

export function targetRotation(current, index, n, rand) {
  const w = TAU / n;
  const turns = Math.min(8, 5 + Math.floor(rand() * 4));
  const offset = 0.15 + 0.7 * rand();
  const angle = (index + offset) * w;
  const delta = mod(-angle - current, TAU);
  return current + delta + turns * TAU;
}

// Palette indices for n slices; neighbours (including last → first) differ.
export function sliceColors(n, paletteSize) {
  const colors = Array.from({ length: n }, (_, i) => i % paletteSize);
  if (n > 1 && colors[n - 1] === colors[0]) {
    let c = colors[n - 1];
    do c = (c + 1) % paletteSize;
    while (c === colors[0] || c === colors[n - 2]);
    colors[n - 1] = c;
  }
  return colors;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
