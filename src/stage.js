/**
 * The drawing stage (UI layer). Keeps the canvas sharp at any size and
 * devicePixelRatio, turns pointer input (mouse, pen, touch) into editor
 * strokes, zooms (buttons, wheel, pinch) and pans (two fingers, middle button,
 * Space + drag), and redraws the artwork and its previews.
 * @module stage
 */

import { inBounds } from './grid.js';
import { drawPreview, drawStage, paintChecker, paintPixels } from './render.js';
import { clampView, fitView, panView, stageToCell, stepZoom, zoomViewAt } from './view.js';

/** Free space around the artwork when it is fitted to the stage (CSS pixels). */
const FIT_MARGIN = 12;
/** Part of the artwork that panning always keeps on the stage (CSS pixels). */
const KEEP_VISIBLE = 48;
/** Largest zoom in CSS pixels per art pixel. */
const MAX_ZOOM = 96;
/** Smallest zoom (CSS pixels per art pixel) that still shows the grid. */
const MIN_GRID_ZOOM = 4;
/** Accumulated wheel distance (pixels) for one zoom step. */
const WHEEL_STEP = 50;
/** Pixels per wheel line, for browsers that report lines. */
const WHEEL_LINE = 32;

/**
 * @typedef {object} ZoomInfo
 * @property {number} scale CSS pixels per art pixel
 * @property {boolean} canZoomIn
 * @property {boolean} canZoomOut
 */

/** @typedef {{ x: number, y: number }} Point */

/**
 * Creates the stage. Nothing is drawn before the first render(state) call.
 * @param {object} options
 * @param {HTMLCanvasElement} options.canvas
 * @param {{ canvas: HTMLCanvasElement, scale: number }[]} options.previews
 * @param {ReturnType<import('./editor.js').createEditor>} options.editor
 * @param {() => void} options.onEdit called after pointer input changed the editor
 * @param {(cell: Point|null) => void} options.onHover art pixel under the mouse or pen
 * @param {(zoom: ZoomInfo) => void} options.onZoom
 */
export function createStage({ canvas, previews, editor, onEdit, onHover, onZoom }) {
  const context = canvas.getContext('2d');
  const art = document.createElement('canvas');
  const checker = document.createElement('canvas');
  /** @type {Map<number, Point>} pointers that are down, in canvas pixels */
  const pointers = new Map();
  /** @type {import('./editor.js').EditorState|null} */
  let state = null;
  let view = { cell: 1, offsetX: 0, offsetY: 0 };
  let dpr = 1;
  let followFit = true;
  let showGrid = true;
  /** @type {Point|null} */
  let hover = null;
  let gesture = null;
  let panKey = false;
  let pointerInside = false;
  let wheelDistance = 0;
  let paintedRevision = -1;

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('lostpointercapture', onLostCapture);
  canvas.addEventListener('pointerenter', () => {
    pointerInside = true;
  });
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  new ResizeObserver(layout).observe(canvas);
  window.addEventListener('resize', layout);

  /**
   * Shows an editor state: repaints the artwork when it changed and refits
   * the view when the canvas size changed.
   * @param {import('./editor.js').EditorState} next
   */
  function render(next) {
    const resized = !state || next.width !== state.width || next.height !== state.height;
    state = next;
    if (state.revision !== paintedRevision) {
      paintPixels(art, state.pixels, state.width, state.height);
      previews.forEach((preview) => drawPreview(preview.canvas, art, preview.scale));
      paintedRevision = state.revision;
    }
    if (!resized) {
      draw();
      return;
    }
    paintChecker(checker, state.width, state.height);
    if (hover) {
      hover = null;
      onHover(null);
    }
    followFit = true;
    layout();
  }

  /** Matches the canvas buffer to its CSS size times devicePixelRatio. */
  function layout() {
    if (!state) return;
    const box = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(box.width * dpr));
    const height = Math.max(1, Math.round(box.height * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    setView(followFit ? fittedView() : view);
  }

  function draw() {
    drawStage(context, {
      view,
      art,
      checker,
      grid: showGrid && view.cell >= MIN_GRID_ZOOM * dpr,
      mirror: state.mirror,
      hover,
      dpr,
    });
  }

  /** @param {import('./view.js').View} next */
  function setView(next) {
    view = clampView(next, stageSize(), artSize(), KEEP_VISIBLE * dpr);
    onZoom({ scale: view.cell / dpr, canZoomIn: view.cell < maxCell(), canZoomOut: view.cell > minCell() });
    draw();
  }

  function stageSize() {
    return { width: canvas.width, height: canvas.height };
  }

  function artSize() {
    return { width: state.width, height: state.height };
  }

  function fittedView() {
    return fitView(stageSize(), artSize(), FIT_MARGIN * dpr);
  }

  /** Smallest cell size: one CSS pixel per art pixel. */
  function minCell() {
    return Math.max(1, Math.round(dpr));
  }

  function maxCell() {
    return Math.max(fittedView().cell, Math.round(MAX_ZOOM * dpr));
  }

  /** @param {number} cell */
  function clampCell(cell) {
    return Math.min(maxCell(), Math.max(minCell(), cell));
  }

  /**
   * One zoom step around a stage point (default: the stage center).
   * @param {number} direction positive zooms in
   * @param {Point} [anchor]
   */
  function zoomBy(direction, anchor = { x: canvas.width / 2, y: canvas.height / 2 }) {
    if (!state) return;
    followFit = false;
    setView(zoomViewAt(view, clampCell(stepZoom(view.cell, direction, maxCell())), anchor.x, anchor.y));
  }

  /** @param {PointerEvent} event */
  function onPointerDown(event) {
    if (!state || (event.pointerType === 'mouse' && event.button > 1)) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, stagePoint(event));
    if (event.pointerType === 'touch' && pointers.size === 2) startPinch();
    else if (gesture) return;
    else if (event.button === 1 || panKey) startPan(event.pointerId);
    else startDraw(event);
  }

  /** @param {PointerEvent} event */
  function onPointerMove(event) {
    if (!state) return;
    const point = stagePoint(event);
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point);
    if (gesture?.type === 'pinch') updatePinch();
    else if (gesture?.pointerId === event.pointerId && gesture.type === 'pan') updatePan(point);
    else if (gesture?.pointerId === event.pointerId && !gesture.pendingFill) moveStroke(point);
    if (event.pointerType !== 'touch') setHover(stageToCell(view, point.x, point.y));
  }

  /** @param {PointerEvent} event */
  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    if (gesture?.type === 'draw' && gesture.pointerId === event.pointerId) finishStroke(stagePoint(event));
    else if (gesture?.type === 'pan' && gesture.pointerId === event.pointerId) gesture = null;
    else if (gesture?.type === 'pinch' && pointers.size === 0) gesture = null;
    updateCursor();
  }

  /** @param {PointerEvent} event */
  function onPointerCancel(event) {
    pointers.delete(event.pointerId);
    if (gesture?.type === 'draw' && gesture.pointerId === event.pointerId) cancelStroke();
    else if (pointers.size === 0) gesture = null;
    updateCursor();
  }

  /**
   * Ends a gesture whose pointer capture was lost without a pointerup
   * (for example when the window lost focus mid-stroke).
   * @param {PointerEvent} event
   */
  function onLostCapture(event) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    pointers.delete(event.pointerId);
    if (gesture.type === 'draw' && !gesture.pendingFill) finishStroke(null);
    else gesture = null;
    updateCursor();
  }

  function onPointerLeave() {
    pointerInside = false;
    if (state) setHover(null);
  }

  /** @param {WheelEvent} event */
  function onWheel(event) {
    event.preventDefault();
    wheelDistance += event.deltaMode === 0 ? event.deltaY : event.deltaY * WHEEL_LINE;
    if (Math.abs(wheelDistance) < WHEEL_STEP) return;
    const direction = wheelDistance < 0 ? 1 : -1;
    wheelDistance = 0;
    zoomBy(direction, stagePoint(event));
  }

  /**
   * Starts a stroke. A touch with the fill tool waits for the finger to lift,
   * so a two-finger gesture never fills by accident. The tool is read from the
   * editor, not from the last rendered state, so a tool picked in the same
   * frame already counts.
   * @param {PointerEvent} event
   */
  function startDraw(event) {
    const point = pointers.get(event.pointerId);
    const cell = stageToCell(view, point.x, point.y);
    gesture = { type: 'draw', pointerId: event.pointerId, pendingFill: null };
    if (event.pointerType === 'touch' && editor.getState().tool === 'fill') {
      gesture.pendingFill = cell;
      return;
    }
    editor.pointerDown(cell.x, cell.y);
    onEdit();
  }

  /** @param {Point} point */
  function moveStroke(point) {
    const cell = stageToCell(view, point.x, point.y);
    editor.pointerMove(cell.x, cell.y);
    onEdit();
  }

  /**
   * Ends the stroke of the active draw gesture.
   * @param {Point|null} point where the pointer was lifted, null when unknown
   */
  function finishStroke(point) {
    const { pendingFill } = gesture;
    gesture = null;
    if (pendingFill) {
      // A tool picked while the finger was down (e.g. from a keyboard) drops the waiting fill.
      if (editor.getState().tool === 'fill') editor.pointerDown(pendingFill.x, pendingFill.y);
    } else if (point) {
      const cell = stageToCell(view, point.x, point.y);
      editor.pointerUp(cell.x, cell.y);
    } else {
      editor.pointerUp();
    }
    onEdit();
  }

  /** Drops the stroke in progress (a second finger turned it into a gesture). */
  function cancelStroke() {
    const { pendingFill } = gesture;
    gesture = null;
    if (pendingFill) return;
    editor.cancelStroke();
    onEdit();
  }

  /** @param {number} pointerId */
  function startPan(pointerId) {
    gesture = { type: 'pan', pointerId, last: pointers.get(pointerId) };
    followFit = false;
    updateCursor();
  }

  /** @param {Point} point */
  function updatePan(point) {
    setView(panView(view, point.x - gesture.last.x, point.y - gesture.last.y));
    gesture.last = point;
  }

  function startPinch() {
    if (gesture?.type === 'draw') cancelStroke();
    const [first, second] = pointers.values();
    gesture = { type: 'pinch', view, distance: Math.max(1, distance(first, second)), center: midpoint(first, second) };
    followFit = false;
    setHover(null);
  }

  /** Zooms with the finger distance and pans with the finger midpoint. */
  function updatePinch() {
    const [first, second] = pointers.values();
    if (!first || !second) return;
    const start = gesture.view;
    const cell = clampCell(Math.round((start.cell * distance(first, second)) / gesture.distance));
    const center = midpoint(first, second);
    const zoomed = zoomViewAt(start, cell, gesture.center.x, gesture.center.y);
    setView(panView(zoomed, center.x - gesture.center.x, center.y - gesture.center.y));
  }

  /** @param {Point|null} point fractional cell coordinates */
  function setHover(point) {
    const x = Math.floor(point?.x);
    const y = Math.floor(point?.y);
    const next = point && inBounds(x, y, state.width, state.height) ? { x, y } : null;
    if (next?.x === hover?.x && next?.y === hover?.y) return;
    hover = next;
    onHover(hover);
    draw();
  }

  function updateCursor() {
    canvas.classList.toggle('is-pan-ready', panKey);
    canvas.classList.toggle('is-panning', gesture?.type === 'pan');
  }

  /**
   * Pointer position in canvas device pixels.
   * @param {MouseEvent} event
   * @returns {Point}
   */
  function stagePoint(event) {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) * canvas.width) / box.width,
      y: ((event.clientY - box.top) * canvas.height) / box.height,
    };
  }

  return {
    render,
    /** Zooms in one step around the stage center. */
    zoomIn: () => zoomBy(1),
    /** Zooms out one step around the stage center. */
    zoomOut: () => zoomBy(-1),
    /** Shows the whole artwork again and keeps it fitted when the stage resizes. */
    fit() {
      followFit = true;
      layout();
    },
    /** @returns {boolean} whether the grid is now shown */
    toggleGrid() {
      showGrid = !showGrid;
      if (state) draw();
      return showGrid;
    },
    /**
     * Space held over the stage turns dragging into panning.
     * @param {boolean} down
     * @returns {boolean} true when the state changed
     */
    setPanKey(down) {
      if (panKey === down) return false;
      panKey = down;
      updateCursor();
      return true;
    },
    /** @returns {boolean} whether a mouse or pen is over the stage */
    isPointerInside: () => pointerInside,
  };
}

/**
 * @param {Point} a
 * @param {Point} b
 * @returns {number}
 */
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * @param {Point} a
 * @param {Point} b
 * @returns {Point}
 */
function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
