import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { floodRegion } from '../src/fill.js';
import { createEditor } from '../src/editor.js';
import { createPixels, pixelsFromRows } from '../src/grid.js';

const LEGEND = { '.': null, '#': '#10121c', r: '#d8433b', b: '#3e9bd6' };
const CHAR_OF = new Map(Object.entries(LEGEND).map(([char, color]) => [color, char]));

/** Grid from text rows. */
const grid = (rows) => pixelsFromRows(rows, LEGEND);

/** Text rows from a grid. */
function toRows(pixels, width) {
  const rows = [];
  for (let i = 0; i < pixels.length; i += width) {
    rows.push(pixels.slice(i, i + width).map((color) => CHAR_OF.get(color)).join(''));
  }
  return rows;
}

/** Region indices drawn as '*' on a blank mask, for readable comparisons. */
function maskOf(region, width, height) {
  const mask = Array.from({ length: height }, () => Array(width).fill('.'));
  for (const index of region) mask[Math.floor(index / width)][index % width] = '*';
  return mask.map((row) => row.join(''));
}

/** Runs floodRegion on text rows and returns the region as a mask. */
function regionMask(rows, x, y) {
  const { width, height, pixels } = grid(rows);
  return maskOf(floodRegion(pixels, width, height, x, y), width, height);
}

/** Editor opened on a grid given as text rows. */
function editorWith(rows) {
  const editor = createEditor();
  const { width, height, pixels } = grid(rows);
  assert.ok(editor.load({ width, height, pixels, paletteId: 'retro16', customColors: [] }));
  return editor;
}

const BOX = [
  '......',
  '.####.',
  '.#..#.',
  '.#..#.',
  '.####.',
  '......',
];

describe('floodRegion', () => {
  test('finds exactly the enclosed region and stops at other colors', () => {
    assert.deepEqual(regionMask(BOX, 2, 2), [
      '......',
      '......',
      '..**..',
      '..**..',
      '......',
      '......',
    ]);
  });

  test('the region around a shape reaches every border cell', () => {
    assert.deepEqual(regionMask(BOX, 0, 0), [
      '******',
      '*....*',
      '*....*',
      '*....*',
      '*....*',
      '******',
    ]);
  });

  test('a colored shape is a region of its own', () => {
    assert.deepEqual(regionMask(BOX, 1, 1), [
      '......',
      '.****.',
      '.*..*.',
      '.*..*.',
      '.****.',
      '......',
    ]);
  });

  test('is 4-connected: diagonal gaps do not leak', () => {
    const rows = ['..#', '.#.', '#..'];
    assert.deepEqual(regionMask(rows, 0, 0), ['**.', '*..', '...']);
    assert.deepEqual(regionMask(rows, 2, 2), ['...', '..*', '.**']);
  });

  test('never wraps from the end of a row to the start of the next', () => {
    const rows = ['##.', '.##'];
    assert.deepEqual(regionMask(rows, 2, 0), ['..*', '...']);
    assert.deepEqual(regionMask(rows, 0, 1), ['...', '*..']);
  });

  test('seeds in corners and on edges', () => {
    const rows = [
      '..#..',
      '..#..',
      '###..',
      '.....',
    ];
    const outside = ['...**', '...**', '...**', '*****'];
    assert.deepEqual(regionMask(rows, 0, 0), ['**...', '**...', '.....', '.....']);
    assert.deepEqual(regionMask(rows, 4, 0), outside);
    assert.deepEqual(regionMask(rows, 4, 3), outside);
    assert.deepEqual(regionMask(rows, 0, 3), outside);
  });

  test('a single isolated cell is its own region', () => {
    assert.deepEqual(regionMask(['###', '#.#', '###'], 1, 1), ['...', '.*.', '...']);
  });

  test('covers a whole uniform 64x64 canvas without recursion, each cell once', () => {
    const pixels = createPixels(64, 64);
    const region = floodRegion(pixels, 64, 64, 31, 17);
    assert.equal(region.length, 64 * 64);
    assert.equal(new Set(region).size, 64 * 64);
  });

  test('seeds outside the canvas give an empty region', () => {
    const { width, height, pixels } = grid(BOX);
    for (const [x, y] of [[-1, 0], [0, -1], [6, 0], [0, 6], [1.5, 2]]) {
      assert.deepEqual(floodRegion(pixels, width, height, x, y), [], `seed ${x},${y}`);
    }
  });

  test('does not modify the grid', () => {
    const { width, height, pixels } = grid(BOX);
    const before = pixels.slice();
    floodRegion(pixels, width, height, 2, 2);
    assert.deepEqual(pixels, before);
  });
});

describe('fill tool', () => {
  test('fills exactly the connected region, as one undo step', () => {
    const editor = editorWith(BOX);
    editor.setTool('fill');
    editor.setColor(LEGEND.r);
    editor.pointerDown(2, 3);
    editor.pointerUp();
    const filled = [
      '......',
      '.####.',
      '.#rr#.',
      '.#rr#.',
      '.####.',
      '......',
    ];
    assert.deepEqual(toRows(editor.getState().pixels, 6), filled);
    assert.ok(editor.undo());
    assert.deepEqual(toRows(editor.getState().pixels, 6), BOX);
    assert.ok(editor.redo());
    assert.deepEqual(toRows(editor.getState().pixels, 6), filled);
  });

  test('filling the outside region recolors every border cell but nothing inside', () => {
    const editor = editorWith(BOX);
    editor.setTool('fill');
    editor.setColor(LEGEND.b);
    editor.pointerDown(5, 5);
    assert.deepEqual(toRows(editor.getState().pixels, 6), [
      'bbbbbb',
      'b####b',
      'b#..#b',
      'b#..#b',
      'b####b',
      'bbbbbb',
    ]);
  });

  test('recolors a shape that touches the canvas edges', () => {
    const editor = editorWith(['#....', '#....', '#####']);
    editor.setTool('fill');
    editor.setColor(LEGEND.r);
    editor.pointerDown(0, 0);
    assert.deepEqual(toRows(editor.getState().pixels, 5), ['r....', 'r....', 'rrrrr']);
  });

  test('filling with the color already there records no undo step', () => {
    const editor = editorWith(BOX);
    editor.setTool('fill');
    editor.setColor(LEGEND['#']);
    editor.pointerDown(1, 1);
    assert.equal(editor.getState().canUndo, false);
    assert.deepEqual(toRows(editor.getState().pixels, 6), BOX);
  });

  test('a fill outside the canvas does nothing', () => {
    const editor = editorWith(BOX);
    editor.setTool('fill');
    editor.pointerDown(-3, 2);
    editor.pointerDown(Number.NaN, 2);
    assert.equal(editor.getState().canUndo, false);
    assert.deepEqual(toRows(editor.getState().pixels, 6), BOX);
  });
});
