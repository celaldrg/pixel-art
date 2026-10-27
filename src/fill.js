/**
 * Flood fill (bucket tool) region search.
 * @module fill
 */

import { inBounds } from './grid.js';

/** @typedef {import('./color.js').Color} Color */

/**
 * Finds the 4-connected region of equally colored pixels that contains (x, y).
 * Uses an explicit stack instead of recursion, so even a full 64x64 canvas is safe.
 * Diagonal neighbors are not connected, and the search never wraps around edges.
 * @param {readonly Color[]} pixels row-major grid
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {number[]} pixel indices of the region (empty when (x, y) is outside the grid)
 */
export function floodRegion(pixels, width, height, x, y) {
  if (!inBounds(x, y, width, height)) return [];
  const start = y * width + x;
  const target = pixels[start];
  const visited = new Uint8Array(width * height);
  const stack = [start];
  const region = [];
  visited[start] = 1;
  while (stack.length > 0) {
    const index = stack.pop();
    region.push(index);
    for (const next of neighborIndices(index, width, height)) {
      if (visited[next] === 0 && pixels[next] === target) {
        visited[next] = 1;
        stack.push(next);
      }
    }
  }
  return region;
}

/**
 * Lists the indices of the up to four orthogonal neighbors of a pixel.
 * @param {number} index
 * @param {number} width
 * @param {number} height
 * @returns {number[]}
 */
function neighborIndices(index, width, height) {
  const x = index % width;
  const neighbors = [];
  if (x > 0) neighbors.push(index - 1);
  if (x < width - 1) neighbors.push(index + 1);
  if (index >= width) neighbors.push(index - width);
  if (index < width * (height - 1)) neighbors.push(index + width);
  return neighbors;
}
