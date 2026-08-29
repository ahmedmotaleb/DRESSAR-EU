# Dressar Ireland — Shopify theme

A complete, custom Shopify theme for **Dressar's Irish/EU storefront**
(`ntizm6-fs.myshopify.com`). Built from scratch for the Irish market: euro
pricing, Irish delivery expectations, EU consumer law, and GDPR cookie consent.

It is a standalone theme — no theme framework, no build step, no npm install.
Zip it and upload, or push it with the Shopify CLI.

---

## What's in it

```
assets/      base.css · theme.js · cart.js · consent.js
config/      settings_schema.json · settings_data.json
layout/      theme.liquid · password.liquid
locales/     en.default.json · ar.json · en.default.schema.json
sections/    27 sections (header, footer, hero, product, collection, cart, …)
snippets/    product-card · price · icon · cart-drawer · pagination · meta-tags · social-links
templates/   JSON templates incl. a fully composed Ireland homepage
content/     ready-to-paste page + policy copy (not theme files — see below)
```

## Installing

**Option A — upload a zip (no tooling needed)**

```bash
git archive --format=zip -o dressar-ireland.zip HEAD \
  assets config layout locales sections snippets templates
```

Then in Shopify admin → **Online Store → Themes → Add theme → Upload zip file**.
Preview it, then **Publish**.

> Zip only the seven theme directories. `content/` and `README.md` are not part
> of the theme and Shopify will reject the upload if they're included.

**Option B — Shopify CLI**

```bash
npm install -g @shopify/cli @shopify/theme
shopify theme dev   --store ntizm6-fs.myshopify.com   # live local preview
shopify theme push  --store ntizm6-fs.myshopify.com   # upload
```

## After installing — the setup that actually matters

1. **Currency** — Settings → Store details → set store currency to **EUR**.
   (The store is billed in EUR but the storefront currency is separate.)
2. **Markets** — Settings → Markets → make **Ireland** the primary market and
   add the EU countries you ship to.
3. **Taxes** — Settings → Taxes and duties → Ireland → register for Irish VAT and
   choose **"All prices include tax"**. Irish VAT on adult clothing is 23%.
   Children's clothing and footwear for under-11s is zero-rated — tag those
   products and assign them a 0% override, or you will overcharge and under-remit.
4. **Shipping** — create rates matching what the theme promises:
   Ireland €5.95 (free over €75) · Northern Ireland €7.95 · EU €12.95 (free over €150).
   If you change these, update them in **Theme settings → Ireland & EU** *and* in
   the Delivery page copy — the theme does not read your shipping rates.
5. **Navigation** — build a `main-menu` and `footer` menu. The header expects
   one level of dropdown.
6. **Pages** — Content → Pages, create these and paste from `content/pages/`:
   | Page | Handle | Template |
   |---|---|---|
   | Delivery & Returns | `delivery` | default |
   | Size Guide | `size-guide` | default |
   | About | `about` | default |
   | Contact | `contact` | `page.contact` |
7. **Policies** — Settings → Policies, paste from `content/policies/`.
   **These are drafts with `[PLACEHOLDER]` fields — fill them in and have a
   solicitor review them before you open.**
8. **Theme settings** — Customize → set logo, free-delivery threshold, delivery
   times, returns window, and pick the collections for the homepage blocks.

## Ireland-specific behaviour built into the theme

- **Prices carry a "VAT included" note** (toggle in theme settings) — expected by
  Irish shoppers, since Shopify shows tax-inclusive pricing for EU markets.
- **Free-delivery meter** in the cart drawer, driven by the threshold setting.
- **GDPR cookie banner** (`assets/consent.js`) wrapping Shopify's Customer
  Privacy API — analytics and marketing cookies stay off until the visitor opts
  in, and the banner only appears where consent is legally required.
- **Structured data** includes an Irish `MerchantReturnPolicy` and `eligibleRegion`,
  so Google shows the returns window in shopping results.
- **"No customs charges" messaging** throughout — the single biggest objection
  for Irish customers who have previously ordered from outside the EU.
- **Eircode field** labelled correctly in the address form (not "ZIP code").
- **14-day EU right to cancel** stated separately from the 30-day goodwill
  returns policy, as EU distance-selling rules require.
- **Arabic locale** (`locales/ar.json`) with RTL layout support, since Dressar's
  catalogue is bilingual — enable it under Settings → Languages if you want it.

## Design

Warm ivory ground, deep espresso text, forest-sage accent; Playfair Display over
Work Sans. Every colour and both fonts are theme settings, so the palette can be
changed in Customize without touching code. The layout is responsive from 320px,
respects `prefers-reduced-motion`, and uses semantic landmarks with visible focus
rings and a skip link.

## Notes and limitations

- Product data is **not** bundled. The theme renders whatever is in the store;
  the new store is currently empty, so import the catalogue (or a subset priced
  in EUR) before publishing.
- Prices must be **set in EUR in Shopify**, not converted at render time. Don't
  FX-convert the EGP prices mechanically — EU retail pricing is a commercial
  decision (duty, VAT, shipping, local positioning).
- Collection filtering renders sort only; add Shopify's Search & Discovery app
  if you want faceted filters, and the toolbar markup is ready for them.
- No third-party JS, no CDN dependencies, no tracking beyond what Shopify and
  your own apps add.
