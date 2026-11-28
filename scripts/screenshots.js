/**
 * Screenshots of every main screen for "no visible change" checks (v8.3, DECISIONS #224).
 *
 *   npx expo export -p web --output-dir <dist>
 *   node scripts/screenshots.js <dist> <outDir> [--only <substring>]
 *   node scripts/screenshots.js --compare <beforeDir> <afterDir> [<diffDir>]
 *
 * Seeds the web storage with the export golden data (`src/domain/__golden__/input.json`), fixes
 * the clock and turns motion off, then shoots each screen at 375 and 1280 px in EN + DE, dark +
 * light, with and without the dyslexia font. `--compare` runs ImageMagick `compare -metric AE`
 * on every pair and prints the differing pixel counts (exit code 1 when any differ).
 * Needs Playwright, which is deliberately not a dependency of the app (it is preinstalled in the
 * agents' sandbox; elsewhere `npm i --no-save playwright && npx playwright install chromium`).
 * Not part of CI.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = process.cwd(); // run from the repository root
const DATA = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/domain/__golden__/input.json'), 'utf8'),
);
const NOW = new Date('2026-11-23T12:00:00.000Z');
const CONCURRENCY = Number(process.env.SHOT_JOBS ?? 4);

const SCREENS = [
  ['profiles', '/'],
  ['teams', '/teams'],
  ['profile', '/profile'],
  ['settings', '/settings'],
  ['team-roster', '/team/t1?tab=roster'],
  ['team-matches', '/team/t1?tab=matches'],
  ['team-presets', '/team/t1?tab=presets'],
  ['team-starters', '/team/t1?tab=starters'],
  ['team-stats', '/team/t1?tab=stats'],
  ['team2-roster', '/team/t2?tab=roster'],
  ['player-detail', '/team/t1/players/p1'],
  ['player-edit', '/team/t1/player?playerId=p1'],
  ['player-new', '/team/t1/player'],
  ['match-new', '/team/t1/match-new?seasonId=s1'],
  ['season-new', '/team/t1/season-new'],
  ['preset', '/team/t1/preset/ps2'],
  ['team-starters-editor', '/team/t1/starters'],
  ['season-matches', '/team/t1/season/s1?tab=matches'],
  ['season-opponents', '/team/t1/season/s1?tab=opponents'],
  ['season-stats', '/team/t1/season/s1?tab=stats'],
  ['builder-set1', '/match/m1?set=1'],
  ['builder-set3', '/match/m1?set=3'],
  ['rotation', '/match/m1/rotation'],
  ['match-starters', '/match/m1/starters'],
  ['live-current', '/match/m1/live'],
  ['live-set1', '/match/m1/live?set=1'],
  ['live-not-started', '/match/m2/live'],
  ['performance', '/match/m1/performance?set=all'],
  ['performance-player', '/match/m1/performance?set=1&player=p1'],
  ['match-stats', '/match/m1/stats'],
  ['not-found', '/nowhere'],
  // v11: the account screens (signed out).
  ['account', '/account'],
  ['sign-in', '/account/sign-in'],
  // v12: hosted tournaments (the golden data's "Winter Cup": six teams, nine results).
  ['tournaments', '/tournaments'],
  ['tournament-new', '/tournament-new'],
  ['tournament-edit', '/tournament-new?tournamentId=h1'],
  ['tournament-table', '/tournament/h1?tab=table'],
  ['tournament-matches', '/tournament/h1?tab=matches'],
  ['tournament-teams', '/tournament/h1?tab=teams'],
  ['tournament-result', '/tournament/h1/match?a=ht2&b=ht6'],
  ['tournament-result-new', '/tournament/h1/match?a=ht1&b=ht3'],
  ['tournament-team', '/tournament/h1/team/ht2'],
  ['tournament2-table', '/tournament/h2?tab=table'],
  ['tournament2-matches', '/tournament/h2?tab=matches'],
];

const WIDTHS = [
  [375, 1400],
  [1280, 1100],
];
const VARIANTS = [];
for (const language of ['en', 'de'])
  for (const themeMode of ['dark', 'light'])
    for (const dyslexiaFont of [false, true]) VARIANTS.push({ language, themeMode, dyslexiaFont });

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
  const state = {
    profiles: DATA.profiles,
    teams: DATA.teams,
    players: DATA.players,
    matches: DATA.matches,
    presets: DATA.presets,
    seasons: DATA.seasons,
    opponents: DATA.opponents,
    // v12: the migration to store 14 keeps lists that are already there.
    hostedTournaments: DATA.hostedTournaments,
    hostedTeams: DATA.hostedTeams,
    hostedResults: DATA.hostedResults,
    currentProfileId: 'pr1',
    chipLabel: 'number',
    // v9.0: no tour, so no tip popups over the screens.
    tourMode: 'none',
    tourSeen: [],
    ...variant,
  };
  const items = { 'volley-lineup': JSON.stringify({ state, version: 12 }) };
  for (const photo of DATA.photos) items[`volley-lineup-photo:${photo.id}`] = photo.dataUri;
  return items;
}

async function shootVariant(browser, base, outDir, only, { width, height, variant }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: variant.language === 'de' ? 'de-CH' : 'en-GB',
    timezoneId: 'Europe/Zurich',
  });
  await context.addInitScript((items) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, storage(variant));
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  let count = 0;
  for (const [name, route] of SCREENS) {
    if (only && !name.includes(only)) continue;
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    const v = variant;
    const file = `${name}_${width}_${v.language}_${v.themeMode}${v.dyslexiaFont ? '_font' : ''}.png`;
    await page.screenshot({ path: path.join(outDir, file), animations: 'disabled' });
    count += 1;
  }
  await context.close();
  return count;
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error(
      'Playwright is not installed: npm i --no-save playwright && npx playwright install chromium',
    );
    process.exit(2);
  }
}

async function shoot(dist, outDir, only) {
  const { chromium } = loadPlaywright();
  const server = await serve(path.resolve(dist));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  fs.mkdirSync(outDir, { recursive: true });
  const jobs = WIDTHS.flatMap(([width, height]) =>
    VARIANTS.map((variant) => ({ width, height, variant })),
  );
  let count = 0;
  const worker = async () => {
    for (let job = jobs.shift(); job !== undefined; job = jobs.shift()) {
      const shot = await shootVariant(browser, base, outDir, only, job);
      count += shot;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();
  server.close();
  console.log(`${count} screenshots in ${outDir}`);
}

function compareDirs(before, after, diffDir) {
  if (diffDir) fs.mkdirSync(diffDir, { recursive: true });
  const files = fs.readdirSync(before).filter((f) => f.endsWith('.png'));
  let differing = 0;
  for (const file of files) {
    const other = path.join(after, file);
    if (!fs.existsSync(other)) {
      console.log(`MISSING ${file}`);
      differing += 1;
      continue;
    }
    const diff = diffDir ? path.join(diffDir, file) : 'null:';
    let pixels;
    try {
      execFileSync('compare', ['-metric', 'AE', path.join(before, file), other, diff], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      pixels = 0;
    } catch (error) {
      pixels = String(error.stderr).trim();
    }
    if (pixels !== 0) {
      differing += 1;
      console.log(`DIFF ${file}: ${pixels} px`);
    }
  }
  console.log(`${files.length} compared, ${differing} differ`);
  process.exitCode = differing === 0 ? 0 : 1;
}

const args = process.argv.slice(2);
if (args[0] === '--compare') compareDirs(args[1], args[2], args[3]);
else {
  const onlyAt = args.indexOf('--only');
  shoot(args[0], args[1], onlyAt === -1 ? undefined : args[onlyAt + 1]).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
