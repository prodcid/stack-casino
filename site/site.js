/* ================= STACK CASINO REBRAND: the site =================
   MV (from site/build.py) holds the Motion Vault catalogue: MV.CATS -> [{id,title,items:[{id,n,s,t,h,c,i,j,p,wrap}]}].
   Every area of the site is a motion slot. AREAS lists them, what kinds of animation suit each, and the default.
   Picks are saved in localStorage 'stack.motion.v1'. */
(()=>{
const $=id=>document.getElementById(id);
const ITEM={},CATOF={};MV.CATS.forEach(c=>c.items.forEach(i=>{ITEM[i.id]=i;CATOF[i.id]=c}));
const CATNAME={};MV.CATS.forEach(c=>CATNAME[c.id]=c.title);
const REDUCE=matchMedia('(prefers-reduced-motion: reduce)').matches;
const NATIVE={'X-FADE':['Fade','A quick fade through the page colour'],'X-NONE':['None','No animation here']};
const AREAS=[
 {k:'boot',g:'Everywhere',n:'Opening screen',d:'Plays while the site starts up',cats:['screens','logo'],def:'LS-01',extra:['X-NONE'],full:1},
 {k:'trans',g:'Everywhere',n:'Page transition',d:'Between pages and into every game',cats:['transitions'],def:'PT-11',extra:['X-FADE','X-NONE'],full:1},
 {k:'btn',g:'Everywhere',n:'Buttons',d:'Every call-to-action button',cats:['buttons'],def:'BT-01'},
 {k:'tile',g:'Everywhere',n:'Game tiles',d:'Hover on every game tile in every lobby',cats:['hover'],def:'HV-01'},
 {k:'gameLoad',g:'Everywhere',n:'Game loading',d:'Shown while a game opens',cats:['screens','spin','progress','skeleton'],def:'LS-07',full:1},
 {k:'brand',g:'Everywhere',n:'Footer mark',d:'The logo moment at the bottom of every page',cats:['logo'],def:'LG-13'},
 {k:'heroHead',g:'Lobby',n:'Hero headline',d:'The big line in the lobby hero',cats:['text'],def:'TX-01'},
 {k:'heroFeat',g:'Lobby',n:'Hero feature',d:'The right half of the hero',cats:['bigwin','wins','numbers','games','cards','logo'],def:'BW-06'},
 {k:'heroBg',g:'Lobby',n:'Hero background',d:'Slow motion behind the hero',cats:['ambient'],def:'AM-01',extra:['X-NONE']},
 {k:'tick1',g:'Lobby',n:'Ticker one',d:'Live jackpot',cats:['numbers','progress','games'],def:'NM-05'},
 {k:'tick2',g:'Lobby',n:'Ticker two',d:'Crash this round',cats:['numbers','progress','games'],def:'NM-06'},
 {k:'tick3',g:'Lobby',n:'Ticker three',d:'Next draw',cats:['numbers','progress','games'],def:'NM-07'},
 {k:'win',g:'Lobby',n:'Win moment',d:'Results: you won',cats:['wins','bigwin'],def:'WN-02'},
 {k:'loss',g:'Lobby',n:'Loss moment',d:'Results: you lost',cats:['losses'],def:'LO-01'},
 {k:'promo',g:'Lobby',n:'Featured pack',d:'The Stack Cards promo block',cats:['cards'],def:'CR-05'},
 {k:'skeleton',g:'Casino',n:'Lobby loading',d:'Placeholder while the casino lobby loads',cats:['skeleton','spin'],def:'SK-06'},
 {k:'tables',g:'Tables',n:'Tables feature',d:'Hero of the Tables page',cats:['games','cards'],def:'GA-11'},
 {k:'sports',g:'Sports',n:'Sports feature',d:'Hero of the Sports page',cats:['numbers','progress','games','wins'],def:'NM-11'},
 {k:'markets',g:'Markets',n:'Markets feature',d:'Hero of the Markets page',cats:['numbers','losses','wins','progress'],def:'NM-10'},
 {k:'cards',g:'Cards',n:'Cards feature',d:'Hero of the Cards page',cats:['cards'],def:'CR-04'},
 {k:'arcade',g:'Arcade',n:'Arcade feature',d:'Hero of the Arcade page',cats:['games','bigwin','wins'],def:'GA-07'},
 {k:'walletNum',g:'Wallet',n:'Balance',d:'The big balance number',cats:['numbers'],def:'NM-02'},
 {k:'walletProg',g:'Wallet',n:'VIP progress',d:'Level progress',cats:['progress'],def:'PR-10'},
 {k:'walletState',g:'Wallet',n:'Account status',d:'Verified, locked, offline and so on',cats:['states'],def:'ST-08'},
 {k:'walletToggle',g:'Wallet',n:'Settings control',d:'Switches and inputs',cats:['inputs'],def:'TG-01'}];
const AREA={};AREAS.forEach(a=>AREA[a.k]=a);
let PICK={};try{PICK=JSON.parse(localStorage.getItem('stack.motion.v1')||'{}')}catch(e){}
const pick=k=>{const a=AREA[k],v=PICK[k];return v&&(ITEM[v]||NATIVE[v])?v:ITEM[a.def]?a.def:(MV.CATS.find(c=>c.id===a.cats[0])||{items:[{}]}).items[0].id};
const savePick=()=>{try{localStorage.setItem('stack.motion.v1',JSON.stringify(PICK))}catch(e){}};
const nameOf=id=>ITEM[id]?ITEM[id].n:NATIVE[id]?NATIVE[id][0]:id;

/* ---------- a vault specimen inside a box ---------- */
const VIO=new IntersectionObserver(es=>es.forEach(e=>{const st=e.target;st.classList.toggle('vis',e.isIntersecting);if(e.isIntersecting&&st._auto&&!st._played){st._played=1;MV.play(st)}}),{rootMargin:'40px'});
/* fit a specimen to its box: a full-bleed one (absolutely placed, e.g. a mini UI) scales the vault's 290x218 frame;
   anything else is measured and scaled so its content fills about 85% of the box */
function fitZ(el,st){const W=el.clientWidth,H=el.clientHeight;if(!W||!H)return false;st.style.setProperty('--z',1);st.style.width=W+'px';st.style.height=H+'px';
 const kids=[...st.firstElementChild.children].filter(k=>!k.classList.contains('fx'));let full=false,x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const k of kids){const cs=getComputedStyle(k);if(cs.position==='absolute'&&(parseFloat(cs.left)<=30||cs.inset!=='auto'))full=true;const r=k.getBoundingClientRect();if(!r.width&&!r.height)continue;x0=Math.min(x0,r.left);y0=Math.min(y0,r.top);x1=Math.max(x1,r.right);y1=Math.max(y1,r.bottom)}
 st.style.width='';st.style.height='';let z;if(full||x1<=x0)z=Math.min(W/290,H/218);else{const cw=x1-x0,ch=y1-y0,t=!!st.closest('.tcell');z=Math.min(W*(t?.84:.66)/cw,H*(t?.8:.6)/ch)}
 z=Math.max(.4,Math.min(st.closest('.tcell')?6:full?5:2.6,z));st.style.setProperty('--z',z.toFixed(3));return true}
function mount(el,id,html){if(!el)return null;el.querySelectorAll(':scope>.stage').forEach(s=>{VIO.unobserve(s);s.remove()});el._id=id;if(!id||NATIVE[id]){tagFor(el);return null}
 const it=ITEM[id];if(!it)return null;const st=document.createElement('div');st.className='stage '+(it.wrap||'')+(it.t==='hover'||it.t==='tap'?' int':'');
 st.innerHTML=`<div style="display:contents">${html||it.h}</div>`;st._item=it;st._auto=it.t==='auto';el.prepend(st);fitZ(el,st);VIO.observe(st);
 try{it.i&&it.i(st)}catch(e){console.error(id,e)}if(it.t==='auto')st.addEventListener('click',()=>MV.play(st));tagFor(el);return st}
function tagFor(el){const k=el.dataset.area;if(!k||!AREA[k])return;let t=el.querySelector(':scope>.tag');if(!t){t=document.createElement('button');t.className='tag';el.appendChild(t);t.addEventListener('click',e=>{e.stopPropagation();openPicker(k)})}
 t.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>${AREA[k].n} · ${pick(k)}`}
setInterval(()=>{if(REDUCE||document.hidden)return;const now=performance.now();document.querySelectorAll('.stage.vis').forEach(st=>{if(!st._auto)return;if(now-(st._last||0)>(st._item.p||3200))MV.play(st)})},250);
addEventListener('resize',()=>document.querySelectorAll('.slot>.stage,.pv>.stage,.mini>.stage').forEach(st=>fitZ(st.parentElement,st)));

/* ---------- games (the glyph is the tile) ---------- */
const G=(k,n,g,c,r)=>({k,n,g,c,r});
const GAMES={orig:[G('crash','Crash','2.41×','Instant','RTP 97%'),G('blackjack','Blackjack','21','Cards','RTP 99.1%'),G('roulette','Roulette','00','Table','RTP 97.3%'),G('plinko','Plinko','×16','Instant','RTP 97%'),
  G('mines','Mines','24','Instant','RTP 97%'),G('dice','Dice','50.5','Dice','RTP 98%'),G('limbo','Limbo','1000×','Instant','RTP 98%'),G('slots','Dragon Stacks','777','Slots','RTP 96.5%'),
  G('tower','Tower','8F','Instant','RTP 97%'),G('chicken','Chicken Road','×7','Instant','RTP 97%'),G('balloon','Balloon','POP','Instant','RTP 97%'),G('wheel','Fortune Wheel','30','Instant','RTP 97%'),
  G('keno','Keno','80','Instant','RTP 97%'),G('hilo','Hi-Lo','K','Cards','RTP 98%'),G('scratch','Scratch','$$$','Instant','RTP 96%'),G('olympus','Olympus Storm','×500','Slots','RTP 96.5%'),
  G('egypt',"Ra's Fortune",'RA','Slots','RTP 96.5%'),G('poker','Video Poker','AA','Cards','RTP 97%')],
 tables:[G('t-bj','Blackjack','21','Live','RTP 99.1%'),G('t-rou','Roulette','00','Live','RTP 97.3%'),G('t-pk',"Texas Hold'em",'AA','Poker','Skill'),G('t-bac','Baccarat','9','Live','RTP 98.9%'),
  G('t-dt','Dragon Tiger','D/T','Live','RTP 96.3%'),G('t-tcp','Three Card Poker','QQQ','Poker','RTP 98%'),G('t-war','Casino War','K','Live','RTP 97.6%'),G('t-ab','Andar Bahar','A|B','Live','RTP 97.9%'),
  G('t-mw','Money Wheel','×48','Wheel','RTP 98%'),G('t-sb','Sic Bo','4–17','Dice','RTP 97.2%'),G('t-cr','Craps','7','Dice','RTP 98.6%'),G('pool','Stack Pool','8','Party','Friendly')],
 sports:[G('football','Football','2–1','Live','Every match'),G('racing','Racing','1st','Horses','Every race'),G('fight','Fight Night','KO','Combat','Every bout'),G('gp','Stack GP','P1','Motor','Every lap'),G('nrl','Stack League','24–18','League','Every round')],
 markets:[G('m-term','Terminal','5,120','Trade','Leverage'),G('m-scr','Screener','12','Data','Every market'),G('m-ipo','IPO Centre','IPO','New listings','Every 5 min'),G('m-pulse','Market Pulse','LIVE','News','Stories')],
 cards:[G('c-packs','Packs','S03','Open','Six a series'),G('c-clash','Stack Clash','VS','Battle','Party'),G('c-trade','Trades','⇄','Party','With your mate'),G('c-col','Collection','148','Album','Every card')],
 arcade:[G('a-claw','Claw','×50','Prize','Grab it'),G('a-push','Coin Pusher','PUSH','Coins','Drop it'),G('a-heads','Stackheads','#12','Figures','Collect them')]};
GAMES.all=GAMES.orig;
function tileHTML(id,g){let h=ITEM[id].h;const R=(re,v)=>{h=h.replace(re,(m,a,b)=>a+v+b)},S=(a,v)=>{h=h.split(a).join(v)};/* replacer functions: a glyph like $$$ must stay literal */
 R(/(<b class="dn">)[^<]*(<\/b>)/,g.g);R(/(<\/b>)<span>[^<]*(<\/span>)/,'<span>'+g.n);R(/(<b class="dw">)[^<]*(<\/b>)/,g.n);R(/(<span class="l1 dn">)[^<]*(<\/span>)/,g.g);
 S('RTP 97%',g.r);S('Max ×5000',g.c);S('5 × 5 grid',g.c);S('>24<','>'+g.g+'<');S('gems to find',g.r);return h}
function buildTiles(root){const set=GAMES[root.dataset.tiles]||[],lim=+root.dataset.lim||set.length,id=pick('tile'),f=root._filter;
 root.innerHTML=set.slice(0,lim).filter(g=>!f||f==='All'||g.c===f).map(g=>`<div class="tcell" data-g="${g.k}"><div class="slot"></div><div class="meta"><span class="mono">${g.c}</span><span class="mono">${g.r}</span></div></div>`).join('');
 root.querySelectorAll('.tcell').forEach(c=>{const g=set.find(x=>x.k===c.dataset.g);mount(c.querySelector('.slot'),id,tileHTML(id,g));c.addEventListener('click',()=>openGame(g,root.dataset.tiles))});
 root.dataset.area='tile';tagFor(root)}
/* ---------- buttons (the chosen vault button, relabelled) ---------- */
function btnHTML(id,label){return ITEM[id].h.replace(/>([^<>]*\S[^<>]*)</g,(m,t)=>t.trim()==='·'?m:'>'+label+'<')}
function buildBtn(span){const id=pick('btn'),label=span.dataset.btn;span.innerHTML='';const st=document.createElement('span');st.className='stage bst int vis';st.style.cssText='width:auto;height:auto;zoom:1;overflow:visible';
 st.innerHTML=btnHTML(id,label);st._item=ITEM[id];span.appendChild(st);try{ITEM[id].i&&ITEM[id].i(st)}catch(e){}
 const b=st.querySelector('button');if(b)b.addEventListener('click',()=>{try{ITEM[id].j&&ITEM[id].j(st)}catch(e){}st.classList.remove('go');void st.offsetWidth;st.classList.add('go');act(span.dataset)});
 const row=span.closest('.btnrow');if(row){row.dataset.area='btn';tagFor(row)}}
function act(d){if(d.g&&GAMES[d.g])return openGame(GAMES[d.g][0],d.g);if(d.go)setTimeout(()=>go(d.go),ITEM[pick('btn')]&&/BT-11/.test(pick('btn'))?900:60);if(d.act==='bonus')addBal(250,'Bonus claimed');if(d.act==='dep')addBal(1000,'Deposit received');if(d.act==='wd')toast('Withdrawals are off in play mode')}

/* ---------- balance: an odometer, never a snap ---------- */
let BAL=12480;const ACT=[['Crash · cashed out 4.20×','+1,050.00'],['Blackjack · blackjack','+375.00'],['Roulette · 17 black','−200.00'],['Deposit','+5,000.00']];
function drawBal(){const o=$('balOdo');if(!o.firstChild){o.innerHTML=MV.odoHTML(MV.fmt(BAL));requestAnimationFrame(()=>MV.odoSet(o,MV.fmt(BAL)))}else MV.odoSet(o,MV.fmt(BAL))}
function addBal(n,msg){BAL+=n;drawBal();ACT.unshift([msg,'+'+MV.fmt(n)]);drawActs();toast(`${msg} · +${MV.fmt(n)}`)}
function drawActs(){const a=$('acts');if(a)a.innerHTML=ACT.slice(0,6).map(([t,v])=>`<div>${t}<span>${v}</span></div>`).join('')}
function toast(t){const d=document.createElement('div');d.className='toast';d.innerHTML=`<svg class="rib" viewBox="0 0 96 96"><path d="M84 22 H30 A13 13 0 0 0 30 48 H66 A13 13 0 0 1 66 74 H12"/></svg>${t}`;$('toasts').appendChild(d);setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),300)},2800)}

/* ---------- pages ---------- */
const PAGES=[['lobby','Lobby'],['casino','Casino'],['tables','Tables'],['sports','Sports'],['markets','Markets'],['cards','Cards'],['arcade','Arcade'],['wallet','Wallet']];
const SECT={tables:['Live tables · 12 games','Tables.','Live dealers, real felt, every RTP shown. Poker night against the AI, and Stack Pool with your mate.'],
 sports:['Sport · five books','Sports.','Football, racing, fight night, motor sport and league, all on one balance.'],
 markets:['Markets · live','Markets.','Trade the Stack market with leverage, buy shares to hold, watch IPOs ring the bell.'],
 cards:['Stack cards · series 03','Cards.','Open packs, build a collection, trade with your mate and battle in Stack Clash.'],
 arcade:['Arcade · prizes','Arcade.','Claw machine, coin pusher and Stackheads figures to collect.']};
for(const [k,[eb,t,d]] of Object.entries(SECT))$('p-'+k).innerHTML=`<div class="secthero frame"><div class="copy"><span class="mono">${eb}</span><h1 class="dw">${t}</h1><p style="margin:0;color:var(--ink-2);max-width:40ch">${d}</p><div class="btnrow" style="margin-top:18px"><span data-btn="Play now" data-g="${k}"></span></div></div><div class="slot" data-area="${k}"></div></div>
 <div class="sh reveal"><div><span class="mono">${t.replace('.','')} · all games</span><h2 class="dw">Every game.</h2></div><p>Outlined, numbered, one click to play.</p></div><div class="frame hgrid tiles" data-tiles="${k}"></div>`;
$('nav').insertAdjacentHTML('beforeend',PAGES.map(([k,l])=>`<a href="#${k}" data-p="${k}">${l}</a>`).join(''));
$('casChips').innerHTML=['All','Instant','Cards','Dice','Slots','Table'].map((c,i)=>`<button class="${i?'':'on'}" data-c="${c}">${c}</button>`).join('');
$('casChips').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$('casChips').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));const g=$('casGrid');g._filter=b.dataset.c;buildTiles(g)});
document.querySelector('[data-tiles="orig"]').dataset.lim=10;
let CUR=null;
function mountPage(p){const el=$('p-'+p);el.querySelectorAll('.slot[data-area]').forEach(s=>mount(s,pick(s.dataset.area)));el.querySelectorAll('[data-tiles]').forEach(buildTiles);el.querySelectorAll('[data-btn]').forEach(buildBtn);
 el.querySelectorAll('.reveal').forEach(r=>RIO.observe(r));
 if(p==='casino'){const sk=$('casSkel'),gr=$('casGrid');sk.hidden=false;gr.hidden=true;mount(sk,pick('skeleton'));clearTimeout(mountPage.t);mountPage.t=setTimeout(()=>{sk.hidden=true;gr.hidden=false;buildTiles(gr);gr.classList.add('enter')},1400)}
 if(p==='wallet')drawActs()}
function navPill(){const a=document.querySelector('.nav a.on'),p=$('navPill');if(!a){p.style.width='0';return}p.style.width=a.offsetWidth+'px';p.style.transform=`translateX(${a.offsetLeft}px)`}
function show(p){CUR=p;document.querySelectorAll('.page').forEach(s=>s.classList.toggle('on',s.id==='p-'+p));document.querySelectorAll('.nav a').forEach(a=>a.classList.toggle('on',a.dataset.p===p));navPill();scrollTo(0,0);
 const el=$('p-'+p);mountPage(p);el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter')}
/* the chosen transition covers the screen, the page swaps underneath, then it uncovers */
function cover(swap){const t=pick('trans');if(REDUCE||t==='X-NONE'){swap();return Promise.resolve()}
 return new Promise(res=>{if(t==='X-FADE'){const f=document.createElement('div');f.className='xfade';document.body.appendChild(f);requestAnimationFrame(()=>f.classList.add('go'));setTimeout(()=>{swap();f.classList.remove('go');setTimeout(()=>{f.remove();res()},260)},250);return}
  if(t==='PT-12'){const r=document.createElement('div');r.className='xrib';r.innerHTML='<svg viewBox="0 0 96 96"><path pathLength="1" d="M84 22 H30 A13 13 0 0 0 30 48 H66 A13 13 0 0 1 66 74 H12"/></svg>';document.body.appendChild(r);requestAnimationFrame(()=>r.classList.add('go'));
   setTimeout(()=>{swap();r.classList.remove('go');void r.offsetWidth;r.classList.add('out');setTimeout(()=>{r.remove();res()},620)},640);return}
  const b=document.createElement('div');b.className='xbar';b.innerHTML='<i></i><i></i><i></i>';document.body.appendChild(b);requestAnimationFrame(()=>b.classList.add('go'));
  setTimeout(()=>{swap();b.classList.remove('go');void b.offsetWidth;b.classList.add('out');setTimeout(()=>{b.remove();res()},560)},560)})}
function go(p){if(!PAGES.some(x=>x[0]===p))p='lobby';if(p===CUR&&!$('game').classList.contains('on'))return;cover(()=>{$('game').classList.remove('on');show(p);if(location.hash!=='#'+p)history.replaceState(null,'','#'+p)})}
addEventListener('hashchange',()=>go(location.hash.slice(1)));
document.querySelector('.lock').addEventListener('click',e=>{e.preventDefault();go('lobby')});
$('nav').addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;e.preventDefault();go(a.dataset.p)});
/* ---------- the game screen: white, says which game, after the loading animation ---------- */
const GROUP={orig:'Stack original',all:'Stack original',tables:'Stack tables',sports:'Stack sports',markets:'Stack markets',cards:'Stack cards',arcade:'Stack arcade'};
function openGame(g,grp){cover(()=>{const gp=$('game');gp.classList.add('on');$('gTitle').textContent=`Here is ${g.n}.`;$('gGlyph').textContent=g.g;$('gEyebrow').textContent=`${GROUP[grp]||'Stack'} · ${g.r}`;
 const L=$('gLoad');L.style.opacity=1;L.hidden=false;const s=L.querySelector('.slot');mount(s,pick('gameLoad'));clearTimeout(openGame.t);openGame.t=setTimeout(()=>{L.style.opacity=0;setTimeout(()=>L.hidden=true,420)},NATIVE[pick('gameLoad')]?0:2200)})}
$('gBack').addEventListener('click',()=>go(CUR||'lobby'));
$('dep').addEventListener('click',()=>addBal(1000,'Deposit received'));
/* ---------- invert ---------- */
$('invBtn').addEventListener('click',()=>{const r=document.documentElement,cur=r.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');r.dataset.theme=cur==='dark'?'light':'dark';$('invBtn').classList.toggle('on',r.dataset.theme==='dark');try{localStorage.setItem('stack.theme',r.dataset.theme)}catch(e){}});
try{const t=localStorage.getItem('stack.theme');if(t){document.documentElement.dataset.theme=t;$('invBtn').classList.toggle('on',t==='dark')}}catch(e){}
const RIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');RIO.unobserve(e.target)}}),{rootMargin:'-60px'});

/* ---------- Motion panel: every area, and a picker for each ---------- */
function overlay(on){$('scrim').classList.toggle('on',on)}
function openDrawer(){drawList();$('drawer').classList.add('on');overlay(true)}
function closeAll(){$('drawer').classList.remove('on');$('sheet').classList.remove('on');overlay(false);$('shList').innerHTML=''}
function drawList(){const groups=[...new Set(AREAS.map(a=>a.g))];$('areaList').innerHTML=groups.map(g=>`<div class="grp mono">${g}</div>`+AREAS.filter(a=>a.g===g).map(a=>`<div class="arow" data-k="${a.k}"><div class="mini" data-m="${a.k}"></div><div><b>${a.n}</b><small>${a.d}</small></div><span class="id">${pick(a.k)}</span></div>`).join('')).join('');
 $('areaList').querySelectorAll('[data-m]').forEach(m=>{const id=pick(m.dataset.m);if(ITEM[id])mount(m,AREA[m.dataset.m].k==='tile'?id:id,AREA[m.dataset.m].k==='tile'?tileHTML(id,GAMES.orig[0]):AREA[m.dataset.m].k==='btn'?btnHTML(id,'Play now'):null);else m.innerHTML=`<span class="mono" style="position:absolute;inset:0;display:grid;place-items:center">${nameOf(id)}</span>`});
 $('areaList').querySelectorAll('.arow').forEach(r=>{r.addEventListener('click',()=>openPicker(r.dataset.k));r.addEventListener('mouseenter',()=>document.querySelectorAll(`.page.on [data-area="${r.dataset.k}"]`).forEach(x=>{x.classList.remove('flash');void x.offsetWidth;x.classList.add('flash')}))})}
let SHA=null,SHC=null;const PIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&!e.target._m){e.target._m=1;const id=e.target.dataset.id,a=AREA[SHA];mount(e.target,id,a.k==='tile'?tileHTML(id,GAMES.orig[0]):a.k==='btn'?btnHTML(id,'Play now'):null)}}),{root:null,rootMargin:'200px'});
function openPicker(k){SHA=k;const a=AREA[k];SHC=a.cats[0];$('shEyebrow').textContent=`${a.g} · ${a.d}`;$('shTitle').textContent=a.n;
 $('shCats').innerHTML=a.cats.map(c=>`<button data-c="${c}">${CATNAME[c]}</button>`).join('')+(a.extra?'<button data-c="_x">Other</button>':'')+'<button data-c="_all">Everything</button>'+(a.full?`<span class="sp"></span><button data-prev="1" style="border-color:var(--ink);color:var(--ink)">Preview it</button>`:'');
 $('shCats').querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{SHC=b.dataset.c;drawPicks()});const pv=$('shCats').querySelector('[data-prev]');if(pv)pv.onclick=()=>previewArea(k);
 const cur=pick(k);SHC=NATIVE[cur]?'_x':(a.cats.includes(CATOF[cur]&&CATOF[cur].id)?CATOF[cur].id:a.cats[0]);drawPicks();$('drawer').classList.remove('on');$('sheet').classList.add('on');overlay(true)}
function drawPicks(){const a=AREA[SHA],cur=pick(SHA);$('shCats').querySelectorAll('[data-c]').forEach(b=>b.classList.toggle('on',b.dataset.c===SHC));
 const ids=SHC==='_x'?a.extra:SHC==='_all'?MV.CATS.filter(c=>c.items.length).flatMap(c=>c.items.map(i=>i.id)):(MV.CATS.find(c=>c.id===SHC)||{items:[]}).items.map(i=>i.id);
 $('shList').innerHTML=`<div class="pgrid">${ids.map(id=>`<div class="pick${id===cur?' on':''}" data-id="${id}"><div class="pv" data-id="${id}">${NATIVE[id]?`<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:16px"><b class="dw" style="font-size:26px">${NATIVE[id][0]}</b><small style="color:var(--ink-2)">${NATIVE[id][1]}</small></div>`:''}</div><div class="cap"><b>${nameOf(id)}</b><span>${NATIVE[id]?'SITE':id}</span></div></div>`).join('')}</div>`;
 $('shList').querySelectorAll('.pv').forEach(p=>{if(!NATIVE[p.dataset.id])PIO.observe(p)});
 $('shList').querySelectorAll('.pick').forEach(p=>p.addEventListener('click',()=>{PICK[SHA]=p.dataset.id;savePick();$('shList').querySelectorAll('.pick').forEach(x=>x.classList.toggle('on',x===p));apply(SHA);if(AREA[SHA].full)previewArea(SHA)}))}
function apply(k){if(k==='tile')document.querySelectorAll('[data-tiles]').forEach(t=>{if(t.closest('.page.on')&&!t.hidden)buildTiles(t)});else if(k==='btn')document.querySelectorAll('.page.on [data-btn]').forEach(buildBtn);
 else document.querySelectorAll(`[data-area="${k}"]`).forEach(s=>{if(s.classList.contains('slot')&&(s.closest('.page.on')||s.closest('.foot')))mount(s,pick(k))});document.querySelectorAll('.tag').forEach(t=>{const s=t.parentElement;if(s.dataset.area)tagFor(s)})}
function previewArea(k){if(k==='boot'){closeAll();boot(true)}else if(k==='trans'){closeAll();cover(()=>{})}else if(k==='gameLoad'){closeAll();openGame(GAMES.orig[0],'orig')}}
$('motionBtn').addEventListener('click',openDrawer);$('scrim').addEventListener('click',closeAll);$('shClose').addEventListener('click',()=>{$('sheet').classList.remove('on');$('shList').innerHTML='';openDrawer()});
addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});
$('editSw').addEventListener('click',()=>{const on=document.body.classList.toggle('edit');$('editSw').classList.toggle('on',on)});
$('resetBtn').addEventListener('click',()=>{PICK={};savePick();AREAS.forEach(a=>apply(a.k));drawList();toast('Every area is back to its default')});

/* ---------- start: the opening screen, then the lobby ---------- */
function boot(again){const b=$('boot'),id=pick('boot');if(NATIVE[id]||REDUCE){b.classList.add('off');return}b.classList.remove('off');const s=b.querySelector('.slot');mount(s,id);
 clearTimeout(boot.t);boot.t=setTimeout(()=>b.classList.add('off'),again?2800:2600)}
$('skip').addEventListener('click',()=>{clearTimeout(boot.t);$('boot').classList.add('off')});
drawBal();mount(document.querySelector('.foot [data-area="brand"]'),pick('brand'));
boot();show(PAGES.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'lobby');
window.SITE={AREAS,pick,PICK:()=>PICK,go,openGame,openPicker,ITEM,cover};
})();
