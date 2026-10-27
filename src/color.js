/**
 * Color helpers.
 *
 * Throughout the editor a pixel color is a lowercase "#rrggbb" string and
 * `null` stands for a transparent pixel.
 * @module color
 */

/** @typedef {string|null} Color */

const LONG_HEX = /^#[0-9a-f]{6}$/;
const SHORT_HEX = /^#[0-9a-f]{3}$/;

/**
 * Normalizes a CSS hex color ("#rgb" or "#rrggbb", any case) to "#rrggbb".
 * @param {unknown} value
 * @returns {string|null} the normalized color, or null when value is not a hex color
 */
export function normalizeColor(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (LONG_HEX.test(text)) return text;
  if (SHORT_HEX.test(text)) {
    const [, r, g, b] = text;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/**
 * Splits a normalized "#rrggbb" color into red, green and blue channels.
 * @param {string} color
 * @returns {[number, number, number]}
 */
export function hexToRgb(color) {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
