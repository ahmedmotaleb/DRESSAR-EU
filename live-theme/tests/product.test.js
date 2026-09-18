/* Runs assets/dressar-product.js in jsdom.

   The markup mirrors sections/dressar-product.liquid and the data mirrors this
   shop: one Size option running M, L, XL, 2XL, 3XL, a single price, and the real
   money format — €{{amount_with_comma_separator}}, which puts the decimal comma
   and thousands dot the European way round. */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is not installed. Run `npm install` in live-theme/ first.');
  process.exit(1);
}

const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dressar-product.js'), 'utf8');
const MONEY = '€{{amount_with_comma_separator}}';

const SIZES = ['M', 'L', 'XL', '2XL', '3XL'];

function variants({ soldOut = [], stock = 5, compareAt = 0 } = {}) {
  return SIZES.map((size, i) => ({
    id: 1000 + i,
    options: [size],
    price: 3500,
    compare_at_price: compareAt,
    available: !soldOut.includes(size),
    sku: 'DR-' + size,
    inventory_management: 'shopify',
    inventory_quantity: soldOut.includes(size) ? 0 : stock,
    featured_media_id: 0,
  }));
}

function page(vs) {
  const radios = SIZES.map(
    (s) =>
      `<input type="radio" id="opt-${s}" name="options[Size]" value="${s}">` +
      `<label for="opt-${s}">${s}</label>`
  ).join('');

  return `
<section data-dr-product data-money-format="${MONEY}">
  <div class="dr-pdp__price" data-dr-price><span class="dr-pdp__price-now">&euro;35,00</span></div>
  <p data-dr-sku-wrap>SKU: <span data-dr-sku"></span></p>
  <p data-dr-stock data-template="Only [count] left" hidden></p>
  <product-form>
    <form id="DressarProductForm-x" action="/cart/add" method="post">
      <input type="hidden" name="id" value="1000" data-dr-variant-id>
      <fieldset data-dr-option-group data-option-name="Size">
        <span class="dr-opt__value" data-dr-option-value></span>
        ${radios}
      </fieldset>
      <p data-dr-size-error data-template="Please choose a [option]." hidden></p>
      <button type="submit" name="add" data-dr-submit
        data-text-add="Add to cart" data-text-soldout="Sold out" data-text-unavailable="Unavailable">
        <span>Add to cart</span>
      </button>
    </form>
  </product-form>
  <script type="application/json" data-dr-variants>${JSON.stringify(vs)}</script>
</section>
<div class="dr-stickybar" data-dr-sticky>
  <span class="dr-stickybar__price" data-dr-sticky-price>&euro;35,00</span>
  <button type="button" data-dr-sticky-add data-form="DressarProductForm-x"><span>Add to cart</span></button>
</div>`;
}

function load(vs) {
  const dom = new JSDOM(`<!doctype html><body>${page(vs)}</body>`, {
    url: 'https://dressar.eu/products/wool-coat',
    runScripts: 'outside-only',
  });
  const win = dom.window;
  win.eval(SCRIPT);
  return win;
}

function pick(win, size) {
  const input = win.document.getElementById('opt-' + size);
  input.checked = true;
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
}

const q = (win, sel) => win.document.querySelector(sel);

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`);
}

// 1. nothing is chosen for the shopper
{
  const win = load(variants());
  check('no size is preselected', {
    checked: [...win.document.querySelectorAll('input[type=radio]')].filter((i) => i.checked).length,
    submitDisabled: q(win, '[data-dr-submit]').disabled,
  }, { checked: 0, submitDisabled: false });
}

// 2. submitting without a size is blocked and says which option is missing
{
  const win = load(variants());
  const form = q(win, 'form');
  const ev = new win.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(ev);
  const err = q(win, '[data-dr-size-error]');
  check('submitting with no size is blocked', {
    prevented: ev.defaultPrevented,
    message: err.textContent,
    hidden: err.hidden,
    focused: win.document.activeElement.id,
  }, { prevented: true, message: 'Please choose a Size.', hidden: false, focused: 'opt-M' });
}

// 3. choosing a size wires up id, price, sku and the sticky bar
{
  const win = load(variants());
  pick(win, 'XL');
  check('choosing XL updates id, price, sku and the sticky bar price', {
    id: q(win, '[data-dr-variant-id]').value,
    price: q(win, '[data-dr-price]').textContent.trim(),
    sticky: q(win, '[data-dr-sticky-price]').textContent,
    label: q(win, '[data-dr-option-value]').textContent,
    submitDisabled: q(win, '[data-dr-submit]').disabled,
    url: win.location.search,
  }, {
    id: '1002', price: '€35,00', sticky: '€35,00', label: 'XL',
    submitDisabled: false, url: '?variant=1002',
  });
}

// 4. a sold-out size disables the button and says so
{
  const win = load(variants({ soldOut: ['2XL'] }));
  pick(win, '2XL');
  check('a sold-out size disables add to cart', {
    disabled: q(win, '[data-dr-submit]').disabled,
    text: q(win, '[data-dr-submit] span').textContent,
  }, { disabled: true, text: 'Sold out' });
}

// 5. and choosing an available one afterwards re-enables it
{
  const win = load(variants({ soldOut: ['2XL'] }));
  pick(win, '2XL');
  pick(win, 'L');
  check('choosing an available size afterwards re-enables it', {
    disabled: q(win, '[data-dr-submit]').disabled,
    text: q(win, '[data-dr-submit] span').textContent,
  }, { disabled: false, text: 'Add to cart' });
}

// 6. stock message only on real low stock
{
  const plenty = load(variants({ stock: 25 }));
  pick(plenty, 'M');
  const low = load(variants({ stock: 2 }));
  pick(low, 'M');
  check('stock message follows real inventory', {
    at25: q(plenty, '[data-dr-stock]').hidden,
    at2hidden: q(low, '[data-dr-stock]').hidden,
    at2text: q(low, '[data-dr-stock]').textContent,
  }, { at25: true, at2hidden: false, at2text: 'Only 2 left' });
}

// 7. European money formatting, including thousands
{
  const win = load(variants());
  const vs = variants();
  vs[0].price = 123456;
  vs[0].compare_at_price = 200000;
  const win2 = load(vs);
  pick(win2, 'M');
  check('formats €1.234,56 and the was-price the European way',
    q(win2, '[data-dr-price]').textContent.replace(/\s+/g, ' ').trim(),
    '€1.234,56 €2.000,00');
}

// 8. the sticky bar submits the real form rather than adding by itself
{
  const win = load(variants());
  pick(win, 'L');
  let submitted = 0;
  q(win, 'form').addEventListener('submit', (e) => { e.preventDefault(); submitted += 1; });
  q(win, 'form').requestSubmit = function () {
    this.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  };
  q(win, '[data-dr-sticky-add]').dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  check('the sticky bar submits the real form', submitted, 1);
}

console.log(failed ? `\n${failed} FAILING` : '\nall passing');
process.exit(failed ? 1 : 0);
