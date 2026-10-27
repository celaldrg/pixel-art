/**
 * Keyboard shortcuts, kept separate from DOM code so they can be tested.
 * @module shortcuts
 */

/** Single-key tool shortcuts (lowercase key -> tool id). */
export const TOOL_KEYS = Object.freeze({
  b: 'pencil',
  e: 'eraser',
  g: 'fill',
  l: 'line',
  r: 'rect',
  i: 'picker',
});

/**
 * @typedef {{ type: 'tool', tool: string } | { type: 'undo' } | { type: 'redo' }} ShortcutCommand
 */

/**
 * Maps a keyboard event to an editor command.
 * Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo, B/E/G/L/R/I pick a tool.
 * @param {{ key: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean }} event
 * @returns {ShortcutCommand|null} null when the key has no shortcut
 */
export function resolveShortcut({ key, ctrlKey = false, metaKey = false, shiftKey = false, altKey = false }) {
  if (altKey || typeof key !== 'string') return null;
  const lower = key.toLowerCase();
  if (ctrlKey || metaKey) {
    if (lower === 'z') return { type: shiftKey ? 'redo' : 'undo' };
    if (lower === 'y') return { type: 'redo' };
    return null;
  }
  const tool = Object.hasOwn(TOOL_KEYS, lower) ? TOOL_KEYS[lower] : null;
  return tool ? { type: 'tool', tool } : null;
}
