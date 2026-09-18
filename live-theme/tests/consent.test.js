/* Runs assets/dressar-consent.js in jsdom against a stubbed Customer Privacy API.

   This one gates analytics and marketing for an EU store, so the assertions are
   about what is sent, not about how the banner looks. The rule the tests hold the
   script to: nothing non-essential is on until the visitor turns it on, and every
   category is stated explicitly in the payload rather than left out. */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is not installed. Run `npm install` in live-theme/ first.');
  process.exit(1);
}

const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dressar-consent.js'), 'utf8');

/* Mirrors sections/dressar-consent.liquid: banner, panel and save all start hidden. */
const MARKUP = `
<div class="dr-consent" data-dr-consent role="dialog" aria-modal="false" hidden>
  <h2 id="DressarConsentTitle">Before you browse</h2>
  <div class="dr-consent__panel" id="DressarConsentPanel" data-dr-consent-panel hidden>
    <ul>
      <li><label for="DrConsent-preferences">Preferences</label>
          <input type="checkbox" id="DrConsent-preferences" data-dr-category="preferences"></li>
      <li><label for="DrConsent-analytics">Analytics</label>
          <input type="checkbox" id="DrConsent-analytics" data-dr-category="analytics"></li>
      <li><label for="DrConsent-marketing">Marketing</label>
          <input type="checkbox" id="DrConsent-marketing" data-dr-category="marketing"></li>
    </ul>
  </div>
  <div class="dr-consent__actions">
    <button type="button" data-dr-accept><span>Accept all</span></button>
    <button type="button" data-dr-reject><span>Essential only</span></button>
    <button type="button" data-dr-manage aria-expanded="false" aria-controls="DressarConsentPanel">Manage preferences</button>
    <button type="button" data-dr-save hidden>Save choices</button>
  </div>
</div>
<footer><a href="#" data-dr-consent-open>Cookie preferences</a></footer>`;

function load({ shouldShow = true, stored = null, featuresFail = false, noApi = false } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${MARKUP}</body>`, {
    url: 'https://dressar.eu/',
    runScripts: 'outside-only',
  });
  const win = dom.window;
  const sent = [];

  if (!noApi) {
    win.Shopify = {
      loadFeatures(features, cb) { cb(featuresFail ? new Error('blocked') : null); },
      customerPrivacy: {
        setTrackingConsent(consent, cb) { sent.push(consent); if (cb) cb(); },
        shouldShowBanner() { return shouldShow; },
        currentVisitorConsent() { return stored; },
      },
    };
  }

  win.eval(SCRIPT);
  return { win, sent };
}

const q = (win, s) => win.document.querySelector(s);
const click = (win, sel) =>
  q(win, sel).dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`);
}

const ALL_OFF = { analytics: false, marketing: false, preferences: false, sale_of_data: false };
const ALL_ON = { analytics: true, marketing: true, preferences: true, sale_of_data: true };

// 1. the banner appears where consent is required, and consents to nothing on its own
{
  const { win, sent } = load({ shouldShow: true });
  check('shows where required, and sends nothing until asked',
    { hidden: q(win, '[data-dr-consent]').hidden, sent }, { hidden: false, sent: [] });
}

// 2. ...and stays out of the way where Shopify says it is not required
{
  const { win, sent } = load({ shouldShow: false });
  check('stays hidden where consent is not required',
    { hidden: q(win, '[data-dr-consent]').hidden, sent }, { hidden: true, sent: [] });
}

// 3. Essential only turns everything off explicitly
{
  const { win, sent } = load();
  click(win, '[data-dr-reject]');
  check('Essential only sends every category as false',
    { sent, hidden: q(win, '[data-dr-consent]').hidden }, { sent: [ALL_OFF], hidden: true });
}

// 4. Accept all turns everything on
{
  const { win, sent } = load();
  click(win, '[data-dr-accept]');
  check('Accept all sends every category as true',
    { sent, hidden: q(win, '[data-dr-consent]').hidden }, { sent: [ALL_ON], hidden: true });
}

// 5. Manage reveals the panel and the Save control
{
  const { win } = load();
  click(win, '[data-dr-manage]');
  check('Manage opens the panel and reveals Save', {
    panel: q(win, '[data-dr-consent-panel]').hidden,
    save: q(win, '[data-dr-save]').hidden,
    expanded: q(win, '[data-dr-manage]').getAttribute('aria-expanded'),
    checked: [...win.document.querySelectorAll('[data-dr-category]')].filter((b) => b.checked).length,
  }, { panel: false, save: false, expanded: 'true', checked: 0 });
}

// 6. Save sends exactly what is ticked, and false for what is not
{
  const { win, sent } = load();
  click(win, '[data-dr-manage]');
  q(win, '#DrConsent-analytics').checked = true;
  click(win, '[data-dr-save]');
  check('Save sends analytics on and everything else explicitly off',
    sent, [{ analytics: true, marketing: false, preferences: false, sale_of_data: false }]);
}

// 7. ticking Marketing also consents to sale_of_data — recorded, not incidental
{
  const { win, sent } = load();
  click(win, '[data-dr-manage]');
  q(win, '#DrConsent-marketing').checked = true;
  click(win, '[data-dr-save]');
  check('Marketing carries sale_of_data with it',
    sent, [{ analytics: false, marketing: true, preferences: false, sale_of_data: true }]);
}

// 8. reopening from the footer shows what was actually stored
{
  const { win } = load({ stored: { analytics: 'yes', marketing: 'no', preferences: 'yes' } });
  click(win, '[data-dr-consent-open]');
  check('reopening reflects the stored choice, not the defaults', {
    preferences: q(win, '#DrConsent-preferences').checked,
    analytics: q(win, '#DrConsent-analytics').checked,
    marketing: q(win, '#DrConsent-marketing').checked,
    visible: !q(win, '[data-dr-consent]').hidden,
    panelOpen: !q(win, '[data-dr-consent-panel]').hidden,
  }, { preferences: true, analytics: true, marketing: false, visible: true, panelOpen: true });
}

// 9. if the privacy API will not load, ask rather than assume
{
  const { win, sent } = load({ featuresFail: true });
  check('a failed privacy API still asks the visitor',
    { hidden: q(win, '[data-dr-consent]').hidden, sent }, { hidden: false, sent: [] });
}
{
  const { win, sent } = load({ noApi: true });
  check('no Shopify object at all still asks the visitor',
    { hidden: q(win, '[data-dr-consent]').hidden, sent }, { hidden: false, sent: [] });
}

console.log(failed ? `\n${failed} FAILING` : '\nall passing');
process.exit(failed ? 1 : 0);
