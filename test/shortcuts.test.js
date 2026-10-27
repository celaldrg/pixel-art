import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShortcut, TOOL_KEYS } from '../src/shortcuts.js';
import { TOOLS } from '../src/editor.js';

test('B, E, G, L, R and I select the tools (either case)', () => {
  const expected = { b: 'pencil', e: 'eraser', g: 'fill', l: 'line', r: 'rect', i: 'picker' };
  for (const [key, tool] of Object.entries(expected)) {
    assert.deepEqual(resolveShortcut({ key }), { type: 'tool', tool });
    assert.deepEqual(resolveShortcut({ key: key.toUpperCase(), shiftKey: true }), { type: 'tool', tool });
  }
});

test('every shortcut points at a real tool', () => {
  assert.ok(Object.values(TOOL_KEYS).every((tool) => TOOLS.includes(tool)));
});

test('Ctrl/Cmd+Z undoes; Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo', () => {
  assert.deepEqual(resolveShortcut({ key: 'z', ctrlKey: true }), { type: 'undo' });
  assert.deepEqual(resolveShortcut({ key: 'z', metaKey: true }), { type: 'undo' });
  assert.deepEqual(resolveShortcut({ key: 'y', ctrlKey: true }), { type: 'redo' });
  assert.deepEqual(resolveShortcut({ key: 'Z', ctrlKey: true, shiftKey: true }), { type: 'redo' });
  assert.deepEqual(resolveShortcut({ key: 'z', metaKey: true, shiftKey: true }), { type: 'redo' });
});

test('other keys and modifier combinations do nothing', () => {
  for (const event of [
    { key: 'x' },
    { key: 'Enter' },
    { key: 'b', ctrlKey: true },
    { key: 'z', altKey: true, ctrlKey: true },
    { key: 'g', altKey: true },
    { key: 'constructor' },
    { key: undefined },
  ]) {
    assert.equal(resolveShortcut(event), null, JSON.stringify(event));
  }
});
