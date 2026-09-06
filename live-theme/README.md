# Dressar EU — theme layer

The source for the Dressar layer applied to the **live Shopify theme**, not a
standalone theme. Working copy:

- Store: `ntizm6-fs` (Dressar.EU, dressar.eu, EUR, Ireland)
- Theme: `Dressar EU — Ireland compliance`, `gid://shopify/OnlineStoreTheme/155562213544` (unpublished)

Shopify is the source of truth. Every file here was verified byte-identical to
the live theme by MD5 at the time of commit. When you change one, upload it with
`themeFilesUpsert` and check the returned `checksumMd5` against the local file.

## PENDING UPLOAD — read this first

Phase B (commit `8577fc6`) is committed here but **has not been uploaded to the
theme**: the Shopify connector needed reauthorising mid-session and could not be
restored inside a running remote session. Before anything else, upload these six
files with `themeFilesUpsert` and check each returned `checksumMd5` against the
local file:

| File | Bytes | MD5 |
| --- | --- | --- |
| `sections/dressar-quick-add.liquid` | 5505 | `035a6aeabb1a0619190f6ab92ada7a90` |
| `snippets/dressar-quick-add-sheet.liquid` | 1787 | `6e2213fb149abfc3a8ead905375d6027` |
| `assets/dressar-quick-add.css` | 4152 | `c14526e302ae3685c60d04ab87f7b998` |
| `assets/dressar-quick-add.js` | 8509 | `e2bdca20a72aa7c3595d0520493ef71e` |
| `sections/dressar-collection.liquid` | 10719 | `e9605faa8cf17a578cf01b46f32ad6d5` |
| `sections/dressar-search.liquid` | 10196 | `28055f4f1be28e0a1a008abb11f80409` |

Everything from Phase A (commit `02d269d`) is already live and verified.

**Check the connected store first.** It has drifted twice to the Egyptian store
`dnx31m-mi` / `dressar.co` (EGP). The correct one is `ntizm6-fs` / dressar.eu
(EUR, Ireland). Theme `155562213544` exists only on the EU store, so a write
aimed at the wrong shop fails rather than landing somewhere it should not — but
confirm with `get-shop-info` before touching anything.

Still to build: Phase C (collection toolbar, grid density, editorial inserts),
D (restyle Dawn's filter drawer), E (product detail page), F (recommendations,
complete the look, recently viewed), G (Product Family and Size Chart
metaobjects, remaining metafield definitions).

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
