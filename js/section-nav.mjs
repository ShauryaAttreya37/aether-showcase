/* Marks the section being read in the sticky navigation. */
const READING_LINE = 0.3;
const NAV_PADDING = 16;

export function initSectionNav(nav) {
  if (!nav) return;
  const links = [...nav.querySelectorAll('a')];
  const headings = links.map(link => document.getElementById(link.hash.slice(1)));
  let current = null;
  let queued = false;

  function mark(index) {
    if (index === current) return;
    current = index;
    links.forEach((link, position) => {
      if (position === index) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    // Only the nav scrolls here: moving the page would fight an anchor jump.
    if (index !== null && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = links[index].offsetLeft - NAV_PADDING;
    }
  }

  function update() {
    queued = false;
    const line = window.innerHeight * READING_LINE;
    const passed = headings.filter(heading => heading.getBoundingClientRect().top <= line);
    mark(passed.length ? passed.length - 1 : null);
  }

  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
}
