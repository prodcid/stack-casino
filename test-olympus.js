#!/usr/bin/env node
/* test-olympus.js - Olympus Storm (tumble slot) checks.
   node test-olympus.js sim [rounds]  Node only: whole-game RTP, bought-bonus RTP, free-spin frequency,
                                      max-win cap, tumbles really settle, weights match the paytable
   node test-olympus.js ui            Playwright: losing spin, tumbles, orbs multiplying, a bought bonus
                                      with the wallet audited, autoplay, paytable, console errors */
const fs = require('fs'), path = require('path'), os = require('os');
const FILE = path.resolve(__dirname, 'stack-olympus.html');
const mode = process.argv[2] || 'sim';
const results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);
function loadCore() {
  const src = fs.readFileSync(FILE, 'utf8'), a = src.indexOf('/*==CORE==*/'), b = src.indexOf('/*==END CORE==*/');
  if (a < 0 || b < 0) throw new Error('core markers missing');
  const m = { exports: {} }; new Function('module', src.slice(a, b))(m); return m.exports;
}
function sim() {
  const G = loadCore(), N = +process.argv[3] || 3000000, R = G.mulberry(20260926);
  console.log(`\n-- whole game (${N.toLocaleString()} spins) --`);
  const a = { base: 0, scat: 0, fs: 0, tot: 0 }; let trig = 0, hit = 0, sq = 0, capped = 0, maxT = 0;
  for (let i = 0; i < N; i++) { const o = G.playRound(R); for (const k in a) a[k] += o[k]; trig += o.trig; hit += o.tot > 0; sq += o.tot * o.tot; if (o.tot > G.MAXWIN + 1e-9) capped++; maxT = Math.max(maxT, o.tumbles); }
  const rtp = a.tot / N, se = Math.sqrt(sq / N - rtp * rtp) / Math.sqrt(N);
  check(rtp > .955 && rtp < .99 && Math.abs(rtp - .975) < Math.max(.015, 3 * se), 'return to player', `${(100 * rtp).toFixed(2)}% ± ${(300 * se).toFixed(2)} (house rule 96-99%)`);
  console.log('       shares: ' + Object.entries(a).filter(([k]) => k !== 'tot').map(([k, v]) => `${k} ${(100 * v / N).toFixed(1)}%`).join(' · '));
  check(N / hit > 2.8 && N / hit < 4.2, 'any win', '1 in ' + (N / hit).toFixed(2));
  check(N / trig > 280 && N / trig < 450, 'free spins frequency', '1 in ' + (N / trig).toFixed(0));
  check(!capped, 'no round pays past the ' + G.MAXWIN + 'x cap');
  check(maxT < 60, 'tumble sequences always end', 'longest ' + maxT + ' tumbles');
  console.log('\n-- the bought bonus --');
  { let t = 0, s2 = 0, all4 = true; const M = 150000; for (let i = 0; i < M; i++) { const o = G.playRound(R, true); t += o.tot; s2 += o.tot * o.tot; if (!o.trig) all4 = false; }
    const r = t / M / G.BUY_X, e = Math.sqrt(s2 / M - (t / M) ** 2) / Math.sqrt(M) / G.BUY_X;
    check(all4, 'every bought spin starts the free spins');
    check(Math.abs(r - .97) < Math.max(.03, 3 * e), `buy at ${G.BUY_X}x returns about 97%`, `${(100 * r).toFixed(1)}% ± ${(300 * e).toFixed(1)}`); }
  { let bad = 0; for (let i = 0; i < 20000; i++) { const b = G.spinBuy(R); if (G.countOf(b.start, G.SCAT) !== 4) bad++; } check(!bad, 'a bought board holds exactly 4 scatters', bad + ' wrong'); }
  console.log('\n-- the drop is honest --');
  { const c = Array(11).fill(0); let n = 0; for (let i = 0; i < 20000; i++) { const b = G.fillBoard(R, G.W); for (const col of b) for (const x of col) { c[x.s]++; n++; } }
    const tw = G.W.reduce((a, b) => a + b, 0); let worst = 0; c.forEach((v, i) => { const p = G.W[i] / tw, z = Math.abs(v / n - p) / Math.sqrt(p * (1 - p) / n); worst = Math.max(worst, z); });
    check(worst < 5, 'every cell is drawn from the published weights', 'max |z| ' + worst.toFixed(2)); }
  { let ok = true; for (let i = 0; i < 5000; i++) { const o = G.spinBase(R); for (const st of o.steps) for (const w of st.wins) if (w.n < 8) ok = false; if (G.findWins(o.end).length) ok = false; } check(ok, 'only 8+ pays, and the final board never has a win left on it'); }
}
async function ui() {
  let playwright; try { playwright = require('playwright'); } catch { console.error('playwright missing'); process.exit(2); }
  const out = path.join(os.tmpdir(), 'stack-olympus-shots'); fs.mkdirSync(out, { recursive: true });
  const b = await playwright.chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => errs.push('' + e)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + FILE); await pg.waitForTimeout(1000);
  const shot = n => pg.screenshot({ path: path.join(out, n + '.png') });
  await pg.evaluate("S.bal=10000;S.turbo=true;drawBal()"); await shot('idle');
  const force = async cond => pg.evaluate(`(()=>{const o=window.__sb||(window.__sb=spinBase);spinBase=R=>{let r,g=0;do r=o(R);while(!(${cond})&&g++<2e6);spinBase=o;window.__last=r;return r}})()`);
  const play = async (name, click, cost) => {
    const before = await pg.evaluate('bal()'); await click(); const t0 = Date.now();
    while (Date.now() - t0 < 240000) { await pg.waitForTimeout(300); await pg.evaluate("if($('big').classList.contains('on'))$('big').click()"); if (await pg.evaluate('!busy')) break; }
    const r = await pg.evaluate('({busy,bal:bal(),last:lastWin,bet:BET()})');
    check(!r.busy && Math.abs(r.bal - (before - cost(r.bet) + r.last)) < .005, `${name}: plays to the end and the wallet adds up`, `paid ${r.last.toFixed(2)} · balance ${before.toFixed(2)} -> ${r.bal.toFixed(2)}`); return r;
  };
  const spin = () => pg.click('#spinbtn');
  console.log('\n-- base game --');
  await force('r.win===0&&!r.fs'); await play('a losing spin', spin, b => b);
  check(await pg.evaluate('OB.size===30&&[...OB.values()].every(o=>o.st==="rest")'), 'the board settles to 30 symbols');
  await force('r.steps.length>=2&&r.orbs===0&&!r.fs'); await play('a tumble chain', spin, b => b); await shot('tumble');
  await force('r.tw>0&&r.orbs>0&&!r.fs'); const m = await play('orbs multiply the tumble', spin, b => b);
  check(Math.abs(m.last - Math.round(Math.min(5000, (await pg.evaluate('__last.tw*__last.mult'))) * m.bet * 100) / 100) < .02, 'the win shown is tumble win × orb total');
  console.log('\n-- bought bonus --');
  await play('buy free spins', async () => { await pg.click('#buyBtn'); await pg.waitForTimeout(300); await shot('buy'); await pg.click('#buyYes'); }, b => 115 * b);
  check(await pg.evaluate('S.stats.fs>=1&&S.stats.buys===1'), 'the bonus ran and was recorded');
  await pg.click('#infoBtn'); await pg.waitForTimeout(300); await shot('info'); check(await pg.evaluate("document.querySelectorAll('#infoBody .pr').length===11"), 'paytable shows every symbol'); await pg.click('[data-close="info"]');
  console.log('\n-- autoplay --');
  await pg.click('#autoBtn'); await pg.click('[data-a="10"]');
  await pg.waitForFunction('auto===0&&!busy', null, { timeout: 240000 }).catch(() => {});
  check(await pg.evaluate('auto===0&&!busy'), 'ten autoplay spins run and stop');
  await b.close();
  check(!errs.length, 'no console errors', errs.slice(0, 4).join(' | '));
  console.log('\nscreens: ' + out);
}
(async () => {
  if (mode === 'sim') sim(); else if (mode === 'ui') await ui(); else { console.log('usage: node test-olympus.js sim|ui'); process.exit(2); }
  const bad = results.filter(x => !x).length; console.log(`\n${results.length - bad}/${results.length} checks passed`); process.exit(bad ? 1 : 0);
})();
