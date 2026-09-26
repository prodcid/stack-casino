#!/usr/bin/env node
/* test-hq.js - Stack HQ (the admin-only company simulation) checks.
   node test-hq.js sim   Node only: the economy is balanced (hands-off drifts, greedy pricing loses players,
                         expansion grows), licences take time, bailouts dilute, deals move money correctly,
                         the public snapshot carries only public news
   node test-hq.js ui    Playwright: HQ loads and every screen renders, months advance, actions work from the
                         screens, it saves; inside Stack it is admin-only and publishes the home-page strip */
const fs = require('fs'), path = require('path');
const FILE = path.resolve(__dirname, 'stack-hq.html'), CASINO = path.resolve(__dirname, 'stack-casino.html');
const mode = process.argv[2] || 'sim', results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);
const rng = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function core() { const src = fs.readFileSync(FILE, 'utf8'), m = { exports: {} }; new Function('module', src.slice(src.indexOf('/*==CORE==*/'), src.indexOf('/*==END CORE==*/')))(m); return m.exports; }
function sim() {
  const H = core();
  const run = (strat, seed, N = 48) => { const r = rng(seed), st = H.hqNew(r); const real = { players: 2, ggr: 0 };
    for (let i = 0; i < N; i++) { real.ggr += 300; strat(st, i); H.hqAdvance(st, r, real); while (st.inbox.length) H.hqDecide(st, st.inbox[0].uid, st.inbox[0].opts[st.inbox[0].opts.length - 1].k, r); } return st; };
  const avg = strat => { let t = 0; for (let s = 1; s <= 6; s++) t += run(strat, s).val; return t / 6; };
  console.log('\n-- economy --');
  { const st = H.hqNew(rng(1)); check(st.val > 2e7 && st.val < 2e8, 'Stack starts as a young company', H.hqMoney(st.val)); }
  const passive = avg(() => {});
  const smart = avg((st, i) => { if (i === 0) { H.hqHire(st, 'cmo', 0); H.hqCampaign(st, 'social', 'AU', 3e5, 12); } if (i === 3) H.hqLaunch(st, 'NZ'); if (i === 10) H.hqLaunch(st, 'UK'); if (i === 12) H.hqStartRnd(st, 'fantasy'); if (i === 20 && st.cash > 1e7) H.hqLaunch(st, 'CA'); if (i % 12 === 0 && i) H.hqCampaign(st, 'tv', '*', 1.5e6, 6); });
  console.log(`       average after 4 years: hands-off ${H.hqMoney(passive)} · expanding ${H.hqMoney(smart)}`);
  check(passive < 1e9, 'doing nothing does not build an empire', H.hqMoney(passive));
  check(smart > passive * 2, 'expanding and marketing grows the company far faster', H.hqMoney(smart));
  { const a = H.hqNew(rng(3)), b = H.hqNew(rng(3)); for (const t in b.products) H.hqSetMargin(b, 'AU', t, .12);
    for (let i = 0; i < 24; i++) { H.hqMonth(a, rng(100 + i), null, false); H.hqMonth(b, rng(100 + i), null, false); }
    check(b.last.users < a.last.users * .6, 'greedy margins drive players away', `${(a.last.users / 1e3).toFixed(0)}K at 3% vs ${(b.last.users / 1e3).toFixed(0)}K at 12%`); }
  console.log('\n-- decisions --');
  { const st = H.hqNew(rng(4)), c0 = st.cash; const r1 = H.hqLaunch(st, 'NZ'), due = st.countries.NZ.due;
    check(r1 === 'ok' && st.cash === c0 - 1.5e6 && st.countries.NZ.st === 'pending' && due >= 1, 'a licence costs its fee and takes time', `New Zealand in ${due} months`);
    for (let i = 0; i < due; i++) H.hqMonth(st, rng(i), null, false); check(st.countries.NZ.st === 'live', 'the market goes live when the licence lands');
    check(H.hqLaunch(st, 'US') === 'cash', 'you cannot launch a market you cannot afford'); }
  { const st = H.hqNew(rng(5)); st.cash = -5e6; const sh0 = st.shares, own0 = st.mine / st.shares; H.hqMonth(st, rng(1), null, false);
    check(st.bailouts === 1 && st.cash > 0 && st.shares > sh0 && st.mine / st.shares < own0, 'running out of cash triggers a bailout that dilutes you', `stake ${(own0 * 100).toFixed(1)}% -> ${(st.mine / st.shares * 100).toFixed(1)}%`); }
  { const st = H.hqNew(rng(6)); st.cash = 1e10; st.startups.push({ id: 'x', n: 'Test Labs', type: 'poker', home: 'UK', q: 90, users: 1e5, val: 1e7, age: 0 }); const c = st.cash; H.hqBuyStartup(st, 'x');
    check(st.products.poker && st.products.poker.q === 90 && Math.abs(c - st.cash - 1.35e7) < 1, 'buying a startup costs 1.35x its value and adds its product');
    const rv = st.rivals[3], price = rv.val * 1.4, c2 = st.cash; H.hqTakeover(st, rv.id); check(!rv.alive && Math.abs(c2 - st.cash - price) < 1, 'a takeover removes the rival for 1.4x its value'); }
  { const st = H.hqNew(rng(7)), sh = st.shares, pr = st.val / st.shares * .9; const n = H.hqRaise(st, 1e7); check(Math.abs(n - 1e7 / pr) < 1 && st.shares === sh + n, 'raising capital sells new shares at 90% of the price'); }
  { const st = H.hqNew(rng(8)); for (let i = 0; i < 12; i++) H.hqAdvance(st, rng(i), null); const pub = H.hqPublic(st);
    check(pub.news.length && pub.news.every(n => !/breach|fined|rescued|price war/i.test(n.t)) && typeof pub.val === 'number' && pub.countries >= 1, 'the public snapshot carries only public news', pub.news.length + ' headlines'); }
}
async function ui() {
  const playwright = require('playwright'); const b = await playwright.chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1440, height: 860 } }); pg.on('pageerror', e => errs.push('' + e));
  await pg.goto('file://' + FILE); await pg.waitForTimeout(800); await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.waitForTimeout(800);
  check(await pg.evaluate("$('modal').classList.contains('on')&&/Welcome/.test($('modalBody').textContent)"), 'a new company starts with the welcome brief');
  await pg.evaluate("$('modal').classList.remove('on')");
  const tabs = await pg.evaluate("(()=>{const out={};for(const t of['overview','world','products','brand','people','deals','finance','news']){TAB=t;render();out[t]=$('main').textContent.length}return out})()");
  check(Object.values(tabs).every(n => n > 200), 'all eight HQ screens render', JSON.stringify(tabs));
  const adv = await pg.evaluate("(()=>{const m0=st.month;for(let i=0;i<3;i++)monthEnd();$('modal').classList.remove('on');return{m:st.month-m0,hist:st.hist.length}})()");
  check(adv.m === 3 && adv.hist >= 3, 'months advance and history builds', JSON.stringify(adv));
  const act = await pg.evaluate("(()=>{TAB='world';SEL='NZ';render();document.querySelector('[data-launch=NZ]').click();const a=st.countries.NZ.st;TAB='people';render();document.querySelector('[data-hire]').click();const h=Object.values(st.execs).filter(Boolean).length;return{a,h}})()");
  check(act.a === 'pending' && act.h === 1, 'launching a market and hiring an executive from the screens', JSON.stringify(act));
  const saved = await pg.evaluate("save();JSON.parse(localStorage.getItem('stackHQ.v1')).month");
  await pg.reload(); await pg.waitForTimeout(600); check(await pg.evaluate('st.month') === saved, 'the company is saved and restored', 'month ' + saved);
  /* inside Stack */
  const cp = await b.newPage({ viewport: { width: 1440, height: 900 } }); cp.on('pageerror', e => errs.push('casino: ' + e)); cp.on('dialog', d => d.accept().catch(() => {}));
  await cp.goto('file://' + CASINO); await cp.waitForTimeout(700);
  await cp.evaluate("(()=>{const u='hq'+Date.now();S.players.push({user:u,name:'Boss',pw:hashPw(u,'pw'),bal:1000,created:Date.now(),wagered:50,won:40});S.cur=S.players.length-1;S.session=u;save(true);authRender();buildNav();buildTiles();renderBal()})()");
  check(await cp.evaluate("!document.querySelector('#side [data-g=hq]')"), 'Stack HQ is hidden from players');
  await cp.evaluate("ADM.on=true;buildNav();go('hq')"); await cp.waitForFunction('FG.hq.ready', null, { timeout: 30000 }); await cp.waitForTimeout(800);
  const pub = await cp.evaluate("(()=>{const w=FG.hq.frame.contentWindow;w.document.getElementById('modal').classList.remove('on');w.monthEnd();w.document.getElementById('modal').classList.remove('on');return{nav:!!document.querySelector('#side [data-g=hq]'),bridged:w.StackBridge===FrameBridges.hq,corp:!!S.corp,real:!!(S.corp&&S.corp.real&&S.corp.real.players>=1)}})()");
  check(pub.nav && pub.bridged && pub.corp && pub.real, 'for admins, HQ runs on the casino bridge and publishes the snapshot with real figures', JSON.stringify(pub));
  await cp.evaluate("go('lobby')");
  check(await cp.evaluate("(()=>{const t=$('corpStrip').textContent;return /SIMULATED/.test(t)&&/Paid out to players/.test(t)&&/NEWSROOM/i.test(t)&&/TRUST/i.test(t)})()"), 'the home page shows the newsroom, Stack World (labelled simulated), real payouts and trust & status');
  const recv = await cp.evaluate("(()=>{const keep=S.corp;S.corp=null;onAdminCmd({a:'corp',c:Object.assign({},keep,{val:123e6})});return S.corp&&S.corp.val})()");
  check(recv === 123e6, 'a player receiving the snapshot over the admin line stores and shows it');
  check(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
  await b.close();
}
(async () => { if (mode === 'sim') sim(); else await ui(); const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} checks passed`); process.exit(ok === results.length ? 0 : 1); })();
