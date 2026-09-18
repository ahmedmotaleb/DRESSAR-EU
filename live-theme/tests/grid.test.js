/* Runs assets/dressar-grid.js in jsdom.

   The column count is written to the section wrapper, not to the <ul>. That is the
   whole point of the file: Dawn's facets.js replaces #ProductGridContainer wholesale
   on every filter change, so a custom property set on the grid itself is thrown away
   the first time anyone touches a filter. The wrapper survives and the property
   inherits down. The test below simulates that replacement. */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is not installed. Run `npm install` in live-theme/ first.');
  process.exit(1);
}

const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dressar-grid.js'), 'utf8');

/* Mirrors the toolbar from snippets/dressar-grid-density.liquid inside the section
   wrapper from sections/dressar-collection.liquid. */
const MARKUP = `
<section class="dr-section" data-dr-grid-scope>
  <div class="dr-density" data-dr-density role="group" aria-label="Grid view">
    <button type="button" data-dr-density-set="3" data-scope="desktop" aria-pressed="false"><span class="dr-density__bar"></span></button>
    <button type="button" data-dr-density-set="4" data-scope="desktop" aria-pressed="true"><span class="dr-density__bar"></span></button>
    <button type="button" data-dr-density-set="5" data-scope="desktop" aria-pressed="false"><span class="dr-density__bar"></span></button>
    <button type="button" data-dr-density-set="1" data-scope="mobile" aria-pressed="false"><span class="dr-density__bar"></span></button>
    <button type="button" data-dr-density-set="2" data-scope="mobile" aria-pressed="true"><span class="dr-density__bar"></span></button>
  </div>
  <div id="ProductGridContainer"><ul class="dr-grid"><li>a</li></ul></div>
</section>`;

function load({ stored = {}, storageThrows = false } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${MARKUP}</body>`, { runScripts: 'outside-only' });
  const win = dom.window;
  const store = { ...stored };
  Object.defineProperty(win, 'localStorage', {
    configurable: true,
    value: {
      getItem(k) { if (storageThrows) throw new Error('blocked'); return k in store ? store[k] : null; },
      setItem(k, v) { if (storageThrows) throw new Error('blocked'); store[k] = v; },
    },
  });
  win.eval(SCRIPT);
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  return { win, store };
}

const q = (win, s) => win.document.querySelector(s);
const cols = (win) => ({
  desktop: q(win, '[data-dr-grid-scope]').style.getPropertyValue('--dr-cols'),
  mobile: q(win, '[data-dr-grid-scope]').style.getPropertyValue('--dr-cols-mobile'),
});
const pressed = (win, scope) =>
  [...win.document.querySelectorAll(`[data-dr-density-set][data-scope="${scope}"]`)]
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.getAttribute('data-dr-density-set'));

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`);
}
function click(win, el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

// 1. clicking a density writes the property, stores it and moves the pressed state
{
  const { win, store } = load();
  click(win, q(win, '[data-dr-density-set="5"][data-scope="desktop"] .dr-density__bar'));
  check('choosing 5 across applies, persists and marks itself pressed', {
    cols: cols(win).desktop, stored: store['dressar:cols'], pressed: pressed(win, 'desktop'),
  }, { cols: '5', stored: '5', pressed: ['5'] });
}

// 2. desktop and mobile are independent
{
  const { win, store } = load();
  click(win, q(win, '[data-dr-density-set="5"][data-scope="desktop"]'));
  click(win, q(win, '[data-dr-density-set="1"][data-scope="mobile"]'));
  check('the two breakpoints keep separate preferences', {
    cols: cols(win), stored: [store['dressar:cols'], store['dressar:cols-mobile']],
    desktopPressed: pressed(win, 'desktop'), mobilePressed: pressed(win, 'mobile'),
  }, {
    cols: { desktop: '5', mobile: '1' }, stored: ['5', '1'],
    desktopPressed: ['5'], mobilePressed: ['1'],
  });
}

// 3. a stored preference is restored on the next page
{
  const { win } = load({ stored: { 'dressar:cols': '3', 'dressar:cols-mobile': '1' } });
  check('a stored choice comes back', { cols: cols(win), pressed: pressed(win, 'desktop') },
    { cols: { desktop: '3', mobile: '1' }, pressed: ['3'] });
}

// 4. the choice survives Dawn replacing the grid on a filter change
{
  const { win } = load();
  click(win, q(win, '[data-dr-density-set="5"][data-scope="desktop"]'));
  // what facets.js does: swap #ProductGridContainer for freshly rendered HTML
  q(win, '#ProductGridContainer').innerHTML = '<ul class="dr-grid"><li>b</li></ul>';
  check('filtering does not reset the column count', cols(win).desktop, '5');
}

// 5. storage blocked -> the layout still changes for this visit
{
  const { win } = load({ storageThrows: true });
  click(win, q(win, '[data-dr-density-set="3"][data-scope="desktop"]'));
  check('blocked storage still changes the layout, just does not remember it',
    { cols: cols(win).desktop, pressed: pressed(win, 'desktop') }, { cols: '3', pressed: ['3'] });
}

console.log(failed ? `\n${failed} FAILING` : '\nall passing');
process.exit(failed ? 1 : 0);
