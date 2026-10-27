/**
 * The editor model: canvas pixels, the active tool and its settings, and
 * undo/redo. It has no DOM code; the UI forwards pointer positions in cell
 * coordinates plus commands, and reads everything back through getState().
 * @module editor
 */

import { normalizeColor } from './color.js';
import { floodRegion } from './fill.js';
import { bresenhamLine, mirrorCells, rectangleCells } from './geometry.js';
import { createPixels, DEFAULT_SIZE, inBounds, isValidDimension, resizePixels } from './grid.js';
import { applyPixelDiff, createHistory, createPixelDiff, DEFAULT_HISTORY_LIMIT } from './history.js';
import { addCustomColor as addToCustomColors, DEFAULT_PALETTE_ID, getPalette, isPaletteId } from './palettes.js';
import { isValidProject } from './project.js';

/** @typedef {import('./color.js').Color} Color */
/** @typedef {import('./geometry.js').Cell} Cell */
/** @typedef {import('./project.js').Project} Project */
/** @typedef {import('./history.js').HistoryStep} HistoryStep */

/** Tool ids in toolbar order. */
export const TOOLS = Object.freeze(['pencil', 'eraser', 'fill', 'line', 'rect', 'picker']);

/**
 * @typedef {object} EditorOptions
 * @property {number} [size] width and height of a new blank canvas (default 32)
 * @property {Project} [project] project to open instead of a blank canvas
 * @property {string} [color] initial drawing color (default: first palette color)
 * @property {number} [historyLimit] undo steps kept (default 100)
 */

/**
 * @typedef {object} EditorState
 * @property {number} width
 * @property {number} height
 * @property {Color[]} pixels copy of the row-major grid
 * @property {string} tool one of TOOLS
 * @property {string} color current drawing color, "#rrggbb"
 * @property {{ horizontal: boolean, vertical: boolean }} mirror active symmetry axes
 * @property {boolean} rectFilled whether the rectangle tool draws solid rectangles
 * @property {string} paletteId
 * @property {string[]} palette colors of the active palette
 * @property {string[]} customColors custom colors, most recent first
 * @property {boolean} canUndo
 * @property {boolean} canRedo
 * @property {boolean} drawing true while a pointer stroke is in progress
 * @property {number} revision grows whenever pixels, size, palette or custom colors change
 */

/**
 * @typedef {object} Stroke
 * @property {string} tool tool that started the stroke
 * @property {Color} value color the stroke paints (null erases)
 * @property {Cell} anchor cell where the stroke started
 * @property {Cell} last latest cell under the pointer
 * @property {Map<number, Color>} originals colors of touched pixels before the stroke
 */

/**
 * Creates an editor. Pointer methods take cell coordinates (fractions are
 * floored, positions outside the canvas are allowed and clipped). A stroke runs
 * from pointerDown to pointerUp and becomes a single undo step.
 * @param {EditorOptions} [options]
 */
export function createEditor(options = {}) {
  const history = createHistory(options.historyLimit ?? DEFAULT_HISTORY_LIMIT);
  let width = isValidDimension(options.size) ? options.size : DEFAULT_SIZE;
  let height = width;
  let pixels = createPixels(width, height);
  let paletteId = DEFAULT_PALETTE_ID;
  /** @type {string[]} */
  let customColors = [];
  let color = normalizeColor(options.color) ?? getPalette(paletteId).colors[0];
  let tool = 'pencil';
  let toolAfterPick = 'pencil';
  let mirror = { horizontal: false, vertical: false };
  let rectFilled = false;
  let revision = 0;
  /** @type {Stroke|null} */
  let stroke = null;

  if (options.project) load(options.project);

  /**
   * Returns a snapshot of everything the UI renders. Arrays are copies.
   * @returns {EditorState}
   */
  function getState() {
    return {
      width,
      height,
      pixels: pixels.slice(),
      tool,
      color,
      mirror: { ...mirror },
      rectFilled,
      paletteId,
      palette: getPalette(paletteId).colors.slice(),
      customColors: customColors.slice(),
      canUndo: history.canUndo(),
      canRedo: history.canRedo(),
      drawing: stroke !== null,
      revision,
    };
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {Color} the pixel color, null for transparent or outside cells
   */
  function getPixel(x, y) {
    return inBounds(x, y, width, height) ? pixels[y * width + x] : null;
  }

  /**
   * Returns the current work as a project (for saving or exporting).
   * @returns {Project}
   */
  function toProject() {
    return { width, height, pixels: pixels.slice(), paletteId, customColors: customColors.slice() };
  }

  /**
   * Starts a stroke at a cell. The fill tool fills at once; the picker picks
   * the color under the pointer until pointerUp, then returns to the previous tool.
   * @param {number} x
   * @param {number} y
   */
  function pointerDown(x, y) {
    finishStroke();
    const cell = toCell(x, y);
    if (!cell) return;
    if (tool === 'fill') {
      fillAt(cell);
      return;
    }
    stroke = { tool, value: tool === 'eraser' ? null : color, anchor: cell, last: cell, originals: new Map() };
    if (tool === 'picker') pickAt(cell);
    else paintCells([cell], stroke.value, stroke.originals);
  }

  /**
   * Continues the stroke: pencil and eraser paint a gap-free line from the
   * previous cell, line and rectangle redraw their preview from the anchor.
   * Does nothing when no stroke is active.
   * @param {number} x
   * @param {number} y
   */
  function pointerMove(x, y) {
    const cell = toCell(x, y);
    if (!stroke || !cell || (cell.x === stroke.last.x && cell.y === stroke.last.y)) return;
    const { anchor, last } = stroke;
    stroke.last = cell;
    if (stroke.tool === 'picker') pickAt(cell);
    else if (stroke.tool === 'line') redrawShape(bresenhamLine(anchor.x, anchor.y, cell.x, cell.y));
    else if (stroke.tool === 'rect') redrawShape(rectangleCells(anchor.x, anchor.y, cell.x, cell.y, rectFilled));
    else paintCells(bresenhamLine(last.x, last.y, cell.x, cell.y), stroke.value, stroke.originals);
  }

  /**
   * Ends the stroke (optionally after a last move to x, y) and records it as one undo step.
   * @param {number} [x]
   * @param {number} [y]
   */
  function pointerUp(x, y) {
    if (!stroke) return;
    if (x !== undefined && y !== undefined) pointerMove(x, y);
    finishStroke();
  }

  /** Aborts the current stroke and restores the pixels it changed. */
  function cancelStroke() {
    if (stroke) restore(stroke.originals);
    finishStroke();
  }

  /**
   * @param {string} next one of TOOLS
   * @returns {boolean} false for an unknown tool
   */
  function setTool(next) {
    if (!TOOLS.includes(next)) return false;
    finishStroke();
    if (next === 'picker' && tool !== 'picker') toolAfterPick = tool === 'eraser' ? 'pencil' : tool;
    tool = next;
    return true;
  }

  /**
   * @param {string} next hex color ("#rgb" or "#rrggbb")
   * @returns {boolean} false for an invalid color
   */
  function setColor(next) {
    const normalized = normalizeColor(next);
    if (normalized === null) return false;
    color = normalized;
    return true;
  }

  /**
   * Turns symmetry axes on or off; omitted axes keep their setting.
   * @param {{ horizontal?: boolean, vertical?: boolean }} next
   */
  function setMirror(next) {
    mirror = {
      horizontal: Boolean(next.horizontal ?? mirror.horizontal),
      vertical: Boolean(next.vertical ?? mirror.vertical),
    };
  }

  /** @param {boolean} filled true makes the rectangle tool draw solid rectangles */
  function setRectFilled(filled) {
    rectFilled = Boolean(filled);
  }

  /**
   * @param {string} id built-in palette id
   * @returns {boolean} false for an unknown palette
   */
  function setPalette(id) {
    if (!isPaletteId(id)) return false;
    paletteId = id;
    revision += 1;
    return true;
  }

  /**
   * Adds a color to the custom colors (most recent first, duplicates moved to the front).
   * @param {string} value hex color
   * @returns {boolean} false for an invalid color
   */
  function addCustomColor(value) {
    if (normalizeColor(value) === null) return false;
    customColors = addToCustomColors(customColors, value);
    revision += 1;
    return true;
  }

  /** @returns {boolean} true when a step was undone */
  function undo() {
    finishStroke();
    const step = history.undo();
    if (step) applyStep(step, 'before');
    return step !== null;
  }

  /** @returns {boolean} true when a step was redone */
  function redo() {
    finishStroke();
    const step = history.redo();
    if (step) applyStep(step, 'after');
    return step !== null;
  }

  /**
   * Makes every pixel transparent (one undo step).
   * @returns {boolean} false when the canvas was already empty
   */
  function clear() {
    finishStroke();
    const originals = new Map();
    pixels.forEach((value, index) => {
      if (value !== null) setIndex(index, null, originals);
    });
    return commit(originals);
  }

  /**
   * Changes the canvas size, keeping the artwork centered (one undo step).
   * @param {number} newWidth 1..64
   * @param {number} [newHeight] defaults to newWidth
   * @returns {boolean} false for invalid or unchanged sizes
   */
  function resize(newWidth, newHeight = newWidth) {
    if (!isValidDimension(newWidth) || !isValidDimension(newHeight)) return false;
    finishStroke();
    if (newWidth === width && newHeight === height) return false;
    const before = { width, height, pixels: pixels.slice() };
    pixels = resizePixels(pixels, width, height, newWidth, newHeight);
    width = newWidth;
    height = newHeight;
    history.push({ type: 'resize', before, after: { width, height, pixels: pixels.slice() } });
    revision += 1;
    return true;
  }

  /**
   * Opens a project, replacing the canvas, palette and custom colors and clearing history.
   * @param {Project} project
   * @returns {boolean} false (and no change) when project is invalid
   */
  function load(project) {
    if (!isValidProject(project)) return false;
    stroke = null;
    width = project.width;
    height = project.height;
    pixels = project.pixels.slice();
    paletteId = project.paletteId;
    customColors = project.customColors.slice();
    history.clear();
    revision += 1;
    return true;
  }

  /**
   * Converts pointer coordinates to a cell; null for non-numbers.
   * @param {number} x
   * @param {number} y
   * @returns {Cell|null}
   */
  function toCell(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: clampCoordinate(Math.floor(x), width), y: clampCoordinate(Math.floor(y), height) };
  }

  /**
   * Sets one pixel, remembering its original color for the undo step.
   * @param {number} index
   * @param {Color} value
   * @param {Map<number, Color>} originals
   */
  function setIndex(index, value, originals) {
    if (pixels[index] === value) return;
    if (!originals.has(index)) originals.set(index, pixels[index]);
    pixels[index] = value;
    revision += 1;
  }

  /**
   * Paints cells and their mirror images, skipping cells outside the canvas.
   * @param {Cell[]} cells
   * @param {Color} value
   * @param {Map<number, Color>} originals
   */
  function paintCells(cells, value, originals) {
    for (const { x, y } of mirrorCells(cells, width, height, mirror)) {
      if (inBounds(x, y, width, height)) setIndex(y * width + x, value, originals);
    }
  }

  /**
   * Replaces the line or rectangle preview of the current stroke.
   * @param {Cell[]} cells
   */
  function redrawShape(cells) {
    restore(stroke.originals);
    paintCells(cells, stroke.value, stroke.originals);
  }

  /**
   * Puts back the original colors of touched pixels and forgets them.
   * @param {Map<number, Color>} originals
   */
  function restore(originals) {
    if (originals.size === 0) return;
    originals.forEach((value, index) => {
      pixels[index] = value;
    });
    originals.clear();
    revision += 1;
  }

  /**
   * Pushes the changes recorded in originals as one undo step.
   * @param {Map<number, Color>} originals
   * @returns {boolean} true when something changed
   */
  function commit(originals) {
    const diff = createPixelDiff(originals, pixels);
    if (diff) history.push(diff);
    return diff !== null;
  }

  /** Ends the active stroke: commits drawing strokes, ends a pick. */
  function finishStroke() {
    if (!stroke) return;
    const finished = stroke;
    stroke = null;
    if (finished.tool === 'picker') tool = toolAfterPick;
    else commit(finished.originals);
  }

  /**
   * Flood-fills the region under the cell (and under its mirror images).
   * @param {Cell} cell
   */
  function fillAt(cell) {
    const originals = new Map();
    for (const seed of mirrorCells([cell], width, height, mirror)) {
      for (const index of floodRegion(pixels, width, height, seed.x, seed.y)) {
        setIndex(index, color, originals);
      }
    }
    commit(originals);
  }

  /**
   * Takes the color under the cell as drawing color; transparent cells are ignored.
   * @param {Cell} cell
   */
  function pickAt(cell) {
    const picked = getPixel(cell.x, cell.y);
    if (picked !== null) color = picked;
  }

  /**
   * Undoes ('before') or redoes ('after') a history step.
   * @param {HistoryStep} step
   * @param {'before'|'after'} side
   */
  function applyStep(step, side) {
    if (step.type === 'resize') {
      width = step[side].width;
      height = step[side].height;
      pixels = step[side].pixels.slice();
    } else {
      applyPixelDiff(pixels, step, side);
    }
    revision += 1;
  }

  return {
    getState,
    getPixel,
    toProject,
    pointerDown,
    pointerMove,
    pointerUp,
    cancelStroke,
    setTool,
    setColor,
    setMirror,
    setRectFilled,
    setPalette,
    addCustomColor,
    undo,
    redo,
    clear,
    resize,
    load,
  };
}

/**
 * Keeps a pointer coordinate within one canvas size beyond the edges, so far-away
 * pointers cannot make line or rectangle previews expensive to rasterize.
 * @param {number} value
 * @param {number} size
 * @returns {number}
 */
function clampCoordinate(value, size) {
  return Math.min(2 * size - 1, Math.max(-size, value));
}
