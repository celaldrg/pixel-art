/**
 * Undo/redo history. Drawing steps are stored as diffs (only the cells that
 * changed, with their old and new colors); a canvas resize stores the grid
 * before and after, because its dimensions change.
 * @module history
 */

/** @typedef {import('./color.js').Color} Color */

/**
 * @typedef {object} PixelDiff
 * @property {'pixels'} type
 * @property {number[]} indices changed pixel indices, ascending
 * @property {Color[]} before colors before the step, parallel to indices
 * @property {Color[]} after colors after the step, parallel to indices
 */

/** @typedef {{ width: number, height: number, pixels: Color[] }} Snapshot */

/** @typedef {{ type: 'resize', before: Snapshot, after: Snapshot }} ResizeStep */

/** @typedef {PixelDiff | ResizeStep} HistoryStep */

/** Undo steps kept by default (the editor guarantees at least 50). */
export const DEFAULT_HISTORY_LIMIT = 100;

/**
 * Builds a diff from the original colors of the cells a step touched.
 * Cells that ended up with their original color are left out.
 * @param {ReadonlyMap<number, Color>} originals pixel index -> color before the step
 * @param {readonly Color[]} pixels the grid after the step
 * @returns {PixelDiff|null} null when nothing actually changed
 */
export function createPixelDiff(originals, pixels) {
  const indices = [...originals.keys()]
    .filter((index) => originals.get(index) !== pixels[index])
    .sort((a, b) => a - b);
  if (indices.length === 0) return null;
  return {
    type: 'pixels',
    indices,
    before: indices.map((index) => originals.get(index)),
    after: indices.map((index) => pixels[index]),
  };
}

/**
 * Writes one side of a diff into a grid (in place).
 * @param {Color[]} pixels
 * @param {PixelDiff} diff
 * @param {'before'|'after'} side 'before' undoes the step, 'after' redoes it
 */
export function applyPixelDiff(pixels, diff, side) {
  const colors = diff[side];
  diff.indices.forEach((index, position) => {
    pixels[index] = colors[position];
  });
}

/**
 * Creates a bounded undo/redo stack. Pushing a new step clears the redo stack;
 * when more than `limit` steps are stored the oldest one is dropped.
 * @param {number} [limit]
 */
export function createHistory(limit = DEFAULT_HISTORY_LIMIT) {
  /** @type {HistoryStep[]} */
  const undoStack = [];
  /** @type {HistoryStep[]} */
  const redoStack = [];

  return {
    /** @param {HistoryStep} step */
    push(step) {
      undoStack.push(step);
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
    },
    /** @returns {HistoryStep|null} the step to undo, now moved to the redo stack */
    undo() {
      const step = undoStack.pop();
      if (!step) return null;
      redoStack.push(step);
      return step;
    },
    /** @returns {HistoryStep|null} the step to redo, now moved back to the undo stack */
    redo() {
      const step = redoStack.pop();
      if (!step) return null;
      undoStack.push(step);
      return step;
    },
    /** Forgets every step. */
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
    /** @returns {boolean} */
    canUndo: () => undoStack.length > 0,
    /** @returns {boolean} */
    canRedo: () => redoStack.length > 0,
  };
}
