# Checks

Two standalone checks. No dependencies, no install step.

    node tests/ladder.test.js      # size-filter ordering
    python3 tests/liquid-balance.py  # Liquid tag balance across sections/ and snippets/

## ladder.test.js

Runs `assets/dressar-facets.js` against a minimal DOM stub and asserts the
resulting visual order of a size filter.

The first case is the one this shop actually produces. Search & Discovery returns
size values alphabetically — `2XL, 3XL, L, M, One size, XL` — and the assortment
mixes lettered sizes with `One size`. The remaining cases pin the guards: a filter
of availability, product type or fabric values must come back untouched, because
the ordering runs over every `.js-filter` in the drawer, not only the size one.

## liquid-balance.py

Walks every tag in `sections/` and `snippets/` and checks that block tags close.
It descends into `{% liquid %}` bodies, where tags are written bare and an `if`
opened inside one may be closed by a `{% endif %}` in the markup after it, and it
skips the interior of `raw`, `comment`, `schema`, `stylesheet` and `javascript` —
in both their tag form and their bare form inside a `{% liquid %}` block.

An unclosed block tag takes the whole section down at render time and there is no
preview of an unpublished theme from CI, so this runs before every upload.
