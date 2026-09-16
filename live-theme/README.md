# Dressar EU — theme layer

The source for the Dressar layer applied to the **live Shopify theme**, not a
standalone theme. Working copy:

- Store: `ntizm6-fs` (Dressar.EU, dressar.eu, EUR, Ireland)
- Theme: `Dressar EU — Ireland compliance`, `gid://shopify/OnlineStoreTheme/155562213544` (unpublished)

Shopify is the source of truth. Every file here was verified byte-identical to
the live theme by MD5 at the time of commit. When you change one, upload it with
`themeFilesUpsert` and check the returned `checksumMd5` against the local file.

## PENDING UPLOAD — read this first

Phase D is committed here but **not on the theme**. `switch-shop` was called from
this remote session at the user's explicit request, which revoked the token; the
replacement is only minted for a new session, so the connector could not recover in
place. Upload these four files with `themeFilesUpsert` and check each returned
`checksumMd5` against the local file:

| File | Bytes | MD5 |
| --- | --- | --- |
| `assets/dressar-facets.css` | 7013 | `c2f335372a46c18d3ad46fee2526dca8` |
| `assets/dressar-facets.js` | 4892 | `a54cd6a170f140a3c690809e1f20568e` |
| `sections/dressar-collection.liquid` | 18321 | `7ad3c4c4b01d3560880a8397244ad236` |
| `sections/dressar-search.liquid` | 12194 | `c669bed0ae7b447f168c208290b66da9` |

Phases A, B and C are already live and verified.

**Phase D's CSS has never been rendered in a browser.** It overrides
component-facets.css to move Dawn's drawer to the left and restyle its internals,
and it is the one part of this work that genuinely needs eyes on a real page before
it can be trusted. Check it at 390px and at 1440px with a filter open.

## Connected store

The connector has silently drifted to the Egyptian store `dnx31m-mi` / `dressar.co`
(EGP) twice during this work. Call `get-shop-info` and confirm `ntizm6-fs` /
dressar.eu (EUR, Ireland) before any write. Theme `155562213544` exists only on the
EU store, so a misdirected write fails rather than landing on the wrong shop — but
that is a passive backstop, not a check.

Do **not** call `switch-shop` from a remote session. It revokes the current token,
and the replacement is only minted for a new session, so it strands the connector
for the rest of the run. Change the store from the Shopify connector settings and
start a fresh session instead.

Still to build: Phase C (collection toolbar, grid density, editorial inserts),
D (restyle Dawn's filter drawer), E (product detail page), F (recommendations,
complete the look, recently viewed), G (Product Family and Size Chart metaobjects,
remaining metafield definitions).

## Why a retrofit rather than a new theme

The repository root holds an earlier standalone theme. It was superseded: the
brief said not to overwrite functioning Shopify behaviour, so the work moved to
adding a Dressar layer on top of the existing Dawn theme. Dawn's cart, facets,
card grid, variant selection, localization, analytics and consent plumbing are
untouched — `facets.liquid`, `card-product.liquid`, `main-cart-items.liquid` and
`cart-drawer.liquid` were deliberately never rewritten.

## A note on JSON files

Shopify stores template and section-group JSON **minified, with no trailing
newline**, and the admin API returns a pretty-printed copy with a generated
comment header on top. So the `size`/`checksumMd5` the API reports will never
match the pretty form. To verify one:

    json.dumps(obj, separators=(',',':'), ensure_ascii=False)

then MD5 that. The pretty copies here are for reading and diffing.

## Not in this directory

These are part of the shipped theme but live only on Shopify:

- Dressar overrides appended to the bottom of Dawn's `component-card.css` and
  `product-form.js` (product card design, colour swatch map, sticky add-to-cart)
- `config/settings_data.json` — colour schemes and typography
- `templates/collection.json`, `templates/search.json`, `templates/product.json`
- `sections/footer-group.json`
- Locale files

`assets/dressar-card-link-fix.css`, `dressar-card-look.css`,
`dressar-price-tightening.css`, `dressar-swatches.css`, `dressar-type.css` and
`dressar-sticky-atc-patch.js` exist on the theme but are dead placeholders that
nothing loads — their contents were folded into the Dawn files above. They are
not mirrored here.
