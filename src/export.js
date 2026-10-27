/**
 * PNG export helpers. The UI turns the RGBA bytes produced here into an
 * ImageData, draws it on a canvas and saves the canvas as a PNG file.
 * @module export
 */

import { hexToRgb } from './color.js';

/** @typedef {import('./color.js').Color} Color */

/** Largest export scale factor. */
export const MAX_EXPORT_SCALE = 16;

/** Scale factors offered in the export menu: every whole number from 1 to MAX_EXPORT_SCALE. */
export const EXPORT_SCALES = Object.freeze(Array.from({ length: MAX_EXPORT_SCALE }, (_, index) => index + 1));

/**
 * Turns any requested scale into an integer between 1 and MAX_EXPORT_SCALE.
 * @param {unknown} scale
 * @returns {number}
 */
export function clampScale(scale) {
  const rounded = Math.round(Number(scale));
  if (!Number.isFinite(rounded)) return 1;
  return Math.min(MAX_EXPORT_SCALE, Math.max(1, rounded));
}

/**
 * Renders a grid to RGBA bytes, every pixel becoming a scale x scale block.
 * Transparent pixels stay fully transparent (all four bytes 0).
 * @param {readonly Color[]} pixels row-major grid
 * @param {number} width
 * @param {number} height
 * @param {number} [scale] 1..16 (clamped)
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }}
 */
export function renderRGBA(pixels, width, height, scale = 1) {
  const factor = clampScale(scale);
  const outWidth = width * factor;
  const outHeight = height * factor;
  const data = new Uint8ClampedArray(outWidth * outHeight * 4);
  const channelCache = new Map();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = pixels[y * width + x];
      if (color === null) continue;
      if (!channelCache.has(color)) channelCache.set(color, [...hexToRgb(color), 255]);
      fillBlock(data, outWidth, x * factor, y * factor, factor, channelCache.get(color));
    }
  }
  return { width: outWidth, height: outHeight, data };
}

/**
 * Suggested download name, e.g. "pixel-art-32x32-x4.png".
 * @param {number} width
 * @param {number} height
 * @param {number} scale
 * @returns {string}
 */
export function exportFileName(width, height, scale) {
  return `pixel-art-${width}x${height}-x${clampScale(scale)}.png`;
}

/**
 * Paints a size x size square of one RGBA color into an RGBA byte buffer.
 * @param {Uint8ClampedArray} data
 * @param {number} rowWidth buffer width in pixels
 * @param {number} left
 * @param {number} top
 * @param {number} size
 * @param {number[]} rgba
 */
function fillBlock(data, rowWidth, left, top, size, rgba) {
  for (let y = top; y < top + size; y += 1) {
    for (let x = left; x < left + size; x += 1) {
      data.set(rgba, (y * rowWidth + x) * 4);
    }
  }
}
