import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOSAVE_KEY,
  isValidProject,
  loadSavedProject,
  parseProject,
  PROJECT_FORMAT,
  PROJECT_VERSION,
  saveProject,
  serializeProject,
} from '../src/project.js';
import { createEditor } from '../src/editor.js';
import { createDemoProject } from '../src/demo.js';
import { createPixels } from '../src/grid.js';
import { MAX_CUSTOM_COLORS } from '../src/palettes.js';
import { createStorage } from '../src/storage.js';

/** Deterministic PRNG (mulberry32). */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A project with random pixels: 24 random colors plus transparency. */
function randomProject(random, width, height) {
  const hex = () => Math.floor(random() * 256).toString(16).padStart(2, '0');
  const colors = Array.from({ length: 24 }, () => `#${hex()}${hex()}${hex()}`);
  const pixels = Array.from({ length: width * height }, () => (random() < 0.3 ? null : colors[Math.floor(random() * 24)]));
  return { width, height, pixels, paletteId: 'earth8', customColors: colors.slice(0, 5) };
}

/** A storage helper over an in-memory backend. */
function memoryStore() {
  const data = new Map();
  return createStorage(() => ({
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  }));
}

/** Valid file contents with some fields replaced. */
function fileWith(overrides) {
  const base = JSON.parse(serializeProject({ width: 2, height: 2, pixels: ['#ff0000', null, null, '#00ff00'], paletteId: 'retro16', customColors: [] }));
  return JSON.stringify({ ...base, ...overrides });
}

describe('serializeProject / parseProject', () => {
  test('round-trips the demo sprite exactly', () => {
    const project = createDemoProject();
    assert.deepEqual(parseProject(serializeProject(project)), project);
  });

  test('round-trips random 64x64, 16x16 and non-square projects exactly', () => {
    const random = seededRandom(99);
    for (const [width, height] of [[64, 64], [16, 16], [5, 3]]) {
      const project = randomProject(random, width, height);
      assert.deepEqual(parseProject(serializeProject(project)), project, `${width}x${height}`);
    }
  });

  test('round-trips an empty canvas and stores it as a single run', () => {
    const project = { width: 16, height: 16, pixels: createPixels(16, 16), paletteId: 'retro16', customColors: [] };
    const json = serializeProject(project);
    const data = JSON.parse(json);
    assert.equal(data.format, PROJECT_FORMAT);
    assert.equal(data.version, PROJECT_VERSION);
    assert.deepEqual(data.colors, []);
    assert.deepEqual(data.runs, [[256, -1]]);
    assert.deepEqual(parseProject(json), project);
  });

  test('run-length encodes rows of equal pixels', () => {
    const pixels = ['#ff0000', '#ff0000', null, '#ff0000', '#00ff00', '#00ff00'];
    const data = JSON.parse(serializeProject({ width: 3, height: 2, pixels, paletteId: 'retro16', customColors: [] }));
    assert.deepEqual(data.colors, ['#ff0000', '#00ff00']);
    assert.deepEqual(data.runs, [[2, 0], [1, -1], [1, 0], [2, 1]]);
  });

  test('an editor state survives save and load unchanged', () => {
    const editor = createEditor({ size: 16 });
    editor.setColor('#3e9bd6');
    editor.pointerDown(0, 0);
    editor.pointerMove(15, 9);
    editor.pointerUp();
    editor.setPalette('pastel8');
    editor.addCustomColor('#123456');
    const copy = createEditor();
    assert.ok(copy.load(parseProject(serializeProject(editor.toProject()))));
    assert.deepEqual(copy.toProject(), editor.toProject());
  });

  test('rejects malformed input', () => {
    const invalid = [
      undefined,
      null,
      42,
      '',
      'not json',
      '[]',
      'null',
      fileWith({ format: 'something-else' }),
      fileWith({ version: 2 }),
      fileWith({ width: 0 }),
      fileWith({ width: 65 }),
      fileWith({ height: 1.5 }),
      fileWith({ colors: ['#ff0000', 'red'] }),
      fileWith({ colors: 'nope' }),
      fileWith({ runs: [[3, 0]] }),
      fileWith({ runs: [[5, 0]] }),
      fileWith({ runs: [[0, 0], [4, 0]] }),
      fileWith({ runs: [[4, 2]] }),
      fileWith({ runs: [[4, -2]] }),
      fileWith({ runs: [[4, 0.5]] }),
      fileWith({ runs: [[2, 0, 1], [2, 0]] }),
      fileWith({ runs: [4, 0] }),
      fileWith({ runs: 'x' }),
    ];
    for (const text of invalid) assert.equal(parseProject(text), null, String(text));
  });

  test('unknown palettes fall back to the default and bad custom colors are dropped', () => {
    const tooMany = Array.from({ length: MAX_CUSTOM_COLORS + 5 }, (_, i) => `#0000${(i + 16).toString(16)}`);
    const project = parseProject(fileWith({ palette: 'missing', customColors: ['#ABC', 'oops', '#aabbcc', 7, ...tooMany] }));
    assert.equal(project.paletteId, 'retro16');
    assert.equal(project.customColors.length, MAX_CUSTOM_COLORS);
    assert.deepEqual(project.customColors.slice(0, 2), ['#aabbcc', '#000010']);
    assert.ok(isValidProject(project));
    assert.deepEqual(parseProject(fileWith({ customColors: undefined })).customColors, []);
  });

  test('normalizes stored colors to lowercase #rrggbb', () => {
    const project = parseProject(fileWith({ colors: ['#F00', '#00FF00'] }));
    assert.deepEqual(project.pixels, ['#ff0000', null, null, '#00ff00']);
  });
});

describe('isValidProject', () => {
  const valid = () => ({ width: 2, height: 1, pixels: ['#ff0000', null], paletteId: 'retro16', customColors: ['#00ff00'] });

  test('accepts a well-formed project', () => {
    assert.equal(isValidProject(valid()), true);
  });

  test('rejects wrong sizes, colors, palettes and custom colors', () => {
    const broken = [
      null,
      'project',
      { ...valid(), width: 3 },
      { ...valid(), width: 100, pixels: createPixels(100, 1) },
      { ...valid(), pixels: ['#FF0000', null] },
      { ...valid(), pixels: ['red', null] },
      { ...valid(), paletteId: 'nope' },
      { ...valid(), customColors: ['#xyzxyz'] },
      { ...valid(), customColors: 'none' },
    ];
    for (const project of broken) assert.equal(isValidProject(project), false, JSON.stringify(project));
  });
});

describe('autosave', () => {
  test('saveProject and loadSavedProject round-trip through the storage helper', () => {
    const store = memoryStore();
    assert.equal(loadSavedProject(store), null);
    const project = createDemoProject();
    assert.equal(saveProject(store, project), true);
    assert.equal(typeof store.get(AUTOSAVE_KEY), 'string');
    assert.deepEqual(loadSavedProject(store), project);
  });

  test('a corrupted autosave loads as null', () => {
    const store = memoryStore();
    store.set(AUTOSAVE_KEY, '{"format":"pixel-art","version":1,"width":2');
    assert.equal(loadSavedProject(store), null);
  });

  test('blocked storage (private mode) never throws', () => {
    const blocked = createStorage(() => {
      throw new Error('SecurityError: storage is disabled');
    });
    assert.equal(saveProject(blocked, createDemoProject()), false);
    assert.equal(loadSavedProject(blocked), null);
  });
});
