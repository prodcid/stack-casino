#!/usr/bin/env node
/* test-markets.js - Stack Markets v2 checks.
   node test-markets.js sim   Node only: every product is priced from the live model and returns inside the
                              house band (96-99%) when played out on that same model, from many random market
                              states (pending company news, market calls, flash moves): leveraged trades,
                              targets, up/down, options, predictions, IPO openings, and holding shares
   node test-markets.js ui    Playwright: every section renders; a trade, an investment, an option, a
                              prediction and an IPO order go through on the wallet; everything is saved and
                              restored; no console errors */
const fs = require('fs'), path = require('path');
const FILE = path.resolve(__dirname, 'stack-markets.html');
const mode = process.argv[2] || 'sim', results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);
function core() { const src = fs.readFileSync(FILE, 'utf8'), m = { exports: {} }; new Function('module', src.slice(src.indexOf('/*==CORE==*/'), src.indexOf('/*==END CORE==*/')))(m); return m.exports; }
const pct = x => (x * 100).toFixed(2) + '%';
function sim() {
  const K = core(), { DT, STOCKS, HOUSE } = K, bySym = s => STOCKS.find(S => S.sym === s);
  /* a random live state: run the market a random while so news and market calls are pending at random times */
  const state = S => { const st = { p: S.p0, pend: null }, G = { pend: null }, n = 40 + Math.floor(Math.random() * 400); for (let k = 0; k < n; k++) { K.applyG(K.stepGlobal(G), S, st); K.stepStock(S, st); } return { st, G }; };
  const clone = (st, G) => ({ st: { p: st.p, pend: st.pend ? { t: st.pend.t } : null }, G: { pend: G.pend ? { t: G.pend.t, e: G.pend.e } : null } });
  const walk = (S, s0, N, each) => { const { st, G } = clone(s0.st, s0.G), p0 = st.p; for (let k = 1; k <= N; k++) { K.applyG(K.stepGlobal(G), S, st); K.stepStock(S, st); if (each && each(st.p / p0, k)) return st.p / p0; } return st.p / p0; };
  const band = r => r >= .96 && r <= .99;
  console.log('\n-- leveraged trades (fee from the model, played out on the model) --');
  for (const [sym, dir, L, T, tp, sl] of [['GLDN', 1, 20, 30, 0, 0], ['AURA', -1, 10, 120, 0, 0], ['VLTC', 1, 5, 60, 1, .5], ['SHRK', -1, 3, 30, 0, 0], ['MOON', 1, 3, 60, 3, 0], ['AUDUSD', 1, 50, 15, 0, 0]]) {
    const S = bySym(sym), N = T / DT; let paid = 0, got = 0;
    for (let s = 0; s < 36; s++) { const s0 = state(S), q = K.mcTrade(S, s0.st, s0.G, { dir, L, N, tp, sl }, 900), fee = K.feeFor(1000, q.ev) / 1000;
      for (let j = 0; j < 300; j++) { let V = 1; walk(S, s0, N, (r, k) => { V = 1 + L * dir * (r - 1); if (V <= 0) { V = 0; return 1; } if (tp && V >= 1 + tp) return 1; if (sl && V <= 1 - sl) return 1; return 0; }); paid += 1 + fee; got += V; } }
    check(band(got / paid), `${sym} ${dir > 0 ? 'long' : 'short'} ${L}x ${T}s${tp ? ' TP+' + tp * 100 + '%' : ''}${sl ? ' SL-' + sl * 100 + '%' : ''}`, pct(got / paid));
  }
  console.log('\n-- targets and up/down --');
  for (const [sym, rel, T] of [['NVRX', .02, 30], ['OIL', -.03, 60], ['SHRK', .1, 60], ['STK', .005, 30]]) {
    const S = bySym(sym), N = T / DT; let paid = 0, got = 0;
    /* a target pays rarely, so each live quote (4000 paths) is scored against the true chance from 40,000 fresh paths */
    for (let s = 0; s < 24; s++) { const s0 = state(S), m = K.multFor(K.mcTarget(S, s0.st, s0.G, rel, N, 4000)); if (m < 1.05 || m > 100) continue;
      paid++; got += m * K.mcTarget(S, s0.st, s0.G, rel, N, 40000); }
    check(band(got / paid), `target ${sym} ${rel > 0 ? '+' : ''}${rel * 100}% in ${T}s`, pct(got / paid));
  }
  for (const [sym, T] of [['PXFX', 30], ['NBLA', 120], ['GLDN', 15]]) {
    const S = bySym(sym), N = T / DT; let paid = 0, got = 0;
    for (let s = 0; s < 40; s++) { const s0 = state(S), P = K.mcUpDown(S, s0.st, s0.G, N, 3000), mu = Math.min(100, K.multFor(P)), md = Math.min(100, K.multFor(1 - P));
      for (let j = 0; j < 300; j++) { const r = walk(S, s0, N); paid += 2; if (r > 1) got += mu; if (r < 1) got += md; } }
    check(band(got / paid), `up/down ${sym} ${T}s (both sides)`, pct(got / paid));
  }
  console.log('\n-- options (chain pricing vs a full simulation) --');
  { let worst = 0, paid = 0, got = 0, cnt = 0;
    for (const [sym, T] of [['STK', 60], ['VLTC', 120], ['SHRK', 60], ['OIL', 300], ['AURA', 30], ['NVRX', 120]]) {
      const S = bySym(sym), N = T / DT;
      for (let s = 0; s < 6; s++) { const s0 = state(S), typ = Math.sqrt(S.sig * S.sig * T + S.jr * T * S.js * S.js + (S.evRate || 0) * T * S.evX * S.evX);
        const Ks = [-1.5, -.5, 0, .5, 1.5].map(z => s0.st.p * Math.exp(z * typ)), ch = K.chainFair(S, s0.st, s0.G, Ks, N, 3000);
        const outs = []; for (let j = 0; j < 6000; j++) outs.push(s0.st.p * walk(S, s0, N));
        for (const o of ch) for (const d of [1, -1]) { const fair = d > 0 ? o.c : o.p; if (fair < s0.st.p * 5e-4) continue; const pay = outs.map(x => Math.max(0, d * (x - o.K))), mc = pay.reduce((a, x) => a + x, 0) / pay.length;
          const se = Math.sqrt(pay.reduce((a, x) => a + (x - mc) * (x - mc), 0)) / pay.length;
          paid += fair / HOUSE; got += mc; cnt++; worst = Math.max(worst, Math.abs(fair - mc) / (se + .02 * mc)); } } }
    check(band(got / paid), `options return (${cnt} contracts across 6 markets, 5 strikes, calls + puts)`, pct(got / paid));
    check(worst < 4, 'each premium matches the simulated fair value (within noise + 2%)', 'worst ' + worst.toFixed(2) + ' noise units'); }
  console.log('\n-- prediction contracts --');
  { let paid = 0, got = 0, maxErr = 0;
    for (const sym of ['STK', 'GLDN', 'OIL', 'AUDUSD', 'VLTC', 'NVRX']) { const S = bySym(sym);
      for (let s = 0; s < 12; s++) { const s0 = state(S), T = [60, 120, 300][s % 3], N = T / DT, L = s0.st.p * Math.exp((Math.random() - .5) * 1.2 * Math.sqrt(S.sig * S.sig * T + S.jr * T * S.js * S.js)), P = K.pAbove(S, s0.st, s0.G, L, N, 3000);
        let up = 0; const n = 4000; for (let j = 0; j < n; j++) if (s0.st.p * walk(S, s0, N) > L) up++; maxErr = Math.max(maxErr, Math.abs(P - up / n));
        for (const [sp, won] of [[P, up / n], [1 - P, 1 - up / n]]) if (K.canBuy(sp)) { paid += K.yesAsk(sp); got += won; } } }
    check(maxErr < .035, 'live quotes match the simulated chance', 'worst gap ' + (maxErr * 100).toFixed(1) + ' points');
    check(band(got / paid), 'price contracts return in the band (YES and NO)', pct(got / paid));
    const ev = .5 / K.yesAsk(.5); check(band(ev), 'a 50/50 event contract costs ' + (K.yesAsk(.5) * 100).toFixed(1) + 'c', pct(ev));
    let worstB = 1, worstT = 0; for (let P = K.P_MIN; P <= K.P_MAX + 1e-9; P += .001) { worstB = Math.min(worstB, P / K.yesAsk(P)); worstT = Math.max(worstT, P / K.yesAsk(P)); }
    check(worstB >= .965 && worstT <= .97 + 1e-9, 'every buyable price returns 96.5-97% (rounding included)', pct(worstB) + ' to ' + pct(worstT));
    check(K.yesBid(.6) < .6 && K.yesAsk(.6) > .6, 'selling back pays below the fair price, buying costs above it'); }
  console.log('\n-- IPOs and holding shares --');
  { let s = 0; const n = 400000; for (let i = 0; i < n; i++) s += K.ipoOpen(20) / 20; const m = s / n;
    check(Math.abs(m - K.IPO_MEAN) < .004, 'IPOs open at 98.5% of the IPO price on average', pct(m));
    check(band(m * (1 - K.SPREAD)), 'flipping an IPO at the bid returns', pct(m * (1 - K.SPREAD))); }
  for (const sym of ['AURA', 'GLDN', 'NVRX']) { const S = bySym(sym), T = 540, N = T / DT; let tot = 0; const n = 3000;
    for (let j = 0; j < n; j++) { const s0 = state(S); let r = walk(S, s0, N); tot += r * Math.pow(1 - (S.div || 0), -T / 180) ; }
    check(Math.abs(tot / n - 1) < .02, `${sym}: holding is fair (price${S.div ? ' + dividends' : ''} averages what you paid)`, pct(tot / n)); }
  check(band((1 - K.SPREAD) / (1 + K.SPREAD)), 'buying then selling costs the 3% spread', pct((1 - K.SPREAD) / (1 + K.SPREAD)));
  console.log('\n-- stakes --');
  check(['STK', 'GLDN', 'OIL', 'AUDUSD', 'AURA'].every(s => bySym(s).maxStake === 1e6) && bySym('PNYM').maxStake === 2e4 && STOCKS.filter(S => !/STK|GLDN|OIL|AUDUSD|AURA|PNYM/.test(S.sym)).every(S => S.maxStake === 1e5), 'max stakes: $1M majors, $100K others, $20K Penny Mining');
}
async function ui() {
  const playwright = require('playwright'); const b = await playwright.chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1600, height: 900 } }); pg.on('pageerror', e => errs.push('' + e));
  await pg.goto('file://' + FILE); await pg.waitForTimeout(500); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.waitForTimeout(1500);
  check(await pg.evaluate("!!document.querySelector('.help')"), 'first visit shows the welcome');
  await pg.click('#helpGo'); await pg.evaluate('credit(5e6)');
  const secs = await pg.evaluate("(()=>{const o={};for(const k of['term','port','opt','pred','ipo','pulse','guide']){showSec(k);o[k]=document.querySelector('.sec.on').textContent.length}showSec('term');return o})()");
  check(Object.values(secs).every(n => n > 150), 'all seven sections render', JSON.stringify(secs));
  check(await pg.evaluate("[...document.querySelectorAll('#chips,.chips button')].some(b=>b.textContent==='$1M')&&STOCKS[0].maxStake===1e6"), 'stake chips go up to $1M');
  await pg.evaluate('select(1)'); await pg.click('[data-c="100000"]'); await pg.click('#levs [data-v="10"]'); await pg.waitForTimeout(300);
  const b0 = await pg.evaluate('getBal()'); await pg.click('#go'); await pg.waitForTimeout(200);
  const tr = await pg.evaluate('({n:positions.length,cost:positions[0]&&positions[0].cost,stake:positions[0]&&positions[0].stake,bal:getBal()})');
  check(tr.n === 1 && tr.stake === 1e5 && Math.abs(b0 - tr.bal - tr.cost) < .01, 'a $100K 10x trade takes stake + fee from the wallet', JSON.stringify(tr));
  const co = await pg.evaluate("(()=>{const b=getBal(),v=valueOf(positions[0]);cashOut(positions[0].id);return{n:positions.length,got:+(getBal()-b).toFixed(2),v:+v.toFixed(2)}})()");
  check(co.n === 0 && Math.abs(co.got - co.v) < .02, 'cashing out pays the live value', JSON.stringify(co));
  await pg.evaluate('select(4)'); await pg.click('[data-t="invest"]'); await pg.click('[data-ic="10000"]'); await pg.waitForTimeout(200); await pg.click('#go');
  const inv = await pg.evaluate("({h:save.port.AURA,ask:askOf(M[4].p)})");
  check(inv.h && inv.h.cost === 1e4 && Math.abs(inv.h.q * inv.ask - 1e4) / 1e4 < .01, 'investing buys shares at the ask', `${inv.h && inv.h.q.toFixed(2)} AURA`);
  await pg.evaluate("showSec('opt')"); await pg.waitForTimeout(300); await pg.click('#chain td[data-d="1"]'); await pg.waitForTimeout(300); await pg.click('[data-oc="10000"]'); await pg.waitForTimeout(200);
  const ob = await pg.evaluate('getBal()'); await pg.click('#oGo'); await pg.waitForTimeout(200);
  const op = await pg.evaluate('({n:OPTS.length,o:OPTS[0],bal:getBal()})');
  check(op.n === 1 && op.o.cost === 1e4 && Math.abs(op.o.units * op.o.prem - 1e4) < .01 && Math.abs(ob - op.bal - 1e4) < .01, 'buying a call: stake / premium = units', `${op.o && op.o.units.toFixed(1)} units at $${op.o && op.o.prem.toFixed(2)}`);
  const ex = await pg.evaluate("(()=>{const o=OPTS[0],b=getBal();T=o.exp;resolveOpts();return{n:OPTS.length,paid:+(getBal()-b).toFixed(2),iv:+(o.units*Math.max(0,M[o.i].p-o.K)).toFixed(2)}})()");
  check(ex.n === 0 && Math.abs(ex.paid - ex.iv) < .02, 'an option settles to units x (price - strike)', JSON.stringify(ex));
  await pg.evaluate("showSec('pred')"); await pg.waitForTimeout(300);
  await pg.click('[data-buy][data-side="1"]:not([disabled])'); const pr = await pg.evaluate("(()=>{const o=PRED_OWN[0],c=PRED.find(x=>x.id===o.cid);return{o,kind:c.kind}})()");
  check(pr.o && pr.o.cost === 1000 && pr.o.n > 1000, 'a prediction buys $1 contracts below $1 each', `${pr.o.n.toFixed(0)} YES (${pr.kind})`);
  const ps = await pg.evaluate("(()=>{const o=PRED_OWN[0],c=PRED.find(x=>x.id===o.cid),b=getBal();settleContract(c,true);return{left:PRED_OWN.length,paid:+(getBal()-b).toFixed(2),n:+o.n.toFixed(2)}})()");
  check(ps.left === 0 && Math.abs(ps.paid - ps.n) < .02, 'a YES that comes true pays $1 a contract', JSON.stringify(ps));
  await pg.evaluate("IPO.t=1;showSec('ipo')"); await pg.waitForTimeout(1600);
  await pg.evaluate("$('iAmt').value=20000"); await pg.click('#iGo');
  const sym = await pg.evaluate('IPO.d.sym'); await pg.evaluate('IPO.t=1'); await pg.waitForTimeout(7500);
  const ip = await pg.evaluate(`({st:IPO.st,listed:byS('${sym}'),h:save.port['${sym}'],ipo:IPO.last.d.ipo})`);
  check(ip.st === 'soon' && ip.listed > 0 && ip.h && Math.abs(ip.h.q * ip.ipo - 2e4) < .01, 'an IPO order becomes shares at the IPO price and the stock lists', `${sym}: ${ip.h && ip.h.q.toFixed(0)} shares`);
  await pg.evaluate("select(1)"); await pg.click('[data-t="trade"]'); await pg.click('#go'); await pg.waitForTimeout(200);
  await pg.evaluate("showSec('opt')"); await pg.waitForTimeout(300); await pg.click('#chain td[data-d="-1"]'); await pg.waitForTimeout(300); await pg.click('#oGo');
  const before = await pg.evaluate("snapshot();persist();({pos:positions.map(o=>o.stake),opts:OPTS.length,port:Object.keys(save.port).sort().join(),n:STOCKS.length,p:M[4].p})");
  await pg.reload(); await pg.waitForTimeout(1500);
  const after = await pg.evaluate("({pos:positions.map(o=>o.stake),opts:OPTS.length,port:Object.keys(save.port).sort().join(),n:STOCKS.length,p:M[4].p})");
  check(JSON.stringify(before.pos) === JSON.stringify(after.pos) && before.opts === after.opts && before.port === after.port && before.n === after.n && Math.abs(before.p / after.p - 1) < .02,
    'bets, options, holdings, IPO listings and prices survive a reload', JSON.stringify(after));
  for (const k of ['port', 'pulse']) { await pg.evaluate(`showSec('${k}')`); await pg.waitForTimeout(1100); }
  check(await pg.evaluate("document.querySelectorAll('#pfHold tr').length>=3"), 'the portfolio lists the holdings');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
  await b.close();
}
(async () => { if (mode === 'sim') sim(); else await ui(); const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0); })();
