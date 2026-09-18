/* assets/product-form.js carries two things: Dawn's ProductForm element, and an
   older Dressar sticky add-to-cart bar appended after it.

   That bar predates the current product page. It finds a button by [name="add"]
   inside <product-form> — which the current page has — and its only guard against
   running twice is a check for its own class. So on a page that already has its
   own sticky bar it adds a second one, and shows an empty price, because it reads
   Dawn's price classes and the current page does not use them.

   This runs the real file and asserts one bar. */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is not installed. Run `npm install` in live-theme/ first.');
  process.exit(1);
}

const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'assets', 'product-form.js'), 'utf8');

/* Mirrors sections/dressar-product.liquid: <product-form> wrapping the form, an
   h1 title, the price in [data-dr-price], and the section's own sticky bar. */
const DRESSAR_PDP = `
<section data-dr-product>
  <h1 class="dr-pdp__title">Wool coat</h1>
  <div data-dr-price><span class="dr-pdp__price-now">&euro;32.00</span></div>
  <product-form class="product-form" data-hide-errors="false">
    <form action="/cart/add" method="post">
      <input name="id" value="111">
      <button type="submit" name="add" data-dr-submit><span>Add to cart</span></button>
    </form>
  </product-form>
</section>
<div class="dr-stickybar" data-dr-sticky>
  <span class="dr-stickybar__title">Wool coat</span>
  <span class="dr-stickybar__price" data-dr-sticky-price>&euro;32.00</span>
  <button type="button" data-dr-sticky-add><span>Add to cart</span></button>
</div>`;

/* A Dawn surface that is NOT the Dressar product page — a featured-product
   section, say. Nothing here should change. */
const DAWN_ONLY = `
<section class="featured-product">
  <h1 class="product__title">Wool coat</h1>
  <div class="price"><span class="price-item">&euro;32.00</span></div>
  <product-form class="product-form" data-hide-errors="false">
    <form action="/cart/add" method="post">
      <input name="id" value="111">
      <button type="submit" name="add"><span>Add to cart</span></button>
    </form>
  </product-form>
</section>`;

function load(markup) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, { runScripts: 'outside-only' });
  const win = dom.window;
  win.requestAnimationFrame = (fn) => { fn(); return 1; };
  win.eval(SCRIPT);
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  return win;
}

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`);
}

// 1. the Dressar product page must end up with exactly one sticky bar
{
  const win = load(DRESSAR_PDP);
  const own = win.document.querySelectorAll('[data-dr-sticky]').length;
  const legacy = win.document.querySelectorAll('.dressar-sticky-atc').length;
  check('the product page gets one sticky bar, not two', { own, legacy }, { own: 1, legacy: 0 });
}

// 2. ...and the legacy stylesheet is not injected there either
{
  const win = load(DRESSAR_PDP);
  check('no legacy sticky styles on the product page',
    !!win.document.getElementById('dressar-sticky-atc-styles'), false);
}

// 3. other Dawn surfaces keep the bar they had
{
  const win = load(DAWN_ONLY);
  const legacy = win.document.querySelector('.dressar-sticky-atc');
  check('a plain Dawn product form still gets the legacy bar', !!legacy, true);
  check('  ...and it still finds the Dawn price',
    legacy ? legacy.querySelector('.dressar-sticky-atc__price').textContent : null, '€32.00');
}

// 4. Dawn's own element still works — this file owns add to cart
{
  const win = load(DRESSAR_PDP);
  check('Dawn ProductForm is still defined', !!win.customElements.get('product-form'), true);
}

console.log(failed ? `\n${failed} FAILING` : '\nall passing');
process.exit(failed ? 1 : 0);
