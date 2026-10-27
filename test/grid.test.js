import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixels,
  DEFAULT_SIZE,
  inBounds,
  isValidDimension,
  MAX_SIZE,
  pixelsFromRows,
  resizePixels,
  SIZES,
} from '../src/grid.js';
import { createEditor } from '../src/editor.js';

test('the editor offers 16x16, 32x32 and 64x64 canvases', () => {
  assert.deepEqual(SIZES, [16, 32, 64]);
  assert.ok(SIZES.includes(DEFAULT_SIZE));
  for (const size of SIZES) {
    const { width, height, pixels } = createEditor({ size }).getState();
    assert.deepEqual([width, height, pixels.length], [size, size, size * size]);
  }
});

test('isValidDimension accepts integers from 1 to MAX_SIZE', () => {
  assert.equal(MAX_SIZE, 64);
  for (const value of [1, 16, 64]) assert.equal(isValidDimension(value), true, String(value));
  for (const value of [0, 65, -1, 2.5, '16', null, Number.NaN]) assert.equal(isValidDimension(value), false, String(value));
});

test('inBounds checks integer cells inside the grid', () => {
  assert.equal(inBounds(0, 0, 4, 3), true);
  assert.equal(inBounds(3, 2, 4, 3), true);
  for (const [x, y] of [[4, 0], [0, 3], [-1, 0], [0, -1], [0.5, 0]]) assert.equal(inBounds(x, y, 4, 3), false, `${x},${y}`);
});

test('createPixels makes a transparent grid', () => {
  assert.deepEqual(createPixels(3, 2), [null, null, null, null, null, null]);
});

/** A width x height grid where every cell has its own color. */
function distinctPixels(width, height) {
  return Array.from({ length: width * height }, (_, index) => `#${index.toString(16).padStart(6, '0')}`);
}

test('resizePixels pads and crops around the center', () => {
  const { pixels } = pixelsFromRows(['ab', 'cd'], { a: '#000001', b: '#000002', c: '#000003', d: '#000004' });
  const grown = resizePixels(pixels, 2, 2, 4, 4);
  assert.deepEqual(grown, [
    null, null, null, null,
    null, '#000001', '#000002', null,
    null, '#000003', '#000004', null,
    null, null, null, null,
  ]);
  assert.deepEqual(resizePixels(grown, 4, 4, 2, 2), pixels);
  // An odd change goes to the right/bottom edge in both directions.
  assert.deepEqual(resizePixels(pixels, 2, 2, 3, 3), ['#000001', '#000002', null, '#000003', '#000004', null, null, null, null]);
  assert.deepEqual(resizePixels(pixels, 2, 2, 1, 1), ['#000001']);
});

test('growing and then shrinking back restores the grid exactly, for even and odd size changes', () => {
  for (const [width, height, newWidth, newHeight] of [[1, 1, 2, 2], [2, 3, 5, 4], [3, 2, 4, 7], [16, 16, 32, 32], [5, 9, 64, 64]]) {
    const pixels = distinctPixels(width, height);
    const grown = resizePixels(pixels, width, height, newWidth, newHeight);
    assert.equal(grown.filter((color) => color !== null).length, pixels.length);
    assert.deepEqual(resizePixels(grown, newWidth, newHeight, width, height), pixels, `${width}x${height} -> ${newWidth}x${newHeight}`);
  }
});

test('pixelsFromRows builds a grid and reports malformed rows', () => {
  const legend = { '.': null, x: '#ffffff' };
  assert.deepEqual(pixelsFromRows(['x.', '.x'], legend), { width: 2, height: 2, pixels: ['#ffffff', null, null, '#ffffff'] });
  assert.throws(() => pixelsFromRows(['x.', 'x'], legend), /Row 1 has 1 cells, expected 2/);
  assert.throws(() => pixelsFromRows(['x?'], legend), /Unknown pixel character "\?"/);
});
