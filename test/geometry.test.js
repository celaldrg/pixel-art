import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { bresenhamLine, mirrorCells, rectangleCells } from '../src/geometry.js';

/** Cells as [x, y] pairs for compact expectations. */
const points = (cells) => cells.map(({ x, y }) => [x, y]);

/** Deterministic PRNG (mulberry32) so the property test is repeatable. */
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

describe('bresenhamLine', () => {
  test('a zero-length line is a single cell', () => {
    assert.deepEqual(points(bresenhamLine(3, 4, 3, 4)), [[3, 4]]);
  });

  test('horizontal and vertical lines', () => {
    assert.deepEqual(points(bresenhamLine(1, 2, 4, 2)), [[1, 2], [2, 2], [3, 2], [4, 2]]);
    assert.deepEqual(points(bresenhamLine(3, 1, 3, 4)), [[3, 1], [3, 2], [3, 3], [3, 4]]);
  });

  test('45 degree diagonals', () => {
    assert.deepEqual(points(bresenhamLine(0, 0, 3, 3)), [[0, 0], [1, 1], [2, 2], [3, 3]]);
    assert.deepEqual(points(bresenhamLine(0, 3, 3, 0)), [[0, 3], [1, 2], [2, 1], [3, 0]]);
  });

  test('shallow line matches the expected cells', () => {
    assert.deepEqual(points(bresenhamLine(0, 0, 5, 2)), [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2]]);
  });

  test('shallow line with negative slope matches the expected cells', () => {
    assert.deepEqual(points(bresenhamLine(0, 4, 7, 1)), [
      [0, 4], [1, 4], [2, 3], [3, 3], [4, 2], [5, 2], [6, 1], [7, 1],
    ]);
  });

  test('steep line matches the expected cells', () => {
    assert.deepEqual(points(bresenhamLine(0, 0, 2, 5)), [[0, 0], [0, 1], [1, 2], [1, 3], [2, 4], [2, 5]]);
  });

  test('steep line with negative slope matches the expected cells', () => {
    assert.deepEqual(points(bresenhamLine(1, 6, 3, 0)), [[1, 6], [1, 5], [2, 4], [2, 3], [2, 2], [3, 1], [3, 0]]);
  });

  test('exact ties follow one fixed rule, the same for shallow and steep lines', () => {
    assert.deepEqual(points(bresenhamLine(0, 0, 4, 2)), [[0, 0], [1, 1], [2, 1], [3, 2], [4, 2]]);
    assert.deepEqual(points(bresenhamLine(0, 0, 2, 4)), [[0, 0], [1, 1], [1, 2], [2, 3], [2, 4]]);
  });

  test('reversed lines give exactly the same cells in reverse order', () => {
    assert.deepEqual(points(bresenhamLine(5, 2, 0, 0)), [[5, 2], [4, 2], [3, 1], [2, 1], [1, 0], [0, 0]]);
    assert.deepEqual(points(bresenhamLine(2, 5, 0, 0)), [[2, 5], [2, 4], [1, 3], [1, 2], [0, 1], [0, 0]]);
    assert.deepEqual(points(bresenhamLine(3, 4, 3, 1)), [[3, 4], [3, 3], [3, 2], [3, 1]]);
    // A slope of exactly 1/2 has ties; direction must still not matter.
    assert.deepEqual(points(bresenhamLine(4, 2, 0, 0)), points(bresenhamLine(0, 0, 4, 2)).reverse());
  });

  test('works with coordinates outside the canvas (negative values)', () => {
    assert.deepEqual(points(bresenhamLine(-3, -1, 2, 1)), [[-3, -1], [-2, -1], [-1, 0], [0, 0], [1, 1], [2, 1]]);
  });

  test('property: 400 random lines are gap-free, exact length, close to the ideal line and direction-independent', () => {
    const random = seededRandom(20261027);
    const coordinate = () => Math.floor(random() * 81) - 40;
    for (let i = 0; i < 400; i += 1) {
      const [x0, y0, x1, y1] = [coordinate(), coordinate(), coordinate(), coordinate()];
      const cells = bresenhamLine(x0, y0, x1, y1);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const label = `line (${x0},${y0})-(${x1},${y1})`;
      assert.equal(cells.length, Math.max(Math.abs(dx), Math.abs(dy)) + 1, label);
      assert.deepEqual(cells[0], { x: x0, y: y0 }, label);
      assert.deepEqual(cells.at(-1), { x: x1, y: y1 }, label);
      for (let k = 1; k < cells.length; k += 1) {
        const step = Math.max(Math.abs(cells[k].x - cells[k - 1].x), Math.abs(cells[k].y - cells[k - 1].y));
        assert.equal(step, 1, `${label}: gap at cell ${k}`);
      }
      for (const { x, y } of cells) {
        const offset = Math.abs(dx) >= Math.abs(dy)
          ? Math.abs(y - (y0 + ((x - x0) * dy) / (dx || 1)))
          : Math.abs(x - (x0 + ((y - y0) * dx) / dy));
        assert.ok(offset <= 0.5 + 1e-9, `${label}: (${x},${y}) is ${offset} away from the ideal line`);
      }
      assert.deepEqual(bresenhamLine(x1, y1, x0, y0), cells.slice().reverse(), label);
    }
  });
});

describe('rectangleCells', () => {
  test('outline contains only the border cells, row by row', () => {
    assert.deepEqual(points(rectangleCells(1, 1, 4, 3, false)), [
      [1, 1], [2, 1], [3, 1], [4, 1],
      [1, 2], [4, 2],
      [1, 3], [2, 3], [3, 3], [4, 3],
    ]);
  });

  test('filled rectangle contains every cell', () => {
    const cells = points(rectangleCells(1, 1, 4, 3, true));
    assert.equal(cells.length, 12);
    assert.deepEqual(cells.slice(0, 5), [[1, 1], [2, 1], [3, 1], [4, 1], [1, 2]]);
    assert.deepEqual(cells.at(-1), [4, 3]);
  });

  test('corners may be given in any order', () => {
    const expected = rectangleCells(1, 1, 4, 3, false);
    assert.deepEqual(rectangleCells(4, 3, 1, 1, false), expected);
    assert.deepEqual(rectangleCells(1, 3, 4, 1, false), expected);
    assert.deepEqual(rectangleCells(4, 1, 1, 3, true), rectangleCells(1, 1, 4, 3, true));
  });

  test('degenerate rectangles have no duplicate cells', () => {
    assert.deepEqual(points(rectangleCells(2, 2, 2, 2, false)), [[2, 2]]);
    assert.deepEqual(points(rectangleCells(2, 0, 2, 3, false)), [[2, 0], [2, 1], [2, 2], [2, 3]]);
    assert.deepEqual(points(rectangleCells(0, 5, 2, 5, true)), [[0, 5], [1, 5], [2, 5]]);
    assert.deepEqual(points(rectangleCells(0, 0, 1, 1, false)), [[0, 0], [1, 0], [0, 1], [1, 1]]);
  });
});

describe('mirrorCells', () => {
  test('no mirror returns the cells unchanged', () => {
    assert.deepEqual(points(mirrorCells([{ x: 1, y: 2 }], 8, 8, {})), [[1, 2]]);
  });

  test('horizontal mirror reflects across the vertical center line', () => {
    assert.deepEqual(points(mirrorCells([{ x: 0, y: 5 }], 16, 16, { horizontal: true })), [[0, 5], [15, 5]]);
  });

  test('vertical mirror reflects across the horizontal center line', () => {
    assert.deepEqual(points(mirrorCells([{ x: 3, y: 0 }], 16, 16, { vertical: true })), [[3, 0], [3, 15]]);
  });

  test('both axes give four-way symmetry', () => {
    const cells = points(mirrorCells([{ x: 1, y: 2 }], 8, 8, { horizontal: true, vertical: true }));
    assert.deepEqual(cells, [[1, 2], [6, 2], [1, 5], [6, 5]]);
  });

  test('cells on the center line of an odd-sized canvas are not duplicated', () => {
    assert.deepEqual(points(mirrorCells([{ x: 2, y: 2 }], 5, 5, { horizontal: true, vertical: true })), [[2, 2]]);
  });

  test('cells that are each other\'s images appear once', () => {
    const cells = [{ x: 0, y: 0 }, { x: 7, y: 0 }];
    assert.deepEqual(points(mirrorCells(cells, 8, 8, { horizontal: true })), [[0, 0], [7, 0]]);
  });
});
