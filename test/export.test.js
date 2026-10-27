import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clampScale, EXPORT_SCALES, exportFileName, MAX_EXPORT_SCALE, renderRGBA } from '../src/export.js';
import { createDemoProject } from '../src/demo.js';
import { hexToRgb } from '../src/color.js';

const SAMPLE = ['#ff0000', null, '#00ff80', '#0000ff'];

/** RGBA bytes of pixel (x, y) in a rendered image. */
function pixelAt(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return [...image.data.slice(offset, offset + 4)];
}

describe('renderRGBA', () => {
  test('scale 1 maps colors to opaque bytes and transparent cells to zeros', () => {
    const image = renderRGBA(SAMPLE, 2, 2, 1);
    assert.equal(image.width, 2);
    assert.equal(image.height, 2);
    assert.ok(image.data instanceof Uint8ClampedArray);
    assert.deepEqual([...image.data], [255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 128, 255, 0, 0, 255, 255]);
  });

  test('scale 3 turns every pixel into a uniform 3x3 block', () => {
    const image = renderRGBA(SAMPLE, 2, 2, 3);
    assert.equal(image.width, 6);
    assert.equal(image.height, 6);
    assert.equal(image.data.length, 6 * 6 * 4);
    for (let y = 0; y < 6; y += 1) {
      for (let x = 0; x < 6; x += 1) {
        const source = SAMPLE[Math.floor(y / 3) * 2 + Math.floor(x / 3)];
        const expected = source === null ? [0, 0, 0, 0] : [...hexToRgb(source), 255];
        assert.deepEqual(pixelAt(image, x, y), expected, `pixel ${x},${y}`);
      }
    }
  });

  test('renders the 32x32 demo at x16 into a 512x512 image', () => {
    const { width, height, pixels } = createDemoProject();
    const image = renderRGBA(pixels, width, height, 16);
    assert.equal(image.width, 512);
    assert.equal(image.height, 512);
    assert.deepEqual(pixelAt(image, 511, 511), [...hexToRgb(pixels[1023]), 255]);
    assert.deepEqual(pixelAt(image, 17, 0), [...hexToRgb(pixels[1]), 255]);
  });

  test('out-of-range scales are clamped', () => {
    assert.equal(renderRGBA(SAMPLE, 2, 2, 40).width, 2 * MAX_EXPORT_SCALE);
    assert.equal(renderRGBA(SAMPLE, 2, 2, 0).width, 2);
    assert.equal(renderRGBA(SAMPLE, 2, 2).width, 2);
  });
});

describe('clampScale / exportFileName', () => {
  test('clampScale returns an integer from 1 to 16', () => {
    const cases = [[1, 1], [0, 1], [-5, 1], [16, 16], [17, 16], [2.4, 2], [2.6, 3], ['8', 8], ['abc', 1], [Number.NaN, 1], [undefined, 1]];
    for (const [input, expected] of cases) assert.equal(clampScale(input), expected, String(input));
  });

  test('the menu offers every whole scale from 1 to 16, each one valid', () => {
    assert.deepEqual(EXPORT_SCALES, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    assert.equal(EXPORT_SCALES.length, MAX_EXPORT_SCALE);
    assert.ok(EXPORT_SCALES.every((scale) => clampScale(scale) === scale));
    assert.ok(Object.isFrozen(EXPORT_SCALES));
  });

  test('every offered scale renders blocks of exactly that size', () => {
    for (const scale of EXPORT_SCALES) {
      const image = renderRGBA(SAMPLE, 2, 2, scale);
      assert.equal(image.width, 2 * scale, `width at x${scale}`);
      assert.equal(image.data.length, 2 * scale * 2 * scale * 4, `bytes at x${scale}`);
      assert.deepEqual(pixelAt(image, scale - 1, scale - 1), [255, 0, 0, 255], `last red pixel at x${scale}`);
      assert.deepEqual(pixelAt(image, scale, scale - 1), [0, 0, 0, 0], `first clear pixel at x${scale}`);
      assert.deepEqual(pixelAt(image, 2 * scale - 1, 2 * scale - 1), [0, 0, 255, 255], `corner at x${scale}`);
    }
  });

  test('file names include size and scale', () => {
    assert.equal(exportFileName(32, 32, 4), 'pixel-art-32x32-x4.png');
    assert.equal(exportFileName(16, 16, 99), 'pixel-art-16x16-x16.png');
  });
});
