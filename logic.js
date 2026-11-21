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

export function addProject(state, name) {
  const clean = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH).trim();
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
const isPileItem = (p) =>
  isWheelItem(p) && typeof p.done === 'boolean' && typeof p.pickedAt === 'number';

export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw == null) return emptyState();
    const data = JSON.parse(raw);
    if (!isObj(data) || Array.isArray(data)) return emptyState();
    const wheel = Array.isArray(data.wheel) ? data.wheel.filter(isWheelItem) : [];
    const pile = Array.isArray(data.pile) ? data.pile.filter(isPileItem) : [];
    return {
      wheel: wheel.map(({ id, name }) => ({ id, name })),
      pile: pile.map(({ id, name, done, pickedAt }) => ({ id, name, done, pickedAt })),
    };
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
