/**
 * Canvas drawing for the stage and the previews (UI layer). The artwork lives
 * in a small canvas with one canvas pixel per art pixel; the stage draws it
 * enlarged without smoothing, over a checkerboard that shows transparency.
 * @module render
 */

import { renderRGBA } from './export.js';
import { mirrorCells } from './geometry.js';

const CHECKER_LIGHT = '#f1f5f9';
const CHECKER_DARK = '#dfe5ee';
const GRID_MINOR = 'rgba(100, 116, 139, 0.32)';
const GRID_MAJOR = 'rgba(51, 65, 85, 0.62)';
const GRID_MAJOR_EVERY = 8;
const AXIS_COLOR = '#fb923c';
const HOVER_OUTER = 'rgba(15, 23, 42, 0.85)';
const HOVER_INNER = '#ffffff';
const ART_SHADOW = 'rgba(2, 6, 23, 0.6)';

/** @typedef {import('./view.js').View} View */
/** @typedef {import('./geometry.js').Cell} Cell */

/**
 * @typedef {object} Scene
 * @property {View} view
 * @property {HTMLCanvasElement} art the artwork, one canvas pixel per art pixel
 * @property {HTMLCanvasElement} checker same size as art
 * @property {boolean} grid
 * @property {{ horizontal: boolean, vertical: boolean }} mirror
 * @property {Cell|null} hover art pixel under the mouse
 * @property {number} dpr device pixels per CSS pixel
 */

/**
 * Copies pixels into a canvas at one canvas pixel per art pixel, resizing it when needed.
 * @param {HTMLCanvasElement} canvas
 * @param {readonly import('./color.js').Color[]} pixels
 * @param {number} width
 * @param {number} height
 */
export function paintPixels(canvas, pixels, width, height) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const image = renderRGBA(pixels, width, height, 1);
  canvas.getContext('2d').putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
}

/**
 * Paints a checkerboard with one square per art pixel.
 * @param {HTMLCanvasElement} canvas
 * @param {number} width
 * @param {number} height
 */
export function paintChecker(canvas, width, height) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = CHECKER_LIGHT;
  context.fillRect(0, 0, width, height);
  context.fillStyle = CHECKER_DARK;
  for (let y = 0; y < height; y += 1) {
    for (let x = y % 2; x < width; x += 2) context.fillRect(x, y, 1, 1);
  }
}

/**
 * Shows the artwork in a preview canvas at `scale` CSS pixels per art pixel.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLCanvasElement} art
 * @param {number} scale
 */
export function drawPreview(canvas, art, scale) {
  if (canvas.width !== art.width || canvas.height !== art.height) {
    canvas.width = art.width;
    canvas.height = art.height;
    canvas.style.width = `${art.width * scale}px`;
    canvas.style.height = `${art.height * scale}px`;
  }
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(art, 0, 0);
}

/**
 * Draws the whole stage: artwork, grid, mirror axes and the hover outline.
 * @param {CanvasRenderingContext2D} context
 * @param {Scene} scene
 */
export function drawStage(context, scene) {
  const { view, art, checker, dpr } = scene;
  const width = art.width * view.cell;
  const height = art.height * view.cell;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.imageSmoothingEnabled = false;
  drawShadow(context, view.offsetX, view.offsetY, width, height, dpr);
  context.drawImage(checker, view.offsetX, view.offsetY, width, height);
  context.drawImage(art, view.offsetX, view.offsetY, width, height);
  if (scene.grid) drawGrid(context, view, art.width, art.height, dpr);
  drawMirrorAxes(context, view, art.width, art.height, scene.mirror, dpr);
  if (scene.hover) drawHover(context, view, mirrorCells([scene.hover], art.width, art.height, scene.mirror), dpr);
}

/**
 * Soft shadow under the artwork so it lifts off the stage.
 * @param {CanvasRenderingContext2D} context
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @param {number} dpr
 */
function drawShadow(context, left, top, width, height, dpr) {
  context.save();
  context.shadowColor = ART_SHADOW;
  context.shadowBlur = 28 * dpr;
  context.shadowOffsetY = 8 * dpr;
  context.fillStyle = CHECKER_LIGHT;
  context.fillRect(left, top, width, height);
  context.restore();
}

/**
 * Cell borders, with a stronger line every GRID_MAJOR_EVERY cells.
 * @param {CanvasRenderingContext2D} context
 * @param {View} view
 * @param {number} columns
 * @param {number} rows
 * @param {number} dpr
 */
function drawGrid(context, view, columns, rows, dpr) {
  const { cell, offsetX: left, offsetY: top } = view;
  const thickness = Math.max(1, Math.round(dpr));
  const shift = Math.floor(thickness / 2);
  for (let column = 1; column < columns; column += 1) {
    context.fillStyle = column % GRID_MAJOR_EVERY === 0 ? GRID_MAJOR : GRID_MINOR;
    context.fillRect(left + column * cell - shift, top, thickness, rows * cell);
  }
  for (let row = 1; row < rows; row += 1) {
    context.fillStyle = row % GRID_MAJOR_EVERY === 0 ? GRID_MAJOR : GRID_MINOR;
    context.fillRect(left, top + row * cell - shift, columns * cell, thickness);
  }
}

/**
 * Dashed lines along the active symmetry axes.
 * @param {CanvasRenderingContext2D} context
 * @param {View} view
 * @param {number} columns
 * @param {number} rows
 * @param {{ horizontal: boolean, vertical: boolean }} mirror
 * @param {number} dpr
 */
function drawMirrorAxes(context, view, columns, rows, mirror, dpr) {
  if (!mirror.horizontal && !mirror.vertical) return;
  const { cell, offsetX: left, offsetY: top } = view;
  context.save();
  context.strokeStyle = AXIS_COLOR;
  context.lineWidth = 2 * dpr;
  context.setLineDash([6 * dpr, 5 * dpr]);
  context.beginPath();
  if (mirror.horizontal) {
    const x = left + (columns * cell) / 2;
    context.moveTo(x, top);
    context.lineTo(x, top + rows * cell);
  }
  if (mirror.vertical) {
    const y = top + (rows * cell) / 2;
    context.moveTo(left, y);
    context.lineTo(left + columns * cell, y);
  }
  context.stroke();
  context.restore();
}

/**
 * Outlines the cells the next click would paint (the hovered cell and its mirror images).
 * @param {CanvasRenderingContext2D} context
 * @param {View} view
 * @param {Cell[]} cells
 * @param {number} dpr
 */
function drawHover(context, view, cells, dpr) {
  const line = Math.max(1, Math.round(dpr));
  for (const { x, y } of cells) {
    const left = view.offsetX + x * view.cell;
    const top = view.offsetY + y * view.cell;
    drawFrame(context, left - line, top - line, view.cell + 2 * line, line, HOVER_OUTER);
    drawFrame(context, left, top, view.cell, line, HOVER_INNER);
  }
}

/**
 * A square outline made of four filled bars (crisp at any device pixel ratio).
 * @param {CanvasRenderingContext2D} context
 * @param {number} left
 * @param {number} top
 * @param {number} size
 * @param {number} line
 * @param {string} color
 */
function drawFrame(context, left, top, size, line, color) {
  context.fillStyle = color;
  context.fillRect(left, top, size, line);
  context.fillRect(left, top + size - line, size, line);
  context.fillRect(left, top + line, line, size - 2 * line);
  context.fillRect(left + size - line, top + line, line, size - 2 * line);
}
