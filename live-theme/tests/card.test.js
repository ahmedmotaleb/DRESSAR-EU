/* Runs assets/dressar-card.js against a real DOM.

   The markup below mirrors what snippets/dressar-card.liquid emits for a card with
   two colours, the first of them reduced. Keep the two in step: the attributes the
   script reads are the contract between them. */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is not installed. Run `npm install` in live-theme/ first.');
  process.exit(1);
}

const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dressar-card.js'), 'utf8');

const MARKUP = `
<div class="dr-card" data-dr-card data-product-url="/products/coat-olive" data-product-handle="coat-olive">
  <div class="dr-card__media">
    <img class="dr-card__img dr-card__img--main" data-dr-card-img
         src="olive-800.jpg" srcset="olive-400.jpg 400w" alt="Wool coat, Olive">
  </div>
  <div class="dr-card__body">
    <h3><a href="/products/coat-olive" data-dr-card-link><span data-dr-card-title>Wool coat, Olive</span></a></h3>
    <p class="dr-card__colour" data-dr-colour-label><span data-dr-colour-name>Olive</span></p>
    <p class="dr-card__price" data-dr-card-price data-dr-show-discount>
      <span class="dr-card__price-now" data-dr-price-now>&euro;35.00</span>
      <s class="dr-card__price-was" data-dr-price-was>&euro;50.00</s>
      <span class="dr-card__price-off" data-dr-price-off>&minus;30%</span>
    </p>
    <a class="dr-card__quick" href="/products/coat-olive" data-dr-quick data-product-url="/products/coat-olive">+</a>
    <div class="dr-swatches" data-dr-swatches role="group" aria-label="Colour">
      <a class="dr-swatch is-current" href="/products/coat-olive" data-dr-swatch aria-current="true"
         data-colour="Olive" data-title="Wool coat, Olive" data-url="/products/coat-olive"
         data-img="olive-800.jpg" data-srcset="olive-400.jpg 400w" data-alt="Wool coat, Olive"
         data-price="&euro;35.00" data-compare="&euro;50.00" data-off="30"><span class="dr-swatch__chip"></span></a>
      <a class="dr-swatch" href="/products/coat-black" data-dr-swatch
         data-colour="Black" data-title="Wool coat, Black" data-url="/products/coat-black"
         data-img="black-800.jpg" data-srcset="black-400.jpg 400w" data-alt="Wool coat, Black"
         data-price="&euro;50.00"><span class="dr-swatch__chip"></span></a>
    </div>
  </div>
</div>`;

function load() {
  const dom = new JSDOM(`<!doctype html><body>${MARKUP}</body>`, { runScripts: 'outside-only' });
  dom.window.eval(SCRIPT);
  return dom.window;
}

function click(win, el, opts = {}) {
  const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...opts });
  el.dispatchEvent(ev);
  return ev;
}

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`);
}

function state(win) {
  const d = win.document;
  const q = (s) => d.querySelector(s);
  return {
    title: q('[data-dr-card-title]').textContent,
    img: q('[data-dr-card-img]').getAttribute('src'),
    alt: q('[data-dr-card-img]').getAttribute('alt'),
    href: q('[data-dr-card-link]').getAttribute('href'),
    cardUrl: q('[data-dr-card]').getAttribute('data-product-url'),
    quickUrl: q('[data-dr-quick]').getAttribute('data-product-url'),
    colour: q('[data-dr-colour-name]').textContent,
    now: q('[data-dr-price-now]').textContent,
    was: q('[data-dr-price-was]') ? q('[data-dr-price-was]').textContent : null,
    off: q('[data-dr-price-off]') ? q('[data-dr-price-off]').textContent : null,
    current: [...d.querySelectorAll('[data-dr-swatch]')].map((s) => s.getAttribute('aria-current') === 'true'),
  };
}

// ---- 1. reduced colour -> full-price colour
{
  const win = load();
  const swatches = win.document.querySelectorAll('[data-dr-swatch]');
  click(win, swatches[1].querySelector('.dr-swatch__chip'));
  const s = state(win);
  check('switching to a full-price colour swaps image, title, link and price', {
    title: s.title, img: s.img, href: s.href, cardUrl: s.cardUrl, quickUrl: s.quickUrl,
    colour: s.colour, now: s.now, current: s.current,
  }, {
    title: 'Wool coat, Black', img: 'black-800.jpg', href: '/products/coat-black',
    cardUrl: '/products/coat-black', quickUrl: '/products/coat-black',
    colour: 'Black', now: '€50.00', current: [false, true],
  });
  check('  ...and drops the strike-through price', s.was, null);
  check('  ...and drops the discount badge with it', s.off, null);
}

// ---- 2. back to the reduced colour
{
  const win = load();
  const swatches = win.document.querySelectorAll('[data-dr-swatch]');
  click(win, swatches[1]);
  click(win, swatches[0]);
  const s = state(win);
  check('switching back restores was-price and badge', { was: s.was, off: s.off, now: s.now },
    { was: '€50.00', off: '−30%', now: '€35.00' });
  check('  ...and the price parts stay in order now / was / off',
    [...win.document.querySelector('[data-dr-card-price]').children].map((e) => e.tagName + ':' + (e.dataset.drPriceNow !== undefined ? 'now' : e.dataset.drPriceWas !== undefined ? 'was' : 'off')),
    ['SPAN:now', 'S:was', 'SPAN:off']);
}

// ---- 3. modified clicks belong to the browser
{
  const win = load();
  const swatches = win.document.querySelectorAll('[data-dr-swatch]');
  const ev = click(win, swatches[1], { metaKey: true });
  check('cmd-click is not hijacked', { prevented: ev.defaultPrevented, title: state(win).title },
    { prevented: false, title: 'Wool coat, Olive' });
}

// ---- 4. a plain click is hijacked
{
  const win = load();
  const ev = click(win, win.document.querySelectorAll('[data-dr-swatch]')[1]);
  check('a plain click is handled in place', ev.defaultPrevented, true);
}

// ---- 5. merchant has the discount badge switched off
{
  const win = load();
  const wrap = win.document.querySelector('[data-dr-card-price]');
  wrap.removeAttribute('data-dr-show-discount');
  wrap.querySelector('[data-dr-price-off]').remove();
  const swatches = win.document.querySelectorAll('[data-dr-swatch]');
  click(win, swatches[1]);
  click(win, swatches[0]);
  const s = state(win);
  check('no badge is invented when the merchant turned it off', { was: s.was, off: s.off },
    { was: '€50.00', off: null });
}

console.log(failed ? `\n${failed} FAILING` : '\nall passing');
process.exit(failed ? 1 : 0);
