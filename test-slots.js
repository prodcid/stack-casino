#!/usr/bin/env node
/* test-slots.js - Dragon Stacks (the slot machine) checks.
   node test-slots.js sim [rounds]  Node only: RTP of the whole game incl. every feature, each feature's
                                    share, free-game options balanced, gamble exactly fair, the wheel and
                                    envelopes uniform, strips never show two different specials on a reel
   node test-slots.js ui            Playwright: every feature forced once and played to the end with the
                                    wallet audited after each round, gamble, big win, console errors
   Screenshots go to <tmp>/stack-slots-shots. */
const fs = require('fs'), path = require('path'), os = require('os');
const FILE = path.resolve(__dirname, 'stack-slots.html');
const mode = process.argv[2] || 'sim';
const results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);
function loadCore() {
  const src = fs.readFileSync(FILE, 'utf8'), a = src.indexOf('/*==CORE==*/'), b = src.indexOf('/*==END CORE==*/');
  if (a < 0 || b < 0) throw new Error('core markers missing in stack-slots.html');
  const m = { exports: {} }; new Function('module', src.slice(a, b))(m); return m.exports;
}
function sim() {
  const G = loadCore(), N = +process.argv[3] || 4000000, R = G.mulberry(20260925);
  console.log(`\n-- whole game (${N.toLocaleString()} rounds, random free-game picks) --`);
  const a = { base: 0, scat: 0, fs: 0, hs: 0, wheel: 0, env: 0, tot: 0 }, c = { fs: 0, hs: 0, wheel: 0, env: 0, hit: 0 }; let sq = 0;
  for (let i = 0; i < N; i++) { const o = G.playRound(R); for (const k in a) a[k] += o[k]; for (const k of ['fs', 'hs', 'wheel', 'env']) if (o.trig[k]) c[k]++; if (o.tot > 0) c.hit++; sq += o.tot * o.tot; }
  const rtp = a.tot / N, se = Math.sqrt(sq / N - rtp * rtp) / Math.sqrt(N);
  check(Math.abs(rtp - .972) < Math.max(.012, 3 * se), 'return to player', `${(100 * rtp).toFixed(2)}% ± ${(300 * se).toFixed(2)} (house rule 96-99%)`);
  check(rtp > .955 && rtp < .99, 'inside the house band', (100 * rtp).toFixed(2) + '%');
  console.log('       shares: ' + Object.entries(a).filter(([k]) => k !== 'tot').map(([k, v]) => `${k} ${(100 * v / N).toFixed(1)}%`).join(' · '));
  const freq = k => N / c[k];
  check(freq('hit') > 3 && freq('hit') < 4.5, 'any win', '1 in ' + freq('hit').toFixed(2));
  check(freq('hs') > 120 && freq('hs') < 200, 'Hold & Spin frequency', '1 in ' + freq('hs').toFixed(0));
  check(freq('fs') > 110 && freq('fs') < 180, 'free games frequency', '1 in ' + freq('fs').toFixed(0));
  check(freq('env') > 120 && freq('env') < 200, 'envelope frequency', '1 in ' + freq('env').toFixed(0));
  check(freq('wheel') > 380 && freq('wheel') < 650, 'wheel frequency', '1 in ' + freq('wheel').toFixed(0));

  console.log('\n-- the three free-game choices are worth about the same --');
  const ev = G.FS_OPT.map(opt => { let t = 0; const M = 60000; for (let i = 0; i < M; i++) { let n = opt.n, g = 0; while (n > 0 && g++ < 300) { n--; const f = G.spinFree(R, opt); t += f.win; n += f.retrig; } } return t / M; });
  const mx = Math.max(...ev), mn = Math.min(...ev);
  check(mx / mn < 1.12, 'Jade / Ruby / Gold within 12%', ev.map((v, i) => G.FS_OPT[i].k + ' ' + v.toFixed(1) + 'x').join(' · '));

  console.log('\n-- honest draws --');
  { let red = 0, s = [0, 0, 0, 0]; const M = 400000; for (let i = 0; i < M; i++) { const k = G.gambleCard(R); red += k.red; s[k.suit]++; }
    check(Math.abs(red / M - .5) < .004, 'gamble colour is 50/50 (pays 2x, so exactly neutral)', (100 * red / M).toFixed(2) + '% red');
    check(s.every(v => Math.abs(v / M - .25) < .004), 'gamble suit is 25% each (pays 4x)', s.map(v => (100 * v / M).toFixed(1)).join(' / ')); }
  { const h = Array(G.WHEEL.length).fill(0), M = 200000; for (let i = 0; i < M; i++) h[G.spinWheel(R).i]++; const e = M / h.length;
    check(h.every(v => Math.abs(v - e) < 5 * Math.sqrt(e)), 'wheel lands on every segment equally', `${Math.min(...h)}..${Math.max(...h)} per segment`); }
  { const b = G.envBoard(R).slice().sort().join(), want = G.ENV_BOARD.slice().sort().join(); check(b === want, 'envelope board holds exactly the advertised envelopes'); }
  { let bad = 0; for (const set of [G.STRIPS, G.FSTRIPS]) for (const st of set) for (let i = 0; i < st.length; i++) { const w = [st[i], st[(i + 1) % st.length], st[(i + 2) % st.length]].filter(s => s >= G.LAN); if (new Set(w).size < w.length && !w.every(s => s === G.PRL)) bad++; if (new Set(w).size > 1) bad++; }
    check(!bad, 'a reel never shows two specials (bar stacked pearls)', bad + ' bad windows'); }
  { const d = {}; G.STRIPS.forEach((s, r) => s.forEach(x => { if (x === G.WILD) d['w' + r] = 1; if (x === G.GONG) d['g' + r] = 1; if (x === G.ENV) d['e' + r] = 1; }));
    check(!d.w0 && !d.w4 && d.w1 && d.w3 && d.g0 && d.g4 && !d.g2 && d.e0 && d.e2 && d.e4 && !d.e1, 'symbols only sit on the reels the paytable says', JSON.stringify(d)); }
  console.log('\n-- near misses happen for real --');
  { let p5 = 0, l2 = 0; const M = 300000; for (let i = 0; i < M; i++) { const b = G.spinBase(R); if (Object.keys(b.pv).length === 5) p5++; if (b.lan.length === 2) l2++; }
    check(M / p5 < 70, '5 pearls (one short of Hold & Spin)', '1 in ' + (M / p5).toFixed(0));
    check(M / l2 < 25, '2 lanterns (one short of free games)', '1 in ' + (M / l2).toFixed(0)); }
}
async function ui() {
  let playwright; try { playwright = require('playwright'); } catch { console.error('playwright missing'); process.exit(2); }
  const out = path.join(os.tmpdir(), 'stack-slots-shots'); fs.mkdirSync(out, { recursive: true });
  const b = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }), errs = [];
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => errs.push('' + e)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + FILE); await pg.waitForTimeout(1200);
  const shot = n => pg.screenshot({ path: path.join(out, n + '.png') });
  await pg.evaluate("S.bal=10000;S.turbo=true;drawBal()"); await shot('idle');
  // force the next spin: keep drawing real spins until one matches
  const force = async cond => pg.evaluate(`(()=>{const o=window.__sb||(window.__sb=spinBase);spinBase=R=>{let r,g=0;do r=o(R);while(!(${cond})&&g++<2e6);spinBase=o;window.__last=r;return r}})()`);
  const round = async (name, cond, drive) => {
    await force(cond); const before = await pg.evaluate('bal()'); await pg.click('#spinbtn');
    const t0 = Date.now(); let n = 0;
    while (Date.now() - t0 < 120000) { await pg.waitForTimeout(250); if (drive) await drive(n++); if (await pg.evaluate('!busy')) break; }
    const r = await pg.evaluate(`({busy,bal:bal(),last:lastWin,bet:BET(),win:__last.win})`);
    const ok = !r.busy && Math.abs(r.bal - (before - r.bet + r.last)) < .005;
    check(ok, `${name}: plays to the end and the wallet adds up`, `bet ${r.bet} · paid ${r.last.toFixed(2)} · balance ${before.toFixed(2)} -> ${r.bal.toFixed(2)}`);
    return r;
  };
  const clickIf = async sel => pg.evaluate(q => { const e = document.querySelector(q); if (e && e.offsetParent !== null) e.click(); }, sel);
  const feat = async () => { await clickIf('#fsPick.on .fsc'); await clickIf('#wheelOv.on #wheelGo:not([disabled])'); await clickIf('#envOv.on #envAuto:not([disabled])'); };
  console.log('\n-- base game --');
  await round('a losing spin', 'r.win===0&&!r.breath&&!Object.values(r.trig).some(x=>x)');
  await round('a small win', 'r.win>=1.2&&r.win<5&&!r.breath&&!Object.values(r.trig).some(x=>x)'); await shot('win');
  await round('a win under the bet (shown as money back, no fanfare)', 'r.win>0&&r.win<1&&!r.breath&&!Object.values(r.trig).some(x=>x)');
  check(await pg.evaluate('HUD.under===true'), 'under-bet win is flagged, not celebrated');
  console.log('\n-- features --');
  let seen = false; pg.on('console', () => {});
  const bigSeen = pg.waitForFunction("document.getElementById('big').classList.contains('on')", null, { timeout: 120000 }).then(() => true, () => false);
  await round('big win', 'r.win>=20&&!Object.values(r.trig).some(x=>x)');
  check(await bigSeen, 'a 15x+ win opens the big-win screen');
  await round('Dragon Breath', 'r.breath&&!Object.values(r.trig).some(x=>x)');
  await round('Hold & Spin', 'r.trig.hs&&!r.trig.fs&&!r.trig.wheel&&!r.trig.env', async n => { if (n === 14) await shot('hold'); });
  await round('Free games', 'r.trig.fs&&!r.trig.hs&&!r.trig.wheel&&!r.trig.env', async n => { await feat(); if (n === 16) await shot('free'); });
  await round('Dragon Wheel', 'r.trig.wheel&&!r.trig.fs&&!r.trig.hs&&!r.trig.env', async n => { await feat(); if (n === 12) await shot('wheel'); });
  await round('Lucky Envelopes', 'r.trig.env&&!r.trig.fs&&!r.trig.hs&&!r.trig.wheel', async n => { await feat(); if (n === 14) await shot('env'); });
  console.log('\n-- gamble --');
  await pg.evaluate('lastWin=10;$("gamble").classList.add("on")'); const g0 = await pg.evaluate('bal()');
  await pg.click('#gamble'); await pg.waitForTimeout(300); check(await pg.evaluate('bal()') === g0 - 10, 'gamble takes the win back into play', `${g0} -> ${await pg.evaluate('bal()')}`);
  await shot('gamble'); await pg.click('[data-g="red"]'); await pg.waitForTimeout(2600);
  const gs = await pg.evaluate('({open:$("gambleOv").classList.contains("on"),amt:GB?GB.amt:0,bal:bal(),card:S.hist[S.hist.length-1]})');
  if (gs.open) { await pg.click('#gTake'); await pg.waitForTimeout(300); const b2 = await pg.evaluate('bal()'); check(gs.card.red && Math.abs(b2 - (g0 + 10)) < .005, 'red card: 2x collected', `${g0} -> ${b2}`); }
  else check(!gs.card.red && Math.abs(gs.bal - (g0 - 10)) < .005, 'black card: the stake is lost', `${g0} -> ${gs.bal}`);
  await pg.click('#infoBtn'); await pg.waitForTimeout(300); await shot('info'); check(await pg.evaluate("document.querySelectorAll('#infoBody .pr').length>=14"), 'paytable shows every symbol'); await pg.click('[data-close="info"]');
  console.log('\n-- autoplay --');
  await pg.evaluate("S.bal=1000;drawBal()"); await pg.click('#autoBtn'); await pg.click('[data-a="10"]');
  await pg.waitForFunction('auto===0&&!busy', null, { timeout: 180000 }).catch(() => {});
  check(await pg.evaluate('auto===0&&!busy'), 'ten autoplay spins run and stop', 'spins so far ' + await pg.evaluate('S.stats.spins'));
  await b.close();
  check(!errs.length, 'no console errors', errs.slice(0, 4).join(' | '));
  console.log('\nscreens: ' + out);
}
(async () => {
  if (mode === 'sim') sim(); else if (mode === 'ui') await ui(); else { console.log('usage: node test-slots.js sim|ui'); process.exit(2); }
  const bad = results.filter(x => !x).length; console.log(`\n${results.length - bad}/${results.length} checks passed`); process.exit(bad ? 1 : 0);
})();
