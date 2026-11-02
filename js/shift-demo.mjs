/* "One shift" demo: controls, stat tiles, two aligned charts and an alert strip. */
import { AETHER } from '../app-js/config.mjs';
import { el, renderTable, segmented, statTile } from './controls.mjs';
import { niceTicks } from './forecast-data.mjs';
import { createLineChart } from './line-chart.mjs';
import { formatDuration, PROFILES, simulateShift, tierRuns, TIER_NAMES } from './shift.mjs';

const TIER_COLOURS = ['var(--line)', 'var(--status-warning)', 'var(--status-serious)', 'var(--status-critical)'];
const BASE_RANGE = { min: 10, max: 250, step: 5 };
const DEFAULT_BASE = 120;

const round = value => Math.round(value).toLocaleString('en-IN');

function hourTicks(hours) {
  const stride = hours > 8 ? 2 : 1;
  return Array.from({ length: Math.floor(hours / stride) + 1 }, (_, index) => {
    const x = index * stride;
    return { x, label: `${x} h` };
  });
}

function buildSlider(state, onChange) {
  const slider = el('label', 'slider');
  const text = el('span', 'slider-label');
  const input = el('input');
  Object.assign(input, { type: 'range', ...BASE_RANGE, value: state.base });
  const writeText = () => {
    text.textContent = `Base level: ${state.base} µg/m³`;
    input.setAttribute('aria-valuetext', `${state.base} µg/m³`);
  };
  input.addEventListener('input', () => {
    state.base = Number(input.value);
    writeText();
    onChange();
  });
  writeText();
  slider.append(text, input);
  return slider;
}

function buildControls(state, onChange) {
  const update = patch => {
    Object.assign(state, patch);
    onChange();
  };
  const roles = Object.entries(AETHER.ROLES).map(([value, role]) => ({ value, label: role.label }));
  const profiles = Object.entries(PROFILES).map(([value, profile]) => ({ value, label: profile.label }));

  const fault = el('label', 'check');
  const faultInput = el('input');
  faultInput.type = 'checkbox';
  faultInput.addEventListener('change', () => update({ fault: faultInput.checked }));
  fault.append(faultInput, el('span', '', 'Sensor fault in hour 4'));

  const form = el('form', 'controls');
  form.addEventListener('submit', event => event.preventDefault());
  form.append(
    segmented('Job', 'shift-role', roles, state.roleKey, roleKey => update({ roleKey })),
    segmented('Exposure pattern', 'shift-profile', profiles, state.profile, profile => update({ profile })),
    buildSlider(state, onChange),
    fault,
  );
  return form;
}

function renderStrip(strip, shift) {
  strip.replaceChildren(...tierRuns(shift.points).map(run => {
    const part = el('span');
    part.style.flexGrow = String(Math.max(run.to - run.from, 0.001));
    part.style.background = TIER_COLOURS[run.tier];
    part.title = `${TIER_NAMES[run.tier]} from ${formatDuration(run.from)} to ${formatDuration(run.to)}`;
    return part;
  }));
}

function tooltipFor(shift) {
  return hour => {
    const point = shift.points[Math.round(hour * 60)];
    return {
      title: `${formatDuration(hour)} into the shift`,
      rows: [
        { value: point.pm25 === null ? 'No reading' : `${round(point.pm25)} µg/m³`, label: 'PM2.5', color: 'var(--series-1)' },
        { value: `${round(point.dose)} µg·h/m³`, label: 'dose', color: 'var(--series-1)' },
        { value: TIER_NAMES[point.tier], label: 'alert', color: TIER_COLOURS[point.tier] },
      ],
    };
  };
}

function concentrationSpec(shift, shared) {
  const { information, caution, danger } = shift.role.thresholds;
  const yTicks = niceTicks(0, Math.max(shift.peak, danger) * 1.08, 4);
  return {
    ...shared,
    yDomain: [0, yTicks.at(-1)],
    yTicks,
    refs: [
      { y: information, label: `Inform ${information}` },
      { y: caution, label: `Caution ${caution}` },
      { y: danger, label: `Danger ${danger}` },
    ],
    series: [{
      color: 'var(--series-1)',
      points: shift.points.map(point => ({ x: point.hour, y: point.pm25 })),
    }],
  };
}

function doseSpec(shift, shared) {
  const yTicks = niceTicks(0, Math.max(shift.dose, shift.budget) * 1.05, 4);
  return {
    ...shared,
    yDomain: [0, yTicks.at(-1)],
    yTicks,
    refs: [{ y: shift.budget, label: `Budget ${round(shift.budget)}` }],
    series: [{
      color: 'var(--series-1)',
      points: shift.points.map(point => ({ x: point.hour, y: point.dose })),
    }],
  };
}

function hourlyRows(shift) {
  return shift.points
    .filter((_, index) => index % 60 === 0)
    .map(point => [
      `${point.hour} h`,
      point.pm25 === null ? 'No reading' : round(point.pm25),
      round(point.dose),
      TIER_NAMES[point.tier],
    ]);
}

function buildStripKey() {
  const stripKey = el('div', 'legend');
  TIER_NAMES.slice(1).forEach((name, index) => {
    const entry = el('span');
    const key = el('span', 'legend-swatch');
    key.style.background = TIER_COLOURS[index + 1];
    entry.append(key, document.createTextNode(name));
    stripKey.append(entry);
  });
  return stripKey;
}

function buildLayout(root) {
  const tiles = {
    dose: statTile('Dose over the shift'),
    share: statTile('Reference budget used'),
    reached: statTile('Budget reached after'),
    alert: statTile('Highest phone alert'),
  };
  const tileRow = el('div', 'tiles');
  tileRow.setAttribute('aria-live', 'polite');
  tileRow.append(...Object.values(tiles).map(tile => tile.element));

  const concentrationHost = el('div');
  const doseHost = el('div');
  const strip = el('div', 'tier-strip');
  strip.setAttribute('aria-hidden', 'true');
  const reasonsTitle = el('p', 'reasons-title');
  const reasons = el('ul', 'reasons');
  const tableHost = el('div');
  const details = el('details');
  details.append(el('summary', '', 'Hour-by-hour values'), tableHost);

  root.append(
    tileRow,
    el('div', 'chart-title', 'PM2.5 at the badge, µg/m³'),
    concentrationHost,
    el('div', 'chart-title', 'Phone alert level'),
    strip,
    buildStripKey(),
    el('div', 'chart-title', 'Accumulated dose, µg·h/m³'),
    doseHost,
    reasonsTitle, reasons, details,
  );
  return { tiles, concentrationHost, doseHost, strip, reasonsTitle, reasons, tableHost };
}

function renderStats(layout, shift) {
  const { tiles } = layout;
  tiles.dose.set(`${round(shift.dose)}`, 'µg·h/m³');
  tiles.share.set(`${round(shift.fraction * 100)}%`, `of ${round(shift.budget)} µg·h/m³`);
  tiles.reached.set(
    shift.budgetReachedHour === null ? 'Not reached' : formatDuration(shift.budgetReachedHour),
    `${shift.hours} h shift`,
  );
  tiles.alert.set(
    TIER_NAMES[shift.highestTier],
    shift.highestTier ? `from ${formatDuration(shift.highestTierHour)}` : 'stays below every threshold',
  );
  layout.reasonsTitle.textContent = shift.highestTier
    ? `Why the alert engine reached ${TIER_NAMES[shift.highestTier]}:`
    : 'The alert engine stays quiet for this shift.';
  layout.reasons.replaceChildren(...shift.reasons.map(reason => el('li', '', reason)));
}

export function initShiftDemo(root) {
  const state = { roleKey: AETHER.DEFAULT_ROLE, profile: 'rush', base: DEFAULT_BASE, fault: false };
  const charts = {};
  let layout = null;

  function render() {
    const shift = simulateShift(state);
    const shared = {
      xDomain: [0, shift.hours],
      xTicks: hourTicks(shift.hours),
      snapXs: shift.points.map(point => point.hour),
      bands: shift.fault ? [{ ...shift.fault, label: 'No data' }] : [],
      tooltip: tooltipFor(shift),
    };
    renderStats(layout, shift);
    charts.concentration.update(concentrationSpec(shift, shared));
    charts.dose.update(doseSpec(shift, shared));
    renderStrip(layout.strip, shift);
    renderTable(layout.tableHost, 'Hourly PM2.5, dose and alert for this shift',
      ['Hour', 'PM2.5, µg/m³', 'Dose, µg·h/m³', 'Alert'], hourlyRows(shift));
  }

  root.append(buildControls(state, render));
  layout = buildLayout(root);
  charts.concentration = createLineChart(layout.concentrationHost, {
    label: 'PM2.5 over the shift against the alert thresholds for this job',
    onCursor: x => charts.dose.setCursor(x),
  });
  charts.dose = createLineChart(layout.doseHost, {
    label: 'Accumulated dose over the shift against the reference budget',
    onCursor: x => charts.concentration.setCursor(x),
  });
  render();
}
