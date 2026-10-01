#!/usr/bin/env node
/* test-pool.js - Stack Pool inside Stack.
   node test-pool.js         everything
   node test-pool.js solo    look, no AI stakes, the physics is deterministic
   node test-pool.js party   two windows: party, invite, accept, seats, live aim, a shot on both screens
   Needs: npm i -D playwright && npx playwright install chromium */
const path = require('path');
const FILE = process.env.STACK_FILE || 'stack-casino.html';
const URL = 'file://' + path.resolve(FILE);
let playwright;
try { playwright = require('playwright'); }
catch { console.error('x  playwright missing.  npm i -D playwright && npx playwright install chromium'); process.exit(2); }
const results = [];
const pass = (n, d = '') => { results.push([true, n, d]); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push([false, n, d]); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, typeof d === 'string' ? d : JSON.stringify(d));

/* PeerJS stand-in (same as test.js): wires two pages straight to each other, no network */
const MOCK = `
window.Peer=class{constructor(id){this.id=id||('anon'+Math.random());this.h={};window.__peer=this;setTimeout(()=>this.h.open&&this.h.open(this.id),20)}
 on(e,f){this.h[e]=f} connect(){const c=window.__mk();window.__conn=c;setTimeout(()=>window.__netOut(JSON.stringify({type:'connect'})),20);return c} destroy(){} reconnect(){}};
window.__mk=()=>({open:false,h:{},on(e,f){this.h[e]=f},send(d){window.__netOut(JSON.stringify({type:'data',d}))},close(){}});
window.__netIn=(s)=>{const m=JSON.parse(s);
 if(m.type==='connect'){const c=window.__mk();window.__conn=c;window.__peer.h.connection(c);setTimeout(()=>{c.open=true;c.h.open&&c.h.open();window.__netOut(JSON.stringify({type:'opened'}))},15)}
 else if(m.type==='opened'){const c=window.__conn;c.open=true;c.h.open&&c.h.open()}
 else if(m.type==='data'){const c=window.__conn;c&&c.h.data&&c.h.data(m.d)}};`;

async function signIn(pg, user) {
  await pg.waitForSelector('#authGate.show', { timeout: 8000 });
  await pg.click('[data-am="signup"]');
  await pg.fill('#auU', user); await pg.fill('#auP', 'pw123'); await pg.fill('#auP2', 'pw123');
  await pg.click('#auGo');
  await pg.waitForFunction('loggedIn()', null, { timeout: 8000 });
  await pg.waitForTimeout(150);
  await pg.evaluate("(()=>{const b=document.querySelector('#teleOk');b&&b.click()})()");
}
async function newPage(ctx, errs, tag, withMock) {
  const pg = await ctx.newPage();
  if (withMock) await pg.addInitScript(MOCK);
  pg.on('pageerror', e => errs.push(`${tag}: ${e}`));
  pg.on('dialog', d => d.accept().catch(() => {}));
  await pg.goto(URL); await pg.waitForTimeout(500);
  if (await pg.evaluate('!loggedIn()')) await signIn(pg, 'u' + tag);
  return pg;
}
/* run code inside the pool frame (its own globals: A = the game state, M = the menu) */
const inPool = (pg, code) => pg.evaluate(c => FG.pool.frame.contentWindow.eval(c), code);
async function openPool(pg) { await pg.evaluate("go('pool')"); await pg.waitForFunction('FG.pool.ready&&FG.pool.frame.contentWindow.StackFrame', null, { timeout: 60000 }); await pg.waitForTimeout(700); }

async function solo(browser, errs) {
  console.log('\nSTACK POOL (solo)');
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const pg = await newPage(ctx, errs, 'ps', false);
  const nav = await pg.evaluate("!!document.querySelector('#side [data-g=pool]')&&!!document.querySelector('#tilesTables [data-go=pool]')");
  check(nav, 'sidebar and home tile open Stack Pool');
  await openPool(pg);
  const look = await inPool(pg, `({font:getComputedStyle(document.body).fontFamily,bg:getComputedStyle(document.body).backgroundColor,bridged:window.StackBridge===parent.FrameBridges.pool,name:SET.name,logo:document.querySelector('.logo').textContent.trim()})`);
  check(/Outfit/.test(look.font) && look.bg === 'rgb(15, 33, 46)' && look.bridged && look.name === 'ups' && /STACK\s*POOL/.test(look.logo), 'Stack fonts, navy, account name, casino bridge', look);
  const st = await inPool(pg, `M.opp='ai';M.stake=500;renderMenu();({stakeUI:/stake/i.test(document.querySelector('#menu').innerText.replace(/mistake/ig,'')),pay:/pays ×/.test(document.querySelector('#menu').innerText)})`);
  const bal0 = await pg.evaluate('P().bal');
  await inPool(pg, `M.stake=500;launch()`); await pg.waitForTimeout(800);
  const after = await inPool(pg, `({stake:A.stake,on:!!A.game,ai:A.game.G.players[1].type})`);
  const bal1 = await pg.evaluate('P().bal');
  check(!st.stakeUI && !st.pay && after.stake === 0 && after.on && after.ai === 'ai' && bal1 === bal0, 'AI games are friendlies: no stake UI, no chips taken', { st, after, bal0, bal1 });
  // the physics core is deterministic: the same break twice gives the same table
  const det = await inPool(pg, `(()=>{const run=()=>{const g=newGame({mode:'eight',seed:12345,breaker:0,players:[{name:'a',type:'human'},{name:'b',type:'human'}]});const cb=g.balls[0];strike(g.W,cb,0,0.9,0.1,-0.2,0.012);const ev=newEvent();for(let i=0;i<60000;i++){if(!stepWorld(g.W,g.balls,DT,ev))break}return g.balls.map(b=>[b.id,b.x.toFixed(9),b.y.toFixed(9),b.on]).join('|')};return run()===run()})()`);
  check(det, 'physics: the same shot plays out identically');
  await ctx.close();
}

async function party(browser, errs) {
  console.log('\nSTACK POOL (party)');
  const vp = { viewport: { width: 1400, height: 900 } };
  const ctxA = await browser.newContext(vp), ctxB = await browser.newContext(vp);
  const A = await newPage(ctxA, errs, 'A', true), B = await newPage(ctxB, errs, 'B', true);
  await A.exposeFunction('__netOut', s => B.evaluate(x => window.__netIn(x), s).catch(() => {}));
  await B.exposeFunction('__netOut', s => A.evaluate(x => window.__netIn(x), s).catch(() => {}));
  await A.reload(); await B.reload(); await A.waitForTimeout(700);
  // the OG way: A hosts a party, B joins with the code
  await A.evaluate("go('party')"); await B.evaluate("go('party')");
  await A.click('#pHost'); await A.waitForTimeout(400);
  await B.fill('#pCode', await A.evaluate('NET.code')); await B.click('#pJoin'); await B.waitForTimeout(1000);
  check(await A.evaluate("NET.status==='connected'") && await B.evaluate("NET.status==='connected'"), 'party connected');
  // A opens Stack Pool, Online: the mate shows with an invite button
  await openPool(A);
  const card = await inPool(A, `M.opp='online';M.mode='eight';renderMenu();({btn:(document.querySelector('#bInvite')||{}).textContent||'',start:!!document.querySelector('#bStart'),mate:document.querySelector('.pty .ptyc b').textContent})`);
  check(/Invite uB/.test(card.btn) && card.mate === 'uB' && !card.start, 'Online tab shows your party mate with an Invite button', card);
  await inPool(A, `document.querySelector('#bInvite').click()`); await A.waitForTimeout(500);
  const waitA = await inPool(A, `({st:PARTY.st,txt:document.querySelector('#menu').innerText.includes('Waiting for')})`);
  const hud = await B.evaluate("({inv:!!CO.poolInv,acc:!!document.querySelector('#coPoolAcc'),txt:$('coHud').innerText})");
  check(waitA.st === 'inviting' && waitA.txt && hud.inv && hud.acc && /Stack Pool/.test(hud.txt), 'invite reaches the mate\'s party HUD (Accept / Decline)', { waitA, hud });
  // B accepts: Stack Pool opens for B and joins A's game; A hosts and breaks
  await B.click('#coPoolAcc');
  await B.waitForFunction("$('poolView').classList.contains('on')&&FG.pool.ready&&FG.pool.frame.contentWindow.eval('!!A.game')", null, { timeout: 60000 });
  for (const [pg, ph] of [[A, 'aim'], [B, 'remote']]) await pg.waitForFunction(`FG.pool.frame.contentWindow.eval('A.phase')==='${ph}'`, null, { timeout: 30000 }).catch(() => {});
  const sa = await inPool(A, `({seat:A.seat,names:A.game.G.players.map(p=>p.name+':'+p.type),turn:A.game.G.turn,phase:A.phase,net:!!A.net})`);
  const sb = await inPool(B, `({seat:A.seat,names:A.game.G.players.map(p=>p.name+':'+p.type),turn:A.game.G.turn,phase:A.phase,net:!!A.net})`);
  check(sa.seat === 0 && sb.seat === 1 && sa.names.join() === 'uA:human,uB:remote' && sb.names.join() === 'uA:remote,uB:human' && sa.phase === 'aim' && sb.phase === 'remote' && sa.net && sb.net,
    'accept takes the mate into the game: host breaks, mate watches', { sa, sb });
  const rack = async pg => inPool(pg, `A.game.balls.map(b=>b.id+':'+b.x.toFixed(6)+','+b.y.toFixed(6)).join('|')`);
  check(await rack(A) === await rack(B), 'both tables racked identically');
  // live cue: A aims and pulls back, B's screen follows
  await inPool(A, `A.aim.a=2.5;A.aim.p=0.6;A.aim.sx=0.3;A.aim.sy=-0.2;sendAim()`); await A.waitForTimeout(700);
  const ra = await inPool(B, `({a:A.remoteAim&&A.remoteAim.a,p:A.remoteAim&&A.remoteAim.p,vis:+A.cueVis.a.toFixed(3),sx:A.aim.sx,sy:A.aim.sy})`);
  check(ra.a === 2.5 && ra.p === 0.6 && Math.abs(ra.vis - 2.5) < 0.02 && ra.sx === 0.3 && ra.sy === -0.2, 'live cue: angle, power and spin reach your mate and the cue glides there', ra);
  // the break: both sides simulate the same shot, then the turn hands over
  await inPool(A, `fireShot({a:0,p:0.85,sx:0,sy:0.1},true)`);
  await A.waitForTimeout(400);
  const running = await inPool(B, `A.phase`);
  for (const pg of [A, B]) await pg.waitForFunction("['aim','remote','over'].includes(FG.pool.frame.contentWindow.eval('A.phase'))", null, { timeout: 60000 });
  await A.waitForTimeout(800);
  const endA = await rack(A), endB = await rack(B);
  const tA = await inPool(A, `[A.game.G.turn,A.phase]`), tB = await inPool(B, `[A.game.G.turn,A.phase]`);
  check(['stroke', 'run'].includes(running) && endA === endB && tA[0] === tB[0], 'the shot plays live on both screens and ends on the same table', { running, same: endA === endB, tA, tB });
  // give each other goes: whoever's turn it is now can shoot, the other watches
  const shooter = tA[1] === 'aim' ? A : B, watcher = shooter === A ? B : A;
  check((await inPool(watcher, 'A.phase')) === 'remote', 'turns alternate: one shoots, the other watches', { tA, tB });
  await inPool(shooter, `(()=>{const g=A.game,cb=g.balls[0];if(g.G.bih)A.phase='aim';fireShot({a:Math.PI/3,p:0.5,sx:0,sy:0,cue:{x:cb.x,y:cb.y}},true)})()`);
  for (const pg of [A, B]) await pg.waitForFunction("['aim','remote','over'].includes(FG.pool.frame.contentWindow.eval('A.phase'))", null, { timeout: 60000 });
  await A.waitForTimeout(800);
  check(await rack(A) === await rack(B), 'second shot (the other player) also matches on both screens');
  // decline path, and the party leaving ends the game cleanly
  await inPool(A, `A.over=true;openMenu();M.opp='online';renderMenu();document.querySelector('#bInvite').click()`); await A.waitForTimeout(500);
  await B.evaluate("go('lobby')"); await B.waitForTimeout(200);
  await B.click('#coPoolDec'); await A.waitForTimeout(600);
  check((await inPool(A, 'PARTY.st')) === 'declined' && !(await B.evaluate('CO.poolInv')), 'decline: the inviter is told');
  await A.close(); await B.close();
}

(async () => {
  const which = process.argv[2] || 'all';
  const browser = await playwright.chromium.launch();
  const errs = [];
  if (which === 'all' || which === 'solo') await solo(browser, errs);
  if (which === 'all' || which === 'party') await party(browser, errs);
  await browser.close();
  errs.length ? fail('no page errors', errs.slice(0, 5).join(' | ')) : pass('no page errors');
  const bad = results.filter(r => !r[0]).length;
  console.log(`\n${results.length - bad}/${results.length} passed`);
  process.exit(bad ? 1 : 0);
})();
