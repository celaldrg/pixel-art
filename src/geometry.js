/**
 * Shape rasterizers: lines, rectangles and mirror images. They work on plain
 * cell coordinates and know nothing about colors; cells may lie outside the
 * canvas, callers clip them.
 * @module geometry
 */

/** @typedef {{ x: number, y: number }} Cell */

/**
 * Rasterizes the straight line between two cells with Bresenham's algorithm
 * (all octants, integer math). The cell set does not depend on direction:
 * the line from b to a is exactly the line from a to b, reversed.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Cell[]} cells from (x0, y0) to (x1, y1), both included
 */
export function bresenhamLine(x0, y0, x1, y1) {
  if (x1 < x0 || (x1 === x0 && y1 < y0)) return bresenhamLine(x1, y1, x0, y0).reverse();
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  const cells = [];
  let error = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    cells.push({ x, y });
    if (x === x1 && y === y1) return cells;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
  }
}

/**
 * Rasterizes the axis-aligned rectangle spanned by two opposite corners.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {boolean} filled true for a solid rectangle, false for a one-cell outline
 * @returns {Cell[]} each cell once, row by row
 */
export function rectangleCells(x0, y0, x1, y1, filled) {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  const cells = [];
  for (let y = top; y <= bottom; y += 1) {
    const isEdgeRow = y === top || y === bottom;
    for (let x = left; x <= right; x += 1) {
      if (filled || isEdgeRow || x === left || x === right) cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * Adds mirror images of cells for symmetric drawing.
 * `horizontal` mirrors left/right across the vertical center line (x -> width-1-x);
 * `vertical` mirrors top/bottom across the horizontal center line (y -> height-1-y);
 * both together also add the diagonal image.
 * @param {readonly Cell[]} cells
 * @param {number} width
 * @param {number} height
 * @param {{ horizontal?: boolean, vertical?: boolean }} mirror
 * @returns {Cell[]} the cells and their images, without duplicates
 */
export function mirrorCells(cells, width, height, mirror) {
  const seen = new Set();
  const result = [];
  const add = (x, y) => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ x, y });
  };
  for (const { x, y } of cells) {
    const mirroredX = width - 1 - x;
    const mirroredY = height - 1 - y;
    add(x, y);
    if (mirror.horizontal) add(mirroredX, y);
    if (mirror.vertical) add(x, mirroredY);
    if (mirror.horizontal && mirror.vertical) add(mirroredX, mirroredY);
  }
  return result;
}
