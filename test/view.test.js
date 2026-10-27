import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clampView, fitView, panView, stageToCell, stepZoom, ZOOM_STEP, zoomViewAt } from '../src/view.js';

describe('fitView', () => {
  test('picks the largest whole cell size and centers the artwork', () => {
    assert.deepEqual(fitView({ width: 400, height: 300 }, { width: 32, height: 32 }), { cell: 9, offsetX: 56, offsetY: 6 });
  });

  test('leaves the margin free on the tighter side', () => {
    const view = fitView({ width: 343, height: 343 }, { width: 16, height: 16 }, 12);
    assert.equal(view.cell, 19);
    assert.ok(view.offsetX >= 12 && view.offsetY >= 12);
  });

  test('never goes below one pixel per cell', () => {
    assert.equal(fitView({ width: 20, height: 20 }, { width: 64, height: 64 }).cell, 1);
  });
});

describe('zoomViewAt', () => {
  test('keeps the artwork point under the anchor in place', () => {
    const view = { cell: 10, offsetX: 40, offsetY: 20 };
    const before = stageToCell(view, 175, 95);
    const zoomed = zoomViewAt(view, 20, 175, 95);
    assert.equal(zoomed.cell, 20);
    assert.deepEqual(stageToCell(zoomed, 175, 95), before);
  });

  test('rounds offsets to whole pixels', () => {
    const zoomed = zoomViewAt({ cell: 3, offsetX: 1, offsetY: 1 }, 4, 10, 10);
    assert.ok(Number.isInteger(zoomed.offsetX) && Number.isInteger(zoomed.offsetY));
  });
});

describe('stepZoom', () => {
  test('zooms by the step factor, at least one pixel at a time', () => {
    assert.equal(stepZoom(20, 1, 100), Math.round(20 * ZOOM_STEP));
    assert.equal(stepZoom(20, -1, 100), Math.round(20 / ZOOM_STEP));
    assert.equal(stepZoom(1, 1, 100), 2);
    assert.equal(stepZoom(3, -1, 100), 2);
  });

  test('stays between 1 and the maximum', () => {
    assert.equal(stepZoom(90, 1, 96), 96);
    assert.equal(stepZoom(96, 1, 96), 96);
    assert.equal(stepZoom(1, -1, 96), 1);
  });
});

describe('panView and clampView', () => {
  test('panView moves the offsets only', () => {
    assert.deepEqual(panView({ cell: 5, offsetX: 10, offsetY: 20 }, -3, 7), { cell: 5, offsetX: 7, offsetY: 27 });
  });

  test('clampView keeps part of a large artwork on the stage', () => {
    const stage = { width: 300, height: 200 };
    const art = { width: 32, height: 32 };
    const farLeft = clampView({ cell: 20, offsetX: -5000, offsetY: 5000 }, stage, art, 48);
    assert.equal(farLeft.offsetX, 48 - 640);
    assert.equal(farLeft.offsetY, 200 - 48);
  });

  test('clampView keeps a small artwork fully visible', () => {
    const stage = { width: 300, height: 300 };
    const art = { width: 16, height: 16 };
    assert.deepEqual(clampView({ cell: 2, offsetX: -100, offsetY: 400 }, stage, art, 48), { cell: 2, offsetX: 0, offsetY: 268 });
  });

  test('clampView leaves a view inside the limits unchanged', () => {
    const view = { cell: 8, offsetX: 30, offsetY: 40 };
    assert.deepEqual(clampView(view, { width: 400, height: 400 }, { width: 32, height: 32 }, 48), view);
  });
});

describe('stageToCell', () => {
  test('converts stage pixels to fractional cells', () => {
    const view = { cell: 10, offsetX: 50, offsetY: 30 };
    assert.deepEqual(stageToCell(view, 50, 30), { x: 0, y: 0 });
    assert.deepEqual(stageToCell(view, 125, 30), { x: 7.5, y: 0 });
    assert.deepEqual(stageToCell(view, 40, 20), { x: -1, y: -1 });
  });
});
