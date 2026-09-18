/* Runs assets/dressar-header.js in jsdom.

   jsdom has no layout: every box measures 0 and offsetParent is always null, which
   would quietly defeat both the height publishing and the drawer's focus trap. Both
   are stubbed below so the logic is actually exercised rather than skipped. */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is not installed. Run `npm install` in live-theme/ first.');
  process.exit(1);
}

const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dressar-header.js'), 'utf8');

const markup = ({ sticky = true, overlayHeader = false } = {}) => `
<div id="shopify-section-header" class="shopify-section" style="position: ${sticky ? 'sticky' : 'static'}; top: 0;">
  <header class="dressar-header${overlayHeader ? ' dressar-header--overlay' : ''}" data-dressar-header data-solid-after="40">
    <button type="button" data-dressar-drawer-open aria-label="Menu">Menu</button>
    <a href="/">Dressar</a>
  </header>
</div>
<div class="dressar-overlay" data-dressar-overlay hidden></div>
<nav class="dressar-drawer" data-dressar-drawer data-open="false" aria-hidden="true">
  <button type="button" data-dressar-drawer-close>Close</button>
  <button type="button" data-dressar-expand aria-expanded="false" aria-controls="sub-shop">Shop</button>
  <ul id="sub-shop" hidden><li><a href="/collections/dresses">Dresses</a></li></ul>
  <a href="/pages/contact">Contact</a>
</nav>`;

function load(opts = {}) {
  const dom = new JSDOM(`<!doctype html><body>${markup(opts)}</body>`, {
    url: 'https://dressar.eu/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const win = dom.window;

  // Give the header a real height; jsdom measures everything as zero.
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    return this.hasAttribute('data-dressar-header')
      ? { height: 64, width: 1280, top: 0, left: 0, right: 1280, bottom: 64 }
      : { height: 0, width: 0, top: 0, left: 0, right: 0, bottom: 0 };
  };
  // offsetParent is always null in jsdom, which would empty the focus trap.
  Object.defineProperty(win.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() { return this.ownerDocument.body; },
  });

  win.eval(SCRIPT);
  return win;
}

const q = (win, s) => win.document.querySelector(s);
const click = (win, sel) =>
  q(win, sel).dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const key = (win, k) =>
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const headerVar = (win) => win.document.documentElement.style.getPropertyValue('--dr-header-height');

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`);
}

// 1. a sticky header publishes its height, so the toolbar can sit under it
check('a sticky header publishes its height', headerVar(load({ sticky: true })), '64px');

// 2. a header the merchant unstuck publishes zero, so the toolbar goes to the top
check('a non-sticky header publishes 0, not a phantom gap', headerVar(load({ sticky: false })), '0px');

// 3. opening the drawer
{
  const win = load();
  click(win, '[data-dressar-drawer-open]');
  check('opening the drawer sets its state, shows the overlay and locks scroll', {
    open: q(win, '[data-dressar-drawer]').getAttribute('data-open'),
    ariaHidden: q(win, '[data-dressar-drawer]').getAttribute('aria-hidden'),
    overlayHidden: q(win, '[data-dressar-overlay]').hidden,
    bodyOverflow: win.document.body.style.overflow,
    focusInDrawer: q(win, '[data-dressar-drawer]').contains(win.document.activeElement),
  }, {
    open: 'true', ariaHidden: null, overlayHidden: false,
    bodyOverflow: 'hidden', focusInDrawer: true,
  });
}

// 4. Escape closes it and hands focus back to the control that opened it
{
  const win = load();
  const opener = q(win, '[data-dressar-drawer-open]');
  opener.focus();
  click(win, '[data-dressar-drawer-open]');
  key(win, 'Escape');
  check('Escape closes it and returns focus to the menu button', {
    open: q(win, '[data-dressar-drawer]').getAttribute('data-open'),
    ariaHidden: q(win, '[data-dressar-drawer]').getAttribute('aria-hidden'),
    bodyOverflow: win.document.body.style.overflow,
    focusBack: win.document.activeElement === opener,
  }, { open: 'false', ariaHidden: 'true', bodyOverflow: '', focusBack: true });
}

// 5. clicking the overlay closes it too
{
  const win = load();
  click(win, '[data-dressar-drawer-open]');
  click(win, '[data-dressar-overlay]');
  check('clicking the scrim closes the drawer',
    q(win, '[data-dressar-drawer]').getAttribute('data-open'), 'false');
}

// 6. the submenu toggle keeps aria-expanded and hidden in step
{
  const win = load();
  click(win, '[data-dressar-drawer-open]');
  click(win, '[data-dressar-expand]');
  const opened = {
    expanded: q(win, '[data-dressar-expand]').getAttribute('aria-expanded'),
    subHidden: q(win, '#sub-shop').hidden,
  };
  click(win, '[data-dressar-expand]');
  check('the submenu toggle keeps aria-expanded and hidden in step', {
    opened,
    closed: {
      expanded: q(win, '[data-dressar-expand]').getAttribute('aria-expanded'),
      subHidden: q(win, '#sub-shop').hidden,
    },
  }, {
    opened: { expanded: 'true', subHidden: false },
    closed: { expanded: 'false', subHidden: true },
  });
}

// 8. a page without the header is left alone
{
  const dom = new JSDOM('<!doctype html><body><p>no header here</p></body>', { runScripts: 'outside-only' });
  let threw = null;
  try { dom.window.eval(SCRIPT); } catch (e) { threw = e.message; }
  check('a page with no header is a no-op', threw, null);
}

// 7. the overlay header only goes solid past the threshold.
//    The scroll handler defers to requestAnimationFrame, which jsdom runs on a real
//    frame, so this one has to wait rather than assert straight after dispatching.
async function scrollCase() {
  const win = load({ overlayHeader: true });
  const frame = () => new Promise((r) => win.requestAnimationFrame(() => setTimeout(r, 0)));

  const before = {
    bodyClass: win.document.body.classList.contains('dr-overlay-header'),
    solid: q(win, '[data-dressar-header]').classList.contains('is-solid'),
  };

  win.scrollY = 20;
  win.dispatchEvent(new win.Event('scroll'));
  await frame();
  const shortScroll = q(win, '[data-dressar-header]').classList.contains('is-solid');

  win.scrollY = 120;
  win.dispatchEvent(new win.Event('scroll'));
  await frame();
  const pastThreshold = q(win, '[data-dressar-header]').classList.contains('is-solid');

  win.scrollY = 0;
  win.dispatchEvent(new win.Event('scroll'));
  await frame();
  const backToTop = q(win, '[data-dressar-header]').classList.contains('is-solid');

  check('an overlay header goes solid only once past its threshold',
    { before, at20: shortScroll, at120: pastThreshold, backToTop },
    { before: { bodyClass: true, solid: false }, at20: false, at120: true, backToTop: false });

  console.log(failed ? `\n${failed} FAILING` : '\nall passing');
  process.exit(failed ? 1 : 0);
}

scrollCase();
