/**
 * Layout scans for screens of the web build (v12, DECISIONS #382; the checks HANDOFF §6 describes):
 *
 *   npx expo export -p web --output-dir <dist>
 *   node scripts/layout-scan.js <dist> <route> [<route> ...]
 *
 * At 375 px, in English and German, each with and without the dyslexia font, it reports:
 * - `small`: controls (buttons, tabs, switches, radios, links, inputs) under 44 × 44 px;
 * - `touching`: filled blocks that touch or overlap (a gap under 3 px) and are not parts of one
 *   filled control or panel — panels without outlines show a missing gap;
 * - `sideways`: the page or a scroll container that is wider than what it shows;
 * - `cut`: text that is clipped without "…", or that sticks out of the viewport.
 * A long screen under a pinned bar (the app tab bar) reports its rows as "touching" the bar: that
 * is content scrolled under it, not a fault. The stats tables scroll sideways by design.
 * Seeds the web storage with the export golden data like `scripts/screenshots.js`. Exit code 1
 * when anything is found. Needs Playwright (see `scripts/screenshots.js`). Not part of CI.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = process.cwd(); // run from the repository root
const DATA = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/domain/__golden__/input.json'), 'utf8'),
);
const NOW = new Date('2026-11-23T12:00:00.000Z');
const VARIANTS = [
  { language: 'en', themeMode: 'dark', dyslexiaFont: false },
  { language: 'de', themeMode: 'dark', dyslexiaFont: false },
  { language: 'en', themeMode: 'light', dyslexiaFont: true },
  { language: 'de', themeMode: 'light', dyslexiaFont: true },
];

function serve(dist) {
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(dist, url);
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
      file = path.join(dist, 'index.html');
    res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

function storage(variant) {
  const { photos, ...data } = DATA;
  const state = {
    ...data,
    currentProfileId: 'pr1',
    chipLabel: 'number',
    tourMode: 'none',
    tourSeen: [],
    ...variant,
  };
  const items = { 'volley-lineup': JSON.stringify({ state, version: 12 }) };
  for (const photo of photos) items[`volley-lineup-photo:${photo.id}`] = photo.dataUri;
  return items;
}

/** Runs in the page. */
function scanPage() {
  const out = { small: [], touching: [], sideways: [], cut: [] };
  const MIN = 43.5;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    for (let n = el; n; n = n.parentElement) {
      if (n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('inert')) return null;
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
    }
    if (Number(getComputedStyle(el).opacity) === 0) return null;
    // Pager pages beside the shown one are off-screen.
    if (r.right <= 0 || r.left >= innerWidth) return null;
    return r;
  };
  const name = (el) =>
    (el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.textContent || '')
      .trim()
      .slice(0, 50);

  const controls =
    'button,[role=button],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=link],a,input,textarea';
  for (const el of document.querySelectorAll(controls)) {
    const r = visible(el);
    if (r && (r.width < MIN || r.height < MIN))
      out.small.push(
        `${Math.round(r.width)}x${Math.round(r.height)} ${el.getAttribute('role') || el.tagName} "${name(el)}"`,
      );
  }

  const filled = [];
  for (const el of document.querySelectorAll('body *')) {
    const bg = getComputedStyle(el).backgroundColor;
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
    const r = visible(el);
    if (!r || r.width < 24 || r.height < 24) continue;
    if (r.width >= innerWidth - 1 && r.height > 200) continue; // page backgrounds
    filled.push({ el, r });
  }
  const filledParent = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement)
      if (filled.some((f) => f.el === n)) return n;
    return null;
  };
  for (let i = 0; i < filled.length; i += 1) {
    for (let j = i + 1; j < filled.length; j += 1) {
      const a = filled[i];
      const b = filled[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const parent = filledParent(a.el);
      if (parent && parent === filledParent(b.el)) continue; // segments of one track, …
      const xOverlap = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const yOverlap = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      const vGap = Math.max(a.r.top, b.r.top) - Math.min(a.r.bottom, b.r.bottom);
      const hGap = Math.max(a.r.left, b.r.left) - Math.min(a.r.right, b.r.right);
      if ((xOverlap > 4 && vGap < 3) || (yOverlap > 4 && hGap < 3))
        out.touching.push(
          `"${name(a.el)}" | "${name(b.el)}" vGap=${Math.round(vGap)} hGap=${Math.round(hGap)}`,
        );
    }
  }

  const doc = document.scrollingElement;
  if (doc.scrollWidth > innerWidth + 1)
    out.sideways.push(`page ${doc.scrollWidth} > ${innerWidth}`);
  for (const el of document.querySelectorAll('body *')) {
    if (!/(auto|scroll)/.test(getComputedStyle(el).overflowX) || !visible(el)) continue;
    if (el.scrollWidth > el.clientWidth + 1)
      out.sideways.push(`"${name(el)}" ${el.scrollWidth} > ${el.clientWidth}`);
  }

  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 0 || !el.textContent.trim()) continue;
    const r = visible(el);
    if (!r) continue;
    const cs = getComputedStyle(el);
    const clipped = el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible';
    if (clipped && cs.textOverflow !== 'ellipsis' && cs.webkitLineClamp === 'none')
      out.cut.push(`cut "${name(el)}"`);
    if (r.right > innerWidth + 1)
      out.cut.push(`outside "${name(el)}" right=${Math.round(r.right)}`);
  }
  return out;
}

async function main() {
  const [dist, ...routes] = process.argv.slice(2);
  if (!dist || routes.length === 0) {
    console.error('Usage: node scripts/layout-scan.js <dist> <route> [<route> ...]');
    process.exit(2);
  }
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.error(
      'Playwright is not installed: npm i --no-save playwright && npx playwright install chromium',
    );
    process.exit(2);
  }
  const server = await serve(path.resolve(dist));
  const base = `http://localhost:${server.address().port}`;
  const browser = await playwright.chromium.launch();
  let findings = 0;
  for (const variant of VARIANTS) {
    const context = await browser.newContext({
      viewport: { width: 375, height: 844 },
      reducedMotion: 'reduce',
      hasTouch: true,
    });
    await context.addInitScript((items) => {
      if (sessionStorage.getItem('seeded')) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
      sessionStorage.setItem('seeded', '1');
    }, storage(variant));
    const page = await context.newPage();
    await page.clock.setFixedTime(NOW);
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const result = await page.evaluate(scanPage);
      const where = `${route} [${variant.language}${variant.dyslexiaFont ? ' + font' : ''}]`;
      for (const [kind, lines] of Object.entries(result)) {
        for (const line of new Set(lines)) {
          findings += 1;
          console.log(`${kind.padEnd(8)} ${where}: ${line}`);
        }
      }
    }
    await context.close();
  }
  await browser.close();
  server.close();
  console.log(findings === 0 ? 'no findings' : `${findings} findings`);
  process.exit(findings === 0 ? 0 : 1);
}

main();
