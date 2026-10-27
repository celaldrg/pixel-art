/**
 * Entry point (UI layer): opens the autosaved work (or the ?demo sprite),
 * connects the stage, the controls and the keyboard, and keeps the page, the
 * language and the autosave in step with the editor.
 * @module main
 */

import { createAutosaver } from './autosave.js';
import { bindControls } from './controls.js';
import { createDemoEditor } from './demo.js';
import { downloadPng } from './download.js';
import { createEditor } from './editor.js';
import { LANGUAGE_KEY, normalizeLanguage, otherLanguage, translate } from './i18n.js';
import { loadSavedProject, saveProject } from './project.js';
import { resolveShortcut } from './shortcuts.js';
import { createStage } from './stage.js';
import { storage } from './storage.js';
import { applyTranslations } from './translate-dom.js';

/** How long a toast message stays on screen. */
const TOAST_MS = 2800;

/** The demo shows the sample sprite and never reads or overwrites the visitor's saved work. */
const isDemo = new URLSearchParams(window.location.search).has('demo');
const editor = isDemo ? createDemoEditor() : createEditor({ project: loadSavedProject(storage) });
const touchFirst = window.matchMedia('(pointer: coarse)').matches;
const coordsText = document.getElementById('coords');
const hintText = document.getElementById('hint');
const saveStatus = document.getElementById('save-status');
const toast = document.getElementById('toast');
const langButton = document.getElementById('lang-btn');

let language = normalizeLanguage(storage.get(LANGUAGE_KEY));
let state = editor.getState();
let savedRevision = state.revision;
let saveState = isDemo ? 'demo' : 'saved';
/** @type {{ x: number, y: number }|null} */
let hoverCell = null;
let frame = 0;
let toastTimer = 0;

/**
 * Translates a string key into the current language.
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
const t = (key, params) => translate(language, key, params);

const autosaver = createAutosaver({
  save: () => saveProject(storage, editor.toProject()),
  onStatus: (status) => {
    saveState = status;
    renderSaveStatus();
  },
});

const stage = createStage({
  canvas: document.getElementById('canvas'),
  previews: [
    { canvas: document.getElementById('preview-1x'), scale: 1 },
    { canvas: document.getElementById('preview-2x'), scale: 2 },
  ],
  editor,
  onEdit: refresh,
  onHover: (cell) => {
    hoverCell = cell;
    renderCoords();
  },
  onZoom: (zoom) => controls.showZoom(zoom),
});

const controls = bindControls({
  editor,
  stage,
  t,
  actions: {
    refresh,
    clear: clearCanvas,
    exportPng,
    toggleLanguage: () => setLanguage(otherLanguage(language)),
  },
});

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', () => stage.setPanKey(false));
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});

applyLanguage();
update();

/** Draws the current editor state and schedules the autosave when the artwork changed. */
function update() {
  frame = 0;
  state = editor.getState();
  stage.render(state);
  controls.sync(state);
  renderCoords();
  if (!isDemo && !state.drawing && state.revision !== savedRevision) {
    savedRevision = state.revision;
    autosaver.schedule();
  }
}

/** Coalesces editor changes into one update per animation frame. */
function refresh() {
  if (frame === 0) frame = window.requestAnimationFrame(update);
}

/** Runs a pending update and saves at once, because the page is being hidden or closed. */
function saveNow() {
  if (frame !== 0) {
    window.cancelAnimationFrame(frame);
    update();
  }
  autosaver.flush();
}

/** @param {string} next language code */
function setLanguage(next) {
  language = normalizeLanguage(next);
  storage.set(LANGUAGE_KEY, language);
  applyLanguage();
}

/** Shows every string in the current language. */
function applyLanguage() {
  document.documentElement.lang = language;
  document.title = t('app.title');
  langButton.lang = otherLanguage(language);
  applyTranslations(document, t);
  hintText.textContent = t(touchFirst ? 'hint.touch' : 'hint.mouse');
  controls.relabel();
  renderCoords();
  renderSaveStatus();
  // A toast still on screen would keep the old language.
  toast.classList.remove('is-visible');
}

function renderCoords() {
  coordsText.textContent = hoverCell
    ? t('status.cell', { x: hoverCell.x, y: hoverCell.y })
    : t('status.size', { width: state.width, height: state.height });
}

function renderSaveStatus() {
  saveStatus.dataset.state = saveState;
  saveStatus.textContent = t(`status.${saveState}`);
}

/** @param {string} message */
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), TOAST_MS);
}

function clearCanvas() {
  if (editor.clear()) showToast(t('toast.cleared'));
  refresh();
}

async function exportPng() {
  try {
    const file = await downloadPng(editor.toProject(), controls.exportScale());
    showToast(t('toast.exported', { file }));
  } catch {
    showToast(t('toast.exportFailed'));
  }
}

/** @param {KeyboardEvent} event */
function onKeyDown(event) {
  if (isFormField(event.target)) return;
  if (event.code === 'Space') {
    if (!stage.isPointerInside()) return;
    event.preventDefault();
    stage.setPanKey(true);
    return;
  }
  if (event.key === 'Escape') {
    editor.cancelStroke();
    refresh();
    return;
  }
  const command = resolveShortcut(event);
  if (!command) return;
  event.preventDefault();
  if (command.type === 'undo') editor.undo();
  else if (command.type === 'redo') editor.redo();
  else editor.setTool(command.tool);
  refresh();
}

/** @param {KeyboardEvent} event */
function onKeyUp(event) {
  if (event.code === 'Space' && stage.setPanKey(false)) event.preventDefault();
}

/**
 * Keys typed into form fields keep their normal meaning.
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
function isFormField(target) {
  return target instanceof Element && target.matches('input, select, textarea');
}
