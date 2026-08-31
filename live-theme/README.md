# Dressar EU — theme layer

The source for the Dressar layer applied to the **live Shopify theme**, not a
standalone theme. Working copy:

- Store: `ntizm6-fs` (Dressar.EU, dressar.eu, EUR, Ireland)
- Theme: `Dressar EU — Ireland compliance`, `gid://shopify/OnlineStoreTheme/155562213544` (unpublished)

Shopify is the source of truth. Every file here was verified byte-identical to
the live theme by MD5 at the time of commit. When you change one, upload it with
`themeFilesUpsert` and check the returned `checksumMd5` against the local file.

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
