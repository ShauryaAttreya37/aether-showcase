import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cellAt,
  cellCentre,
  createForecastGrid,
  niceTicks,
  parseMetricPair,
} from '../js/forecast-data.mjs';

const meta = {
  horizon_hours: [1, 2],
  grid: { size: 2, west: 76, east: 78, south: 28, north: 30 },
};
// Frame 1: 10 20 / 30 40. Frame 2: 50 60 / 70 80. Rows run south to north.
const bytes = Uint8Array.from([10, 20, 30, 40, 50, 60, 70, 80]);

test('reads a value by horizon index, row and column', () => {
  const grid = createForecastGrid(meta, bytes);

  assert.equal(grid.value(0, 0, 0), 10);
  assert.equal(grid.value(0, 1, 0), 30);
  assert.equal(grid.value(1, 1, 1), 80);
});

test('returns one frame as a view of the packed bytes', () => {
  const grid = createForecastGrid(meta, bytes);

  assert.deepEqual([...grid.frame(1)], [50, 60, 70, 80]);
});

test('builds the time series of one cell', () => {
  const grid = createForecastGrid(meta, bytes);

  assert.deepEqual(grid.series(0, 1), [20, 60]);
});

test('builds the grid mean for each horizon', () => {
  const grid = createForecastGrid(meta, bytes);

  assert.deepEqual(grid.means(), [25, 65]);
});

test('rejects bytes that do not match the metadata', () => {
  assert.throws(() => createForecastGrid(meta, bytes.slice(1)), /expected 8 bytes/);
});

test('cellAt uses the same rounding as the app and clamps to the grid', () => {
  const { grid } = meta;

  assert.deepEqual(cellAt(28.1, 76.1, grid), { row: 0, column: 0 });
  assert.deepEqual(cellAt(29.9, 77.9, grid), { row: 1, column: 1 });
  assert.deepEqual(cellAt(40, 90, grid), { row: 1, column: 1 });
});

test('cellCentre returns the coordinates of a cell', () => {
  assert.deepEqual(cellCentre(1, 0, meta.grid), { lat: 30, lon: 76 });
});

test('parseMetricPair splits an MAE / RMSE table cell', () => {
  assert.deepEqual(parseMetricPair('52.14 / 83.05'), { mae: 52.14, rmse: 83.05 });
  assert.throws(() => parseMetricPair('n/a'), /MAE \/ RMSE/);
});

test('niceTicks returns round steps that include the top of the range', () => {
  assert.deepEqual(niceTicks(0, 120, 4), [0, 30, 60, 90, 120]);
  assert.deepEqual(niceTicks(0, 950, 4), [0, 250, 500, 750, 1000]);
});
