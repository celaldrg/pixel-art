/**
 * Zoom and pan math for the drawing stage, in device pixels of the stage canvas.
 * A view places the artwork on the stage: `cell` is the size of one art pixel
 * (a whole number, so pixel edges stay sharp) and (offsetX, offsetY) is where
 * the artwork's top-left corner sits.
 * @module view
 */

/** @typedef {{ cell: number, offsetX: number, offsetY: number }} View */
/** @typedef {{ width: number, height: number }} Size */

/** Zoom factor of one zoom step. */
export const ZOOM_STEP = 1.25;

/**
 * The largest view that shows the whole artwork centered, with `margin` free pixels around it.
 * @param {Size} stage
 * @param {Size} art
 * @param {number} [margin]
 * @returns {View}
 */
export function fitView(stage, art, margin = 0) {
  const room = Math.min((stage.width - 2 * margin) / art.width, (stage.height - 2 * margin) / art.height);
  const cell = Math.max(1, Math.floor(room));
  return {
    cell,
    offsetX: Math.round((stage.width - art.width * cell) / 2),
    offsetY: Math.round((stage.height - art.height * cell) / 2),
  };
}

/**
 * Changes the cell size while the artwork point under (anchorX, anchorY) stays in place.
 * @param {View} view
 * @param {number} cell new cell size
 * @param {number} anchorX
 * @param {number} anchorY
 * @returns {View}
 */
export function zoomViewAt(view, cell, anchorX, anchorY) {
  const ratio = cell / view.cell;
  return {
    cell,
    offsetX: Math.round(anchorX - (anchorX - view.offsetX) * ratio),
    offsetY: Math.round(anchorY - (anchorY - view.offsetY) * ratio),
  };
}

/**
 * The cell size one zoom step in or out. Every step changes the size by at
 * least one pixel; the result stays between 1 and maxCell.
 * @param {number} cell
 * @param {number} direction positive zooms in, negative zooms out
 * @param {number} maxCell
 * @returns {number}
 */
export function stepZoom(cell, direction, maxCell) {
  const next = direction > 0
    ? Math.max(cell + 1, Math.round(cell * ZOOM_STEP))
    : Math.min(cell - 1, Math.round(cell / ZOOM_STEP));
  return clamp(next, 1, Math.max(1, maxCell));
}

/**
 * Moves a view by (dx, dy).
 * @param {View} view
 * @param {number} dx
 * @param {number} dy
 * @returns {View}
 */
export function panView(view, dx, dy) {
  return { cell: view.cell, offsetX: view.offsetX + dx, offsetY: view.offsetY + dy };
}

/**
 * Keeps at least `keep` pixels of the artwork on the stage along both axes
 * (all of it when the artwork is smaller), so panning can never lose it.
 * @param {View} view
 * @param {Size} stage
 * @param {Size} art
 * @param {number} keep
 * @returns {View}
 */
export function clampView(view, stage, art, keep) {
  return {
    cell: view.cell,
    offsetX: clampAxis(view.offsetX, art.width * view.cell, stage.width, keep),
    offsetY: clampAxis(view.offsetY, art.height * view.cell, stage.height, keep),
  };
}

/**
 * Converts a stage position to fractional cell coordinates.
 * @param {View} view
 * @param {number} x
 * @param {number} y
 * @returns {{ x: number, y: number }}
 */
export function stageToCell(view, x, y) {
  return { x: (x - view.offsetX) / view.cell, y: (y - view.offsetY) / view.cell };
}

/**
 * @param {number} offset
 * @param {number} artSize artwork size along the axis
 * @param {number} stageSize stage size along the axis
 * @param {number} keep
 * @returns {number}
 */
function clampAxis(offset, artSize, stageSize, keep) {
  const visible = Math.min(keep, artSize, stageSize);
  return clamp(offset, visible - artSize, stageSize - visible);
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
