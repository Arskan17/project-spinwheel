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

// ---- Import and export ----

const sample = () => {
  let s = withProjects('A', 'B', 'C');
  s = L.confirmPick(s, s.wheel[0].id, 1000);
  s = L.toggleDone(L.confirmPick(s, s.wheel[0].id, 2000), s.wheel[0].id);
  return s; // wheel [C], pile [B done, A]
};

test('exportState round-trips through parseBackup', () => {
  const s = sample();
  const text = L.exportState(s, Date.UTC(2026, 10, 22, 9));
  const data = JSON.parse(text);
  assertEqual([data.app, data.version, data.exportedAt], ['project-spinwheel', 1, '2026-11-22T09:00:00.000Z']);
  assertEqual(L.parseBackup(text), s);
});

test('exportFileName uses the local date', () => {
  assertEqual(L.exportFileName(new Date(2026, 0, 5, 23, 59)), 'spinwheel-2026-01-05.json');
});

test('parseBackup rejects non-backups', () => {
  for (const raw of ['', 'not json', 'null', '5', '"x"', '[]', '{}', '{"wheel":5}', 'A\nB']) {
    assertEqual(L.parseBackup(raw), null, raw);
  }
});

test('parseBackup accepts a raw saved state and a BOM', () => {
  const s = sample();
  assertEqual(L.parseBackup('﻿' + JSON.stringify(s)), s);
  assertEqual(L.parseBackup('{"pile":[]}'), L.emptyState(), 'pile only');
});

test('parseBackup cleans items', () => {
  const s = L.parseBackup(JSON.stringify({
    wheel: [
      { id: 'a', name: '  Shed  ', extra: 1 }, { id: 'b', name: 'shed' }, { id: 'c', name: '   ' },
      { id: 'a', name: 'Repeat id' }, { id: 'd', name: 'x'.repeat(80) }, { name: 'No id' },
    ],
    pile: [
      { id: 'a', name: 'Same id as wheel', done: false, pickedAt: 1 },
      { id: 'e', name: 'Far future', done: false, pickedAt: 1e20 },
      { id: 'f', name: 'Ok', done: true, pickedAt: 5 },
    ],
  }));
  assertEqual(s.wheel, [{ id: 'a', name: 'Shed' }, { id: 'd', name: 'x'.repeat(60) }]);
  assertEqual(s.pile, [{ id: 'f', name: 'Ok', done: true, pickedAt: 5 }]);
});

test('loadState drops pile items with out-of-range dates', () => {
  const raw = JSON.stringify({ wheel: [], pile: [{ id: 'y', name: 'P', done: false, pickedAt: 1e20 }] });
  assertEqual(L.loadState(fakeStorage({ 'spinwheel:v1': raw })), L.emptyState());
});

test('mergeBackup adds new items and skips known ones', () => {
  const current = {
    wheel: [{ id: 'w1', name: 'Shed' }],
    pile: [{ id: 'p1', name: 'Old', done: false, pickedAt: 100 }],
  };
  const incoming = {
    wheel: [{ id: 'w1', name: 'Shed renamed' }, { id: 'w2', name: 'SHED' }, { id: 'w3', name: 'Bike' }],
    pile: [
      { id: 'p1', name: 'Old', done: true, pickedAt: 100 },
      { id: 'p2', name: 'Newer', done: true, pickedAt: 300 },
      { id: 'p3', name: 'Oldest', done: false, pickedAt: 50 },
    ],
  };
  const before = show(current);
  const { state, added } = L.mergeBackup(current, incoming);
  assertEqual(names(state.wheel), ['Shed', 'Bike']);
  assertEqual(names(state.pile), ['Newer', 'Old', 'Oldest']);
  assertEqual(state.pile[1].done, false, 'keeps current copy');
  assertEqual(added, 3);
  assertEqual(show(current), before, 'no mutation');
});

test('mergeBackup into empty state is the backup', () => {
  const s = sample();
  assertEqual(L.mergeBackup(L.emptyState(), s), { state: s, added: 3 });
});

test('parseNameList plain text: one per line', () => {
  assertEqual(
    L.parseNameList('﻿Fix bike, oil chain\r\n\n  Learn Rust  \rName\n'),
    ['Fix bike, oil chain', 'Learn Rust', 'Name'],
  );
  assertEqual(L.parseNameList(''), []);
});

test('parseNameList CSV: first column, quotes, delimiters, header', () => {
  const csv = [
    'Project,Priority',
    'Shed,high',
    '"Bike, oil chain",low',
    '"Say ""hi""";x',
    'Tabbed\tcol',
    'Semi;colon',
    ',empty first',
    '',
  ].join('\n');
  assertEqual(
    L.parseNameList(csv, { csv: true }),
    ['Shed', 'Bike, oil chain', 'Say "hi"', 'Tabbed', 'Semi'],
  );
  assertEqual(L.parseNameList('Shed\nBike', { csv: true }), ['Shed', 'Bike'], 'no header');
  assertEqual(L.parseNameList('Projekt;Prio\nShed;1', { csv: true }), ['Shed'], 'German header');
});

test('addNames applies addProject rules', () => {
  const s = withProjects('Shed');
  const r = L.addNames(s, ['Bike', 'shed', 'bike', 'x'.repeat(70)]);
  assertEqual(names(r.state.wheel), ['Shed', 'Bike', 'x'.repeat(60)]);
  assertEqual([r.added, r.skipped], [2, 2]);
});

// ---- Swipe deck ----

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('shuffle keeps every item and leaves the input alone', () => {
  const input = ['a', 'b', 'c', 'd'];
  const out = L.shuffle(input, Math.random);
  assertEqual([...out].sort(), input);
  assertEqual(input, ['a', 'b', 'c', 'd'], 'input untouched');
  assertEqual(L.shuffle(input, () => 0.999999), input, 'rand near 1 is identity');
});

test('drawCard deals each project once per round, then reshuffles', () => {
  const s = withProjects('A', 'B', 'C');
  const ids = s.wheel.map((p) => p.id);
  let deck = [];
  let last = null;
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const r = L.drawCard(deck, s.wheel, Math.random, last);
    seen.push(r.id);
    deck = r.deck;
    last = r.id;
  }
  assertEqual([...seen].sort(), [...ids].sort(), 'one round covers the wheel');
  const next = L.drawCard(deck, s.wheel, Math.random, last);
  assert(ids.includes(next.id), 'new round deals again');
  assertEqual(next.deck.length, 2);
});

test('drawCard never repeats the last card first after a reshuffle', () => {
  const s = withProjects('A', 'B');
  const [a, b] = s.wheel.map((p) => p.id);
  for (const r of [0, 0.5, 0.99]) {
    assertEqual(L.drawCard([], s.wheel, seq(r), a).id, b, `rand ${r}`);
  }
});

test('drawCard skips removed projects and handles an empty or single wheel', () => {
  const s = withProjects('A', 'B', 'C');
  const [a, b, c] = s.wheel.map((p) => p.id);
  const smaller = L.removeProject(s, b);
  assertEqual(L.drawCard([b, c], smaller.wheel, Math.random, a), { id: c, deck: [] });
  assertEqual(L.drawCard([a], [], Math.random, a), { id: null, deck: [] });
  const one = withProjects('Solo');
  const solo = one.wheel[0].id;
  assertEqual(L.drawCard([], one.wheel, Math.random, solo).id, solo, 'only card comes back');
});

// ---- Sections ----

const sectionNames = (ws) => ws.sections.map((s) => s.name);
const wsWith = (...ns) => ns.reduce((ws, n) => L.addSection(ws, n).ws, L.emptyWorkspace());

test('emptyWorkspace has one active, empty section', () => {
  const ws = L.emptyWorkspace();
  assertEqual(sectionNames(ws), ['My projects']);
  assertEqual(L.activeSection(ws).id, ws.activeId);
  assert(L.isBlankWorkspace(ws), 'blank');
});

test('addSection adds, switches to it, and rejects empty or duplicate names', () => {
  const ws = wsWith('  Work ');
  assertEqual(sectionNames(ws), ['My projects', 'Work']);
  assertEqual(L.activeSection(ws).name, 'Work');
  assertEqual(L.addSection(ws, '  ').error, 'empty');
  assertEqual(L.addSection(ws, 'WORK').error, 'duplicate');
});

test('renameSection keeps its own name allowed, rejects others', () => {
  const ws = wsWith('Work');
  const work = ws.sections[1].id;
  assertEqual(L.renameSection(ws, work, 'work').error, null, 'own name, new case');
  assertEqual(L.renameSection(ws, work, 'my PROJECTS').error, 'duplicate');
  assertEqual(sectionNames(L.renameSection(ws, work, 'Job').ws), ['My projects', 'Job']);
});

test('removeSection picks a neighbour and keeps the last one', () => {
  const ws = wsWith('B', 'C');
  const [a, b, c] = ws.sections.map((s) => s.id);
  assertEqual(L.removeSection(L.selectSection(ws, b), b).activeId, c, 'next');
  assertEqual(L.removeSection(ws, c).activeId, b, 'previous at the end');
  assertEqual(L.removeSection(ws, a).activeId, c, 'inactive removed, active stays');
  const one = L.emptyWorkspace();
  assertEqual(L.removeSection(one, one.activeId), one, 'last stays');
});

test('updateSection changes only that section', () => {
  const ws = wsWith('Work');
  const [home, work] = ws.sections.map((s) => s.id);
  const next = L.updateSection(ws, work, withProjects('Report'));
  assertEqual(names(next.sections[1].wheel), ['Report']);
  assertEqual(next.sections[0].wheel, [], 'other untouched');
  assertEqual(next.sections[0].id, home);
  assertEqual(ws.sections[1].wheel, [], 'no mutation');
});

test('loadWorkspace moves an older save into the first section', () => {
  const old = sample();
  const ws = L.loadWorkspace(fakeStorage({ 'spinwheel:v1': JSON.stringify(old) }));
  assertEqual(sectionNames(ws), ['My projects']);
  assertEqual(L.activeSection(ws).wheel, old.wheel);
  assertEqual(L.activeSection(ws).pile, old.pile);
});

test('loadWorkspace round-trips saveWorkspace and survives garbage', () => {
  const store = fakeStorage();
  let ws = wsWith('Work');
  ws = L.updateSection(ws, ws.activeId, sample());
  assert(L.saveWorkspace(store, ws), 'saved');
  assertEqual(L.loadWorkspace(store), ws);
  for (const raw of ['nope', '{}', '{"sections":[]}', '{"sections":[{"id":"x","name":" "}]}']) {
    assert(L.isBlankWorkspace(L.loadWorkspace(fakeStorage({ 'spinwheel:v2': raw }))), raw);
  }
});

test('exportWorkspace round-trips through parseAnyBackup', () => {
  let ws = wsWith('Work');
  ws = L.updateSection(ws, ws.activeId, sample());
  const text = L.exportWorkspace(ws, Date.UTC(2026, 10, 27, 9));
  const data = JSON.parse(text);
  assertEqual([data.app, data.version], ['project-spinwheel', 2]);
  assertEqual(L.parseAnyBackup(text), { kind: 'sections', ws });
});

test('parseAnyBackup reads older backups as a single section', () => {
  const s = sample();
  assertEqual(L.parseAnyBackup(L.exportState(s, 0)), { kind: 'single', state: s });
  for (const raw of ['', 'x', '{}', '{"sections":[]}', '{"sections":5}']) {
    assertEqual(L.parseAnyBackup(raw), null, raw);
  }
});

test('parseAnyBackup cleans sections', () => {
  const r = L.parseAnyBackup(JSON.stringify({
    activeId: 'gone',
    sections: [
      { id: 's1', name: ' Work ', wheel: [{ id: 'a', name: 'A' }] },
      { id: 's1', name: 'Same id' },
      { id: 's2', name: 'work', wheel: [{ id: 'a', name: 'Same item id' }, { id: 'b', name: 'B' }] },
      { id: 's3', name: '' },
      { name: 'No id' },
      'junk',
    ],
  }));
  assertEqual(sectionNames(r.ws), ['Work', 'work 2']);
  assertEqual(r.ws.activeId, 's1');
  assertEqual(names(r.ws.sections[1].wheel), ['B'], 'item ids unique across sections');
  assertEqual(r.ws.sections[1].pile, []);
});

test('mergeWorkspace joins by id or name and adds the rest', () => {
  let ws = wsWith('Work');
  const [home, work] = ws.sections.map((s) => s.id);
  ws = L.updateSection(ws, work, withProjects('Report'));
  ws = L.selectSection(ws, home);
  const incoming = {
    activeId: 'x',
    sections: [
      { id: home, name: 'Renamed home', wheel: [{ id: 'h1', name: 'Shed' }], pile: [] },
      { id: 'other', name: 'WORK', wheel: [{ id: 'w1', name: 'report' }, { id: 'w2', name: 'Slides' }], pile: [] },
      { id: 'new', name: 'Garden', wheel: [{ id: 'g1', name: 'Roses' }], pile: [] },
    ],
  };
  const r = L.mergeWorkspace(ws, incoming);
  assertEqual(sectionNames(r.ws), ['My projects', 'Work', 'Garden']);
  assertEqual(names(r.ws.sections[0].wheel), ['Shed']);
  assertEqual(names(r.ws.sections[1].wheel), ['Report', 'Slides']);
  assertEqual([r.added, r.addedSections], [3, 1]);
  assertEqual(r.ws.activeId, home, 'active unchanged');
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
