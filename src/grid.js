/**
 * Pixel grid helpers. A grid is a flat, row-major array of colors
 * (index = y * width + x) together with its width and height.
 * @module grid
 */

/** @typedef {import('./color.js').Color} Color */

/** Canvas sizes offered by the editor (square). */
export const SIZES = Object.freeze([16, 32, 64]);

/** Size of a new canvas. */
export const DEFAULT_SIZE = 32;

/** Largest supported width or height. */
export const MAX_SIZE = 64;

/**
 * Creates a fully transparent grid.
 * @param {number} width
 * @param {number} height
 * @returns {Color[]}
 */
export function createPixels(width, height) {
  return new Array(width * height).fill(null);
}

/**
 * Tells whether value is a usable width or height (integer 1..MAX_SIZE).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidDimension(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_SIZE;
}

/**
 * Tells whether the cell (x, y) lies inside a width x height grid.
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {boolean}
 */
export function inBounds(x, y, width, height) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
}

/**
 * Copies a grid into a grid of another size, keeping the artwork centered:
 * growing pads with transparent pixels, shrinking crops the edges. An odd
 * leftover column or row is added or removed on the right or bottom, so
 * growing and then shrinking back always restores the grid exactly.
 * @param {readonly Color[]} pixels
 * @param {number} width
 * @param {number} height
 * @param {number} newWidth
 * @param {number} newHeight
 * @returns {Color[]}
 */
export function resizePixels(pixels, width, height, newWidth, newHeight) {
  const result = createPixels(newWidth, newHeight);
  const offsetX = Math.trunc((newWidth - width) / 2);
  const offsetY = Math.trunc((newHeight - height) / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetX = x + offsetX;
      const targetY = y + offsetY;
      if (inBounds(targetX, targetY, newWidth, newHeight)) {
        result[targetY * newWidth + targetX] = pixels[y * width + x];
      }
    }
  }
  return result;
}

/**
 * Builds a grid from text rows, one character per pixel, using a legend that
 * maps characters to colors (map a character to null for transparency).
 * @param {readonly string[]} rows equally long rows
 * @param {Readonly<Record<string, Color>>} legend
 * @returns {{ width: number, height: number, pixels: Color[] }}
 * @throws {Error} when rows have different lengths or use a character missing from the legend
 */
export function pixelsFromRows(rows, legend) {
  const width = rows[0]?.length ?? 0;
  const pixels = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Row ${y} has ${row.length} cells, expected ${width}`);
    for (const char of row) {
      if (!Object.hasOwn(legend, char)) throw new Error(`Unknown pixel character "${char}" in row ${y}`);
      pixels.push(legend[char]);
    }
  });
  return { width, height: rows.length, pixels };
}
