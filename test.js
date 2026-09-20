#!/usr/bin/env node
/* test.js — browser regression for the single-file build.
   node test.js            everything
   node test.js solo       single-player games + tickets + cosmetics
   node test.js admin      admin portal: stats, user table, suspend, audit
   node test.js mp         two-window multiplayer, all party tables
   node test.js rtp        maths only (fast, no clicking)
   node test.js strip      The Strip full game + money-conservation audit
   Needs: npm i -D playwright && npx playwright install chromium
*/
const path = require('path');
const FILE = process.env.STACK_FILE || 'stack-casino.html';
const URL = 'file://' + path.resolve(FILE);
let playwright;
try { playwright = require('playwright'); }
catch { console.error('x  playwright missing.  npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const results = [];
const pass = (n, d = '') => { results.push([true, n, d]); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push([false, n, d]); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

/* PeerJS stand-in: wires two pages straight to each other, no network. */
const MOCK = `
window.Peer=class{constructor(id){this.id=id||('anon'+Math.random());this.h={};window.__peer=this;setTimeout(()=>this.h.open&&this.h.open(this.id),20)}
 on(e,f){this.h[e]=f} connect(){const c=window.__mk();window.__conn=c;setTimeout(()=>window.__netOut(JSON.stringify({type:'connect'})),20);return c} destroy(){} reconnect(){}};
window.__mk=()=>({open:false,h:{},on(e,f){this.h[e]=f},send(d){window.__netOut(JSON.stringify({type:'data',d}))},close(){}});
window.__netIn=(s)=>{const m=JSON.parse(s);
 if(m.type==='connect'){const c=window.__mk();window.__conn=c;window.__peer.h.connection(c);setTimeout(()=>{c.open=true;c.h.open&&c.h.open();window.__netOut(JSON.stringify({type:'opened'}))},15)}
 else if(m.type==='opened'){const c=window.__conn;c.open=true;c.h.open&&c.h.open()}
 else if(m.type==='data'){const c=window.__conn;c&&c.h.data&&c.h.data(m.d)}};`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* The app is gated behind login. Sign each page in with its own account so that
   multiplayer tests use two genuinely distinct identities. */
async function signIn(pg, user) {
  await pg.waitForSelector('#authGate.show', { timeout: 8000 });
  await pg.click('[data-am="signup"]');
  await pg.fill('#auU', user);
  await pg.fill('#auP', 'pw123');
  await pg.fill('#auP2', 'pw123');
  await pg.click('#auGo');
  await pg.waitForFunction('loggedIn()', null, { timeout: 8000 });
  await pg.waitForTimeout(150);
}

async function newPage(ctx, errs, tag, withMock) {
  const pg = await ctx.newPage();
  if (withMock) await pg.addInitScript(MOCK);
  pg.on('pageerror', e => errs.push(`${tag}: ${e}`));
  pg.on('dialog', d => d.accept().catch(() => {}));
  await pg.goto(URL);
  await pg.waitForTimeout(500);
  if (await pg.evaluate('!loggedIn()')) await signIn(pg, 'u' + tag);
  return pg;
}
const tap = async (pg, sel, wait = 400) => {
  try { await pg.click(sel, { timeout: 2500 }); } catch {}
  await pg.waitForTimeout(wait);
};

/* ---------------- solo ---------------- */
async function solo(ctx, errs) {
  console.log('\nSINGLE PLAYER');
  const pg = await newPage(ctx, errs, 'solo', false);
  await pg.evaluate("P().bal=900000;renderBal()");

  const games = [
    ['plinko', [['#plGo', 1500]]],
    ['bj', [['#bjDeal', 2100], ['#bjStand', 2300]]],
    ['poker', [['#pkGo', 800], ['#pkGo', 2100]]],
    ['slots', [['#slGo', 4000]]],
    ['chicken', [['#ckGo', 600], ['#ckGo', 1300], ['#ckCash', 800]]],
    ['balloon', [['#bpGo', 2000], ['#bpGo', 1300]]],
    ['wheel', [['#whGo', 5200]]],
    ['mines', [['#mnGo', 300], ['#mnRand', 450], ['#mnGo', 800]]],
    ['dice', [['#dcGo', 1400]]],
    ['roulette', [['[data-k="red"]', 150], ['#rGo', 6500]]],
    ['keno', [['#knAuto', 300], ['#knGo', 3000]]],
    ['hilo', [['#hlGo', 600], ['#hlHi', 800], ['#hlCash', 700]]],
    ['bacc', [['.bspot[data-b="b"]', 200], ['#bGo', 4000]]],
    ['tower', [['#twGo', 400], ['#twRand', 600], ['#twGo', 800]]],
    ['limbo', [['#lbGo', 1400]]],
    ['craps', [['[data-b="pass"]', 150], ['#crRoll', 1900]]],
  ];
  for (const [view, acts] of games) {
    const n0 = errs.length;
    await pg.evaluate(`go('${view}')`); await pg.waitForTimeout(300);
    for (const [sel, w] of acts) await tap(pg, sel, w);
    errs.length === n0 ? pass(view) : fail(view, errs.slice(n0).join(' | '));
  }

  for (const k of ['crown', 'deep', 'neon', 'gold']) {
    const n0 = errs.length;
    await pg.evaluate(`go('scratch');SC.kind='${k}';scPickUI();scIdle()`); await pg.waitForTimeout(300);
    await tap(pg, '#scGo', 500);
    for (let i = 0; i < 4; i++) {
      if (await pg.evaluate("SC.phase!=='play'")) break;
      await tap(pg, '#scRevealStage', 1300);
    }
    const done = await pg.evaluate("SC.phase") === 'done';
    (errs.length === n0 && done) ? pass('ticket ' + k) : fail('ticket ' + k, done ? errs.slice(n0).join(' | ') : 'did not settle');
  }

  const n0 = errs.length;
  await pg.evaluate("go('locker')"); await pg.waitForTimeout(300);
  for (const t of ['skins', 'frames', 'plates']) { await pg.evaluate(`lkTab='${t}';lkTabs()`); await pg.waitForTimeout(400); }
  errs.length === n0 ? pass('cosmetics') : fail('cosmetics', errs.slice(n0).join(' | '));

  // mobile smoke: nothing should throw at phone width
  const n1 = errs.length;
  await pg.setViewportSize({ width: 390, height: 844 });
  for (const v of ['lobby', 'balloon', 'craps', 'scratch', 'roulette']) { await pg.evaluate(`go('${v}')`); await pg.waitForTimeout(350); }
  errs.length === n1 ? pass('mobile 390px') : fail('mobile 390px', errs.slice(n1).join(' | '));
  await pg.close();
}


/* ---------------- admin portal ---------------- */
async function admin(ctx, errs) {
  console.log('\nADMIN PORTAL');
  const pg = await newPage(ctx, errs, 'adm', false);
  const n0 = errs.length;

  // stats must actually accrue from play, not sit at zero
  await pg.evaluate("P().bal=5000;renderBal();go('dice')");
  await tap(pg, '#dcGo', 1500);
  const w = await pg.evaluate("P().wagered");
  w > 0 ? pass('wagering is recorded', w.toFixed(2)) : fail('wagering is recorded', 'wagered=' + w);

  const created = await pg.evaluate("P().created");
  created > 0 ? pass('account creation date set') : fail('account creation date set');

  // playtime ticker
  await pg.evaluate("playTick();playTick()");
  const pm = await pg.evaluate("P().playMs");
  pm >= 20000 ? pass('playtime accrues', (pm / 1000) + 's') : fail('playtime accrues', 'playMs=' + pm);

  // unlock without touching the prompt
  await pg.evaluate("ADM.on=true;buildNav();go('admin')");
  await pg.waitForTimeout(400);
  const listed = await pg.evaluate("!!document.querySelector('#admTable tr[data-u]')");
  listed ? pass('user table renders') : fail('user table renders');

  const statCount = await pg.evaluate("document.querySelectorAll('#admStats .admstat').length");
  statCount === 6 ? pass('headline stats render') : fail('headline stats render', 'got ' + statCount);

  // a second account, then admin actions against it
  await pg.evaluate(`(()=>{const a={user:'victim',name:'victim',pass:hashPw('victim','pw123'),bal:500,
    color:'#ffc800',created:Date.now()-86400000,lastSeen:Date.now(),playMs:60000,sessions:3,
    wagered:200,won:150,bets:9,big:20};ensureCos(a);ensureStats(a);S.players.push(a);save(true);admRender()})()`);
  await pg.waitForTimeout(250);

  const two = await pg.evaluate("document.querySelectorAll('#admTable tr[data-u]').length");
  two === 2 ? pass('second account listed') : fail('second account listed', 'rows=' + two);

  // select it and confirm the drawer opens with their real figures
  await pg.evaluate("ADM.sel='victim';admRender()");
  await pg.waitForTimeout(200);
  const drawer = await pg.evaluate("$('admDrawer').textContent");
  drawer.includes('victim') ? pass('detail drawer opens') : fail('detail drawer opens');

  // suspend -> that account must not be able to log back in
  await pg.evaluate("(()=>{const u=admUsers().find(x=>x.key==='victim');S.players[u.idx].suspended=true;S.players[u.idx].suspendMsg='nope';save(true)})()");
  await pg.evaluate("logout()");
  await pg.waitForSelector('#authGate.show', { timeout: 6000 });
  await pg.fill('#auU', 'victim'); await pg.fill('#auP', 'pw123');
  await pg.click('#auGo'); await pg.waitForTimeout(400);
  const blocked = await pg.evaluate("!loggedIn() && (AUTH.err||'').includes('nope')");
  blocked ? pass('suspended account cannot log in') : fail('suspended account cannot log in', await pg.evaluate("AUTH.err"));

  // unsuspend -> back in
  await pg.evaluate("(()=>{const i=acctIdx('victim');S.players[i].suspended=false;S.players[i].suspendMsg='';save(true)})()");
  await pg.fill('#auU', 'victim'); await pg.fill('#auP', 'pw123');
  await pg.click('#auGo');
  await pg.waitForFunction('loggedIn()', null, { timeout: 6000 }).catch(() => {});
  (await pg.evaluate("loggedIn() && P().user==='victim'")) ? pass('unsuspend restores access') : fail('unsuspend restores access');

  // audit trail records what was done
  await pg.evaluate("audit('test action','victim','detail')");
  const logged = await pg.evaluate("S.audit.length>0 && S.audit[S.audit.length-1].action==='test action'");
  logged ? pass('audit trail records actions') : fail('audit trail records actions');

  // admin state must not leak to a player who has not unlocked it
  const navHidden = await pg.evaluate("(()=>{ADM.on=false;buildNav();return !document.querySelector('[data-g=\"admin\"]')})()");
  navHidden ? pass('admin hidden when locked') : fail('admin hidden when locked');

  errs.length === n0 ? pass('no admin console errors') : fail('no admin console errors', errs.slice(n0).join(' | '));
  await pg.close();
}

/* ---------------- multiplayer ---------------- */
async function connectPair(browser, errs) {
  const vp = { viewport: { width: 1320, height: 980 } };
  const ctxA = await browser.newContext(vp), ctxB = await browser.newContext(vp);
  const A = await newPage(ctxA, errs, 'A', true);
  const B = await newPage(ctxB, errs, 'B', true);
  await A.exposeFunction('__netOut', s => B.evaluate(x => window.__netIn(x), s).catch(() => {}));
  await B.exposeFunction('__netOut', s => A.evaluate(x => window.__netIn(x), s).catch(() => {}));
  await A.reload(); await B.reload(); await A.waitForTimeout(700);
  // reload must restore both sessions from storage - no second login
  for (const [pg, who] of [[A, 'uA'], [B, 'uB']]) {
    const back = await pg.evaluate('loggedIn() && P().user');
    back === who ? pass('session restored ' + who) : fail('session restored ' + who, 'got ' + back);
  }
  await A.evaluate("P().bal=500000;renderBal();go('party')");
  await B.evaluate("P().color='#ffc800';P().bal=500000;renderBal();go('party')");
  await tap(A, '#pHost', 400);
  await B.fill('#pCode', await A.evaluate("NET.code"));
  await tap(B, '#pJoin', 900);
  return [A, B];
}

async function mp(browser, errs) {
  console.log('\nMULTIPLAYER');
  const [A, B] = await connectPair(browser, errs);
  const ok = await A.evaluate("NET.status") === 'connected' && await B.evaluate("NET.status") === 'connected';
  ok ? pass('peer connect') : fail('peer connect');
  if (!ok) { await A.close(); await B.close(); return; }

  // identity: joining a party must not rename the guest after the host
  const idA = await A.evaluate("[myProf().name, (NET.remote||{}).name]");
  const idB = await B.evaluate("[myProf().name, (NET.remote||{}).name]");
  const distinct = idA[0] === 'uA' && idB[0] === 'uB' && idA[1] === 'uB' && idB[1] === 'uA';
  distinct ? pass('identities distinct') : fail('identities distinct', `A=${JSON.stringify(idA)} B=${JSON.stringify(idB)}`);

  for (const g of ['hs', 'rn', 'vt', 'bj', 'pk', 'cr', 'db', 'cf']) {
    const n0 = errs.length;
    await A.evaluate(`act({a:'pick',g:'${g}'})`); await A.waitForTimeout(900);
    const synced = (await A.evaluate("PS.g")) === g && (await B.evaluate("PS.g")) === g;
    (errs.length === n0 && synced) ? pass('table ' + g) : fail('table ' + g, synced ? errs.slice(n0).join(' | ') : 'not synced');
  }

  // hidden-information leak checks — the guest must never receive secrets
  await A.evaluate("act({a:'pick',g:'vt'})"); await A.waitForTimeout(400);
  await tap(A, '#vtGo', 200); await tap(B, '#vtGo', 1300);
  const vtLeak = await B.evaluate("JSON.stringify((PS.d.lockers||[]).filter(l=>!l.open)[0]||{})");
  vtLeak === '{"open":false}' ? pass('vault: closed lockers hidden') : fail('vault: closed lockers hidden', vtLeak);

  // the vault round above is still live and (correctly) blocks a table switch — clear it first
  await A.evaluate("if(PG&&PG.vt){clearTimeout(PG.vt.to);PG.vt=vtNew();push()}"); await A.waitForTimeout(400);
  await A.evaluate("act({a:'pick',g:'pk'})"); await A.waitForTimeout(600);
  await tap(A, '#mpPkDeal', 2500);
  let pkLeak = 'no deal';
  for (let i = 0; i < 12; i++) {
    const ready = await B.evaluate("!!(PS.d.hole&&PS.d.hole.H&&PS.d.hole.H.length===2&&PS.d.hole.G&&PS.d.hole.G.length===2)");
    if (ready) {
      pkLeak = await B.evaluate("JSON.stringify(PS.d.hole[PS.me==='H'?'G':'H'].map(c=>c.r!=null))+'|'+JSON.stringify(PS.d.hole[PS.me].map(c=>c.r!=null))");
      break;
    }
    await B.waitForTimeout(500);
  }
  pkLeak === '[false,false]|[true,true]'
    ? pass("hold'em: their cards hidden, mine visible")
    : fail("hold'em: their cards hidden, mine visible", pkLeak);

  const n0 = errs.length;
  await A.evaluate("sendTaunt('\u{1F525}')"); await B.waitForTimeout(400);
  await A.evaluate("send({t:'rain',name:P().name,amt:1000});rainCash(P().name,1000)"); await B.waitForTimeout(800);
  await A.evaluate("DEV=true;devRender();send({t:'dev',bal:777,by:'Alex'})"); await B.waitForTimeout(500);
  const devOk = await B.evaluate("P().bal") === 777;
  (errs.length === n0 && devOk) ? pass('taunt + rain + dev override') : fail('taunt + rain + dev override', devOk ? '' : 'dev balance not applied');
  await A.close(); await B.close();
}

/* ---------------- The Strip: full game + money audit ---------------- */
async function strip(browser, errs) {
  console.log('\nTHE STRIP (full game, money audited every turn)');

  // The Strip is documented and audited here but is not currently in the build:
  // no 'st' entry in PT, no hostInit state, no renderer. Skip loudly rather than
  // fail — this suite is worth keeping for when the table is actually built.
  const probe = await browser.newContext();
  const pp = await probe.newPage();
  await pp.goto(URL);
  const hasStrip = await pp.evaluate("typeof PT!=='undefined' && PT.some(t=>t[0]==='st')");
  await probe.close();
  if (!hasStrip) {
    console.log('  SKIPPED  The Strip is not in this build (no "st" table in PT).');
    return;
  }

  const [A, B] = await connectPair(browser, errs);
  if (await A.evaluate("NET.status") !== 'connected') { fail('strip: no connection'); await A.close(); await B.close(); return; }
  const a0 = await A.evaluate("P().bal"), b0 = await B.evaluate("P().bal");
  await A.evaluate("act({a:'pick',g:'st'})"); await A.waitForTimeout(400);
  await tap(A, '#stGo', 200); await tap(B, '#stGo', 1600);
  const ante = await A.evaluate("PS.d.ante");
  let leak = null, bought = 0, bets = 0, ups = 0;

  for (let t = 0; t < 320; t++) {
    if (await A.evaluate("PS.d.phase!=='turn'")) break;
    const tot = await A.evaluate("PS.d.cash.H+PS.d.cash.G+PS.d.pot");
    if (Math.abs(tot - ante * 2) > 2) { leak = `turn ${t}: cash+pot ${tot} vs ${ante * 2}`; break; }
    const pend = await A.evaluate("PS.d.pend?PS.d.pend.k:null");
    if (pend) {
      const who = await A.evaluate("PS.d.pend.who");
      const pg = who === 'H' ? A : B;
      if (pend === 'buy' || pend === 'snipe') {
        const mult = pend === 'snipe' ? 1.25 : 1;
        const can = await pg.evaluate(`PS.d.cash[PS.me]>=Math.round(ST_GRP[ST_BOARD[PS.d.pend.i].g].price*PS.d.u*${mult})`);
        if (can && bought < 14) { await tap(pg, '[data-x="buy"]', 300); bought++; } else await tap(pg, '[data-x="pass"]', 300);
      } else if (pend === 'bet') {
        if (bets < 5) { await pg.evaluate("act({a:'bet',g:'st',k:['coin','high','jack'][Math.floor(Math.random()*3)],stake:Math.round(PS.d.u*0.6)})"); bets++; }
        else await tap(pg, '[data-x="pass"]', 300);
      }
      await A.waitForTimeout(700); continue;
    }
    const pg = (await A.evaluate("PS.d.turn")) === 'H' ? A : B;
    if (!(await pg.evaluate("PS.d.rolled"))) {
      if (ups < 8) {
        const did = await pg.evaluate(`(()=>{const d=PS.d,me=PS.me;
          for(const k in d.own){const i=+k;if(d.own[i]!==me)continue;const gi=ST_BOARD[i].g;
            if(d.setOf[gi]!==me)continue;const l=d.lvl[i]||0;if(l>=3)continue;
            const c=Math.round(ST_GRP[gi].price*d.u*ST_UPC[Math.min(2,l)]);
            if(d.cash[me]>=c){act({a:'upgrade',g:'st',i});return 1}}return 0})()`);
        if (did) { ups++; await pg.waitForTimeout(350); }
      }
      await tap(pg, '[data-x="roll"]', 1500);
    } else await tap(pg, '[data-x="end"]', 450);
  }
  await A.waitForTimeout(1800);
  leak ? fail('money conserved every turn', leak) : pass('money conserved every turn');

  const done = await A.evaluate("PS.d.phase") === 'done';
  done ? pass('game reached settlement', `${await A.evaluate("PS.d.turns")} turns, bought ${bought}, upgrades ${ups}, bets ${bets}`)
       : fail('game reached settlement');
  const a1 = await A.evaluate("P().bal"), b1 = await B.evaluate("P().bal");
  const sum = (a1 - a0) + (b1 - b0), want = -(ante * 2 * 0.03);
  near(sum, want, 0.05) ? pass('3% rake exact', `${sum.toFixed(2)} vs ${want.toFixed(2)}`)
                        : fail('3% rake exact', `${sum.toFixed(2)} vs ${want.toFixed(2)}`);
  await A.close(); await B.close();
}

/* ---------------- RTP (runs the page's own maths) ---------------- */
async function rtp(ctx, errs) {
  console.log('\nRTP  (tolerance is per-game: fat-tailed payouts swing more even at millions of samples)');
  const pg = await newPage(ctx, errs, 'rtp', false);
  const out = await pg.evaluate(`(()=>{
    const res=[];
    const N=2000000;
    // (Skyline's RTP rows lived here; the game is not in this build.)
    // Scratch tickets: generators are the real thing
    const tk=(fn,n)=>{let t=0,h=0;for(let i=0;i<n;i++){const d=fn();t+=d.total;if(d.total>0)h++}
      return [t/n*100,h/n*100];};
    [['crown',genCrown],['deep',genDeep],['neon',genNeon],['gold',genGold]].forEach(([k,f])=>{
      const [r,h]=tk(f,3000000);res.push(['ticket '+k,r,96,h,2.5]);});
    // Limbo
    {let t=0;const T=5;for(let i=0;i<N;i++){const u=Math.random();if(Math.max(1,Math.floor(99/u)/100)>=T)t+=T}
      res.push(['limbo @5x',t/N*100,99,null,0.8]);}
    // Tower
    {const m='med',c=TW_CFG[m],p=(c.d-c.t)/c.d,k=4,mu=twMult(k,m);let t=0;
      for(let i=0;i<N;i++){let ok=1;for(let j=0;j<k;j++)if(Math.random()>=p){ok=0;break}if(ok)t+=mu}
      res.push(['tower med, 4 floors',t/N*100,97,null,0.8]);}
    // Plinko
    {let t=0;for(let i=0;i<N;i++){let b=0;for(let k=0;k<12;k++)b+=Math.random()<.5?1:0;t+=PL_TABLE.med[b]}
      res.push(['plinko medium',t/N*100,99,null,0.5]);}
    return res;})()`);
  for (const [name, got, want, hit, tol] of out) {
    const t = tol || 1.5;
    const d = `${got.toFixed(2)}% (want ${want}% +/-${t})` + (hit != null ? `  hit ${hit.toFixed(1)}%` : '');
    Math.abs(got - want) <= t ? pass(name, d) : fail(name, d);
  }
  await pg.close();
}

/* ---------------- run ---------------- */
(async () => {
  const which = (process.argv[2] || 'all').toLowerCase();
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 980 } });
  const errs = [];
  try {
    if (which === 'all' || which === 'solo') await solo(ctx, errs);
    if (which === 'all' || which === 'admin') await admin(ctx, errs);
    if (which === 'all' || which === 'mp') await mp(browser, errs);
    if (which === 'all' || which === 'strip') await strip(browser, errs);
    if (which === 'all' || which === 'rtp') await rtp(ctx, errs);
  } finally { await browser.close(); }

  console.log('\nCONSOLE ERRORS: ' + (errs.length ? '\n  ' + [...new Set(errs)].join('\n  ') : 'none'));
  const bad = results.filter(r => !r[0]).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed` + (errs.length ? `, ${errs.length} console error(s)` : ''));
  process.exit(bad || errs.length ? 1 : 0);
})();
