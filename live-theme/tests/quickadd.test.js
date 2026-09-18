/* Runs assets/dressar-quick-add.js in jsdom with a stubbed fetch.

   The sheet markup mirrors snippets/dressar-quick-add-sheet.liquid and the fetched
   payload mirrors sections/dressar-quick-add.liquid. The add itself is Dawn's and
   is not exercised here — what matters is which URL is requested, whether the sheet
   opens, and that no size is ever chosen on the shopper's behalf. */
const fs = require('fs');
const path = require('path');

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = require('jsdom'));
} catch (e) {
  console.error('jsdom is not installed. Run `npm install` in live-theme/ first.');
  process.exit(1);
}

const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dressar-quick-add.js'), 'utf8');

const SHEET = `
<div class="dr-sheet" data-dr-sheet hidden
     data-label-add="Add to bag" data-label-size="Select a size" data-label-error="Please choose a size.">
  <div class="dr-sheet__scrim" data-dr-sheet-close></div>
  <div class="dr-sheet__panel" data-dr-sheet-panel tabindex="-1">
    <button type="button" data-dr-sheet-close>Close</button>
    <div class="dr-sheet__body" data-dr-sheet-body></div>
    <p class="dr-sheet__error" data-dr-sheet-error role="alert" hidden></p>
  </div>
</div>`;

const CARD = (handle) => `
<div class="dr-card" data-dr-card data-product-url="/products/${handle}">
  <a class="dr-card__quick" href="/products/${handle}" data-dr-quick data-product-url="/products/${handle}?variant=99">
    <span class="dr-card__quick-plus"></span><span class="dr-card__quick-spinner" hidden></span>
  </a>
</div>`;

function payload({ single = false, sizes = ['M', 'L', 'XL'], soldOut = [] } = {}) {
  const radios = sizes
    .map((s, i) =>
      `<input type="radio" id="qa-${s}" name="options[Size]" value="${s}"${soldOut.includes(s) ? ' disabled' : ''}>` +
      `<label for="qa-${s}">${s}</label>`
    )
    .join('');
  return `<html><body>
    <div data-dr-qa-payload data-single="${single}">
      <product-form>
        <form action="/cart/add" method="post">
          <div class="product-form__error-message-wrapper" role="alert" hidden>
            <span class="product-form__error-message"></span>
          </div>
          <input type="hidden" name="id" value="1001">
          ${single ? '' : `<fieldset class="dr-qa__sizes" data-dr-qa-sizes>${radios}</fieldset>`}
          <button type="submit" name="add" data-dr-qa-add>
            <span data-dr-qa-add-label>Add to cart</span>
            <div class="loading__spinner hidden"></div>
          </button>
        </form>
      </product-form>
    </div>
  </body></html>`;
}

function load({ response = payload(), fail = false } = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  vc.on('error', (m) => errors.push(String(m)));

  const dom = new JSDOM(`<!doctype html><body>${CARD('wool-coat')}${SHEET}</body>`, {
    url: 'https://dressar.eu/collections/outerwear',
    runScripts: 'outside-only',
    virtualConsole: vc,
  });
  const win = dom.window;
  const requests = [];
  win.fetch = (url) => {
    requests.push(url);
    return fail
      ? Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('') })
      : Promise.resolve({ ok: true, text: () => Promise.resolve(response) });
  };
  win.eval(SCRIPT);
  return { win, requests, errors };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const q = (win, s) => win.document.querySelector(s);

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`);
}
function click(win, el, opts = {}) {
  const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...opts });
  el.dispatchEvent(ev);
  return ev;
}

async function main() {
  // 1. the request drops any variant query and asks for the section
  {
    const { win, requests } = load();
    click(win, q(win, '[data-dr-quick] .dr-card__quick-plus'));
    await tick();
    check('requests the product as a section, without the variant query',
      requests, ['/products/wool-coat?section_id=dressar-quick-add']);
  }

  // 2. a multi-size product opens the sheet and gets the merchant's wording
  {
    const { win } = load();
    click(win, q(win, '[data-dr-quick]'));
    await tick();
    check('a multi-size product opens the sheet', {
      open: !q(win, '[data-dr-sheet]').hidden,
      addLabel: q(win, '[data-dr-qa-add-label]').textContent,
      sizeHeading: q(win, '.dr-qa__label') ? q(win, '.dr-qa__label').textContent : null,
      checked: [...win.document.querySelectorAll('[data-dr-qa-sizes] input')].filter((i) => i.checked).length,
    }, { open: true, addLabel: 'Add to bag', sizeHeading: 'Select a size', checked: 0 });
  }

  // 3. a single-variant product never opens the sheet
  {
    const { win } = load({ response: payload({ single: true }) });
    /* jsdom has no requestSubmit, so stand in for it on the prototype before the
       script reaches for it. */
    win.HTMLFormElement.prototype.requestSubmit = function () {
      this.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    };
    let submitted = 0;
    win.document.addEventListener('submit', (e) => { e.preventDefault(); submitted += 1; });
    click(win, q(win, '[data-dr-quick]'));
    await tick();
    check('a single-variant product adds without opening the sheet',
      { sheetOpen: !q(win, '[data-dr-sheet]').hidden, submitted },
      { sheetOpen: false, submitted: 1 });
  }

  // 4. no size chosen -> blocked, told, focused
  {
    const { win } = load();
    click(win, q(win, '[data-dr-quick]'));
    await tick();
    const form = q(win, '[data-dr-sheet-body] form');
    const ev = new win.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
    check('adding without a size is blocked and says so', {
      prevented: ev.defaultPrevented,
      message: q(win, '[data-dr-sheet-error]').textContent,
      hidden: q(win, '[data-dr-sheet-error]').hidden,
      invalid: q(win, '[data-dr-qa-sizes]').classList.contains('is-invalid'),
      focused: win.document.activeElement.id,
    }, {
      prevented: true, message: 'Please choose a size.', hidden: false,
      invalid: true, focused: 'qa-M',
    });
  }

  // 5. focus skips a sold-out size rather than landing on it
  {
    const { win } = load({ response: payload({ soldOut: ['M'] }) });
    click(win, q(win, '[data-dr-quick]'));
    await tick();
    q(win, '[data-dr-sheet-body] form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    check('focus goes to the first size that can be bought', win.document.activeElement.id, 'qa-L');
  }

  // 6. choosing a size clears the complaint
  {
    const { win } = load();
    click(win, q(win, '[data-dr-quick]'));
    await tick();
    q(win, '[data-dr-sheet-body] form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    const input = win.document.getElementById('qa-L');
    input.checked = true;
    input.dispatchEvent(new win.Event('change', { bubbles: true }));
    check('choosing a size clears the message', {
      hidden: q(win, '[data-dr-sheet-error]').hidden,
      invalid: q(win, '[data-dr-qa-sizes]').classList.contains('is-invalid'),
    }, { hidden: true, invalid: false });
  }

  // 7. Escape closes and hands focus back to the +
  {
    const { win } = load();
    const plus = q(win, '[data-dr-quick]');
    click(win, plus);
    await tick();
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    check('Escape closes and returns focus to the +', {
      hidden: q(win, '[data-dr-sheet]').hidden,
      body: q(win, '[data-dr-sheet-body]').innerHTML,
      focusedIsPlus: win.document.activeElement === plus,
    }, { hidden: true, body: '', focusedIsPlus: true });
  }

  // 8. a failed request never strands the shopper on a dead +
  {
    const { win, errors } = load({ fail: true });
    click(win, q(win, '[data-dr-quick]'));
    await tick();
    await tick();
    check('a failed request leaves the sheet shut and falls through to the product', {
      sheetOpen: !q(win, '[data-dr-sheet]').hidden,
      spinnerHidden: q(win, '.dr-card__quick-spinner').hidden,
      loggedFailure: errors.some((e) => /Quick add request failed|Not implemented: navigation/.test(e)),
    }, { sheetOpen: false, spinnerHidden: true, loggedFailure: true });
  }

  // 9. modified clicks belong to the browser
  {
    const { win, requests } = load();
    const ev = click(win, q(win, '[data-dr-quick]'), { metaKey: true });
    await tick();
    check('cmd-click is not hijacked', { prevented: ev.defaultPrevented, requests }, { prevented: false, requests: [] });
  }

  console.log(failed ? `\n${failed} FAILING` : '\nall passing');
  process.exit(failed ? 1 : 0);
}

main();
