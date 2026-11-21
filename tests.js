// Tests for logic.js. Runs in the browser (open tests.html) or from a shell
// with macOS JavaScriptCore:
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests.js
import * as L from './logic.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, msg: e && e.message ? e.message : String(e) });
  }
}
const show = (v) => JSON.stringify(v);
function assertEqual(actual, expected, label = '') {
  if (show(actual) !== show(expected)) {
    throw new Error(`${label} expected ${show(expected)}, got ${show(actual)}`);
  }
}
function assert(cond, label) {
  if (!cond) throw new Error(label || 'assertion failed');
}
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}
const names = (list) => list.map((p) => p.name);
const withProjects = (...ns) =>
  ns.reduce((s, n) => L.addProject(s, n).state, L.emptyState());

// ---- Task 1: state and storage ----

test('addProject trims and adds', () => {
  const r = L.addProject(L.emptyState(), '  Garden shed ');
  assertEqual(names(r.state.wheel), ['Garden shed']);
  assertEqual(r.error, null);
  assert(typeof r.state.wheel[0].id === 'string' && r.state.wheel[0].id.length > 0, 'id set');
});

test('addProject rejects empty', () => {
  const r = L.addProject(L.emptyState(), '   ');
  assertEqual(r.error, 'empty');
  assertEqual(r.state.wheel.length, 0);
});

test('addProject rejects case-insensitive duplicate', () => {
  const s = withProjects('Garden shed');
  const r = L.addProject(s, ' garden SHED ');
  assertEqual(r.error, 'duplicate');
  assertEqual(r.state.wheel.length, 1);
});

test('addProject truncates to 60', () => {
  const r = L.addProject(L.emptyState(), 'a'.repeat(80));
  assertEqual(r.state.wheel[0].name.length, 60);
});

test('removeProject removes by id', () => {
  const s = withProjects('A', 'B', 'C');
  const out = L.removeProject(s, s.wheel[1].id);
  assertEqual(names(out.wheel), ['A', 'C']);
});

test('confirmPick moves to front of pile', () => {
  let s = withProjects('A', 'B', 'C');
  s = L.confirmPick(s, s.wheel[0].id, 1000);
  s = L.confirmPick(s, s.wheel[1].id, 2000); // 'C'
  assertEqual(names(s.wheel), ['B']);
  assertEqual(names(s.pile), ['C', 'A']);
  assertEqual(s.pile.map((p) => [p.done, p.pickedAt]), [[false, 2000], [false, 1000]]);
});

test('toggleDone flips done', () => {
  let s = withProjects('A');
  s = L.confirmPick(s, s.wheel[0].id, 1);
  const id = s.pile[0].id;
  s = L.toggleDone(s, id);
  assertEqual(s.pile[0].done, true);
  s = L.toggleDone(s, id);
  assertEqual(s.pile[0].done, false);
});

test('returnToWheel moves pile item to end of wheel', () => {
  let s = withProjects('A', 'B');
  s = L.confirmPick(s, s.wheel[0].id, 1);
  s = L.returnToWheel(s, s.pile[0].id);
  assertEqual(names(s.wheel), ['B', 'A']);
  assertEqual(s.pile.length, 0);
  assertEqual(Object.keys(s.wheel[1]).sort(), ['id', 'name']);
});

test('functions do not mutate input', () => {
  const s = withProjects('A', 'B');
  const before = show(s);
  L.addProject(s, 'C');
  L.confirmPick(s, s.wheel[0].id, 1);
  L.removeProject(s, s.wheel[1].id);
  assertEqual(show(s), before);
});

test('loadState round-trips saveState', () => {
  const st = fakeStorage();
  let s = withProjects('A', 'B');
  s = L.confirmPick(s, s.wheel[0].id, 5);
  assertEqual(L.saveState(st, s), true);
  assert(L.STORAGE_KEY === 'spinwheel:v1', 'key');
  assert(typeof st.data['spinwheel:v1'] === 'string', 'stored under key');
  assertEqual(L.loadState(st), s);
});

test('loadState handles garbage', () => {
  for (const raw of ['not json', 'null', '{"wheel":5}', '[]']) {
    assertEqual(L.loadState(fakeStorage({ 'spinwheel:v1': raw })), L.emptyState(), raw);
  }
  const mixed = JSON.stringify({
    wheel: [{ name: 3 }, { id: 'x', name: 'Keep' }, null],
    pile: [{ id: 'y', name: 'P', done: 'yes', pickedAt: 1 }, { id: 'z', name: 'Q', done: true, pickedAt: 2 }],
  });
  const s = L.loadState(fakeStorage({ 'spinwheel:v1': mixed }));
  assertEqual(names(s.wheel), ['Keep']);
  assertEqual(names(s.pile), ['Q']);
  assertEqual(L.loadState(fakeStorage()), L.emptyState(), 'missing key');
});

test('loadState handles throwing storage', () => {
  const st = { getItem() { throw new Error('denied'); } };
  assertEqual(L.loadState(st), L.emptyState());
});

test('saveState returns false on throw', () => {
  const st = { setItem() { throw new Error('quota'); } };
  assertEqual(L.saveState(st, L.emptyState()), false);
});

// ---- Task 2: spin geometry and slice colours ----

const TAU = Math.PI * 2;
const fixed = (v) => () => v;

test('pickIndex stays in range', () => {
  assertEqual(L.pickIndex(5, fixed(0)), 0);
  assertEqual(L.pickIndex(5, fixed(0.999999)), 4);
  assertEqual(L.pickIndex(5, fixed(1)), 4, 'clamped');
  assertEqual(L.pickIndex(1, fixed(0.5)), 0);
});

test('targetRotation lands on requested slice', () => {
  for (const n of [1, 2, 3, 7, 12]) {
    for (let index = 0; index < n; index++) {
      for (const rv of [0, 0.5, 0.9999]) {
        for (const current of [0, 1.3, 40]) {
          const r = L.targetRotation(current, index, n, fixed(rv));
          const label = `n=${n} i=${index} rand=${rv} cur=${current}`;
          assertEqual(L.indexAtPointer(r, n), index, label);
          assert(r > current, `${label}: moves forward`);
          assert(r - current >= 5 * TAU - TAU, `${label}: at least ~5 turns`);
          assert(r - current <= 9 * TAU, `${label}: at most ~8 turns`);
        }
      }
    }
  }
});

test('targetRotation keeps off borders', () => {
  for (const n of [2, 5, 9]) {
    const w = TAU / n;
    for (const rv of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const r = L.targetRotation(0.7, 1, n, fixed(rv));
      const under = (((-r) % TAU) + TAU) % TAU;
      const frac = under / w - 1; // position inside slice 1
      assert(frac >= 0.15 - 1e-9 && frac <= 0.85 + 1e-9, `n=${n} rand=${rv} frac=${frac}`);
    }
  }
});

test('sliceColors no adjacent repeats', () => {
  for (let n = 1; n <= 20; n++) {
    const c = L.sliceColors(n, 6);
    assertEqual(c.length, n, `length n=${n}`);
    for (let i = 0; i < n - 1; i++) assert(c[i] !== c[i + 1], `n=${n} i=${i} ${show(c)}`);
    if (n > 1) assert(c[n - 1] !== c[0], `wrap n=${n} ${show(c)}`);
    assert(c.every((x) => Number.isInteger(x) && x >= 0 && x < 6), `range n=${n}`);
  }
});

test('easeOutCubic endpoints', () => {
  assertEqual(L.easeOutCubic(0), 0);
  assertEqual(L.easeOutCubic(1), 1);
  assert(L.easeOutCubic(0.5) > 0.5, 'decelerates');
});

// ---- report ----
const failed = results.filter((r) => !r.ok);
const summary = `${failed.length ? 'FAIL' : 'PASS'} ${failed.length ? failed.length : results.length}`;
const lines = results.map((r) => `${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : ' — ' + r.msg}`);

if (typeof document !== 'undefined') {
  document.title = summary;
  const out = document.getElementById('out');
  out.textContent = [...lines, '', summary].join('\n');
} else if (typeof print === 'function') {
  lines.forEach((l) => print(l));
  print(summary);
  if (failed.length) throw new Error(summary); // non-zero exit for the shell
}
