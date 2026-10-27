/**
 * The ?demo state: a finished 32x32 sprite of a mushroom cottage, built by
 * code from text rows (one character per pixel). Original artwork.
 * @module demo
 */

import { createEditor } from './editor.js';
import { pixelsFromRows } from './grid.js';
import { DEFAULT_PALETTE_ID } from './palettes.js';

/** Characters used in DEMO_ROWS and the colors they stand for. */
const LEGEND = Object.freeze({
  B: '#3e9bd6', // sky
  b: '#8fd3f4', // light sky (custom color)
  '#': '#2c2f45', // outline
  R: '#d8433b', // cap
  r: '#9e2a2f', // cap shadow (custom color)
  o: '#fb923c', // cap highlight
  w: '#f4f1e8', // spots, walls, cloud
  s: '#ecb685', // wall shade
  D: '#a86b3c', // door
  d: '#6b3d2b', // frames, cap underside
  y: '#f7d154', // window light, door knob, flowers
  G: '#82c95b', // grass
  g: '#2f7d4c', // dark grass
  C: '#5a5f7d', // chimney
  c: '#a3a9c2', // smoke, stones, cloud shade
  p: '#8a3a6e', // flowers
});

/** Custom colors the demo uses beyond the default palette, most recent first. */
const DEMO_CUSTOM_COLORS = Object.freeze(['#9e2a2f', '#8fd3f4']);

/** Drawing color selected in the demo (the cap red). */
export const DEMO_COLOR = '#d8433b';

const DEMO_ROWS = Object.freeze([
  'BBBBBBBBBBBBBBBBBBBBBBBBBBcwwcBB',
  'BBBBBBBBBBBBBBBBBBBBBBBcwcccBBBB',
  'BBBBBBBBBBBBBBBBBBBBBBccBBBBBBBB',
  'BBBBwwwBBBBBBBBBBBBB######BBBBBB',
  'BBBwwwwwwBBBBBBBBBBB#cCCC#BBBBBB',
  'BBwwwwwwwwwBBBBBBBBBB#cC#BBBBBBB',
  'BBBccccccBBB########B#cC#BBBBBBB',
  'BBBBBBBBB###ooowwRRR#####BBBBBBB',
  'BBBBBBB##oooRRwwwwRRRRR##BBBBBBB',
  'BBBBB##ooRRRRRRwwRRRRRRRR##BBBBB',
  'BBBB#oowwRRRRRRRRRRRRRwwRrr#BBBB',
  'BBB#oRwwwwRRRRRRRRRRRwwwwRrr#BBB',
  'bBb#oRRwwRRRRRRRRRRRRRwwRRrr#BbB',
  'Bb#RRRRRRRRRRwwRRRRRRRRRRRRrr#Bb',
  'bb#RwwRRRRRRRwwRRRRRwwRRRRRrr#bb',
  'bb#rrrrrrrrrrrrrrrrrrrrrrrrrr#bb',
  'bbb###rrrrrrrrrrrrrrrrrrrr###bbb',
  'bbbbbbddddddddddddddddddddbbbbbb',
  'bbbbbbbb#ssssssssssssss#bbbbbbbb',
  'bbbbbbbb#wwwwwwwwwwwwss#bbbbbbbb',
  'bbbbbbbb#wwddwwwddddwss#bbbbbbbb',
  'bbbbbbbb#wdyydwdDDDDdss#bbbbbbbb',
  'bbbbbbbb#wdyodwdDDdDdss#bbbbbbbb',
  'bbbbbbbb#wwddwwdDDdDdss#bbbbbbbb',
  'bbbbbbbb#wwwwwwdDDdydss#bbbbbbbb',
  'bbbbbbbb#wwwwwwdDDdDdss#bbbbbbbb',
  'bbbbbbb#wwwwwwwdDDdDdsss#bbbbbbb',
  'bbbbbGb#wwGwwwwdDDdDdsGs#bGbbbbb',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'gGGgGGyGGgGGgGGgGccGGgGGgpGgGGgG',
  'ggggpgggggggggggccgggggggggygggg',
  'gggggggggggggggggggggggggggggggg',
]);

/**
 * Builds the demo project: the finished 32x32 mushroom cottage sprite.
 * Returns a fresh project on every call, so callers may modify it.
 * @returns {import('./project.js').Project}
 */
export function createDemoProject() {
  const { width, height, pixels } = pixelsFromRows(DEMO_ROWS, LEGEND);
  return { width, height, pixels, paletteId: DEFAULT_PALETTE_ID, customColors: [...DEMO_CUSTOM_COLORS] };
}

/**
 * Creates an editor showing the demo sprite, ready to draw with the cap red.
 * @returns {ReturnType<typeof createEditor>}
 */
export function createDemoEditor() {
  return createEditor({ project: createDemoProject(), color: DEMO_COLOR });
}
