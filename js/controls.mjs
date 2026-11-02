/* Small DOM builders shared by the demos. All text goes in through textContent. */

export function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function segmented(legendText, name, options, selected, onChange) {
  const group = el('fieldset', 'segmented');
  group.append(el('legend', '', legendText));
  const row = el('div', 'segmented-row');
  options.forEach(({ value, label }) => {
    const wrap = el('label');
    const input = el('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = value === selected;
    input.addEventListener('change', () => onChange(value));
    wrap.append(input, el('span', '', label));
    row.append(wrap);
  });
  group.append(row);
  return group;
}

export function statTile(label) {
  const tile = el('div', 'tile');
  const name = el('div', 'tile-label', label);
  const value = el('div', 'tile-value');
  const note = el('div', 'tile-note');
  tile.append(name, value, note);
  return {
    element: tile,
    set(valueText, noteText = '') {
      value.textContent = valueText;
      note.textContent = noteText;
    },
  };
}

export function renderTable(host, caption, headers, rows) {
  const table = el('table');
  table.append(el('caption', 'visually-hidden', caption));
  const head = el('tr');
  headers.forEach(header => head.append(el('th', '', header)));
  const thead = el('thead');
  thead.append(head);
  const tbody = el('tbody');
  rows.forEach(cells => {
    const row = el('tr');
    cells.forEach(cell => row.append(el('td', '', cell)));
    tbody.append(row);
  });
  table.append(thead, tbody);
  const wrap = el('div', 'table-wrap');
  wrap.append(table);
  host.replaceChildren(wrap);
}
