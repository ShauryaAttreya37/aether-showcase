/* A small SVG line chart: one y-axis, hairline grid, crosshair and tooltip. */

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN = { top: 16, right: 76, bottom: 26, left: 44 };
const MIN_LABEL_GAP = 14;
const POINT_RADIUS = 4;

function svgEl(name, attributes = {}, text) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function linePath(points, x, y) {
  let path = '';
  let drawing = false;
  points.forEach(point => {
    if (point.y === null) {
      drawing = false;
      return;
    }
    path += `${drawing ? 'L' : 'M'}${x(point.x).toFixed(1)} ${y(point.y).toFixed(1)}`;
    drawing = true;
  });
  return path;
}

function nearest(values, target) {
  return values.reduce((best, value) =>
    (Math.abs(value - target) < Math.abs(best - target) ? value : best), values[0]);
}

function drawGrid(svg, spec, scale, plot) {
  spec.yTicks.forEach(tick => {
    svg.append(svgEl('line', {
      class: tick === 0 ? 'c-axis' : 'c-grid',
      x1: plot.left, x2: plot.right, y1: scale.y(tick), y2: scale.y(tick),
    }));
    svg.append(svgEl('text', {
      class: 'c-tick', x: plot.left - 8, y: scale.y(tick) + 4, 'text-anchor': 'end',
    }, tick.toLocaleString('en-IN')));
  });
  spec.xTicks.forEach(tick => {
    svg.append(svgEl('text', {
      class: 'c-tick', x: scale.x(tick.x), y: plot.bottom + 18, 'text-anchor': 'middle',
    }, tick.label));
  });
}

function drawAnnotations(svg, spec, scale, plot) {
  (spec.bands ?? []).forEach(band => {
    svg.append(svgEl('rect', {
      class: 'c-band',
      x: scale.x(band.from), y: plot.top,
      width: scale.x(band.to) - scale.x(band.from), height: plot.bottom - plot.top,
    }));
    svg.append(svgEl('text', {
      class: 'c-note', x: scale.x((band.from + band.to) / 2), y: plot.top + 12, 'text-anchor': 'middle',
    }, band.label));
  });
  (spec.refs ?? []).forEach(ref => {
    svg.append(svgEl('line', {
      class: 'c-ref', x1: plot.left, x2: plot.right, y1: scale.y(ref.y), y2: scale.y(ref.y),
    }));
    svg.append(svgEl('text', {
      class: 'c-note', x: plot.right + 6, y: scale.y(ref.y) + 4,
    }, ref.label));
  });
  if (spec.marker) {
    const x = scale.x(spec.marker.x);
    svg.append(svgEl('line', { class: 'c-marker', x1: x, x2: x, y1: plot.top, y2: plot.bottom }));
    svg.append(svgEl('text', {
      class: 'c-note', x, y: plot.top - 5,
      'text-anchor': x > (plot.left + plot.right) / 2 ? 'end' : 'start',
    }, spec.marker.label));
  }
}

function drawEndLabels(svg, spec, scale, plot) {
  const labels = spec.series
    .filter(series => series.endLabel)
    .map(series => {
      const last = series.points.filter(point => point.y !== null).at(-1);
      return { text: series.endLabel, y: scale.y(last.y) + 4 };
    });
  // The last series is the main one, so its label is placed first. Labels that
  // would collide are dropped; the legend still names every series.
  labels.reverse().reduce((placed, label) => {
    if (placed.some(other => Math.abs(other.y - label.y) < MIN_LABEL_GAP)) return placed;
    svg.append(svgEl('text', { class: 'c-label', x: plot.right + 8, y: label.y }, label.text));
    return [...placed, label];
  }, []);
}

function drawSeries(svg, spec, scale) {
  spec.series.forEach(series => {
    const path = svgEl('path', { class: 'c-line', d: linePath(series.points, scale.x, scale.y) });
    path.style.stroke = series.color;
    svg.append(path);
    if (!series.markers) return;
    series.points.forEach(point => {
      const dot = svgEl('circle', {
        class: 'c-dot', cx: scale.x(point.x), cy: scale.y(point.y), r: POINT_RADIUS,
      });
      dot.style.fill = series.color;
      svg.append(dot);
    });
  });
}

function fillTooltip(tip, content) {
  const title = document.createElement('div');
  title.className = 'tip-title';
  title.textContent = content.title;
  const rows = content.rows.map(row => {
    const line = document.createElement('div');
    line.className = 'tip-row';
    const key = document.createElement('span');
    key.className = 'tip-key';
    if (row.color) key.style.background = row.color;
    const value = document.createElement('strong');
    value.textContent = row.value;
    const label = document.createElement('span');
    label.textContent = row.label;
    line.append(key, value, label);
    return line;
  });
  tip.replaceChildren(title, ...rows);
}

export function createLineChart(host, { height = 190, label, onCursor, onPick } = {}) {
  host.classList.add('chart');
  host.tabIndex = 0;
  host.setAttribute('role', 'img');
  host.setAttribute('aria-label', label);
  const svg = svgEl('svg');
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  host.append(svg, tip);

  let spec = null;
  let scale = null;
  let plot = null;
  let cursorLine = null;
  let cursorX = null;

  function render() {
    const width = host.clientWidth;
    if (!spec || width === 0) return;
    plot = {
      left: MARGIN.left, right: width - MARGIN.right, top: MARGIN.top, bottom: height - MARGIN.bottom,
    };
    const [x0, x1] = spec.xDomain;
    const [y0, y1] = spec.yDomain;
    scale = {
      x: value => plot.left + (value - x0) / (x1 - x0) * (plot.right - plot.left),
      y: value => plot.bottom - (value - y0) / (y1 - y0) * (plot.bottom - plot.top),
    };
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.replaceChildren();
    drawGrid(svg, spec, scale, plot);
    drawAnnotations(svg, spec, scale, plot);
    drawSeries(svg, spec, scale);
    drawEndLabels(svg, spec, scale, plot);
    cursorLine = svgEl('line', { class: 'c-cursor', y1: plot.top, y2: plot.bottom, visibility: 'hidden' });
    svg.append(cursorLine);
    if (cursorX !== null) setCursor(cursorX);
  }

  function setCursor(x) {
    cursorX = x;
    if (!cursorLine) return;
    if (x === null) {
      cursorLine.setAttribute('visibility', 'hidden');
      return;
    }
    cursorLine.setAttribute('x1', scale.x(x));
    cursorLine.setAttribute('x2', scale.x(x));
    cursorLine.setAttribute('visibility', 'visible');
  }

  function showTooltip(x) {
    fillTooltip(tip, spec.tooltip(x));
    tip.hidden = false;
    const tipWidth = tip.offsetWidth;
    const left = scale.x(x) + 12;
    const flipped = left + tipWidth > host.clientWidth;
    tip.style.left = `${flipped ? Math.max(0, scale.x(x) - tipWidth - 12) : left}px`;
    tip.style.top = `${plot.top}px`;
  }

  function moveTo(x) {
    setCursor(x);
    showTooltip(x);
    onCursor?.(x);
  }

  function clear() {
    setCursor(null);
    tip.hidden = true;
    onCursor?.(null);
  }

  function snapFromEvent(event) {
    const bounds = svg.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const ratio = (px - plot.left) / (plot.right - plot.left);
    const [x0, x1] = spec.xDomain;
    return nearest(spec.snapXs, x0 + ratio * (x1 - x0));
  }

  function stepCursor(delta) {
    const xs = spec.snapXs;
    const index = cursorX === null ? 0 : xs.indexOf(nearest(xs, cursorX));
    moveTo(xs[Math.min(xs.length - 1, Math.max(0, index + delta))]);
  }

  svg.addEventListener('pointermove', event => { if (spec) moveTo(snapFromEvent(event)); });
  svg.addEventListener('pointerleave', clear);
  svg.addEventListener('click', event => { if (spec) onPick?.(snapFromEvent(event)); });
  host.addEventListener('focus', () => { if (spec) stepCursor(0); });
  host.addEventListener('blur', clear);
  host.addEventListener('keydown', event => {
    const stride = Math.max(1, Math.round(spec.snapXs.length / 24));
    if (event.key === 'ArrowRight') stepCursor(stride);
    else if (event.key === 'ArrowLeft') stepCursor(-stride);
    else if (event.key === 'Enter' && cursorX !== null) onPick?.(cursorX);
    else if (event.key === 'Escape') clear();
    else return;
    event.preventDefault();
  });
  new ResizeObserver(render).observe(host);
  svg.style.height = `${height}px`;
  host.style.minHeight = `${height}px`;

  return {
    update(next) {
      spec = next;
      render();
      if (!tip.hidden && cursorX !== null) showTooltip(nearest(spec.snapXs, cursorX));
    },
    setCursor(x) {
      if (spec && scale) setCursor(x);
    },
  };
}

/* A legend with a short line key per series. Text stays in text colours. */
export function renderLegend(host, items) {
  host.classList.add('legend');
  host.replaceChildren(...items.map(item => {
    const entry = document.createElement('span');
    const key = document.createElement('span');
    key.className = 'legend-key';
    key.style.background = item.color;
    entry.append(key, document.createTextNode(item.label));
    return entry;
  }));
}
