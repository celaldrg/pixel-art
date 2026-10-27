/**
 * Connects the toolbar, the stage bar and the side panels to the editor and
 * the stage, and keeps them in step with the editor state (UI layer).
 * @module controls
 */

import { EXPORT_SCALES } from './export.js';
import { SIZES } from './grid.js';
import { PALETTES } from './palettes.js';

/** Export scale selected when the page opens. */
const DEFAULT_EXPORT_SCALE = 8;

/** Tools that make way for the pencil when a color is chosen. */
const NON_PAINTING_TOOLS = Object.freeze(['eraser', 'picker']);

/**
 * @typedef {object} ControlActions
 * @property {() => void} refresh redraws the page after the editor changed
 * @property {() => void} clear clears the canvas
 * @property {() => void} exportPng saves the artwork as a PNG file
 * @property {() => void} toggleLanguage switches between English and Turkish
 */

/**
 * Wires every control and returns the functions that update them.
 * @param {object} options
 * @param {ReturnType<import('./editor.js').createEditor>} options.editor
 * @param {ReturnType<import('./stage.js').createStage>} options.stage
 * @param {(key: string, params?: Record<string, string|number>) => string} options.t translates a string key
 * @param {ControlActions} options.actions
 */
export function bindControls({ editor, stage, t, actions }) {
  const get = (id) => document.getElementById(id);
  const toolButtons = [...document.querySelectorAll('button[data-tool]')];
  const undoButton = get('undo-btn');
  const redoButton = get('redo-btn');
  const mirrorHButton = get('mirror-h-btn');
  const mirrorVButton = get('mirror-v-btn');
  const filledButton = get('filled-btn');
  const gridButton = get('grid-btn');
  const zoomInButton = get('zoom-in-btn');
  const zoomOutButton = get('zoom-out-btn');
  const zoomLabel = get('zoom-label');
  const currentSwatch = get('current-swatch');
  const currentHex = get('current-hex');
  const paletteSelect = get('palette-select');
  const paletteSwatches = get('palette-swatches');
  const customSwatches = get('custom-swatches');
  const customEmpty = get('custom-empty');
  const colorInput = get('color-input');
  const sizeSelect = get('size-select');
  const scaleSelect = get('scale-select');
  const exportSize = get('export-size');
  let state = editor.getState();
  let swatchKey = '';

  scaleSelect.replaceChildren(...EXPORT_SCALES.map((scale) => new Option(`${scale}×`, String(scale))));
  scaleSelect.value = String(DEFAULT_EXPORT_SCALE);

  /**
   * Runs an editor command, then redraws.
   * @param {() => unknown} command
   */
  const run = (command) => {
    command();
    actions.refresh();
  };

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => run(() => editor.setTool(button.dataset.tool)));
  });
  undoButton.addEventListener('click', () => run(editor.undo));
  redoButton.addEventListener('click', () => run(editor.redo));
  mirrorHButton.addEventListener('click', () => run(() => editor.setMirror({ horizontal: !editor.getState().mirror.horizontal })));
  mirrorVButton.addEventListener('click', () => run(() => editor.setMirror({ vertical: !editor.getState().mirror.vertical })));
  filledButton.addEventListener('click', () => run(() => editor.setRectFilled(!editor.getState().rectFilled)));
  gridButton.addEventListener('click', () => gridButton.setAttribute('aria-pressed', String(stage.toggleGrid())));
  zoomInButton.addEventListener('click', stage.zoomIn);
  zoomOutButton.addEventListener('click', stage.zoomOut);
  get('fit-btn').addEventListener('click', stage.fit);
  paletteSelect.addEventListener('change', () => run(() => editor.setPalette(paletteSelect.value)));
  paletteSwatches.addEventListener('click', onSwatchClick);
  customSwatches.addEventListener('click', onSwatchClick);
  colorInput.addEventListener('change', () => run(() => {
    editor.addCustomColor(colorInput.value);
    chooseColor(colorInput.value);
  }));
  sizeSelect.addEventListener('change', () => run(() => editor.resize(Number(sizeSelect.value))));
  scaleSelect.addEventListener('change', showExportSize);
  get('export-btn').addEventListener('click', actions.exportPng);
  get('clear-btn').addEventListener('click', actions.clear);
  get('lang-btn').addEventListener('click', actions.toggleLanguage);

  /** @param {MouseEvent} event */
  function onSwatchClick(event) {
    const swatch = event.target instanceof Element ? event.target.closest('.swatch') : null;
    if (swatch) run(() => chooseColor(swatch.dataset.color));
  }

  /**
   * Makes a color the drawing color; the eraser and the picker give way to the pencil.
   * @param {string} color
   */
  function chooseColor(color) {
    editor.setColor(color);
    if (NON_PAINTING_TOOLS.includes(editor.getState().tool)) editor.setTool('pencil');
  }

  /**
   * Shows an editor state in every control.
   * @param {import('./editor.js').EditorState} next
   */
  function sync(next) {
    state = next;
    toolButtons.forEach((button) => setPressed(button, button.dataset.tool === state.tool));
    undoButton.disabled = !state.canUndo;
    redoButton.disabled = !state.canRedo;
    setPressed(mirrorHButton, state.mirror.horizontal);
    setPressed(mirrorVButton, state.mirror.vertical);
    setPressed(filledButton, state.rectFilled);
    currentSwatch.style.setProperty('--swatch', state.color);
    currentHex.textContent = state.color;
    if (colorInput.value !== state.color) colorInput.value = state.color;
    paletteSelect.value = state.paletteId;
    sizeSelect.value = String(state.width);
    renderSwatches(false);
    showExportSize();
  }

  /** Builds the texts that come from code (menus, swatch labels) in the current language. */
  function relabel() {
    paletteSelect.replaceChildren(...PALETTES.map(({ id }) => new Option(t(`palette.${id}`), id)));
    sizeSelect.replaceChildren(...SIZES.map((size) => new Option(t('status.size', { width: size, height: size }), String(size))));
    paletteSelect.value = state.paletteId;
    sizeSelect.value = String(state.width);
    renderSwatches(true);
    showExportSize();
  }

  /**
   * Rebuilds the swatches when the palette or the custom colors changed
   * (or when forced), then marks the drawing color.
   * @param {boolean} force
   */
  function renderSwatches(force) {
    const key = `${state.paletteId}|${state.customColors.join(',')}`;
    if (force || key !== swatchKey) {
      swatchKey = key;
      paletteSwatches.replaceChildren(...state.palette.map(createSwatch));
      customSwatches.replaceChildren(...state.customColors.map(createSwatch));
      customEmpty.hidden = state.customColors.length > 0;
    }
    for (const swatch of document.querySelectorAll('.swatch')) {
      setPressed(swatch, swatch.dataset.color === state.color);
    }
  }

  /**
   * @param {string} color
   * @returns {HTMLButtonElement}
   */
  function createSwatch(color) {
    const swatch = document.createElement('button');
    const label = t('swatch.label', { color });
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.dataset.color = color;
    swatch.style.setProperty('--swatch', color);
    swatch.setAttribute('aria-label', label);
    swatch.title = label;
    return swatch;
  }

  function showExportSize() {
    const scale = Number(scaleSelect.value);
    exportSize.textContent = t('status.size', { width: state.width * scale, height: state.height * scale });
  }

  return {
    sync,
    relabel,
    /**
     * Shows the zoom level and enables the zoom buttons that still apply.
     * @param {import('./stage.js').ZoomInfo} zoom
     */
    showZoom({ scale, canZoomIn, canZoomOut }) {
      zoomLabel.textContent = `${Math.max(1, Math.round(scale))}×`;
      zoomInButton.disabled = !canZoomIn;
      zoomOutButton.disabled = !canZoomOut;
    },
    /** @returns {number} the export scale picked in the menu */
    exportScale: () => Number(scaleSelect.value),
  };
}

/**
 * @param {Element} element
 * @param {boolean} pressed
 */
function setPressed(element, pressed) {
  element.setAttribute('aria-pressed', String(pressed));
}
