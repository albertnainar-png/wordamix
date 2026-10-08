const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { adjacent } = require('../js/engine.js');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const Sel={');
const endMarker = '};grid.addEventListener';
const end = html.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, 'Could not locate the live Sel controller in index.html');

const source = html.slice(start, end + 2);
let sel = [];
let state = 'PLAYING';
let paintCalls = 0;
let submitCalls = 0;
const grid = {
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 500, height: 500, right: 500, bottom: 500 };
  }
};

const context = {
  adjacent,
  grid,
  sel,
  S: state,
  paint() { paintCalls++; },
  submit() { submitCalls++; }
};
vm.createContext(context);
vm.runInContext(source + '\nthis.Sel = Sel;', context);
const Sel = context.Sel;

function reset() {
  sel.length = 0;
  Sel.id = null;
  Sel.last = -1;
  paintCalls = 0;
  submitCalls = 0;
  context.S = 'PLAYING';
}

function cellCenter(index) {
  const row = Math.floor(index / 5);
  const col = index % 5;
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

function beginAt(index) {
  const p = cellCenter(index);
  Sel.begin(p.x, p.y);
}

function moveTo(index) {
  const p = cellCenter(index);
  Sel.move({ clientX: p.x, clientY: p.y });
}

function assertAdjacentPath(path) {
  for (let i = 1; i < path.length; i++) {
    assert.equal(adjacent(path[i - 1], path[i]), true, `non-adjacent step: ${path[i - 1]} -> ${path[i]}`);
  }
}

// Horizontal
reset();
beginAt(0); moveTo(4);
assert.deepEqual(sel, [0, 1, 2, 3, 4]);

// Vertical
reset();
beginAt(0); moveTo(20);
assert.deepEqual(sel, [0, 5, 10, 15, 20]);

// Main diagonal
reset();
beginAt(0); moveTo(24);
assert.deepEqual(sel, [0, 6, 12, 18, 24]);

// Reverse diagonal
reset();
beginAt(4); moveTo(20);
assert.deepEqual(sel, [4, 8, 12, 16, 20]);

// Fast diagonal jump: every interpolated cell must remain adjacent.
reset();
beginAt(0); moveTo(13);
assert.deepEqual(sel, [0, 6, 7, 13]);
assertAdjacentPath(sel);

// Direction changes
reset();
beginAt(0); moveTo(6); moveTo(12); moveTo(17);
assert.deepEqual(sel, [0, 6, 12, 17]);

// Non-adjacent jump must be rejected.
reset();
beginAt(0);
assert.equal(Sel.add(12), false);
assert.deepEqual(sel, [0]);

// Tile reuse must be rejected.
reset();
beginAt(0); moveTo(6);
assert.equal(Sel.add(0), false);
assert.deepEqual(sel, [0, 6]);

// Bounds from the controller itself.
reset();
assert.equal(Sel.add(-1), false);
assert.equal(Sel.add(25), false);
assert.deepEqual(sel, []);

// Out-of-grid pointer coordinates must not start a selection.
reset();
Sel.begin(-10, 250);
assert.equal(Sel.id, null);
assert.deepEqual(sel, []);

// Pointer lifecycle submits exactly once.
reset();
beginAt(0); moveTo(6); Sel.end();
assert.equal(submitCalls, 1);
assert.equal(Sel.id, null);

// Cancel clears the active path without submitting.
reset();
beginAt(0); moveTo(6); Sel.cancel();
assert.equal(submitCalls, 0);
assert.deepEqual(sel, []);
assert.equal(Sel.id, null);

console.log('WORDAMIX selection matrix: 12/12 passed');
