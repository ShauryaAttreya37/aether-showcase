/* Plots the results table on the page, so chart and table cannot disagree. */
import { segmented } from './controls.mjs';
import { niceTicks, parseMetricPair } from './forecast-data.mjs';
import { createLineChart, renderLegend } from './line-chart.mjs';

const PASS_MARK_HOUR = 24;
const METRICS = [{ value: 'mae', label: 'MAE' }, { value: 'rmse', label: 'RMSE' }];
const MODEL_COLOUR = 'var(--series-1)';
const PERSISTENCE_COLOUR = 'var(--series-2)';

function readTable(table) {
  return [...table.tBodies[0].rows].map(row => ({
    hour: Number.parseInt(row.cells[0].textContent.replace('+', ''), 10),
    model: parseMetricPair(row.cells[1].textContent),
    persistence: parseMetricPair(row.cells[2].textContent),
  }));
}

function chartSpec(rows, metric) {
  const name = metric.toUpperCase();
  const top = Math.max(...rows.flatMap(row => [row.model[metric], row.persistence[metric]]));
  const yTicks = niceTicks(0, top * 1.05, 4);
  const pointsFor = key => rows.map(row => ({ x: row.hour, y: row[key][metric] }));
  return {
    xDomain: [0, 72],
    xTicks: rows.filter(row => row.hour !== 1).map(row => ({ x: row.hour, label: `+${row.hour} h` })),
    yDomain: [0, yTicks.at(-1)],
    yTicks,
    snapXs: rows.map(row => row.hour),
    marker: { x: PASS_MARK_HOUR, label: 'Pass mark' },
    series: [
      { color: PERSISTENCE_COLOUR, endLabel: 'Persistence', markers: true, points: pointsFor('persistence') },
      { color: MODEL_COLOUR, endLabel: 'Model', markers: true, points: pointsFor('model') },
    ],
    tooltip: x => {
      const row = rows.find(candidate => candidate.hour === x);
      return {
        title: `+${x} h, ${name}`,
        rows: [
          { value: `${row.model[metric]} µg/m³`, label: 'model', color: MODEL_COLOUR },
          { value: `${row.persistence[metric]} µg/m³`, label: 'persistence', color: PERSISTENCE_COLOUR },
        ],
      };
    },
  };
}

export function initModelChart(root, table) {
  const rows = readTable(table);
  const legend = document.createElement('div');
  const host = document.createElement('div');
  const chooser = segmented('Error measure', 'model-metric', METRICS, 'mae', metric => {
    chart.update(chartSpec(rows, metric));
  });
  chooser.classList.add('controls-inline');
  renderLegend(legend, [
    { label: 'Model', color: MODEL_COLOUR },
    { label: 'Persistence', color: PERSISTENCE_COLOUR },
  ]);
  root.append(chooser, legend, host);
  const chart = createLineChart(host, {
    height: 240,
    label: 'Forecast error by horizon for the model and for persistence. The table below has every value.',
  });
  chart.update(chartSpec(rows, 'mae'));
}
