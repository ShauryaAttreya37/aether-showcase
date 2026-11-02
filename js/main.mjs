/* Entry point. One failing demo must not take the others, or the page, with it. */
import { initForecastDemo } from './forecast-demo.mjs';
import { initModelChart } from './model-chart.mjs';
import { initSectionNav } from './section-nav.mjs';
import { initShiftDemo } from './shift-demo.mjs';

function boot(name, rootId, start) {
  const root = document.getElementById(rootId);
  if (!root) return;
  try {
    start(root);
  } catch (error) {
    console.error(`${name} failed`, error);
    const message = document.createElement('p');
    message.className = 'note';
    message.textContent = `The ${name} could not start in this browser.`;
    root.replaceChildren(message);
  }
}

initSectionNav(document.querySelector('.section-nav'));
boot('shift demo', 'shift-demo', initShiftDemo);
boot('forecast explorer', 'forecast-demo', initForecastDemo);
boot('error chart', 'model-chart', root => {
  initModelChart(root, document.getElementById('horizon-table'));
});
