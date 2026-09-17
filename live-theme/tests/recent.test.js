/* Runs assets/dressar-recently-viewed.js in jsdom.

   The markup mirrors the wrapper sections/dressar-recently-viewed.liquid emits.
   The fetch is stubbed: the point is what gets stored and what gets requested,
   not what Shopify sends back. */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is not installed. Run `npm install` in live-theme/ first.');
  process.exit(1);
}

const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dressar-recently-viewed.js'), 'utf8');

function markup(current, limit) {
  return `<section data-dr-recent data-section-id="recent-1" data-limit="${limit}"${
    current ? ` data-current="${current}"` : ''
  } hidden><div data-dr-recent-body></div></section>`;
}

/* A product card carrying the same attribute the old code used to read. Its
   presence is the regression this file guards: it must never be what gets
   recorded. */
const DECOY = '<button data-dr-wishlist data-product-id="999999">save</button>';

/* jsdom reports readyState 'loading' straight after construction, so the script's
   DOMContentLoaded branch is the one that runs. Waiting for that event before
   evaluating it means start() is called exactly once, synchronously — dispatching
   the event by hand instead would let jsdom fire its own later and double the
   fetch. */
async function ready(dom) {
  if (dom.window.document.readyState !== 'loading') return;
  await new Promise((resolve) => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

async function run({ current = '111', limit = 6, stored = null, body = markup, decoyFirst = false, storageThrows = false } = {}) {
  const html = decoyFirst ? DECOY + body(current, limit) : body(current, limit) + DECOY;
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: 'https://example.com/products/thing',
    runScripts: 'outside-only',
  });
  const win = dom.window;

  const store = {};
  if (stored !== null) store['dressar:recent'] = stored;
  Object.defineProperty(win, 'localStorage', {
    configurable: true,
    value: {
      getItem(k) { if (storageThrows) throw new Error('blocked'); return k in store ? store[k] : null; },
      setItem(k, v) { if (storageThrows) throw new Error('blocked'); store[k] = v; },
    },
  });

  const requests = [];
  win.fetch = (url) => { requests.push(url); return Promise.resolve({ ok: true, text: () => Promise.resolve('') }); };

  await ready(dom);
  win.eval(SCRIPT);
  return { store, requests, win };
}

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`);
}
const saved = (r) => JSON.parse(r.store['dressar:recent'] || '[]');

async function main() {
  // 1. records the page's own product
  check('records the current product at the front',
    saved(await run({ current: '111', stored: '["222","333"]' })), ['111', '222', '333']);

  // 2. the decoy must never win, whatever the document order
  check('a card wishlist button is never mistaken for the page product',
    saved(await run({ current: '111', stored: '[]', decoyFirst: true })), ['111']);

  // 3. re-viewing moves to front, does not duplicate
  check('re-viewing moves the product to the front',
    saved(await run({ current: '333', stored: '["111","222","333"]' })), ['333', '111', '222']);

  // 4. capped at 12
  const many = JSON.stringify(Array.from({ length: 15 }, (_, i) => String(900 + i)));
  const capped = saved(await run({ current: '111', stored: many }));
  check('keeps at most 12', { length: capped.length, first: capped[0] }, { length: 12, first: '111' });

  // 5. the request excludes the current product and pins the search options
  const r = await run({ current: '111', limit: 3, stored: '["222","333","444","555"]' });
  check('requests the right ids, current one excluded, limit respected', r.requests, [
    '/search?section_id=recent-1&type=product&options%5Bprefix%5D=none' +
    '&options%5Bunavailable_products%5D=last&q=id:222+OR+id:333+OR+id:444',
  ]);

  // 6. nothing stored yet -> no request at all
  check('no request when there is nothing to show', (await run({ current: '111', stored: '[]' })).requests, []);

  // 7. storage blocked (private mode throws) -> no crash, no request
  check('blocked storage degrades quietly', (await run({ current: '111', storageThrows: true })).requests, []);

  // 8. unparseable storage -> treated as empty
  check('unparseable storage is treated as empty', (await run({ current: '111', stored: 'not json' })).requests, []);

  // 9. no section on the page -> no crash
  const bare = new JSDOM(`<!doctype html><body>${DECOY}</body>`, { runScripts: 'outside-only' });
  bare.window.fetch = () => Promise.reject(new Error('should not be called'));
  await ready(bare);
  let threw = null;
  try { bare.window.eval(SCRIPT); } catch (e) { threw = e.message; }
  check('no section on the page is a no-op', threw, null);

  console.log(failed ? `\n${failed} FAILING` : '\nall passing');
  process.exit(failed ? 1 : 0);
}

main();
