import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, normalizeColor } from '../src/color.js';
import {
  addCustomColor,
  DEFAULT_PALETTE_ID,
  getPalette,
  isPaletteId,
  MAX_CUSTOM_COLORS,
  PALETTES,
} from '../src/palettes.js';

describe('color helpers', () => {
  test('normalizeColor accepts #rgb and #rrggbb in any case', () => {
    assert.equal(normalizeColor('#FB923C'), '#fb923c');
    assert.equal(normalizeColor('  #fb923c '), '#fb923c');
    assert.equal(normalizeColor('#AbC'), '#aabbcc');
  });

  test('normalizeColor rejects everything else', () => {
    for (const value of ['fb923c', '#fb923', '#fb923cc', '#ggg', 'red', '', null, undefined, 0xfb923c, {}]) {
      assert.equal(normalizeColor(value), null, String(value));
    }
  });

  test('hexToRgb splits the channels', () => {
    assert.deepEqual(hexToRgb('#fb923c'), [251, 146, 60]);
    assert.deepEqual(hexToRgb('#000000'), [0, 0, 0]);
    assert.deepEqual(hexToRgb('#ffffff'), [255, 255, 255]);
  });
});

describe('palettes', () => {
  test('every palette has a unique id and unique, normalized colors', () => {
    assert.equal(new Set(PALETTES.map((palette) => palette.id)).size, PALETTES.length);
    for (const palette of PALETTES) {
      assert.ok(palette.colors.length >= 8, palette.id);
      assert.ok(palette.colors.every((color) => normalizeColor(color) === color), palette.id);
      assert.equal(new Set(palette.colors).size, palette.colors.length, palette.id);
    }
  });

  test('the default retro palette has 16 colors and includes the accent color', () => {
    const retro = getPalette(DEFAULT_PALETTE_ID);
    assert.equal(retro.id, 'retro16');
    assert.equal(retro.colors.length, 16);
    assert.ok(retro.colors.includes('#fb923c'));
  });

  test('getPalette falls back to the default palette', () => {
    assert.equal(getPalette('gray8').id, 'gray8');
    assert.equal(getPalette('does-not-exist').id, DEFAULT_PALETTE_ID);
  });

  test('isPaletteId knows the built-in ids only', () => {
    assert.equal(isPaletteId('pastel8'), true);
    assert.equal(isPaletteId('earth8'), true);
    assert.equal(isPaletteId('Retro16'), false);
    assert.equal(isPaletteId(undefined), false);
  });

  test('palettes are frozen', () => {
    assert.ok(Object.isFrozen(PALETTES));
    assert.ok(Object.isFrozen(PALETTES[0]));
    assert.ok(Object.isFrozen(PALETTES[0].colors));
  });
});

describe('addCustomColor', () => {
  test('puts the newest color first and normalizes it', () => {
    assert.deepEqual(addCustomColor(['#111111'], '#ABC'), ['#aabbcc', '#111111']);
  });

  test('moves an existing color to the front instead of duplicating it', () => {
    assert.deepEqual(addCustomColor(['#111111', '#222222', '#333333'], '#333333'), ['#333333', '#111111', '#222222']);
  });

  test('never keeps more than the maximum, dropping the oldest', () => {
    let list = [];
    for (let i = 0; i < MAX_CUSTOM_COLORS + 4; i += 1) list = addCustomColor(list, `#0000${(i + 16).toString(16)}`);
    assert.equal(list.length, MAX_CUSTOM_COLORS);
    assert.equal(list[0], `#0000${(MAX_CUSTOM_COLORS + 19).toString(16)}`);
    assert.ok(!list.includes('#000010'));
  });

  test('ignores invalid colors and never mutates the input', () => {
    const list = Object.freeze(['#111111']);
    assert.deepEqual(addCustomColor(list, 'nope'), ['#111111']);
    assert.deepEqual(addCustomColor(list, '#222222', 1), ['#222222']);
    assert.deepEqual(list, ['#111111']);
  });
});
