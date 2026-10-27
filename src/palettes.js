/**
 * Built-in color palettes and the custom color list.
 *
 * All palettes are original picks for this project. The UI looks up a
 * human-readable, translated name for each palette by its `id`.
 * @module palettes
 */

import { normalizeColor } from './color.js';

/** @typedef {{ id: string, colors: readonly string[] }} Palette */

/** @type {readonly Palette[]} */
export const PALETTES = deepFreeze([
  {
    id: 'retro16',
    colors: [
      '#10121c', '#2c2f45', '#5a5f7d', '#a3a9c2',
      '#f4f1e8', '#6b3d2b', '#a86b3c', '#ecb685',
      '#fb923c', '#f7d154', '#d8433b', '#8a3a6e',
      '#82c95b', '#2f7d4c', '#3e9bd6', '#3a4bb3',
    ],
  },
  {
    id: 'earth8',
    colors: ['#231a14', '#4a3326', '#7a5236', '#a8794f', '#d2a874', '#ece0c4', '#8c9a58', '#4f6b3a'],
  },
  {
    id: 'pastel8',
    colors: ['#fff4e6', '#ffd3b0', '#fff0a8', '#c8f0b8', '#aee8f0', '#b4c8ff', '#d2c0ff', '#ffc8e4'],
  },
  {
    id: 'gray8',
    colors: ['#000000', '#242424', '#494949', '#6d6d6d', '#929292', '#b6b6b6', '#dbdbdb', '#ffffff'],
  },
]);

/** Palette used by new projects. */
export const DEFAULT_PALETTE_ID = 'retro16';

/** Maximum number of remembered custom colors. */
export const MAX_CUSTOM_COLORS = 16;

/**
 * Tells whether id names a built-in palette.
 * @param {unknown} id
 * @returns {boolean}
 */
export function isPaletteId(id) {
  return PALETTES.some((palette) => palette.id === id);
}

/**
 * Returns the built-in palette with the given id (the default palette for unknown ids).
 * @param {string} id
 * @returns {Palette}
 */
export function getPalette(id) {
  return PALETTES.find((palette) => palette.id === id) ?? getDefaultPalette();
}

/**
 * Returns a new custom color list with `color` first (most recent first).
 * A color already in the list moves to the front; the list never grows past `max`.
 * Invalid colors leave the list unchanged. The input list is not modified.
 * @param {readonly string[]} list
 * @param {string} color
 * @param {number} [max]
 * @returns {string[]}
 */
export function addCustomColor(list, color, max = MAX_CUSTOM_COLORS) {
  const normalized = normalizeColor(color);
  if (normalized === null) return list.slice();
  return [normalized, ...list.filter((entry) => entry !== normalized)].slice(0, max);
}

/** @returns {Palette} */
function getDefaultPalette() {
  return PALETTES.find((palette) => palette.id === DEFAULT_PALETTE_ID);
}

/**
 * Freezes an object and everything reachable from it.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
