// Pure state and spin logic for Project Spinwheel. No DOM access here.
// Section state: { wheel: [{ id, name }], pile: [{ id, name, done, pickedAt }] }.
// Several sections make a workspace, see "Sections" below.

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
  return tidyState(pickState(data), new Set());
}

// Trim names, drop repeated ids (tracked in `ids`) and repeated wheel names.
function tidyState(picked, ids) {
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

// ---- Sections ----
// A workspace holds several sections, each with its own wheel and pile:
// { sections: [{ id, name, wheel, pile }], activeId }. The functions above
// work on one section's { wheel, pile }; these manage the list around them.
// Older saves (a single wheel and pile) become the first section.

export const WORKSPACE_KEY = 'spinwheel:v2';
export const DEFAULT_SECTION_NAME = 'My projects';
export const WORKSPACE_VERSION = 2;

const sectionData = ({ wheel, pile }) => ({ wheel, pile });

export function newSection(name, data = emptyState()) {
  return { id: newId(), name, ...sectionData(data) };
}

export function emptyWorkspace() {
  const first = newSection(DEFAULT_SECTION_NAME);
  return { sections: [first], activeId: first.id };
}

export function activeSection(ws) {
  return ws.sections.find((s) => s.id === ws.activeId) ?? ws.sections[0];
}

export function selectSection(ws, id) {
  return ws.sections.some((s) => s.id === id) ? { ...ws, activeId: id } : ws;
}

// Replace one section's wheel and pile.
export function updateSection(ws, id, data) {
  return {
    ...ws,
    sections: ws.sections.map((s) => (s.id === id ? { ...s, ...sectionData(data) } : s)),
  };
}

function checkSectionName(ws, name, exceptId = null) {
  const clean = cleanName(name);
  if (!clean) return { clean, error: 'empty' };
  if (ws.sections.some((s) => s.id !== exceptId && sameName(s.name, clean))) {
    return { clean, error: 'duplicate' };
  }
  return { clean, error: null };
}

// Add a section and switch to it.
export function addSection(ws, name) {
  const { clean, error } = checkSectionName(ws, name);
  if (error) return { ws, error };
  const section = newSection(clean);
  return { ws: { sections: [...ws.sections, section], activeId: section.id }, error: null };
}

export function renameSection(ws, id, name) {
  const { clean, error } = checkSectionName(ws, name, id);
  if (error) return { ws, error };
  return {
    ws: { ...ws, sections: ws.sections.map((s) => (s.id === id ? { ...s, name: clean } : s)) },
    error: null,
  };
}

// Remove a section. The last one stays. If it was active, its neighbour
// (the next one, or the previous one at the end) becomes active.
export function removeSection(ws, id) {
  const index = ws.sections.findIndex((s) => s.id === id);
  if (index < 0 || ws.sections.length < 2) return ws;
  const sections = ws.sections.filter((s) => s.id !== id);
  const activeId = ws.activeId === id
    ? sections[Math.min(index, sections.length - 1)].id
    : ws.activeId;
  return { sections, activeId };
}

export const isEmptySection = (s) => s.wheel.length === 0 && s.pile.length === 0;

// Nothing worth keeping: one section, nothing in it.
export const isBlankWorkspace = (ws) => ws.sections.length === 1 && isEmptySection(ws.sections[0]);

// "Name", then "Name 2", "Name 3"… until it's free.
function uniqueName(name, taken) {
  const free = (n) => !taken.some((t) => sameName(t, n));
  if (free(name)) return name;
  for (let k = 2; ; k++) {
    const suffix = ` ${k}`;
    const candidate = name.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd() + suffix;
    if (free(candidate)) return candidate;
  }
}

// Keep only well-formed sections. Names are cleaned and made unique, section
// ids are kept unique, item ids are unique within each section (the same item
// id may appear in several sections, e.g. after importing one backup twice;
// every item operation works inside one section), and a
// missing or unknown activeId falls back to the first section. Returns null
// when there's no usable section.
function pickWorkspace(data) {
  if (!isObj(data) || !Array.isArray(data.sections)) return null;
  const sectionIds = new Set();
  const sections = [];
  for (const raw of data.sections) {
    if (!isObj(raw) || typeof raw.id !== 'string' || sectionIds.has(raw.id)) continue;
    const name = cleanName(raw.name);
    if (!name) continue;
    sectionIds.add(raw.id);
    const picked = pickState(raw);
    sections.push({
      id: raw.id,
      name: uniqueName(name, sections.map((s) => s.name)),
      ...tidyState(picked, new Set()),
    });
  }
  if (!sections.length) return null;
  const activeId = sectionIds.has(data.activeId) ? data.activeId : sections[0].id;
  return { sections, activeId };
}

// Load the saved workspace, or turn an older single-wheel save into one.
export function loadWorkspace(storage) {
  try {
    const raw = storage.getItem(WORKSPACE_KEY);
    if (raw != null) {
      const ws = pickWorkspace(JSON.parse(raw));
      if (ws) return ws;
    }
  } catch { /* fall through */ }
  const old = loadState(storage);
  const ws = emptyWorkspace();
  return isEmptySection(old) ? ws : updateSection(ws, ws.activeId, old);
}

export function saveWorkspace(storage, ws) {
  try {
    storage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
    return true;
  } catch {
    return false;
  }
}

export function exportWorkspace(ws, now) {
  return JSON.stringify({
    app: BACKUP_APP,
    version: WORKSPACE_VERSION,
    exportedAt: new Date(now).toISOString(),
    activeId: ws.activeId,
    sections: ws.sections.map(({ id, name, wheel, pile }) => ({
      id,
      name,
      wheel: wheel.map(({ id, name }) => ({ id, name })),
      pile: pile.map(({ id, name, done, pickedAt }) => ({ id, name, done, pickedAt })),
    })),
  }, null, 2) + '\n';
}

// Parse any backup. Returns
//   { kind: 'sections', ws }  for a backup with sections,
//   { kind: 'single', state } for an older one with a single wheel and pile,
//   or null when it isn't a backup.
export function parseAnyBackup(text) {
  let data;
  try {
    data = JSON.parse(stripBom(text));
  } catch {
    return null;
  }
  if (isObj(data) && Array.isArray(data.sections)) {
    const ws = pickWorkspace(data);
    return ws ? { kind: 'sections', ws } : null;
  }
  const state = parseBackup(text);
  return state ? { kind: 'single', state } : null;
}

// Merge a backup with sections into the workspace. An incoming section joins
// the section with the same id, or else the same name, through mergeBackup;
// the rest come in as new sections. The active section stays the same.
export function mergeWorkspace(ws, incoming) {
  let sections = [...ws.sections];
  let added = 0;
  let addedSections = 0;
  for (const inc of incoming.sections) {
    const i = sections.findIndex((s) => s.id === inc.id);
    const match = i >= 0 ? i : sections.findIndex((s) => sameName(s.name, inc.name));
    if (match >= 0) {
      const r = mergeBackup(sections[match], inc);
      sections[match] = { ...sections[match], ...r.state };
      added += r.added;
    } else {
      sections = [...sections, { ...inc }];
      added += inc.wheel.length + inc.pile.length;
      addedSections++;
    }
  }
  return { ws: { ...ws, sections }, added, addedSections };
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
