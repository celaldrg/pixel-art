/**
 * Debounced autosave: a burst of edits becomes one save after a short pause.
 * The timer functions are injectable, so tests run instantly.
 * @module autosave
 */

/** Pause after the last edit before the work is saved. */
export const AUTOSAVE_DELAY_MS = 500;

/** @typedef {'pending' | 'saved' | 'failed'} SaveStatus */

/**
 * Creates an autosaver.
 * @param {object} options
 * @param {() => boolean} options.save writes the work; false when storage refused it
 * @param {(status: SaveStatus) => void} options.onStatus reports every status change
 * @param {number} [options.delay]
 * @param {(callback: () => void, ms: number) => unknown} [options.setTimer]
 * @param {(handle: unknown) => void} [options.clearTimer]
 * @returns {{ schedule(): void, flush(): void }} schedule after each edit; flush before the page goes away
 */
export function createAutosaver({
  save,
  onStatus,
  delay = AUTOSAVE_DELAY_MS,
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (handle) => clearTimeout(/** @type {number} */ (handle)),
}) {
  let timer = null;

  const run = () => {
    timer = null;
    onStatus(save() ? 'saved' : 'failed');
  };

  return {
    schedule() {
      if (timer !== null) clearTimer(timer);
      onStatus('pending');
      timer = setTimer(run, delay);
    },
    flush() {
      if (timer === null) return;
      clearTimer(timer);
      run();
    },
  };
}
