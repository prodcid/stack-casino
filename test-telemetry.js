#!/usr/bin/env node
/* test-telemetry.js - the encrypted telemetry path end to end, offline.
     node test-telemetry.js path/to/private-key.txt
   Runs the REAL telemetry-worker.js against an in-memory fake GitHub, points a
   copy of the game at it, plays a little, flushes, checks the stored files are
   opaque, then decrypts them in the admin portal with the private key. */
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright');
const keyFile = process.argv[2];
if (!keyFile || !fs.existsSync(keyFile)) { console.error('usage: node test-telemetry.js <private-key.txt>'); process.exit(2); }
const PRIV = fs.readFileSync(keyFile, 'utf8').trim().split('\n').pop().trim();
let ok = 0, bad = 0;
const pass = (n, d = '') => { ok++; console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { bad++; console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };

(async () => {
  // the real Worker, with GitHub faked in memory
  const src = fs.readFileSync(path.join(__dirname, 'telemetry-worker.js'), 'utf8');
  const worker = (await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))).default;
  const store = {}; let sha = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const m = String(url).match(/\/repos\/me\/stack-telemetry\/contents\/(.+)$/);
    if (m && init.method === 'PUT') {
      if (!/^Bearer test-write-token$/.test(init.headers.Authorization)) return new Response('no', { status: 401 });
      if (store[m[1]]) return new Response('exists', { status: 422 });
      store[m[1]] = { sha: 's' + (++sha), content: JSON.parse(init.body).content };
      return new Response('{}', { status: 201 });
    }
    return realFetch(url, init);
  };
  const env = { REPO: 'me/stack-telemetry', GH_TOKEN: 'test-write-token' };
  // the Worker itself turns junk away
  const junk = await worker.fetch(new Request('https://relay.test/log', { method: 'POST', body: '{"v":1,"k":"plain text <b>","iv":"x","d":"y"}' }), env);
  junk.status === 400 ? pass('relay rejects anything that is not an encrypted packet') : fail('relay rejects junk', junk.status);

  // a copy of the game pointed at the relay
  const game = fs.readFileSync(path.join(__dirname, 'stack-casino.html'), 'utf8').replace("const TELE_URL='';", "const TELE_URL='https://relay.test/log';");
  const tmp = path.join(os.tmpdir(), 'stack-tele-test.html'); fs.writeFileSync(tmp, game);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('https://relay.test/**', async route => {
    const q = route.request();
    const res = await worker.fetch(new Request(q.url(), { method: q.method(), body: q.method() === 'POST' ? q.postData() : undefined }), env);
    await route.fulfill({ status: res.status, body: await res.text(), headers: Object.fromEntries(res.headers) });
  });
  await pg.route('https://api.github.com/**', async route => {
    const u = new URL(route.request().url()), p = u.pathname;
    if (route.request().headers().authorization !== 'Bearer test-read-token') return route.fulfill({ status: 401, body: '{}' });
    if (p === '/repos/me/stack-telemetry') return route.fulfill({ json: { default_branch: 'main' } });
    if (p.endsWith('/git/trees/main')) return route.fulfill({ json: { tree: Object.entries(store).map(([k, v]) => ({ path: k, type: 'blob', sha: v.sha })) } });
    const bm = p.match(/\/git\/blobs\/(.+)$/);
    if (bm) { const f = Object.values(store).find(v => v.sha === bm[1]); return route.fulfill({ json: { content: f.content } }); }
    route.fulfill({ status: 404, body: '{}' });
  });
  await pg.goto('file:///' + tmp.replace(/\\/g, '/'));
  await pg.waitForSelector('#authGate.show'); await pg.click('[data-am="signup"]'); await pg.waitForTimeout(300);
  await pg.fill('#auU', 'teletester'); await pg.fill('#auP', 'pw123'); await pg.fill('#auP2', 'pw123'); await pg.click('#auGo');
  await pg.waitForFunction('loggedIn()'); await pg.waitForTimeout(600);
  const notice = await pg.evaluate("!!document.querySelector('.telebox')");
  notice ? pass('player is told on first login') : fail('player is told on first login');
  await pg.evaluate("document.querySelector('#teleOk').click()");
  // play a little: dice bets/wins, a top-up, a card pack
  await pg.evaluate("go('dice');take(10);pay(25);take(40);P().bal=50;renderBal();$('refill').click();go('cards')");
  await pg.waitForTimeout(900);
  await pg.evaluate("StackCards.go('shop');StackCards.root.querySelector('#buy').click()"); await pg.waitForTimeout(300);
  await pg.evaluate("(()=>{const p=StackCards.root.querySelector('#pk');p.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))})()"); await pg.waitForTimeout(800);
  await pg.evaluate('teleFlush()'); await pg.waitForTimeout(1500);
  const files = Object.keys(store);
  files.length >= 1 ? pass('game flushes to the relay, relay writes to the private repo', files.length + ' file(s)') : fail('flush reached the repo', JSON.stringify(files));
  const raw = Object.values(store).map(v => Buffer.from(v.content, 'base64').toString()).join('\n');
  (!/teletester|dice|wagered|cards|pack/i.test(raw)) ? pass('stored files are unreadable without the key', 'no names, games or amounts in plain text') : fail('stored files leak plaintext');
  const queued = await pg.evaluate('TELE.q.length');
  queued === 0 ? pass('queue cleared after a successful send') : fail('queue cleared', queued);

  // admin: wrong key is refused, right key decrypts
  await pg.evaluate("ADM.on=true;go('admin');admRender()"); await pg.waitForTimeout(300);
  await pg.fill('#taRepo', 'me/stack-telemetry'); await pg.fill('#taTok', 'test-read-token');
  await pg.fill('#taKey', 'MIIBVwIBADANBgkqhkiG9w0BAQEFAASCAUEwggE9AgEAAkEAtotallyWrong'); await pg.click('#taLoad'); await pg.waitForTimeout(800);
  const wrong = await pg.evaluate("$('taMsg').textContent");
  /not valid|couldn/i.test(wrong) ? pass('wrong private key cannot decrypt', wrong.slice(0, 60)) : fail('wrong key refused', wrong);
  await pg.fill('#taKey', PRIV); await pg.click('#taLoad');
  await pg.waitForFunction("/events/.test($('taMsg').textContent)", null, { timeout: 15000 }).catch(() => {});
  const res = await pg.evaluate(`(()=>{const E=TA.ev.filter(e=>e.u==='teletester');return {n:E.length,types:[...new Set(E.map(e=>e.ty))].sort(),
    dice:E.filter(e=>e.ty==='money'&&e.g==='dice').reduce((a,e)=>[a[0]+e.wagered,a[1]+e.won],[0,0]),msg:$('taMsg').textContent,rendered:!!document.querySelector('.tatab')}})()`);
  (res.types.includes('session') && res.types.includes('money') && res.types.includes('topup') && res.types.includes('pack') && res.dice[0] === 50 && res.dice[1] === 25 && res.rendered)
    ? pass('admin portal decrypts and summarises', `${res.n} events: ${res.types.join(', ')}; dice wagered ${res.dice[0]} won ${res.dice[1]}`)
    : fail('admin portal decrypts and summarises', JSON.stringify(res));
  await pg.screenshot({ path: path.join(os.tmpdir(), 'stack-tele-admin.png'), fullPage: false });
  errs.length ? fail('no console errors', errs.join(' | ')) : pass('no console errors');
  await b.close(); fs.unlinkSync(tmp);
  console.log(`\n${ok}/${ok + bad} checks passed`); process.exit(bad ? 1 : 0);
})();
