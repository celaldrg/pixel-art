import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoEditor, createDemoProject, DEMO_COLOR } from '../src/demo.js';
import { isValidProject, parseProject, serializeProject } from '../src/project.js';
import { getPalette } from '../src/palettes.js';

test('the demo is a valid, finished 32x32 sprite', () => {
  const project = createDemoProject();
  assert.ok(isValidProject(project));
  assert.equal(project.width, 32);
  assert.equal(project.height, 32);
  assert.ok(project.pixels.every((color) => color !== null), 'every pixel is painted');
  assert.ok(new Set(project.pixels).size >= 12, 'uses a rich set of colors');
});

test('the demo is deterministic and every call returns a fresh copy', () => {
  const first = createDemoProject();
  const second = createDemoProject();
  assert.deepEqual(first, second);
  first.pixels[0] = null;
  first.customColors.push('#000000');
  assert.deepEqual(createDemoProject(), second);
});

test('every demo color is available as a palette or custom swatch', () => {
  const { pixels, paletteId, customColors } = createDemoProject();
  const swatches = new Set([...getPalette(paletteId).colors, ...customColors]);
  for (const color of new Set(pixels)) assert.ok(swatches.has(color), color);
});

test('the demo survives a save/load round trip', () => {
  const project = createDemoProject();
  assert.deepEqual(parseProject(serializeProject(project)), project);
});

test('the demo editor shows the sprite, ready to draw, and undo restores it exactly', () => {
  const editor = createDemoEditor();
  const state = editor.getState();
  assert.deepEqual(state.pixels, createDemoProject().pixels);
  assert.equal(state.color, DEMO_COLOR);
  assert.equal(state.tool, 'pencil');
  assert.equal(state.canUndo, false);
  editor.setTool('fill');
  editor.pointerDown(0, 0);
  assert.notDeepEqual(editor.getState().pixels, state.pixels);
  assert.ok(editor.undo());
  assert.deepEqual(editor.getState().pixels, state.pixels);
});
