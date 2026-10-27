import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditor, TOOLS } from '../src/editor.js';
import { pixelsFromRows } from '../src/grid.js';
import { getPalette } from '../src/palettes.js';

const RED = '#d8433b';
const BLUE = '#3e9bd6';
const INK = getPalette('retro16').colors[0];

/** Painted cells as [x, y] pairs in row-major order. */
function painted(editor) {
  const { width, pixels } = editor.getState();
  return pixels.flatMap((color, index) => (color === null ? [] : [[index % width, Math.floor(index / width)]]));
}

/** Presses at the first point, moves through the rest, releases. */
function drag(editor, ...points) {
  const [first, ...rest] = points;
  editor.pointerDown(...first);
  for (const point of rest) editor.pointerMove(...point);
  editor.pointerUp();
}

/** Editor opened on a grid described by text rows ('.' transparent, '#' ink, 'r' red). */
function editorWith(rows) {
  const editor = createEditor();
  const { width, height, pixels } = pixelsFromRows(rows, { '.': null, '#': INK, r: RED });
  assert.ok(editor.load({ width, height, pixels, paletteId: 'retro16', customColors: [] }));
  return editor;
}

describe('creating an editor', () => {
  test('starts with a blank 32x32 canvas and the pencil', () => {
    const state = createEditor().getState();
    assert.equal(state.width, 32);
    assert.equal(state.height, 32);
    assert.equal(state.pixels.length, 1024);
    assert.ok(state.pixels.every((color) => color === null));
    assert.equal(state.tool, 'pencil');
    assert.equal(state.color, INK);
    assert.deepEqual(state.mirror, { horizontal: false, vertical: false });
    assert.equal(state.rectFilled, false);
    assert.equal(state.paletteId, 'retro16');
    assert.deepEqual(state.palette, [...getPalette('retro16').colors]);
    assert.deepEqual(state.customColors, []);
    assert.equal(state.canUndo, false);
    assert.equal(state.canRedo, false);
    assert.equal(state.drawing, false);
    assert.equal(state.revision, 0);
  });

  test('accepts a size and a color, ignoring invalid ones', () => {
    assert.equal(createEditor({ size: 16 }).getState().width, 16);
    assert.equal(createEditor({ size: 64 }).getState().height, 64);
    for (const size of [0, 65, 20.5, 'big']) assert.equal(createEditor({ size }).getState().width, 32, String(size));
    assert.equal(createEditor({ color: '#F00' }).getState().color, '#ff0000');
    assert.equal(createEditor({ color: 'red' }).getState().color, INK);
  });

  test('opens a given project, or a blank canvas when it is invalid', () => {
    const project = { width: 2, height: 1, pixels: [RED, null], paletteId: 'gray8', customColors: [BLUE] };
    const state = createEditor({ project }).getState();
    assert.deepEqual([state.width, state.height, state.pixels, state.paletteId, state.customColors], [2, 1, [RED, null], 'gray8', [BLUE]]);
    assert.equal(createEditor({ project: { width: 2 } }).getState().width, 32);
  });

  test('lists the tools in toolbar order', () => {
    assert.deepEqual(TOOLS, ['pencil', 'eraser', 'fill', 'line', 'rect', 'picker']);
  });

  test('honours a custom history limit', () => {
    const editor = createEditor({ size: 8, historyLimit: 2 });
    for (let x = 0; x < 5; x += 1) drag(editor, [x, 0]);
    assert.ok(editor.undo());
    assert.ok(editor.undo());
    assert.equal(editor.undo(), false);
  });
});

describe('pencil and eraser', () => {
  test('the pencil paints every cell along the pointer path', () => {
    const editor = createEditor({ size: 16 });
    drag(editor, [2, 2], [6, 2], [6, 5]);
    assert.deepEqual(painted(editor), [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [6, 3], [6, 4], [6, 5]]);
    assert.ok(editor.getState().pixels.every((color) => color === null || color === INK));
  });

  test('fast pointer moves leave no gaps', () => {
    const editor = createEditor({ size: 16 });
    drag(editor, [0, 0], [5, 2]);
    assert.deepEqual(painted(editor), [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2]]);
  });

  test('fractional coordinates are floored to their cell', () => {
    const editor = createEditor({ size: 16 });
    drag(editor, [2.7, 3.2]);
    assert.deepEqual(painted(editor), [[2, 3]]);
  });

  test('the eraser clears pixels', () => {
    const editor = createEditor({ size: 16 });
    drag(editor, [0, 1], [7, 1]);
    editor.setTool('eraser');
    drag(editor, [2, 0], [2, 3]);
    assert.deepEqual(painted(editor), [[0, 1], [1, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]]);
  });

  test('strokes outside the canvas are clipped, not wrapped', () => {
    const editor = createEditor({ size: 16 });
    drag(editor, [-5, 3], [20, 3]);
    assert.deepEqual(painted(editor), Array.from({ length: 16 }, (_, x) => [x, 3]));
  });

  test('invalid coordinates are ignored', () => {
    const editor = createEditor({ size: 16 });
    editor.pointerDown(Number.NaN, 1);
    editor.pointerMove(1, 1);
    editor.pointerUp();
    editor.pointerDown(Number.POSITIVE_INFINITY, 0);
    assert.equal(editor.getState().drawing, false);
    assert.deepEqual(painted(editor), []);
  });

  test('drawing is true only during a stroke, and pointerUp can carry the last position', () => {
    const editor = createEditor({ size: 16 });
    editor.pointerDown(1, 1);
    assert.equal(editor.getState().drawing, true);
    editor.pointerUp(3, 1);
    assert.equal(editor.getState().drawing, false);
    assert.deepEqual(painted(editor), [[1, 1], [2, 1], [3, 1]]);
  });

  test('cancelStroke restores the canvas and records nothing', () => {
    const editor = createEditor({ size: 16 });
    drag(editor, [0, 0]);
    editor.pointerDown(4, 4);
    editor.pointerMove(9, 9);
    editor.cancelStroke();
    assert.deepEqual(painted(editor), [[0, 0]]);
    assert.ok(editor.undo());
    assert.equal(editor.undo(), false);
  });
});

describe('line and rectangle tools', () => {
  test('the line preview follows the pointer and only the final line stays', () => {
    const editor = createEditor({ size: 16 });
    editor.setTool('line');
    drag(editor, [1, 1], [8, 8], [12, 3], [5, 1]);
    assert.deepEqual(painted(editor), [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]);
    assert.ok(editor.undo());
    assert.deepEqual(painted(editor), []);
  });

  test('a preview passing over existing pixels gives them back', () => {
    const editor = editorWith(['....', '.r..', '....']);
    editor.setTool('line');
    editor.setColor(BLUE);
    editor.pointerDown(0, 1);
    editor.pointerMove(3, 1);
    assert.equal(editor.getPixel(1, 1), BLUE);
    editor.pointerMove(0, 2);
    editor.pointerUp();
    assert.equal(editor.getPixel(1, 1), RED);
    assert.deepEqual([editor.getPixel(0, 1), editor.getPixel(0, 2)], [BLUE, BLUE]);
  });

  test('rectangle outline and filled rectangle', () => {
    const outline = createEditor({ size: 8 });
    outline.setTool('rect');
    drag(outline, [2, 2], [5, 4]);
    assert.deepEqual(painted(outline), [[2, 2], [3, 2], [4, 2], [5, 2], [2, 3], [5, 3], [2, 4], [3, 4], [4, 4], [5, 4]]);

    const filled = createEditor({ size: 8 });
    filled.setTool('rect');
    filled.setRectFilled(true);
    drag(filled, [5, 4], [2, 2]);
    assert.equal(painted(filled).length, 12);
    assert.equal(filled.getState().rectFilled, true);
  });

  test('the rectangle preview can shrink back', () => {
    const editor = createEditor({ size: 16 });
    editor.setTool('rect');
    drag(editor, [2, 2], [10, 10], [3, 3]);
    assert.deepEqual(painted(editor), [[2, 2], [3, 2], [2, 3], [3, 3]]);
  });

  test('a far-away pointer is clamped near the canvas instead of rasterizing a huge shape', () => {
    const editor = createEditor({ size: 16 });
    editor.setTool('rect');
    drag(editor, [0, 0], [1e9, 1e9]);
    const cells = painted(editor);
    assert.equal(cells.length, 31);
    assert.ok(cells.every(([x, y]) => x === 0 || y === 0));
  });
});

describe('color picker', () => {
  test('picks the color under the pointer and returns to the previous tool', () => {
    const editor = editorWith(['r...', '....']);
    editor.setTool('line');
    editor.setTool('picker');
    editor.pointerDown(0, 0);
    assert.equal(editor.getState().tool, 'picker');
    editor.pointerUp();
    assert.equal(editor.getState().color, RED);
    assert.equal(editor.getState().tool, 'line');
    assert.equal(editor.getState().canUndo, false);
  });

  test('dragging updates the picked color live', () => {
    const editor = editorWith(['r..#', '....']);
    editor.setTool('picker');
    editor.pointerDown(0, 0);
    assert.equal(editor.getState().color, RED);
    editor.pointerMove(3, 0);
    assert.equal(editor.getState().color, INK);
    editor.pointerUp();
    assert.equal(editor.getState().tool, 'pencil');
  });

  test('transparent pixels leave the color unchanged', () => {
    const editor = editorWith(['r...', '....']);
    editor.setColor(BLUE);
    editor.setTool('picker');
    drag(editor, [2, 1]);
    assert.equal(editor.getState().color, BLUE);
  });

  test('picking while erasing switches back to the pencil', () => {
    const editor = editorWith(['r...', '....']);
    editor.setTool('eraser');
    editor.setTool('picker');
    drag(editor, [0, 0]);
    assert.equal(editor.getState().tool, 'pencil');
  });
});

describe('mirror drawing', () => {
  test('horizontal mirror draws a left/right symmetric stroke', () => {
    const editor = createEditor({ size: 16 });
    editor.setMirror({ horizontal: true });
    drag(editor, [1, 2], [3, 2]);
    assert.deepEqual(painted(editor), [[1, 2], [2, 2], [3, 2], [12, 2], [13, 2], [14, 2]]);
  });

  test('vertical mirror draws a top/bottom symmetric stroke', () => {
    const editor = createEditor({ size: 16 });
    editor.setMirror({ vertical: true });
    drag(editor, [2, 0], [2, 1]);
    assert.deepEqual(painted(editor), [[2, 0], [2, 1], [2, 14], [2, 15]]);
  });

  test('both axes paint all four quadrants', () => {
    const editor = createEditor({ size: 16 });
    editor.setMirror({ horizontal: true, vertical: true });
    drag(editor, [0, 0]);
    assert.deepEqual(painted(editor), [[0, 0], [15, 0], [0, 15], [15, 15]]);
  });

  test('lines and rectangles are mirrored too', () => {
    const line = createEditor({ size: 16 });
    line.setMirror({ horizontal: true });
    line.setTool('line');
    drag(line, [0, 0], [3, 3]);
    assert.deepEqual(painted(line), [[0, 0], [15, 0], [1, 1], [14, 1], [2, 2], [13, 2], [3, 3], [12, 3]]);

    const rect = createEditor({ size: 8 });
    rect.setMirror({ vertical: true });
    rect.setTool('rect');
    rect.setRectFilled(true);
    drag(rect, [0, 0], [1, 1]);
    assert.deepEqual(painted(rect), [[0, 0], [1, 0], [0, 1], [1, 1], [0, 6], [1, 6], [0, 7], [1, 7]]);
  });

  test('fill is mirrored as well, in a single undo step', () => {
    const rows = ['.#..#.', '.#..#.', '.#..#.'];
    const editor = editorWith(rows);
    editor.setMirror({ horizontal: true });
    editor.setTool('fill');
    editor.setColor(RED);
    drag(editor, [0, 0]);
    const filled = editor.getState().pixels;
    for (let y = 0; y < 3; y += 1) {
      assert.deepEqual([filled[y * 6], filled[y * 6 + 2], filled[y * 6 + 3], filled[y * 6 + 5]], [RED, null, null, RED]);
    }
    assert.ok(editor.undo());
    assert.equal(editor.undo(), false);
    assert.ok(editor.getState().pixels.every((color, index) => color === (rows[Math.floor(index / 6)][index % 6] === '#' ? INK : null)));
  });

  test('setMirror changes only the axes it is given', () => {
    const editor = createEditor();
    editor.setMirror({ horizontal: true });
    editor.setMirror({ vertical: true });
    assert.deepEqual(editor.getState().mirror, { horizontal: true, vertical: true });
    editor.setMirror({ horizontal: false });
    assert.deepEqual(editor.getState().mirror, { horizontal: false, vertical: true });
  });
});

describe('settings, canvas and state', () => {
  test('setTool and setColor reject invalid values', () => {
    const editor = createEditor();
    assert.equal(editor.setTool('spray'), false);
    assert.equal(editor.getState().tool, 'pencil');
    assert.equal(editor.setTool('fill'), true);
    assert.equal(editor.setColor('#ABCDEF'), true);
    assert.equal(editor.getState().color, '#abcdef');
    assert.equal(editor.setColor('blue'), false);
    assert.equal(editor.getState().color, '#abcdef');
  });

  test('palettes and custom colors', () => {
    const editor = createEditor();
    assert.equal(editor.setPalette('gray8'), true);
    assert.deepEqual(editor.getState().palette, [...getPalette('gray8').colors]);
    assert.equal(editor.setPalette('neon'), false);
    assert.equal(editor.getState().paletteId, 'gray8');
    assert.equal(editor.addCustomColor('#123'), true);
    assert.equal(editor.addCustomColor(BLUE), true);
    assert.equal(editor.addCustomColor('#112233'), true);
    assert.equal(editor.addCustomColor('nope'), false);
    assert.deepEqual(editor.getState().customColors, ['#112233', BLUE]);
  });

  test('resize keeps the artwork centered and shrinking crops the edges', () => {
    const editor = createEditor({ size: 16 });
    for (const point of [[0, 0], [7, 7], [15, 15]]) drag(editor, point);
    assert.equal(editor.resize(32), true);
    assert.deepEqual(painted(editor), [[8, 8], [15, 15], [23, 23]]);
    assert.equal(editor.resize(8), true);
    assert.deepEqual(painted(editor), [[3, 3]]);
  });

  test('resize rejects invalid or unchanged sizes and supports non-square canvases', () => {
    const editor = createEditor({ size: 16 });
    for (const size of [0, 65, 'x', 12.5]) assert.equal(editor.resize(size), false, String(size));
    assert.equal(editor.resize(16), false);
    assert.equal(editor.getState().canUndo, false);
    assert.equal(editor.resize(16, 8), true);
    assert.deepEqual([editor.getState().width, editor.getState().height], [16, 8]);
  });

  test('clear empties the canvas as one undo step', () => {
    const editor = createEditor({ size: 8 });
    assert.equal(editor.clear(), false);
    drag(editor, [0, 0], [7, 7]);
    const drawn = editor.getState().pixels;
    assert.equal(editor.clear(), true);
    assert.deepEqual(painted(editor), []);
    editor.undo();
    assert.deepEqual(editor.getState().pixels, drawn);
  });

  test('load rejects invalid projects and resets history for valid ones', () => {
    const editor = createEditor({ size: 8 });
    drag(editor, [1, 1]);
    assert.equal(editor.load({ width: 8, height: 8, pixels: [], paletteId: 'retro16', customColors: [] }), false);
    assert.deepEqual(painted(editor), [[1, 1]]);
    assert.equal(editor.getState().canUndo, true);
    assert.equal(editor.load({ width: 1, height: 1, pixels: [BLUE], paletteId: 'retro16', customColors: [] }), true);
    assert.equal(editor.getState().canUndo, false);
    assert.equal(editor.getPixel(0, 0), BLUE);
  });

  test('getState and toProject return copies', () => {
    const editor = createEditor({ size: 8 });
    const state = editor.getState();
    state.pixels[0] = RED;
    state.mirror.horizontal = true;
    state.palette.push(RED);
    state.customColors.push(RED);
    editor.toProject().pixels[1] = RED;
    const fresh = editor.getState();
    assert.equal(fresh.pixels[0], null);
    assert.equal(fresh.pixels[1], null);
    assert.equal(fresh.mirror.horizontal, false);
    assert.equal(fresh.palette.length, 16);
    assert.deepEqual(fresh.customColors, []);
  });

  test('getPixel returns null outside the canvas', () => {
    const editor = editorWith(['r']);
    assert.equal(editor.getPixel(0, 0), RED);
    assert.equal(editor.getPixel(1, 0), null);
    assert.equal(editor.getPixel(0, -1), null);
  });

  test('revision changes with the project, not with tool settings', () => {
    const editor = createEditor({ size: 8 });
    const revision = () => editor.getState().revision;
    let last = revision();
    editor.setTool('line');
    editor.setColor(RED);
    editor.setMirror({ horizontal: true });
    editor.setRectFilled(true);
    assert.equal(revision(), last);
    drag(editor, [0, 0], [3, 0]);
    assert.ok(revision() > last);
    last = revision();
    editor.setTool('eraser');
    drag(editor, [5, 5]);
    assert.equal(revision(), last, 'erasing empty pixels changes nothing');
    for (const action of [() => editor.undo(), () => editor.redo(), () => editor.setPalette('gray8'), () => editor.addCustomColor(BLUE), () => editor.resize(16)]) {
      action();
      assert.ok(revision() > last);
      last = revision();
    }
  });
});
