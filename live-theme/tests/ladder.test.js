/* Runs the real dressar-facets.js in a minimal DOM stub and asserts the resulting
   visual order for the actual filter values this catalogue produces. */
const fs = require('fs');
const src = fs.readFileSync('/home/user/DRESSAR-EU/live-theme/assets/dressar-facets.js', 'utf8');

function makeItem(label) {
  const item = {
    style: {},
    _label: label,
    querySelector(sel) {
      if (sel === '.facet-checkbox__text-label') return { textContent: label };
      return null;
    },
  };
  return item;
}

function run(labels) {
  const items = labels.map(makeItem);
  const list = { children: items };
  const details = {
    _classes: new Set(),
    classList: { add(c) { details._classes.add(c); }, remove(c) { details._classes.delete(c); } },
    querySelector(sel) { return sel.includes('facets__list') ? list : null; },
  };

  const filters = [details];
  const root = {
    querySelectorAll(sel) { return sel === '.js-filter' ? filters : []; },
    querySelector() { return null; },
  };

  global.document = {
    readyState: 'complete',
    getElementById(id) { return id === 'FacetFiltersFormMobile' ? root : null; },
    querySelector() { return null; },
    addEventListener() {},
  };
  global.window = { requestAnimationFrame(fn) { fn(); } };
  global.MutationObserver = class { observe() {} };

  eval(src);

  const ordered = items
    .map((it, i) => ({ label: it._label, order: it.style.order === '' || it.style.order === undefined ? null : Number(it.style.order), i }))
    .sort((a, b) => (a.order === null || b.order === null) ? a.i - b.i : (a.order - b.order) || (a.i - b.i));

  return {
    applied: details._classes.has('dr-facet--sizes'),
    order: ordered.map((o) => o.label),
  };
}

const cases = [
  ['REAL catalogue Size facet', ['2XL', '3XL', 'L', 'M', 'One size', 'XL'], ['M','L','XL','2XL','3XL','One size']],
  ['Size facet without One size', ['2XL', '3XL', 'L', 'M', 'XL'],           ['M','L','XL','2XL','3XL']],
  ['XXL spelling equals 2XL',    ['XXL', 'L', 'M'],                          ['M','L','XXL']],
  ['Numeric sizes',              ['40', '36', '38'],                         ['36','38','40']],
  ['Alpha before numeric',       ['38', 'M', '36', 'L'],                     ['M','L','36','38']],
  ['Availability is untouched',  ['In stock', 'Out of stock'],               ['In stock','Out of stock']],
  ['Product type is untouched',  ['Dresses', 'Outerwear', 'Sets', 'Skirts'], ['Dresses','Outerwear','Sets','Skirts']],
  ['One lone size-shaped word',  ['Merino', 'L', 'Cotton', 'Linen'],         ['Merino','L','Cotton','Linen']],
];

let fail = 0;
for (const [name, input, expected] of cases) {
  const got = run(input);
  const ok = JSON.stringify(got.order) === JSON.stringify(expected);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`      in       ${JSON.stringify(input)}`);
  console.log(`      expected ${JSON.stringify(expected)}`);
  console.log(`      got      ${JSON.stringify(got.order)}   (chip styling applied: ${got.applied})`);
}
console.log(fail ? `\n${fail} FAILING` : '\nall passing');
process.exit(fail ? 1 : 0);
