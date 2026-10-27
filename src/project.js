/**
 * Project files: JSON (de)serialization, validation and autosave.
 *
 * Saved JSON layout (version 1):
 *   { format: "pixel-art", version: 1, width, height, palette, customColors,
 *     colors: ["#rrggbb", ...], runs: [[count, colorIndex], ...] }
 * `runs` run-length encodes the row-major pixels; colorIndex -1 is transparent.
 * @module project
 */

import { normalizeColor } from './color.js';
import { isValidDimension } from './grid.js';
import { DEFAULT_PALETTE_ID, isPaletteId, MAX_CUSTOM_COLORS } from './palettes.js';

/** @typedef {import('./color.js').Color} Color */

/**
 * @typedef {object} Project
 * @property {number} width
 * @property {number} height
 * @property {Color[]} pixels row-major grid, length width * height
 * @property {string} paletteId id of a built-in palette
 * @property {string[]} customColors custom colors, most recent first
 */

/** @typedef {{ get(key: string): string|null, set(key: string, value: string): boolean }} KeyValueStore */

/** Value of the `format` field in saved files. */
export const PROJECT_FORMAT = 'pixel-art';

/** Current file format version. */
export const PROJECT_VERSION = 1;

/** Storage key of the autosaved project. */
export const AUTOSAVE_KEY = 'pixel-art:project';

/**
 * Tells whether value is a well-formed project (normalized colors, matching sizes).
 * @param {unknown} value
 * @returns {value is Project}
 */
export function isValidProject(value) {
  if (!value || typeof value !== 'object') return false;
  const { width, height, pixels, paletteId, customColors } = /** @type {Project} */ (value);
  return isValidDimension(width)
    && isValidDimension(height)
    && Array.isArray(pixels)
    && pixels.length === width * height
    && pixels.every((color) => color === null || isNormalizedColor(color))
    && isPaletteId(paletteId)
    && Array.isArray(customColors)
    && customColors.length <= MAX_CUSTOM_COLORS
    && customColors.every(isNormalizedColor);
}

/**
 * Serializes a project to a compact JSON string.
 * @param {Project} project
 * @returns {string}
 */
export function serializeProject(project) {
  const { colors, runs } = encodeRuns(project.pixels);
  return JSON.stringify({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    width: project.width,
    height: project.height,
    palette: project.paletteId,
    customColors: project.customColors,
    colors,
    runs,
  });
}

/**
 * Parses and validates a project JSON string.
 * Unknown palettes fall back to the default one and invalid custom colors are dropped;
 * anything else that is malformed rejects the whole file.
 * @param {unknown} text
 * @returns {Project|null} the project, or null when text is not a valid project
 */
export function parseProject(text) {
  const data = parseJsonObject(text);
  if (!data || data.format !== PROJECT_FORMAT || data.version !== PROJECT_VERSION) return null;
  const { width, height } = data;
  if (!isValidDimension(width) || !isValidDimension(height)) return null;
  const colors = parseColorList(data.colors);
  if (!colors) return null;
  const pixels = decodeRuns(data.runs, colors, width * height);
  if (!pixels) return null;
  return {
    width,
    height,
    pixels,
    paletteId: isPaletteId(data.palette) ? data.palette : DEFAULT_PALETTE_ID,
    customColors: parseCustomColors(data.customColors),
  };
}

/**
 * Autosaves a project through the storage helper.
 * @param {KeyValueStore} store
 * @param {Project} project
 * @returns {boolean} false when storage is unavailable or full
 */
export function saveProject(store, project) {
  return store.set(AUTOSAVE_KEY, serializeProject(project));
}

/**
 * Loads the autosaved project through the storage helper.
 * @param {KeyValueStore} store
 * @returns {Project|null} null when nothing valid is stored
 */
export function loadSavedProject(store) {
  return parseProject(store.get(AUTOSAVE_KEY));
}

/**
 * Run-length encodes pixels against a list of the distinct colors they use.
 * @param {readonly Color[]} pixels
 * @returns {{ colors: string[], runs: [number, number][] }}
 */
function encodeRuns(pixels) {
  const colors = [];
  const colorIndex = new Map();
  const runs = [];
  for (const color of pixels) {
    if (color !== null && !colorIndex.has(color)) {
      colorIndex.set(color, colors.length);
      colors.push(color);
    }
    const index = color === null ? -1 : colorIndex.get(color);
    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun[1] === index) lastRun[0] += 1;
    else runs.push([1, index]);
  }
  return { colors, runs };
}

/**
 * Expands runs back into pixels, checking every run.
 * @param {unknown} runs
 * @param {string[]} colors
 * @param {number} length expected number of pixels
 * @returns {Color[]|null}
 */
function decodeRuns(runs, colors, length) {
  if (!Array.isArray(runs)) return null;
  const pixels = [];
  for (const run of runs) {
    if (!Array.isArray(run) || run.length !== 2) return null;
    const [count, index] = run;
    const validCount = Number.isInteger(count) && count >= 1 && pixels.length + count <= length;
    const validIndex = Number.isInteger(index) && index >= -1 && index < colors.length;
    if (!validCount || !validIndex) return null;
    const color = index === -1 ? null : colors[index];
    for (let i = 0; i < count; i += 1) pixels.push(color);
  }
  return pixels.length === length ? pixels : null;
}

/**
 * @param {unknown} text
 * @returns {Record<string, unknown>|null} the parsed object, or null for anything else
 */
function parseJsonObject(text) {
  if (typeof text !== 'string') return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value
 * @returns {string[]|null} normalized colors, or null if any entry is invalid
 */
function parseColorList(value) {
  if (!Array.isArray(value)) return null;
  const colors = value.map(normalizeColor);
  return colors.includes(null) ? null : colors;
}

/**
 * @param {unknown} value
 * @returns {string[]} valid, unique custom colors (at most MAX_CUSTOM_COLORS)
 */
function parseCustomColors(value) {
  if (!Array.isArray(value)) return [];
  const colors = value.map(normalizeColor).filter((color) => color !== null);
  return [...new Set(colors)].slice(0, MAX_CUSTOM_COLORS);
}

/**
 * @param {unknown} color
 * @returns {boolean}
 */
function isNormalizedColor(color) {
  return typeof color === 'string' && normalizeColor(color) === color;
}
