#!/usr/bin/env node
/* test-launcher.js - proves the auto-update path actually works.

     node ship.js --local "wip"     # build dist/ first
     node test-launcher.js

   Serves dist/ from a throwaway local server, points a copy of launcher.html at
   it, and checks the whole lifecycle: cold download, cached warm start, picking
   up a new version, keeping the player's account across an update, and booting
   offline when the mirror is unreachable.

   It rewrites dist/ during the run to fake a release, then restores it, so it
   never leaves a bogus version behind for ship.js to build on.
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
let playwright;
try { playwright = require('playwright'); }
catch { console.error('x  playwright missing.  npm i -D playwright && npx playwright install chromium'); process.exit(2); }

let blockDist = false; // simulates "GitHub unreachable" without killing the launcher page
const srv = http.createServer((req, res) => {
  const f = path.join(DIST, req.url.split('?')[0].replace(/^\/dist/, ''));
  if (blockDist && !f.endsWith('__launchertest.html')) { res.writeHead(503); return res.end('down'); }
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  const type = f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'text/plain';
  res.writeHead(200, { 'content-type': type, 'access-control-allow-origin': '*' });
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const base = `http://127.0.0.1:${port}`;

  // launcher copy whose grab() points at the local mirror
  let L = fs.readFileSync(path.join(ROOT, 'launcher.html'), 'utf8');
  L = L.replace(/user:\s*'[^']*'/, "user:   'local'").replace(/repo:\s*'[^']*'/, "repo:   'local'");
  L = L.replace(/return \[\s*'https:\/\/raw[\s\S]*?\];/,
    "return ['" + base + "/' + path + '?' + bust];");
  const tmp = path.join(DIST, '__launchertest.html');
  fs.writeFileSync(tmp, L);

  // Snapshot dist/ - this test deliberately rewrites it to fake a new release,
  // and leaving it rewritten made ship.js derive the next version from a bogus
  // number (two builds ended up sharing a version, so cached launchers never
  // updated). Always put it back.
  const SNAP = ['version.json', 'stack-casino.html']
    .map(f => [path.join(DIST, f), fs.existsSync(path.join(DIST, f)) ? fs.readFileSync(path.join(DIST, f)) : null]);
  const restore = () => { for (const [f, buf] of SNAP) if (buf !== null) fs.writeFileSync(f, buf); };
  process.on('exit', restore);

  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));

  const ok = (n, c) => console.log((c ? '  ok   ' : '  FAIL ') + n);
  let bad = 0;
  const check = (n, c) => { ok(n, c); if (!c) bad++; };

  // --- cold start: no cache, must download and boot ---
  await pg.goto(base.replace(/\/$/, '') + '/__launchertest.html');
  await pg.waitForFunction("typeof loggedIn==='function'", null, { timeout: 15000 }).catch(() => {});
  check('cold start boots the game', await pg.evaluate("typeof loggedIn==='function'"));
  check('auth gate shown', await pg.evaluate("!!document.querySelector('#authGate.show')"));
  const v1 = await pg.evaluate("(document.querySelector('meta[name=\\\"stack-version\\\"]')||{}).content");
  check('version stamped (' + v1 + ')', !!v1 && v1 !== '0.0.0-dev');
  check('build cached', await pg.evaluate("!!localStorage.getItem('stack-launcher-build')"));

  // --- sign up, then reload: account must survive a launcher restart ---
  await pg.click('[data-am="signup"]');
  await pg.fill('#auU', 'mate1'); await pg.fill('#auP', 'pw123'); await pg.fill('#auP2', 'pw123');
  await pg.click('#auGo');
  await pg.waitForFunction('loggedIn()', null, { timeout: 8000 });
  await pg.reload();
  await pg.waitForFunction("typeof loggedIn==='function' && loggedIn()", null, { timeout: 15000 }).catch(() => {});
  check('warm start restores the account', await pg.evaluate("loggedIn() && P().user === 'mate1'"));

  // --- ship a new version: launcher must pick it up, account must survive ---
  const vj = JSON.parse(fs.readFileSync(path.join(DIST, 'version.json'), 'utf8'));
  vj.version = '9999.01.01.1';
  fs.writeFileSync(path.join(DIST, 'version.json'), JSON.stringify(vj));
  const gf = path.join(DIST, 'stack-casino.html');
  const game = fs.readFileSync(gf, 'utf8')
    .replace(/(<meta name="stack-version" content=")[^"]*(">)/, '$19999.01.01.1$2');
  if (!/9999\.01\.01\.1/.test(game)) { console.log('  FAIL harness could not restamp the build'); process.exit(1); }
  fs.writeFileSync(gf, game);

  await pg.reload();
  await pg.waitForFunction("typeof loggedIn==='function'", null, { timeout: 15000 }).catch(() => {});
  const v2 = await pg.evaluate("(document.querySelector('meta[name=\\\"stack-version\\\"]')||{}).content");
  check('update picked up (' + v2 + ')', v2 === '9999.01.01.1');
  check('account survived the update', await pg.evaluate("loggedIn() && P().user === 'mate1'"));

  // --- offline: mirror down, must still boot from cache ---
  blockDist = true;
  await pg.reload();
  await pg.waitForFunction("typeof loggedIn==='function'", null, { timeout: 20000 }).catch(() => {});
  check('offline boots from cache', await pg.evaluate("typeof loggedIn==='function' && loggedIn()"));

  console.log('\n  console errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await browser.close();
  await new Promise(r => srv.close(r));
  restore();
  try { fs.unlinkSync(tmp); } catch {}
  console.log(bad ? `\n${bad} FAILED\n` : '\nlauncher ok\n');
  process.exit(bad || errs.length ? 1 : 0);
})();
