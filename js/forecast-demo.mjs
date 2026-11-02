/* Forecast explorer: map with a time slider, and the 72 hours of one pinned cell. */
import { aqiBand, AETHER, bandRange } from '../app-js/config.mjs';
import { el, renderTable } from './controls.mjs';
import { cellAt, cellCentre, createForecastGrid, niceTicks } from './forecast-data.mjs';
import { createLineChart, renderLegend } from './line-chart.mjs';

const SCALE_MAX = 120;
const SCALE_TICKS = [0, 30, 60, 90, 120];
const PLAY_INTERVAL_MS = 220;
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const PLACES = [
  { name: 'Connaught Place', lat: 28.632, lon: 77.219 },
  { name: 'IGI Airport', lat: 28.556, lon: 77.1 },
  { name: 'Gurugram', lat: 28.459, lon: 77.027 },
  { name: 'Noida', lat: 28.535, lon: 77.391 },
  { name: 'Rohini', lat: 28.736, lon: 77.113 },
];
const CELL_COLOUR = 'var(--series-1)';
const MEAN_COLOUR = 'var(--series-muted)';

const timeFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

const darkScheme = matchMedia('(prefers-color-scheme: dark)');

function hexToRgb(hex) {
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
}

/* One colour per byte value. Dark mode reverses the ramp so low values recede. */
function buildLookup(dark) {
  const stops = (dark ? [...RAMP].reverse() : RAMP).map(hexToRgb);
  return Array.from({ length: 256 }, (_, value) => {
    const position = Math.min(value / SCALE_MAX, 1) * (stops.length - 1);
    const lower = Math.min(Math.floor(position), stops.length - 2);
    const blend = position - lower;
    return stops[lower].map((channel, index) =>
      Math.round(channel + (stops[lower + 1][index] - channel) * blend));
  });
}

function buildScale(dark) {
  const scale = el('div', 'map-scale');
  const bar = el('div', 'map-scale-bar');
  const paint = isDark => {
    const stops = isDark ? [...RAMP].reverse() : RAMP;
    bar.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
  };
  paint(dark);
  const ticks = el('div', 'map-scale-ticks');
  SCALE_TICKS.forEach(tick => {
    const label = el('span', '', tick === SCALE_MAX ? `${tick}+` : String(tick));
    label.style.left = `${tick / SCALE_MAX * 100}%`;
    ticks.append(label);
  });
  const bands = AETHER.AQI_BANDS
    .filter(band => band.min <= SCALE_MAX)
    .map(band => `${band.name} ${bandRange(band)}`)
    .join(' · ');
  scale.append(el('div', 'chart-title', 'PM2.5, µg/m³'), bar, ticks, el('p', 'note', `CPCB bands: ${bands}`));
  return { element: scale, paint };
}

function placePosition(row, column, size) {
  return { left: `${(column + 0.5) / size * 100}%`, top: `${(size - row - 0.5) / size * 100}%` };
}

function formatCell(cell, grid) {
  const { lat, lon } = cellCentre(cell.row, cell.column, grid);
  return `${lat.toFixed(3)}° N, ${lon.toFixed(3)}° E`;
}

function buildMap(meta) {
  const { size, north, south, east, west } = meta.grid;
  const canvas = el('canvas', 'map-canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    'Map of forecast PM2.5 over Delhi. Arrow keys move the selected cell; its values appear beside the map.');
  const midLatitude = (north + south) / 2 * Math.PI / 180;
  const aspect = (east - west) * Math.cos(midLatitude) / (north - south);
  const map = el('div', 'map');
  map.style.aspectRatio = aspect.toFixed(3);
  const hoverRing = el('span', 'map-ring map-ring-hover');
  const pinRing = el('span', 'map-ring');
  const tip = el('div', 'tip');
  tip.hidden = true;
  map.append(canvas, hoverRing, pinRing, tip);
  return { canvas, map, hoverRing, pinRing, tip };
}

function buildLayout(root, meta) {
  const transport = el('div', 'transport');
  const play = el('button', 'button', 'Play');
  play.type = 'button';
  const slider = el('input');
  Object.assign(slider, { type: 'range', min: 0, max: meta.horizon_hours.length - 1, value: 0 });
  slider.setAttribute('aria-label', 'Forecast hour');
  const time = el('output', 'transport-time');
  transport.append(play, slider, time);

  const mapParts = buildMap(meta);
  const readout = el('div', 'readout');
  readout.setAttribute('aria-live', 'polite');
  const scale = buildScale(darkScheme.matches);
  const placeRow = el('div', 'place-row');
  const side = el('div', 'map-side');
  side.append(readout, placeRow, scale.element);
  const layout = el('div', 'map-layout');
  layout.append(mapParts.map, side);

  const legend = el('div');
  const chartHost = el('div');
  const tableHost = el('div');
  const details = el('details');
  details.append(el('summary', '', 'Hourly values for this cell'), tableHost);
  root.replaceChildren(
    transport, layout,
    el('div', 'chart-title', 'The next 72 hours at this cell, µg/m³'),
    legend, chartHost, details,
  );
  return { ...mapParts, play, slider, time, readout, placeRow, scale, legend, chartHost, tableHost };
}

function fillReadout(readout, { name, coordinates, value, when, peak, peakWhen }) {
  readout.replaceChildren(
    el('div', 'readout-name', name),
    el('div', 'note', coordinates),
    el('div', 'readout-value', `${value} µg/m³`),
    el('div', 'readout-band', aqiBand(value).name),
    el('div', 'note', when),
    el('div', 'note', `Peak ${peak} µg/m³ on ${peakWhen}`),
  );
}

function cellFromPointer(event, canvas, size) {
  const bounds = canvas.getBoundingClientRect();
  const column = Math.floor((event.clientX - bounds.left) / bounds.width * size);
  const row = size - 1 - Math.floor((event.clientY - bounds.top) / bounds.height * size);
  if (row < 0 || row >= size || column < 0 || column >= size) return null;
  return { row, column };
}

function paintFrame(context, image, values, size, lookup) {
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const target = ((size - 1 - row) * size + column) * 4;
      const [red, green, blue] = lookup[values[row * size + column]];
      image.data[target] = red;
      image.data[target + 1] = green;
      image.data[target + 2] = blue;
      image.data[target + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function showMapTip(ui, cell, value, meta) {
  const { size } = meta.grid;
  ui.tip.replaceChildren(
    el('div', 'tip-title', formatCell(cell, meta.grid)),
    el('div', 'tip-value', `${value} µg/m³`),
    el('div', 'note', aqiBand(value).name),
  );
  ui.tip.hidden = false;
  const position = placePosition(cell.row, cell.column, size);
  Object.assign(ui.hoverRing.style, position, { display: 'block' });
  const onRight = (cell.column + 0.5) / size > 0.5;
  ui.tip.style.left = onRight ? 'auto' : `calc(${position.left} + 12px)`;
  ui.tip.style.right = onRight ? `calc(${100 - parseFloat(position.left)}% + 12px)` : 'auto';
  ui.tip.style.top = `min(${position.top}, calc(100% - 84px))`;
}

function hideMapTip(ui) {
  ui.tip.hidden = true;
  ui.hoverRing.style.display = 'none';
}

function cellChartSpec({ hours, frame, series, means, whenAt }) {
  const yTicks = niceTicks(0, Math.max(...series, ...means) * 1.05, 4);
  return {
    xDomain: [hours[0], hours.at(-1)],
    xTicks: [12, 24, 36, 48, 60, 72].map(x => ({ x, label: `+${x} h` })),
    yDomain: [0, yTicks.at(-1)],
    yTicks,
    snapXs: hours,
    marker: { x: hours[frame], label: `+${hours[frame]} h` },
    series: [
      { color: MEAN_COLOUR, endLabel: 'Grid mean', points: hours.map((x, i) => ({ x, y: means[i] })) },
      { color: CELL_COLOUR, endLabel: 'This cell', points: hours.map((x, i) => ({ x, y: series[i] })) },
    ],
    tooltip: x => {
      const index = hours.indexOf(x);
      return {
        title: `${whenAt(index)} (+${x} h)`,
        rows: [
          { value: `${series[index]} µg/m³`, label: 'this cell', color: CELL_COLOUR },
          { value: `${Math.round(means[index])} µg/m³`, label: 'grid mean', color: MEAN_COLOUR },
        ],
      };
    },
  };
}

function startExplorer(root, meta, grid) {
  const ui = buildLayout(root, meta);
  const context = ui.canvas.getContext('2d');
  const image = context.createImageData(grid.size, grid.size);
  const means = grid.means();
  const start = Date.parse(meta.valid_from);
  const hours = meta.horizon_hours;
  const whenAt = index => `${timeFormat.format(start + hours[index] * 3_600_000)} IST`;

  let lookup = buildLookup(darkScheme.matches);
  let frame = 0;
  let timer = null;
  let pinned = { ...cellAt(PLACES[0].lat, PLACES[0].lon, meta.grid), name: PLACES[0].name };

  const chart = createLineChart(ui.chartHost, {
    height: 200,
    label: 'Forecast PM2.5 over 72 hours at the selected cell and across the whole grid',
    onPick: x => setFrame(hours.indexOf(x)),
  });

  const drawFrame = () => paintFrame(context, image, grid.frame(frame), grid.size, lookup);

  function renderReadout() {
    const series = grid.series(pinned.row, pinned.column);
    const peakIndex = series.indexOf(Math.max(...series));
    fillReadout(ui.readout, {
      name: pinned.name ?? 'Selected cell',
      coordinates: formatCell(pinned, meta.grid),
      value: series[frame],
      when: whenAt(frame),
      peak: series[peakIndex],
      peakWhen: whenAt(peakIndex),
    });
  }

  function renderChart() {
    const series = grid.series(pinned.row, pinned.column);
    chart.update(cellChartSpec({ hours, frame, series, means, whenAt }));
  }

  function renderTableView() {
    const series = grid.series(pinned.row, pinned.column);
    renderTable(ui.tableHost, 'Forecast PM2.5 by hour at the selected cell',
      ['Time (IST)', 'Horizon', 'This cell', 'Grid mean'],
      hours.map((hour, index) => [
        whenAt(index), `+${hour} h`, String(series[index]), String(Math.round(means[index])),
      ]));
  }

  function setFrame(index) {
    frame = index;
    ui.slider.value = String(index);
    ui.time.textContent = `${whenAt(index)} · +${hours[index]} h`;
    ui.slider.setAttribute('aria-valuetext', ui.time.textContent);
    drawFrame();
    renderReadout();
    renderChart();
  }

  function setPinned(cell) {
    pinned = cell;
    Object.assign(ui.pinRing.style, placePosition(cell.row, cell.column, grid.size));
    ui.placeRow.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.textContent === cell.name));
    });
    renderReadout();
    renderChart();
    renderTableView();
  }

  function setPlaying(playing) {
    clearInterval(timer);
    timer = playing
      ? setInterval(() => setFrame((frame + 1) % hours.length), PLAY_INTERVAL_MS)
      : null;
    ui.play.textContent = playing ? 'Pause' : 'Play';
    // Announcing every frame of playback would drown out a screen reader.
    const announce = playing ? 'off' : 'polite';
    ui.time.setAttribute('aria-live', announce);
    ui.readout.setAttribute('aria-live', announce);
  }

  function bindMap() {
    ui.canvas.addEventListener('pointermove', event => {
      const cell = cellFromPointer(event, ui.canvas, grid.size);
      if (cell) showMapTip(ui, cell, grid.value(frame, cell.row, cell.column), meta);
    });
    ui.canvas.addEventListener('pointerleave', () => hideMapTip(ui));
    ui.canvas.addEventListener('click', event => {
      const cell = cellFromPointer(event, ui.canvas, grid.size);
      if (cell) setPinned(cell);
    });
    ui.canvas.addEventListener('keydown', event => {
      const moves = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      const clamp = value => Math.min(grid.size - 1, Math.max(0, value));
      setPinned({ row: clamp(pinned.row + move[0]), column: clamp(pinned.column + move[1]) });
    });
  }

  function bindPlaces() {
    PLACES.forEach(place => {
      const cell = cellAt(place.lat, place.lon, meta.grid);
      const dot = el('span', 'map-place');
      Object.assign(dot.style, placePosition(cell.row, cell.column, grid.size));
      dot.append(el('span', 'map-place-label', place.name));
      ui.map.insertBefore(dot, ui.hoverRing);
      const button = el('button', 'chip', place.name);
      button.type = 'button';
      button.addEventListener('click', () => setPinned({ ...cell, name: place.name }));
      ui.placeRow.append(button);
    });
  }

  renderLegend(ui.legend, [
    { label: 'This cell', color: CELL_COLOUR },
    { label: 'Grid mean', color: MEAN_COLOUR },
  ]);
  ui.play.addEventListener('click', () => setPlaying(timer === null));
  ui.slider.addEventListener('input', () => {
    setPlaying(false);
    setFrame(Number(ui.slider.value));
  });
  darkScheme.addEventListener('change', event => {
    lookup = buildLookup(event.matches);
    ui.scale.paint(event.matches);
    drawFrame();
  });
  bindPlaces();
  bindMap();
  setFrame(0);
  setPinned(pinned);
}

async function loadForecast() {
  const [metaResponse, dataResponse] = await Promise.all([
    fetch(new URL('../data/forecast.json', import.meta.url)),
    fetch(new URL('../data/forecast.bin', import.meta.url)),
  ]);
  if (!metaResponse.ok || !dataResponse.ok) {
    throw new Error(`Forecast files returned ${metaResponse.status} and ${dataResponse.status}`);
  }
  const meta = await metaResponse.json();
  const bytes = new Uint8Array(await dataResponse.arrayBuffer());
  return { meta, grid: createForecastGrid(meta, bytes) };
}

/* The forecast is about 300 KB, so it loads only when the reader gets near it. */
export function initForecastDemo(root) {
  const status = el('p', 'note', 'Loading the forecast…');
  root.append(status);
  const observer = new IntersectionObserver(async entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    try {
      const { meta, grid } = await loadForecast();
      startExplorer(root, meta, grid);
    } catch (error) {
      console.error('Forecast explorer failed', error);
      status.textContent = 'The forecast could not be loaded. The results table below still has the numbers.';
    }
  }, { rootMargin: '400px' });
  observer.observe(root);
}
