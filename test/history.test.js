import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPixelDiff, createHistory, createPixelDiff, DEFAULT_HISTORY_LIMIT } from '../src/history.js';
import { createEditor } from '../src/editor.js';
import { getPalette } from '../src/palettes.js';

const RED = '#d8433b';
const BLUE = '#3e9bd6';
const YELLOW = '#f7d154';

/** Deterministic PRNG (mulberry32). */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dimensions and pixels of the editor right now. */
function snapshot(editor) {
  const { width, height, pixels } = editor.getState();
  return { width, height, pixels };
}

/** Presses at the first point, moves through the rest, releases. */
function drag(editor, ...points) {
  const [first, ...rest] = points;
  editor.pointerDown(...first);
  for (const point of rest) editor.pointerMove(...point);
  editor.pointerUp();
}

/** Undoes every step, then redoes every step, checking the exact grid each time. */
function assertWalksThrough(editor, snapshots) {
  for (let i = snapshots.length - 2; i >= 0; i -= 1) {
    assert.ok(editor.undo(), `undo to snapshot ${i}`);
    assert.deepEqual(snapshot(editor), snapshots[i], `after undo to snapshot ${i}`);
  }
  assert.equal(editor.undo(), false, 'nothing left to undo');
  for (let i = 1; i < snapshots.length; i += 1) {
    assert.ok(editor.redo(), `redo to snapshot ${i}`);
    assert.deepEqual(snapshot(editor), snapshots[i], `after redo to snapshot ${i}`);
  }
  assert.equal(editor.redo(), false, 'nothing left to redo');
}

describe('createPixelDiff / applyPixelDiff', () => {
  test('a diff stores only the cells that really changed, sorted by index', () => {
    const pixels = [RED, null, BLUE, null];
    const originals = new Map([[2, RED], [0, RED], [3, null]]);
    assert.deepEqual(createPixelDiff(originals, pixels), {
      type: 'pixels',
      indices: [2],
      before: [RED],
      after: [BLUE],
    });
    assert.equal(createPixelDiff(new Map([[0, RED]]), pixels), null);
    assert.equal(createPixelDiff(new Map(), pixels), null);
  });

  test('applying the before and after sides restores both states exactly', () => {
    const original = [null, RED, null, BLUE];
    const changed = [YELLOW, RED, null, null];
    const diff = createPixelDiff(new Map([[0, null], [3, BLUE]]), changed);
    const pixels = changed.slice();
    applyPixelDiff(pixels, diff, 'before');
    assert.deepEqual(pixels, original);
    applyPixelDiff(pixels, diff, 'after');
    assert.deepEqual(pixels, changed);
  });
});

describe('createHistory', () => {
  test('undo and redo move steps between the two stacks in order', () => {
    const history = createHistory();
    assert.equal(history.canUndo(), false);
    history.push('a');
    history.push('b');
    assert.equal(history.undo(), 'b');
    assert.equal(history.canRedo(), true);
    assert.equal(history.undo(), 'a');
    assert.equal(history.undo(), null);
    assert.equal(history.redo(), 'a');
    assert.equal(history.redo(), 'b');
    assert.equal(history.redo(), null);
  });

  test('a new step clears the redo stack', () => {
    const history = createHistory();
    history.push('a');
    history.push('b');
    history.undo();
    history.push('c');
    assert.equal(history.canRedo(), false);
    assert.equal(history.undo(), 'c');
    assert.equal(history.undo(), 'a');
  });

  test('drops the oldest steps beyond the limit', () => {
    const history = createHistory(3);
    ['a', 'b', 'c', 'd', 'e'].forEach((step) => history.push(step));
    assert.deepEqual([history.undo(), history.undo(), history.undo(), history.undo()], ['e', 'd', 'c', null]);
  });

  test('clear forgets everything', () => {
    const history = createHistory();
    history.push('a');
    history.push('b');
    history.undo();
    history.clear();
    assert.equal(history.canUndo(), false);
    assert.equal(history.canRedo(), false);
  });
});

describe('editor undo/redo', () => {
  test('DONE criterion: every kind of step is undone and redone to the exact pixel data', () => {
    const editor = createEditor({ size: 16 });
    const snapshots = [snapshot(editor)];
    const step = (action) => {
      action();
      const next = snapshot(editor);
      assert.notDeepEqual(next, snapshots.at(-1), 'each step must change the canvas');
      snapshots.push(next);
    };

    step(() => {
      editor.setColor(RED);
      drag(editor, [1, 1], [6, 4], [2, 9]);
    });
    step(() => {
      editor.setTool('line');
      drag(editor, [3, 0], [9, 7], [15, 12]);
    });
    step(() => {
      editor.setTool('rect');
      editor.setRectFilled(true);
      drag(editor, [8, 8], [12, 14]);
    });
    step(() => {
      editor.setTool('fill');
      editor.setColor(BLUE);
      drag(editor, [0, 15]);
    });
    step(() => {
      editor.setTool('eraser');
      drag(editor, [0, 0], [15, 15]);
    });
    step(() => {
      editor.setTool('pencil');
      editor.setColor(YELLOW);
      editor.setMirror({ horizontal: true, vertical: true });
      drag(editor, [2, 2], [5, 3]);
    });
    step(() => editor.resize(32));
    step(() => {
      editor.setTool('rect');
      editor.setRectFilled(false);
      drag(editor, [0, 0], [10, 20], [30, 25]);
    });
    step(() => editor.resize(16));
    step(() => editor.clear());

    assertWalksThrough(editor, snapshots);
  });

  test('random sessions: 80 seeded steps undo and redo through the exact snapshots', () => {
    const random = seededRandom(1234);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const point = () => [Math.floor(random() * 22) - 3, Math.floor(random() * 22) - 3];
    const colors = getPalette('retro16').colors;
    const editor = createEditor({ size: 16 });
    const snapshots = [snapshot(editor)];
    while (snapshots.length <= 80) {
      const roll = random();
      if (roll < 0.04) editor.clear();
      else if (roll < 0.08) editor.resize(pick([8, 12, 16, 20]));
      else {
        editor.setTool(pick(['pencil', 'pencil', 'eraser', 'fill', 'line', 'rect']));
        editor.setColor(pick(colors));
        editor.setMirror({ horizontal: random() < 0.3, vertical: random() < 0.2 });
        editor.setRectFilled(random() < 0.5);
        drag(editor, point(), point(), point());
      }
      const next = snapshot(editor);
      if (JSON.stringify(next) !== JSON.stringify(snapshots.at(-1))) snapshots.push(next);
    }
    assertWalksThrough(editor, snapshots);
  });

  test('keeps 100 undo steps by default (at least 50) and drops the oldest', () => {
    assert.ok(DEFAULT_HISTORY_LIMIT >= 50);
    const editor = createEditor({ size: 16 });
    editor.setColor(RED);
    for (let i = 0; i < 120; i += 1) drag(editor, [i % 16, Math.floor(i / 16)]);
    let undone = 0;
    while (editor.undo()) undone += 1;
    assert.equal(undone, 100);
    const { pixels } = editor.getState();
    for (let i = 0; i < 120; i += 1) assert.equal(pixels[i], i < 20 ? RED : null, `pixel ${i}`);
  });

  test('a whole pencil drag is a single undo step', () => {
    const editor = createEditor({ size: 16 });
    drag(editor, [0, 0], [5, 0], [5, 5], [0, 5]);
    assert.ok(editor.undo());
    assert.equal(editor.getState().canUndo, false);
    assert.ok(editor.getState().pixels.every((color) => color === null));
  });

  test('a stroke that changes nothing records no step', () => {
    const editor = createEditor({ size: 16 });
    editor.setTool('eraser');
    drag(editor, [0, 0], [15, 15]);
    assert.equal(editor.getState().canUndo, false);
    editor.setTool('pencil');
    drag(editor, [3, 3]);
    drag(editor, [3, 3]);
    assert.ok(editor.undo());
    assert.equal(editor.getState().canUndo, false);
  });

  test('a new stroke after undo clears redo', () => {
    const editor = createEditor({ size: 16 });
    drag(editor, [1, 1]);
    drag(editor, [2, 2]);
    editor.undo();
    assert.equal(editor.getState().canRedo, true);
    drag(editor, [3, 3]);
    assert.equal(editor.getState().canRedo, false);
    assert.equal(editor.redo(), false);
  });

  test('undo in the middle of a stroke first finishes the stroke, then undoes it', () => {
    const editor = createEditor({ size: 16 });
    editor.pointerDown(4, 4);
    editor.pointerMove(8, 4);
    assert.ok(editor.undo());
    assert.ok(editor.getState().pixels.every((color) => color === null));
    assert.equal(editor.getState().drawing, false);
    assert.ok(editor.redo());
    assert.equal(editor.getPixel(6, 4), getPalette('retro16').colors[0]);
  });

  test('undo and redo of a resize restore size and pixels exactly', () => {
    const editor = createEditor({ size: 32 });
    drag(editor, [0, 0], [31, 31]);
    const before = snapshot(editor);
    assert.ok(editor.resize(16));
    const after = snapshot(editor);
    assert.equal(after.width, 16);
    editor.undo();
    assert.deepEqual(snapshot(editor), before);
    editor.redo();
    assert.deepEqual(snapshot(editor), after);
  });
});
