import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTOSAVE_DELAY_MS, createAutosaver } from '../src/autosave.js';

/** Manual timers: nothing runs until the test calls tick(). */
function fakeTimers() {
  const pending = new Map();
  let nextId = 1;
  return {
    setTimer: (callback, ms) => {
      pending.set(nextId, { callback, ms });
      nextId += 1;
      return nextId - 1;
    },
    clearTimer: (id) => pending.delete(id),
    tick() {
      const due = [...pending.values()];
      pending.clear();
      due.forEach(({ callback }) => callback());
    },
    get count() {
      return pending.size;
    },
    get delays() {
      return [...pending.values()].map(({ ms }) => ms);
    },
  };
}

function setup(saveResult = true) {
  const timers = fakeTimers();
  const statuses = [];
  let saves = 0;
  const autosaver = createAutosaver({
    save: () => {
      saves += 1;
      return saveResult;
    },
    onStatus: (status) => statuses.push(status),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  return { autosaver, timers, statuses, saves: () => saves };
}

describe('createAutosaver', () => {
  test('saves once after a burst of edits', () => {
    const { autosaver, timers, statuses, saves } = setup();
    autosaver.schedule();
    autosaver.schedule();
    autosaver.schedule();
    assert.equal(timers.count, 1);
    assert.deepEqual(timers.delays, [AUTOSAVE_DELAY_MS]);
    assert.equal(saves(), 0);
    timers.tick();
    assert.equal(saves(), 1);
    assert.deepEqual(statuses, ['pending', 'pending', 'pending', 'saved']);
  });

  test('reports a refused save as failed', () => {
    const { autosaver, timers, statuses } = setup(false);
    autosaver.schedule();
    timers.tick();
    assert.deepEqual(statuses, ['pending', 'failed']);
  });

  test('flush saves a pending change at once', () => {
    const { autosaver, timers, statuses, saves } = setup();
    autosaver.schedule();
    autosaver.flush();
    assert.equal(saves(), 1);
    assert.equal(timers.count, 0);
    assert.deepEqual(statuses, ['pending', 'saved']);
  });

  test('flush does nothing when no change is pending', () => {
    const { autosaver, statuses, saves } = setup();
    autosaver.flush();
    assert.equal(saves(), 0);
    assert.deepEqual(statuses, []);
  });

  test('a later edit after a save schedules a new save', () => {
    const { autosaver, timers, saves } = setup();
    autosaver.schedule();
    timers.tick();
    autosaver.schedule();
    timers.tick();
    assert.equal(saves(), 2);
  });
});
