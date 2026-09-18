# Checks

    npm install            # once, for jsdom
    npm test               # all three

Or individually:

    node tests/ladder.test.js        # size-filter ordering        (no dependencies)
    node tests/card.test.js          # product card behaviour      (needs jsdom)
    node tests/recent.test.js        # recently viewed             (needs jsdom)
    node tests/sticky.test.js        # one sticky bar, not two     (needs jsdom)
    node tests/product.test.js       # product page                (needs jsdom)
    node tests/quickadd.test.js      # quick add sheet             (needs jsdom)
    node tests/grid.test.js          # grid density                (needs jsdom)
    python3 tests/liquid-balance.py  # Liquid tag balance          (no dependencies)

`package.json` and `node_modules/` are test tooling only. The theme is uploaded
file by file through the Admin API, so Shopify never sees either.

## ladder.test.js

Runs `assets/dressar-facets.js` against a minimal DOM stub and asserts the
resulting visual order of a size filter.

The first case is the one this shop actually produces. Search & Discovery returns
size values alphabetically — `2XL, 3XL, L, M, One size, XL` — and the assortment
mixes lettered sizes with `One size`. The remaining cases pin the guards: a filter
of availability, product type or fabric values must come back untouched, because
the ordering runs over every `.js-filter` in the drawer, not only the size one.

## card.test.js

Runs `assets/dressar-card.js` in jsdom against markup that mirrors what
`snippets/dressar-card.liquid` emits, and asserts what a colour swap does to the
card.

The case worth keeping is the price. A reduction belongs to one colour, not to the
product: switching from a reduced colour to a full-price one has to remove the
strike-through *and* the percentage badge together. Leaving the badge behind states
a reduction on a garment that is not reduced, which is a price claim, not a
cosmetic bug. The test also pins that the badge is never invented on a card where
the merchant turned the discount display off, and that the three price parts end up
in the order the card first rendered them — now, was, then the percentage.

## recent.test.js

Runs `assets/dressar-recently-viewed.js` in jsdom with a stubbed `fetch` and a
stubbed `localStorage`, and asserts what gets stored and what gets requested.

Two cases carry most of the weight. The first is the decoy: the markup includes a
product card's wishlist button, which carries `data-product-id` just as the main
product section does. The script must record the product whose page this is, taken
from the section's own `data-current`, never whichever `[data-product-id]` happens
to come first in the document — otherwise reordering sections in the theme editor
silently changes what gets recorded. The second pins the search URL exactly,
including `options[prefix]=none`: storefront search partial-matches the last term
by default, and the last term here is an id.

The storage stub also throws on demand, which is what private browsing modes do
rather than returning null.

## sticky.test.js

`assets/product-form.js` holds two things: Dawn's `ProductForm` element, which owns
add to cart, and an older Dressar sticky add-to-cart bar appended after it.

That bar predates the current product page and does not know about it. It finds a
button by `[name="add"]` inside `<product-form>`, which this product page has, and
its only guard is a check for its own class — so it was adding a second fixed bar
underneath the section's own, with an empty price, because the price it reads is
Dawn's markup and this page does not use it.

The test loads the real file and asserts one bar on the Dressar product page and
no legacy stylesheet there, while a plain Dawn product form still gets the bar it
always had, price included. That second half is the point of a guard rather than a
deletion: the older bar still does a job on surfaces this theme has not replaced.

## product.test.js

Runs `assets/dressar-product.js` against markup mirroring
`sections/dressar-product.liquid`, with this shop's real data: one Size option
running M to 3XL, and the real money format `€{{amount_with_comma_separator}}`,
which puts the decimal comma and the thousands dot the European way round.

What it pins: no size is chosen for the shopper and submitting without one is
blocked, names the option and moves focus to the grid; picking a size updates the
variant id, the price, the SKU, the URL and the sticky bar's price together; a
sold-out size disables the button and says so, and picking an available one
afterwards puts it back; and the low-stock line appears only on real inventory at
or below three, never as a nudge.

## quickadd.test.js

Runs `assets/dressar-quick-add.js` with a stubbed fetch. The add itself is Dawn's
and is not exercised — what matters here is the request, the sheet, and sizes.

It checks the request strips any variant query and asks for the section; that a
multi-size product opens the sheet with the merchant's own wording and nothing
preselected; that a single-variant product adds without opening a sheet at all;
that adding without a size is blocked, explained, and focuses the first size that
can actually be bought rather than a sold-out one; and that a failed request
leaves the sheet shut and falls through to the product page rather than stranding
the shopper on a dead "+".

## grid.test.js

Runs `assets/dressar-grid.js`. The case that justifies the file's design is the
fourth: the column count is written to the section wrapper, not to the `<ul>`,
because Dawn's `facets.js` replaces `#ProductGridContainer` wholesale on every
filter change. The test performs that replacement and asserts the choice survives.

## liquid-balance.py

Walks every tag in `sections/` and `snippets/` and checks that block tags close.
It descends into `{% liquid %}` bodies, where tags are written bare and an `if`
opened inside one may be closed by a `{% endif %}` in the markup after it, and it
skips the interior of `raw`, `comment`, `schema`, `stylesheet` and `javascript` —
in both their tag form and their bare form inside a `{% liquid %}` block.

An unclosed block tag takes the whole section down at render time and there is no
preview of an unpublished theme from CI, so this runs before every upload.
