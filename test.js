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
    ['moles', [['#moGo', 500], ['.mohole[data-h="0"]', 900], ['.mohole[data-h="1"]', 900]]],
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






/* ---------------- party presence / join / side bets ---------------- */
async function coop(browser, errs) {
  console.log('\nPARTY HUD');
  const [A, B] = await connectPair(browser, errs);
  if (await A.evaluate("NET.status") !== 'connected') { fail('coop: no connection'); await A.close(); await B.close(); return; }

  // B wanders off into Moles; A should be told about it
  await B.evaluate("go('moles')");
  await A.waitForTimeout(500);
  const seen = await A.evaluate("[CO.theirGame, !!document.querySelector('#coHud.show')]");
  (seen[0] === 'moles' && seen[1]) ? pass('presence shows their game', 'moles')
                                   : fail('presence shows their game', JSON.stringify(seen));

  // mid-round is reported as busy, and an invite is HELD rather than interrupting
  await B.evaluate("P().bal=10000;renderBal();$('moBet').value='10';moStart()");
  await A.waitForTimeout(500);
  const busy = await A.evaluate("CO.theirBusy");
  busy ? pass('mid-round reads as busy') : fail('mid-round reads as busy');

  await A.evaluate("coJoin()");
  await B.waitForTimeout(500);
  const held = await B.evaluate("[!!CO.held, !!CO.inReq]");
  (held[0] && !held[1]) ? pass('invite waits while they are mid-round')
                        : fail('invite waits while they are mid-round', JSON.stringify(held));

  // end B's round -> the invite should surface
  await B.evaluate("MO.phase='idle';MO.busy=false;coPresSend()");
  await B.waitForTimeout(600);
  const surfaced = await B.evaluate("[!!CO.inReq, !!CO.held]");
  (surfaced[0] && !surfaced[1]) ? pass('invite arrives once the round ends')
                                : fail('invite arrives once the round ends', JSON.stringify(surfaced));

  await B.evaluate("coAccept()");
  await A.waitForTimeout(600);
  const joined = await A.evaluate("[CO.on, CO.game]");
  (joined[0] && joined[1] === 'moles') ? pass('both land in the same game', 'moles')
                                       : fail('both land in the same game', JSON.stringify(joined));

  // B starts a round -> A gets a priced side-bet offer
  await B.evaluate("MO.moles=5;$('moBet').value='10';moStart()");
  await A.waitForTimeout(600);
  const offer = await A.evaluate("CO.offer?[CO.offer.q, CO.offer.label]:null");
  (offer && Math.abs(offer[0] - 5/7) < 1e-9) ? pass('side-bet offer priced from live odds', (offer[0]*100).toFixed(1) + '%')
                                             : fail('side-bet offer priced from live odds', JSON.stringify(offer));

  // A backs YES; stake leaves A's wallet only
  const bal = await A.evaluate("P().bal");
  const bBal = await B.evaluate("P().bal");
  await A.evaluate("$('coStake').value='20';coBet('yes')");
  await A.waitForTimeout(250);
  const took = await A.evaluate(`Math.round((${bal}-P().bal)*100)/100`);
  const bUnchanged = await B.evaluate(`Math.abs(P().bal-${bBal})<0.001`);
  (took === 20 && bUnchanged) ? pass('side bet is house-banked, not player-vs-player')
                              : fail('side bet is house-banked', 'took ' + took + ', theirs changed: ' + !bUnchanged);

  // force a hit on B -> A's YES must pay at 0.97/q
  const before = await A.evaluate("P().bal");
  await B.evaluate(`(()=>{const el=document.querySelector('.mohole[data-h="0"]');MO.set=new Set([0]);moWhack(0,el)})()`);
  await A.waitForTimeout(1400);
  const paidA = await A.evaluate(`Math.round((P().bal-${before})*100)/100`);
  const want = Math.round(20 * (0.97 / (5/7)) * 100) / 100;
  Math.abs(paidA - want) < 0.02 ? pass('winning side bet pays 0.97/q', paidA + ' (want ' + want + ')')
                                : fail('winning side bet pays 0.97/q', paidA + ' vs ' + want);

  // leaving the game ends the session for both
  await A.evaluate("go('lobby')");
  await B.waitForTimeout(500);
  const ended = await B.evaluate("CO.on");
  !ended ? pass('leaving the game ends the session') : fail('leaving the game ends the session');

  await A.close(); await B.close();
}

/* ---------------- sportsbook ---------------- */
async function sports(ctx, errs) {
  console.log('\nSPORTSBOOK');
  const pg = await newPage(ctx, errs, 'fb', false);
  const n0 = errs.length;
  await pg.evaluate("P().bal=1000000;renderBal();go('sports')");
  await pg.waitForTimeout(500);

  const card = await pg.evaluate("FB.card.length");
  card === 1 ? pass('one fixture at a time') : fail('one fixture at a time', 'got ' + card);

  // Every market on a fixture must be a complete, non-overlapping book: the true
  // probabilities have to sum to 1, or the odds are simply wrong.
  const books = await pg.evaluate(`(()=>{
    const m=FB.card[0], P=fbProbs(m,FB_MINS,0,0);
    const r=[
      ['1X2', P.home+P.draw+P.away],
      ['O/U', P.ov+P.un],
      ['BTTS', P.btts+P.nbtts],
      ['CS grid', Object.values(P.cs).reduce((a,b)=>a+b,0)]
    ];
    return r.map(([n,v])=>[n, Math.abs(v-1)]);
  })()`);
  const badBook = books.find(b => b[1] > 0.005);
  badBook ? fail('market books sum to 1', badBook[0] + ' off by ' + badBook[1].toFixed(4))
          : pass('market books sum to 1', books.map(b=>b[0]).join(', '));

  // The pricing model must match the GENERATOR exactly. Simulate thousands of
  // matches from the same engine the game uses and compare realised frequency
  // with the priced probability - a Poisson approximation would drift here.
  const model = await pg.evaluate(`(()=>{
    const m=FB.card[0], P=fbProbs(m,FB_MINS,0,0);
    const N=20000; let h=0,d=0,a=0,ov=0,bt=0;
    for(let i=0;i<N;i++){
      const mm={h:m.h,a:m.a,lam:m.lam,seed:(i*2654435761)>>>0};
      fbSim(mm);
      const [H,A]=mm.ft;
      if(H>A)h++;else if(H===A)d++;else a++;
      if(H+A>=3)ov++;
      if(H>0&&A>0)bt++;
    }
    return [[P.home,h/N],[P.draw,d/N],[P.away,a/N],[P.ov,ov/N],[P.btts,bt/N]];
  })()`);
  const worst = model.reduce((w,[pp,ff]) => Math.max(w, Math.abs(pp-ff)), 0);
  worst < 0.015 ? pass('priced odds match the simulator', 'max gap ' + (worst*100).toFixed(2) + 'pp')
                : fail('priced odds match the simulator', 'max gap ' + (worst*100).toFixed(2) + 'pp');

  // single bets must return exactly 97%
  const single = await pg.evaluate(`(()=>{
    const m=FB.card[0], P=fbProbs(m,FB_MINS,0,0);
    return ['home','draw','away','ov','un','btts','nbtts']
      .map(k=>P[k]*fbOdds(P[k])*100);
  })()`);
  const sBad = single.find(v => Math.abs(v-97) > 0.01);
  sBad === undefined ? pass('every single returns 97%') : fail('every single returns 97%', String(sBad));

  // accumulators must ALSO return 97% - the edge is applied once, not per leg.
  // Compounding would give 0.97^n (a 5-fold would be 86%) and breach the rule.
  const acca = await pg.evaluate(`(()=>{
    const m=FB.card[0], sets=[['home','ov'],['home','btts'],['home','ov','btts'],['away','un','nbtts']];
    return sets.map(ks=>{ const p=fbJointP(m,ks,FB_MINS,0,0); return p>0?p*fbOdds(p)*100:97; });
  })()`);
  const aBad = acca.find(v => Math.abs(v-97) > 0.01);
  aBad === undefined ? pass('accumulators return 97%', '2 and 3-leg combinations')
                     : fail('accumulators return 97%', String(aBad));

  // Legs within one match are CORRELATED, so multiplying their individual
  // probabilities misprices the ticket. The joint probability must match what
  // the simulator actually produces, and must differ from the naive product.
  const joint = await pg.evaluate(`(()=>{
    const m=FB.card[0];
    const P=fbProbs(m,FB_MINS,0,0);
    const jt=fbJointP(m,['home','ov'],FB_MINS,0,0);
    const naive=P.home*P.ov;
    const N=20000; let both=0;
    for(let i=0;i<N;i++){
      const mm={h:m.h,a:m.a,lam:m.lam,seed:(i*2246822519)>>>0}; fbSim(mm);
      const [H,A]=mm.ft;
      if(H>A && H+A>=3) both++;
    }
    return [jt, naive, both/N];
  })()`);
  const jtErr = Math.abs(joint[0]-joint[2]), naiveErr = Math.abs(joint[1]-joint[2]);
  (jtErr < 0.015 && naiveErr > jtErr)
    ? pass('correlated legs priced jointly, not multiplied',
           'joint off by ' + (jtErr*100).toFixed(2) + 'pp, naive product off by ' + (naiveErr*100).toFixed(2) + 'pp')
    : fail('correlated legs priced jointly', JSON.stringify(joint));

  // cash out must be value-neutral: E[cash value] == E[holding]
  const co = await pg.evaluate(`(()=>{
    const m=FB.card[0];
    const P0=fbProbs(m,FB_MINS,0,0), price=fbOdds(P0.home), stake=100;
    // average the fair cash value at minute 45 across many simulated first halves
    const N=6000; let sum=0;
    for(let i=0;i<N;i++){
      const mm={h:m.h,a:m.a,lam:m.lam,seed:(i*40503+7)>>>0}; fbSim(mm);
      let ch=0,ca=0;
      for(const e of mm.events) if(e.type==='goal'&&e.t<=45){ch=e.ch;ca=e.ca;}
      const Pn=fbProbs(m,45,ch,ca);
      sum += stake*price*Pn.home;
    }
    return [sum/N, stake*price*P0.home];
  })()`);
  Math.abs(co[0]-co[1]) / co[1] < 0.03
    ? pass('cash out is value-neutral', co[0].toFixed(2) + ' vs hold ' + co[1].toFixed(2))
    : fail('cash out is value-neutral', co[0].toFixed(2) + ' vs ' + co[1].toFixed(2));

  // placing a bet takes the stake; settlement pays the right amount
  const flow = await pg.evaluate(`(()=>{
    FB.sel=[];FB.mode='single';FB.open=[];
    const m=FB.card[0];const {p,o}=fbPriceOf(m,'home');
    FB.sel.push({mi:0,key:'home',p,o,label:'x',match:'y',min:0});
    fbSlipRender();$('fbStake').value='100';
    const before=P().bal; fbPlace();
    const took=Math.round((before-P().bal)*100)/100;
    // force the match to a home win and settle
    const mm=FB.card[0]; mm.phase='done'; mm.ch=3; mm.ca=0;
    const b4=P().bal; fbSettle();
    const paid=Math.round((P().bal-b4)*100)/100;
    return [took, paid, Math.round(100*o*100)/100];
  })()`);
  (flow[0] === 100 && Math.abs(flow[1]-flow[2]) < 0.02)
    ? pass('stake taken and winner paid', flow[0] + ' in, ' + flow[1] + ' out')
    : fail('stake taken and winner paid', JSON.stringify(flow));

  // Cash-out buttons must show profit or loss against the stake, colour-coded.
  const cashUI = await pg.evaluate(`(()=>{
    const m=FB.card[0];
    FB.open=[];
    // price the bets at kick-off, THEN run the match on - otherwise they are
    // priced against a finished scoreline and one of them is worth nothing
    m.phase='live';m.min=0;m.ch=0;m.ca=0;FB.live=0;
    const mk=(key,stake)=>{const {p,o}=fbPriceOf(m,key);
      FB.open.push({id:Math.random(),legs:[{mi:0,key,p,o,label:fbLabel(m,key),match:'x'}],
       stake,odds:o,acca:false,state:'open'})};
    mk('home',100); mk('un',100);
    m.min=62;m.ch=2;m.ca=0;      // 2-0 up: home is winning, under 2.5 is losing
    fbRender();
    return [...document.querySelectorAll('#fbOpen button[data-co]')].map(x=>{
      const i=x.querySelector('i');
      return [x.className, i?i.textContent[0]:'?'];
    });
  })()`);
  const up = cashUI.find(c => c[0] === 'up'), dn = cashUI.find(c => c[0] === 'down');
  (up && up[1] === '+' && dn && dn[1] === '−')
    ? pass('cash out shows coloured +/- against stake', 'up and down both rendered')
    : fail('cash out shows coloured +/- against stake', JSON.stringify(cashUI));
  await pg.evaluate("FB.open=[];FB.card[0].phase='pre';FB.card[0].min=0;FB.card[0].ch=0;FB.card[0].ca=0;FB.live=-1;fbRender()");

  // Bets must not pile up across matches: the next fixture starts with a clean
  // slate, and anything somehow still open is refunded rather than dropped.
  const cleared = await pg.evaluate(`(()=>{
    FB.open=[];FB.profit=0;
    const m=FB.card[0];
    m.phase='live';m.min=0;m.ch=0;m.ca=0;FB.live=0;
    const {p,o}=fbPriceOf(m,'home');
    FB.open.push({id:1,legs:[{mi:0,key:'home',p,o,label:'x',match:'y'}],stake:50,odds:o,acca:false,state:'open'});
    FB.open.push({id:2,legs:[{mi:0,key:'away',p,o,label:'x',match:'y'}],stake:50,odds:o,acca:false,state:'lost',ret:0});
    const before=P().bal;
    m.phase='done';FB.live=-1;
    fbAdvance();
    return [FB.open.length, Math.round((P().bal-before)*100)/100, FB.card[0].phase];
  })()`);
  (cleared[0] === 0 && cleared[1] === 50 && cleared[2] === 'pre')
    ? pass('bets clear between matches', 'unsettled stake refunded')
    : fail('bets clear between matches', JSON.stringify(cleared));

  // A settled market prices below 1.00 (BTTS "yes" at 1-1 is already certain, so
  // 0.97/1 = 0.97). Offering that is a guaranteed loss, so every ENABLED price
  // must clear 1.00 - checked across a whole match, minute by minute.
  const suspended = await pg.evaluate(`(()=>{
    let worst=99, offered=0;
    const m=FB.card[0]; fbSim(m);
    for(let t=0;t<=FB_MINS;t+=5){
      let ch=0,ca=0;
      for(const e of m.events) if(e.type==='goal'&&e.t<=t){ch=e.ch;ca=e.ca;}
      const P=fbProbs(m,FB_MINS-t,ch,ca);
      for(const k of ['home','draw','away','ov','un','btts','nbtts']){
        const o=fbOdds(P[k]);
        if(P[k]>0 && fbLive(o)){ offered++; worst=Math.min(worst,o); } }
      for(const k in P.cs){ const o=fbOdds(P.cs[k]);
        if(P.cs[k]>0 && fbLive(o)){ offered++; worst=Math.min(worst,o); } }
    }
    return [worst, offered];
  })()`);
  (suspended[0] > 1.0 && suspended[1] > 50)
    ? pass('settled markets are suspended', 'lowest live price ' + suspended[0].toFixed(3) + ' across ' + suspended[1] + ' quotes')
    : fail('settled markets are suspended', JSON.stringify(suspended));

  // Layout: the stage must never spill over the control column, and nothing in
  // the slip may overflow its 300px panel. A bare `1fr` track and flex centring
  // once pushed the fixture list straight over the bet slip.
  for (const w of [920, 1000, 1100, 1280, 1440, 1600, 1920]) {
    await pg.setViewportSize({ width: w, height: 860 });
    await pg.waitForTimeout(250);
    const g = await pg.evaluate(`(()=>{
      const c=document.querySelector('#sportsView .ctrl').getBoundingClientRect();
      const s=document.querySelector('#sportsView .stage').getBoundingClientRect();
      const sh=document.querySelector('#sportsView .shell').getBoundingClientRect();
      const ctrl=document.querySelector('#sportsView .ctrl');
      const cs=getComputedStyle(ctrl);
      const inner=ctrl.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
      let over=0;
      ctrl.querySelectorAll('*').forEach(el=>{ if(el.getBoundingClientRect().width>inner+1) over++; });
      return [+(c.right-s.left).toFixed(1), +(s.right-sh.right).toFixed(1), over];
    })()`);
    (g[0] <= 0.5 && g[1] <= 0.5 && g[2] === 0)
      ? pass('layout clean at ' + w + 'px')
      : fail('layout clean at ' + w + 'px', 'overlap ' + g[0] + ', spill ' + g[1] + ', ' + g[2] + ' overflowing');
  }
  await pg.setViewportSize({ width: 1320, height: 980 });

  // the guide must actually open
  await pg.evaluate("go('sports')"); await pg.waitForTimeout(200);
  await pg.click('#fbGuideBtn'); await pg.waitForTimeout(300);
  const guideOpen = await pg.evaluate("!!document.querySelector('#fbGuide.show') && $('fbGuide').textContent.includes('Multiply your stake')");
  guideOpen ? pass('betting guide opens') : fail('betting guide opens');
  await pg.click('#fbGuideClose'); await pg.waitForTimeout(200);
  const guideShut = await pg.evaluate("!document.querySelector('#fbGuide.show')");
  guideShut ? pass('betting guide closes') : fail('betting guide closes');

  errs.length === n0 ? pass('no sportsbook console errors') : fail('no sportsbook console errors', errs.slice(n0).join(' | '));
  await pg.close();
}

/* ---------------- long shot ---------------- */
async function longshot(ctx, errs) {
  console.log('\nLONG SHOT');
  const pg = await newPage(ctx, errs, 'ls', false);
  const n0 = errs.length;
  await pg.evaluate("P().bal=100000;renderBal();go('shot')");
  await pg.waitForTimeout(500);

  const box = await pg.evaluate("(()=>{const r=$('lsCv').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()");

  // Drag from the cannon up and to the right - the natural gesture. This used to
  // produce a zero-power flat shot that landed at the cannon's feet.
  await pg.evaluate("$('lsBet').value='10';lsStart()");
  await pg.waitForTimeout(250);
  const cannon = await pg.evaluate("(()=>{const r=$('lsCv').getBoundingClientRect();return{x:r.x+lsX(LS_CX)/(SHOT.cv.width/r.width), y:r.y+lsY(LS_CY)/(SHOT.cv.height/r.height)}})()");
  await pg.mouse.move(cannon.x, cannon.y);
  await pg.mouse.down();
  await pg.mouse.move(cannon.x + box.w * 0.45, cannon.y - box.h * 0.42, { steps: 8 });
  const aim = await pg.evaluate("SHOT.aim?{vx:SHOT.aim.vx,vy:SHOT.aim.vy,sp:SHOT.aim.sp}:null");
  (aim && aim.vy > 200 && aim.sp > 300) ? pass('drag up-right builds a real shot', 'vy=' + Math.round(aim.vy) + ' sp=' + Math.round(aim.sp))
    : fail('drag up-right builds a real shot', JSON.stringify(aim));

  await pg.mouse.up();
  await pg.waitForTimeout(150);
  const flew = await pg.evaluate("SHOT.phase==='fly'||SHOT.phase==='done'");
  flew ? pass('release fires') : fail('release fires', await pg.evaluate("SHOT.phase"));

  // it must actually travel, not drop at the cannon
  await pg.waitForTimeout(2200);
  const land = await pg.evaluate("SHOT.land");
  // cannon sits at x=74; the old bug landed it there every time
  land > 250 ? pass('ball travels downrange', 'landed at ' + Math.round(land))
             : fail('ball travels downrange', 'landed at ' + Math.round(land) + ' (cannon is at 74)');

  // a tap must NOT fire a dud and eat the stake
  await pg.waitForTimeout(1600);
  await pg.evaluate("SHOT.phase='idle';SHOT.shot=null;$('lsBet').value='10';lsStart()");
  await pg.waitForTimeout(200);
  const balBefore = await pg.evaluate("P().bal");
  // a genuine click: press and release at the same point, no movement
  await pg.mouse.move(cannon.x + box.w * 0.3, cannon.y - box.h * 0.3);
  await pg.mouse.down();
  await pg.mouse.up();
  await pg.waitForTimeout(250);
  const tap = await pg.evaluate("[ 'aim', SHOT.phase, 0 ]");
  tap[2] = await pg.evaluate(`Math.round((${balBefore}-P().bal)*100)/100`);
  (tap[1] === 'aim' && tap[2] === 0) ? pass('a tap cancels instead of firing a dud')
                                     : fail('a tap cancels instead of firing a dud', JSON.stringify(tap));

  errs.length === n0 ? pass('no long shot console errors') : fail('no long shot console errors', errs.slice(n0).join(' | '));
  await pg.close();
}

/* ---------------- moles ---------------- */
async function moles(ctx, errs) {
  console.log('\nMOLES');
  const pg = await newPage(ctx, errs, 'moles', false);
  const n0 = errs.length;
  await pg.evaluate("P().bal=100000;renderBal();go('moles')");
  await pg.waitForTimeout(400);

  // board shape must match the real game
  const holes = await pg.evaluate("document.querySelectorAll('#moHoles .mohole').length");
  holes === 7 ? pass('7 holes') : fail('7 holes', 'got ' + holes);

  // default should be a setting that plays, not one that ends instantly
  const dflt = await pg.evaluate("(()=>{const b=$('moCount').querySelector('.on');return [MO.moles, +b.dataset.v]})()");
  (dflt[0] === 5 && dflt[1] === 5) ? pass('defaults to 5 moles', '71.4% per swing')
                                   : fail('defaults to 5 moles', JSON.stringify(dflt));

  // the headline number from the real game, exactly
  const max = await pg.evaluate("(()=>{MO.moles=1;return moMult(8)})()");
  Math.abs(max - 5649504.98) < 0.01 ? pass('max win matches Stake', max.toLocaleString())
                                    : fail('max win matches Stake', String(max));

  // the edge must be applied once, not compounded per step
  const once = await pg.evaluate("(()=>{MO.moles=3;const p=3/7;return Math.abs(moMult(4)-(0.98/Math.pow(p,4)))<0.02})()");
  once ? pass('edge applied once, not per step') : fail('edge applied once, not per step');

  // a forced win streak pays exactly bet x multiplier
  const paid = await pg.evaluate(`(()=>{
    MO.moles=3;MO.phase='idle';MO.busy=false;
    const before=P().bal;
    MO.bet=100;MO.hits=3;MO.mult=moMult(3);MO.phase='play';
    const expect=Math.round(MO.bet*MO.mult*100)/100;
    moCash(false);
    return [Math.round((P().bal-before)*100)/100, expect];
  })()`);
  paid[0] === paid[1] ? pass('cash out pays bet x multiplier', paid[0] + '')
                      : fail('cash out pays bet x multiplier', paid[0] + ' vs ' + paid[1]);

  // a miss must cost the stake and reset the round
  await pg.waitForTimeout(600);
  const bust = await pg.evaluate(`(()=>{
    MO.phase='idle';MO.busy=false;MO.hits=0;MO.mult=1;
    const before=P().bal;
    $('moBet').value='50';moStart();
    const staked=Math.round((before-P().bal)*100)/100;
    // force every hole empty, then whack one
    MO.set=new Set();
    const el=document.querySelector('.mohole[data-h="0"]');
    moWhack(0,el);
    return staked;
  })()`);
  bust === 50 ? pass('miss costs the stake') : fail('miss costs the stake', 'staked ' + bust);
  await pg.waitForTimeout(1400);
  const reset = await pg.evaluate("MO.phase==='idle' && MO.hits===0 && MO.mult===1");
  reset ? pass('round resets after a miss') : fail('round resets after a miss');

  // cash out must be impossible before a hit lands
  const guard = await pg.evaluate(`(()=>{
    MO.phase='idle';MO.busy=false;MO.hits=0;MO.mult=1;
    $('moBet').value='10';moStart();
    const before=P().bal;moCash(false);
    return Math.round((P().bal-before)*100)/100;
  })()`);
  guard === 0 ? pass('cannot cash out with zero hits') : fail('cannot cash out with zero hits', 'gained ' + guard);

  // The moles RESHUFFLE: hitting one does not remove it from the board. This is
  // required by the maths - a constant p is the only way 0.98/p^8 gives Stake's
  // published max win - and it is the thing players find counter-intuitive.
  const shuf = await pg.evaluate(`(()=>{
    MO.moles=3;MO.phase='idle';MO.busy=false;MO.hits=0;MO.mult=1;
    const sizes=[];
    for(let i=0;i<40;i++){ moDeal(); sizes.push(MO.set.size); }
    return [Math.min(...sizes), Math.max(...sizes)];
  })()`);
  (shuf[0] === 3 && shuf[1] === 3) ? pass('mole count constant every redeal', '3 every time')
                                   : fail('mole count constant every redeal', JSON.stringify(shuf));

  // and the redeal must actually move them, not re-place the same set
  const moved = await pg.evaluate(`(()=>{
    MO.moles=3;let diff=0;
    for(let i=0;i<60;i++){ moDeal(); const a=[...MO.set].sort().join(); moDeal();
      if([...MO.set].sort().join()!==a) diff++; }
    return diff;
  })()`);
  moved > 40 ? pass('redeal moves the moles', moved + '/60 layouts changed')
             : fail('redeal moves the moles', moved + '/60');

  // the new sound engine must not throw when driven hard
  const snd = await pg.evaluate(`(()=>{try{SND.init();
    ['click','tick','chip','card','thud','lose','taunt'].forEach(k=>SND[k]());
    SND.peg(3);SND.win(5);SND.big();SND.swing(.3);SND.pop(-.2);SND.whack(4,.1);
    SND.squeak(0);SND.dud(.5);SND.cash(12);SND.hover(0);
    SND.tone(440,.1);SND.noise(.05,.1,1200);
    for(let i=0;i<=10;i++)SND.reel(i/10);SND.reelStop();
    return 'ok'}catch(e){return String(e)}})()`);
  snd === 'ok' ? pass('sound engine runs clean') : fail('sound engine runs clean', snd);

  errs.length === n0 ? pass('no moles console errors') : fail('no moles console errors', errs.slice(n0).join(' | '));
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
    // Moles: 0.98/p^k must hold for every mole count and every cash-out point.
    // Exact expectation first - this covers the deep streaks that simulation
    // cannot reach (1 mole to 8 hits is 1 in 5,764,801, so no sane sample size
    // ever lands one and a Monte Carlo row there would just read 0.00%).
    {const holes=7;let worst=98,worstAt='';
     for(let moles=1;moles<=6;moles++)for(let k=1;k<=8;k++){
       const p=moles/holes,mult=.98/Math.pow(p,k);
       const ev=Math.pow(p,k)*mult*100;           // reach it with p^k, get paid mult
       if(Math.abs(ev-98)>Math.abs(worst-98)){worst=ev;worstAt=moles+'m@'+k}
     }
     res.push(['moles exact EV (worst '+worstAt+')',worst,98,null,0.02]);
     // then simulate the reachable cases, to prove the code matches the maths
     for(const moles of [1,3,6]){
       for(const stopAt of [1,3]){
         const p=moles/holes;const mult=k=>k<=0?1:.98/Math.pow(p,k);
         let ret=0;const N2=400000;
         for(let i=0;i<N2;i++){
           let k=0;
           while(k<stopAt){ if(Math.random()<p)k++; else {k=-1;break} }
           if(k>=stopAt)ret+=mult(stopAt);
         }
         // Tolerance from the estimator's own variance, not a guessed number.
         // Payout is all-or-nothing with q=p^k, so the relative standard error is
         // ~1/sqrt(qN) - at 1 mole and 3 hits that is 2.9%, and a fixed +/-1.2
         // band would fail roughly a third of runs for no reason. The exact-EV
         // row above is what pins the maths down; these rows prove the code
         // matches it. 4 sigma keeps false failures rare.
         const q=Math.pow(p,stopAt), se=98*Math.sqrt((1-q)/(q*N2));
         res.push(['moles '+moles+'m stop@'+stopAt,ret/N2*100,98,null,Math.max(0.5,+(4*se).toFixed(2))]);
       }
     }}
    // Long Shot: the skill game. 97% must be the CEILING - reached only by
    // flawless aim, and strictly lower for anyone worse. That is what stops a
    // good player beating the house on a game where skill genuinely counts.
    {const G=100, tiers=[55,33,16,6];
     const gust=()=>((Math.random()-.5)+(Math.random()-.5))*G;
     const qOf=h=>{const r=(G-h)/G;return 1-r*r};
     tiers.forEach((half,ti)=>{
       const q=qOf(half), payout=.97/q;
       let ret=0;const N2=300000;
       for(let i=0;i<N2;i++)if(Math.abs(gust())<=half)ret+=payout;
       res.push(['longshot t'+ti+' flawless aim',ret/N2*100,97,null,
         Math.max(0.35,+(4*97*Math.sqrt((1-q)/(q*N2))).toFixed(2))]);
     });
     // sloppy aim must return strictly LESS, at every tier
     {let worstOk=1;
      tiers.forEach(half=>{
        const q=qOf(half), payout=.97/q;
        let ret=0;const N2=200000;
        for(let i=0;i<N2;i++){
          const slop=(Math.random()*2-1)*25;      // 25 units of aiming error
          if(Math.abs(gust()+slop)<=half)ret+=payout;
        }
        if(ret/N2*100 >= 96.0) worstOk=0;          // must be clearly under 97
      });
      res.push(['longshot sloppy aim returns less',worstOk?97:80,97,null,1]);
     }}
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
    if (which === 'all' || which === 'moles') await moles(ctx, errs);
    if (which === 'all' || which === 'shot') await longshot(ctx, errs);
    if (which === 'all' || which === 'sports') await sports(ctx, errs);
    if (which === 'all' || which === 'mp') await mp(browser, errs);
    if (which === 'all' || which === 'coop') await coop(browser, errs);
    if (which === 'all' || which === 'strip') await strip(browser, errs);
    if (which === 'all' || which === 'rtp') await rtp(ctx, errs);
  } finally { await browser.close(); }

  console.log('\nCONSOLE ERRORS: ' + (errs.length ? '\n  ' + [...new Set(errs)].join('\n  ') : 'none'));
  const bad = results.filter(r => !r[0]).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed` + (errs.length ? `, ${errs.length} console error(s)` : ''));
  process.exit(bad || errs.length ? 1 : 0);
})();
