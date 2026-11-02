/* Pure helpers for the packed forecast and the page's numeric tables. */

export function createForecastGrid(meta, bytes) {
  const { size } = meta.grid;
  const frames = meta.horizon_hours.length;
  const cellCount = size * size;
  const expected = frames * cellCount;
  if (bytes.length !== expected) {
    throw new Error(`Forecast data: expected ${expected} bytes, got ${bytes.length}`);
  }

  const frame = index => bytes.subarray(index * cellCount, (index + 1) * cellCount);
  const value = (index, row, column) => bytes[index * cellCount + row * size + column];
  const series = (row, column) =>
    meta.horizon_hours.map((_, index) => value(index, row, column));
  const means = () => meta.horizon_hours.map((_, index) =>
    frame(index).reduce((sum, cell) => sum + cell, 0) / cellCount);

  return { size, frames, frame, value, series, means };
}

const clampIndex = (position, size) => Math.min(size - 1, Math.max(0, Math.round(position)));

/* Same rounding as forecast.mjs in the app, clamped to the edge of the grid. */
export function cellAt(lat, lon, grid) {
  const steps = grid.size - 1;
  return {
    row: clampIndex((lat - grid.south) / (grid.north - grid.south) * steps, grid.size),
    column: clampIndex((lon - grid.west) / (grid.east - grid.west) * steps, grid.size),
  };
}

export function cellCentre(row, column, grid) {
  const steps = grid.size - 1;
  return {
    lat: grid.south + row * (grid.north - grid.south) / steps,
    lon: grid.west + column * (grid.east - grid.west) / steps,
  };
}

export function parseMetricPair(text) {
  const match = /^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/.exec(text);
  if (!match) throw new Error(`Expected "MAE / RMSE", got "${text}"`);
  return { mae: Number(match[1]), rmse: Number(match[2]) };
}

const NICE_STEPS = [1, 2, 2.5, 3, 5, 10];

export function niceTicks(min, max, count) {
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = magnitude * NICE_STEPS.find(nice => nice * magnitude >= rawStep);
  const top = Math.ceil(max / step) * step;
  const length = Math.round((top - min) / step) + 1;
  return Array.from({ length }, (_, index) => min + index * step);
}
