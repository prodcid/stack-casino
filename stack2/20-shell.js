/* ================= SHELL: login, navigation, router, lobby, feed, account ================= */
const GAMES={},ORDER=[];
const HOW={'crash': 'Bet during the countdown, then hit Cash out before the line crashes. The longer you wait, the more you win, and the more likely it busts.', 'dice': 'Drag the slider to set your target, choose over or under, then roll. A smaller chance pays more.', 'limbo': 'Set a target multiplier and bet. If the result reaches your target, you win target × your stake.', 'plinko': 'Drop a ball. Where it lands sets your multiplier; the edges pay the most. High risk widens the gap.', 'mines': 'Choose how many mines, then flip tiles. Each gem raises your multiplier. Cash out before you hit a mine.', 'towers': 'Pick one of three doors on each floor. Two are safe. Climb to raise the payout, cash out any time.', 'coin': 'Call heads or tails. Each right call nearly doubles it. Bank any time, one wrong call loses it.', 'penalty': 'Pick a spot to shoot. The keeper covers two of five. Every goal multiplies your stake by 1.65.', 'wheel': 'One spin, one multiplier. The wheel shows exactly how many segments pay what.', 'blackjack': "Beat the dealer's hand without going over 21. Hit for another card, stand to stop, double to double your bet for one card.", 'baccarat': 'Bet on Player, Banker or Tie. The hand closest to 9 wins. The dealer follows fixed rules, you just pick a side.', 'war': 'You and the dealer get one card. Higher card wins. Ties go to war.', 'hilo': 'Guess if the next card is higher or lower. Each right guess multiplies your win. Cash out whenever you like.', 'reddog': 'Two cards are dealt. Bet that the third lands between them; a smaller gap pays more.', 'vpoker': 'Deal five cards, tap the ones to hold, then draw. Your final poker hand sets the payout.', 'tcp': 'Ante to see three cards, then play or fold against the dealer. Pair Plus pays on your hand alone.', 'holdem': 'Two private cards and five shared ones. Bet, call, raise or fold over four rounds; the best five-card hand wins the pot.', 'roulette': 'Click the layout to place chips, then spin. Numbers pay 35 to 1, colours and halves 1 to 1.'};
function game(id,o){o.id=id;if(HOW[id])o.how=HOW[id];GAMES[id]=o;ORDER.push(id)}
const CATS={orig:'Stack Originals',cards:'Card games',poker:'Poker',table:'Table games'};
/* ---------- login gate: the same accounts as Stack v1 ---------- */
const AUTH={mode:'login',err:''};
function gate(){const g=$('gate');if(loggedIn()){g.hidden=true;return}g.hidden=false;const m=AUTH.mode,known=S.players.some(p=>p.user);
 g.innerHTML=`<div class="l"><a class="brand" style="color:inherit"><svg class="rib" viewBox="0 0 96 96" style="width:40px;height:40px"><path d="M84 22 H30 A13 13 0 0 0 30 48 H66 A13 13 0 0 1 66 74 H12"/></svg><span class="wm dw" style="font-size:36px">stack</span><sup style="color:inherit">CASINO</sup></a>
  <div><span class="mono" style="color:rgba(255,255,255,.5)">Casino · Sports · Micro betting</span><h1 class="dw">Every bet.<br>One balance.</h1><p style="max-width:42ch;opacity:.7">Originals, classic card games, poker against the house AI, live football with micro markets every minute. Same account, same balance, brand new Stack.</p></div>
  <div class="mono" style="color:rgba(255,255,255,.45)">Play money only · no real money is won or lost · 18+</div></div>
 <div class="r"><form id="auF" onsubmit="return false"><span class="mono">${m==='login'?'Welcome back':'Create your account'}</span><h2 class="dw" style="font-size:40px;margin:0 0 6px">${m==='login'?'Log in':'Sign up'}</h2>
  <div class="field"><label>Username</label><input class="inp" id="auU" autocomplete="username"></div>
  <div class="field"><label>Password</label><input class="inp" id="auP" type="password" autocomplete="current-password"></div>
  ${m==='signup'?'<div class="field"><label>Confirm password</label><input class="inp" id="auP2" type="password"></div><label style="display:flex;gap:8px;font-size:12.5px;color:var(--ink-2)"><input type="checkbox" id="au18" checked> I am 18 or over and I understand this is play money only</label>':''}
  <div style="color:var(--ink);font-weight:700;font-size:13px;min-height:18px">${esc(AUTH.err)}</div>
  ${BTN(m==='login'?'Log in':'Create account','f lg w','id="auGo"')}
  <button type="button" class="mut" style="font-size:13px" id="auSw">${m==='login'?'New here? <b>Create an account</b>':'Already have an account? <b>Log in</b>'}</button>
  ${known&&m==='login'?`<div class="mono" style="margin-top:6px">Accounts on this device: ${S.players.filter(p=>p.user).map(p=>esc(p.user)).join(', ')}</div>`:''}</form></div>`;
 $('auGo').onclick=doAuth;$('auSw').onclick=()=>{AUTH.mode=m==='login'?'signup':'login';AUTH.err='';gate()};setTimeout(()=>$('auU').focus(),50);
 $('auF').onkeydown=e=>{if(e.key==='Enter')doAuth()}}
function doAuth(){const u=$('auU').value.trim(),pw=$('auP').value;if(!u||!pw){AUTH.err='Enter a username and password';return gate()}
 if(AUTH.mode==='login'){const i=acctIdx(u);if(i<0||S.players[i].pw!==hashPw(u,pw)){AUTH.err='Wrong username or password';sfx('err');return gate()}S.cur=i}
 else{if(acctIdx(u)>=0){AUTH.err='That username is taken';return gate()}if(pw!==$('auP2').value){AUTH.err='Passwords do not match';return gate()}if(!$('au18').checked){AUTH.err='You must be 18 or over';return gate()}
  S.players.push({name:u,user:u,pw:hashPw(u,pw),bal:1000,big:0,bets:0,color:'#0b0b0b',created:Date.now()});S.cur=S.players.length-1;setTimeout(()=>offer('welcome'),1200)}
 S.session={u:P().user};save(true);SES.start=Date.now();SES.lastRc=Date.now();sfx('cash');boot2()}
function logout(){S.session=null;S.cur=-1;save(true);closeAll();AUTH.mode='login';AUTH.err='';gate()}

/* ---------- navigation ---------- */
let MODE='casino';
const NAVS={casino:[['','',[['#/lobby','home','Lobby'],['#/c/orig','rocket','Stack Originals'],['#/c/cards','cards','Card games'],['#/c/poker','spade','Poker'],['#/c/table','wheel','Table games'],['#/c/favs','heart','Favourites'],['#/c/recent','clock','Recently played']]],
  ['','Rewards',[['#/promos','gift','Promotions'],['#/vip','crown','VIP club'],['#/missions','trophy','Daily missions']]],['','Account',[['#/account/wallet','wallet','Wallet'],['#/account/bets','list','My bets'],['#/safer','shield','Safer gambling']]]],
 sports:[['','',[['#/sports','ball','Sports home'],['#/sports/live','bolt','Live now'],['#/micro','fire','Micro betting'],['#/sports/football','ball','Football'],['#/sports/basketball','ball','Basketball'],['#/sports/tennis','ball','Tennis']]],
  ['','Account',[['#/account/bets','list','My bets'],['#/promos','gift','Promotions'],['#/safer','shield','Safer gambling']]]]};
function drawNav(){const n=$('nav');n.innerHTML=NAVS[MODE].map(([,g,items])=>(g?`<div class="grp">${g}</div>`:'')+items.map(([h,ic,l])=>`<a href="${h}">${svg(ic)}<span>${l}</span>${h==='#/sports/live'?'<span class="live"></span>':h==='#/c/favs'?`<span class="ct">${X().favs.length}</span>`:''}</a>`).join('')).join('');markNav()}
function markNav(){const h=location.hash||'#/lobby';$('nav').querySelectorAll('a').forEach(a=>a.classList.toggle('on',h===a.getAttribute('href')||(h.startsWith(a.getAttribute('href')+'/')&&a.getAttribute('href')!=='#/sports')))}
function setMode(m){MODE=m;$('mode').classList.toggle('r',m==='sports');$('mode').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));drawNav()}
$('mode').querySelectorAll('button').forEach(b=>b.onclick=()=>{sfx('click');setMode(b.dataset.m);location.hash=b.dataset.m==='sports'?'#/sports':'#/lobby'});

/* ---------- router (with the brand's bar wipe between sections) ---------- */
const ROUTES={};let CURGAME=null,LASTSEC='';
function route(){if(!loggedIn())return;const h=(location.hash||'#/lobby').slice(2).split('/'),sec=h[0]||'lobby';
 const sp=['sports','micro','match'].includes(sec);if(sp&&MODE!=='sports')setMode('sports');else if(!sp&&MODE!=='casino'&&!['account','safer','promos'].includes(sec))setMode('casino');
 const go=()=>{if(CURGAME&&GAMES[CURGAME]&&GAMES[CURGAME].leave)try{GAMES[CURGAME].leave()}catch(e){}CURGAME=null;const v=$('view');v.classList.remove('enter');(ROUTES[sec]||ROUTES.lobby)(h[1],h[2]);void v.offsetWidth;v.classList.add('enter');$('main').scrollTop=0;markNav()};
 const big=LASTSEC&&LASTSEC!==sec&&(sec==='play'||LASTSEC==='play');LASTSEC=sec;if(big)wipe(go);else go()}
function wipe(fn){const b=document.createElement('div');b.className='bars3';b.innerHTML='<i></i><i></i><i></i>';document.body.appendChild(b);requestAnimationFrame(()=>b.classList.add('go'));sfx('whoosh');
 setTimeout(()=>{fn();b.classList.remove('go');void b.offsetWidth;b.classList.add('out');setTimeout(()=>b.remove(),560)},480)}
addEventListener('hashchange',route);

/* ---------- lobby ---------- */
const isFav=g=>loggedIn()&&X().favs.includes(g);
function toggleFav(g){const x=X(),i=x.favs.indexOf(g);i<0?x.favs.push(g):x.favs.splice(i,1);save(true);sfx('click');toast(i<0?'Added to favourites':'Removed from favourites',GAMES[g].name,'lt','heart');drawNav();document.querySelectorAll(`[data-fav="${g}"]`).forEach(b=>b.classList.toggle('on',i<0))}
const tileHTML=g=>{const G=GAMES[g];return `<div class="tile${G.inv?' inv':''}" data-g="${g}" data-cat="${G.cat}">${G.tag?`<span class="tg">${G.tag}</span>`:''}<button class="fv${isFav(g)?' on':''}" data-fav="${g}" title="Favourite">♥</button><div class="g">${G.glyph}</div><div class="bot"><div class="n">${G.name}</div><div class="s">${G.sub||CATS[G.cat]} · RTP ${G.rtp}</div></div><div class="pl">${BTN('Play','f sm w')}</div></div>`};
function wireTiles(root){root.querySelectorAll('.tile [data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFav(b.dataset.fav)});root.querySelectorAll('.tile[data-g]').forEach(t=>{t.onclick=()=>{sfx('click');location.hash='#/play/'+t.dataset.g};t.onmouseenter=()=>sfx('hover')})}
function banners(){return `<div class="hero">
 <div class="ban inv" data-go="#/promos"><div><span class="mono">Daily bonus · day ${Math.min(7,X().daily.streak+1)} of 7</span><h3 class="dw">Your free spin<br>is waiting.</h3><p>Come back every day to build your streak. Day 7 pays the most.</p></div><div>${BTN('Claim now','sm')}</div><svg class="art rib" viewBox="0 0 96 96" style="opacity:.14;width:260px;height:260px"><path d="M84 22 H30 A13 13 0 0 0 30 48 H66 A13 13 0 0 1 66 74 H12" style="stroke-width:10"/></svg></div>
 <div class="ban out" data-go="#/play/holdem"><div><span class="mono">Poker · no limit</span><h3 class="dw">Hold'em<br>night.</h3><p>Four AI players. You sit down with 100 big blinds.</p></div><div>${BTN('Take a seat','sm')}</div></div>
 <div class="ban out" data-go="#/micro"><div><span class="mono">Sports · live now</span><h3 class="dw">Bet the next<br>minute.</h3><p>Micro markets on every live match: next goal, next corner, next point.</p></div><div>${BTN('Go live','sm')}</div></div></div>`}
function wireBanners(root){root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{sfx('click');if(b.dataset.go==='#/promos'&&canDaily())return dailySpin();location.hash=b.dataset.go})}
ROUTES.lobby=()=>{const v=$('view');const INTRO={orig:'Quick games made by Stack. Pick a stake, play a round in seconds. Each one shows its return to player (RTP).',cards:'The classic casino card games against the dealer.',poker:'Poker against the house: Hold\'em with AI players, plus video poker and three card poker.',table:'Roulette and the wheel.'};
const row=(cat,t,sub)=>`<div class="sh"><div><span class="mono">${sub}</span><h2 class="dw">${t}</h2><p class="intro">${INTRO[cat]}</p></div><a class="btn sm" href="#/c/${cat}"><i class="b"></i><i class="b"></i><i class="b"></i>View all</a></div><div class="tiles">${ORDER.filter(g=>GAMES[g].cat===cat).slice(0,7).map(tileHTML).join('')}</div>`;
 v.innerHTML=banners()+`<div class="sh"><div><span class="mono">Sports · in play</span><h2 class="dw">Live now</h2><p class="intro">Matches being played right now. Click a price to add it to your bet slip, or open a match for every market.</p></div><a class="btn sm" href="#/sports/live"><i class="b"></i><i class="b"></i><i class="b"></i>All live</a></div><div id="lobLive"></div>`
  +row('orig','Stack Originals','Fair odds · made in house')+row('cards','Card games','The classics, dealt in black and white')+row('poker','Poker','Against the house AI')+row('table','Table games','Wheels and dice')
  +`<div class="sh"><div><span class="mono">Live · every game</span><h2 class="dw">Latest bets</h2></div></div>${feedBox()}${footer()}`;
 wireTiles(v);wireBanners(v);wireFeed(v);drawLobLive()};
ROUTES.c=(cat)=>{const v=$('view'),x=X();let ids=cat==='favs'?x.favs.filter(g=>GAMES[g]):cat==='recent'?[...new Set(x.bets.map(b=>b.g))].filter(g=>GAMES[g]):ORDER.filter(g=>GAMES[g].cat===cat);
 const t=cat==='favs'?'Favourites':cat==='recent'?'Recently played':CATS[cat]||'Casino';
 v.innerHTML=`<div class="sh"><div><span class="mono">Casino · ${ids.length} games</span><h2 class="dw">${t}</h2></div><div class="chips">${Object.entries(CATS).map(([k,l])=>`<a class="chip${k===cat?' on':''}" href="#/c/${k}">${l}</a>`).join('')}</div></div>
  ${ids.length?`<div class="tiles">${ids.map(tileHTML).join('')}</div>`:`<div class="card empty">${cat==='favs'?'Tap the heart on any game to keep it here.':'Nothing yet. Play a game and it shows up here.'}</div>`}${footer()}`;wireTiles(v)};
/* ---------- a game page: side panel + stage, with the shared header, rules and the game's own bets feed ---------- */
ROUTES.play=(id)=>{const G=GAMES[id];if(!G){location.hash='#/lobby';return}const v=$('view'),fav=X().favs.includes(id);CURGAME=id;
 v.innerHTML=`<div class="ghead"><a class="icb" href="#/c/${G.cat}" title="Back">${svg('x')}</a><h1 class="dw">${G.name}</h1><span class="pill">${CATS[G.cat].toUpperCase()}</span><span class="pill">RTP ${G.rtp}</span><span class="sp"></span>
  <button class="icb fvb${fav?' on':''}" id="gFav" data-fav="${id}" title="Favourite">${svg('heart')}</button><button class="btn sm" id="gRules"><i class="b"></i><i class="b"></i><i class="b"></i>How to play</button></div>
  <p class="intro" style="margin:-6px 0 14px">${G.how||G.rules.split('. ').slice(0,2).join('. ')+'.'}</p><div id="gHost"></div><div class="sh"><div><span class="mono">${G.name} · live</span><h2 class="dw">Latest bets</h2></div></div>${feedBox(id)}`;
 $('gFav').onclick=()=>toggleFav(id);
 $('gRules').onclick=()=>modal(`<span class="mono">${CATS[G.cat]} · RTP ${G.rtp}</span><h3 class="dw">${G.name}</h3><p class="mut" style="line-height:1.6">${G.rules}</p>`);
 wireFeed(v,id);G.mount($('gHost'))};

/* ---------- the live bets feed: everyone's bets as they settle (other players are simulated) ---------- */
const FEED=[];const NAMES=['tilly_v','m4tt','RONIN','kj22','sasha.b','bigdog','NeoChips','luckyleo','mira','oz_punter','fxk','Hollis','jinx99','viktor','pip','cashcow','ANON','danno','zara.k','TheWhale','quickfingers','marlo','betsy','sk8r','nova'];
function feedPush(b){b.t=Date.now();FEED.unshift(b);FEED.length=Math.min(FEED.length,60);if(document.querySelector('.feedt'))drawFeeds()}
let FEEDTAB='all';
function feedBox(g){return `<div class="card" data-feed="${g||''}"><div class="tabs" style="padding:0 10px;margin:0"><button data-ft="all" class="${FEEDTAB==='all'?'on':''}">All bets</button><button data-ft="high" class="${FEEDTAB==='high'?'on':''}">High rollers</button><button data-ft="me" class="${FEEDTAB==='me'?'on':''}">My bets</button></div><table class="feedt"><thead><tr><th>Game</th><th>Player</th><th>Time</th><th class="r">Bet</th><th class="r">Multiplier</th><th class="r">Payout</th></tr></thead><tbody></tbody></table></div>`}
function wireFeed(root){root.querySelectorAll('[data-ft]').forEach(b=>b.onclick=()=>{FEEDTAB=b.dataset.ft;root.querySelectorAll('[data-ft]').forEach(x=>x.classList.toggle('on',x.dataset.ft===FEEDTAB));drawFeeds()});drawFeeds()}
let feedLast=0;
function drawFeeds(){document.querySelectorAll('[data-feed]').forEach(c=>{const g=c.dataset.feed;let L=FEED.filter(b=>!g||b.g===g);if(FEEDTAB==='high')L=L.filter(b=>b.s>=500);if(FEEDTAB==='me')L=L.filter(b=>b.me);
 const tb=c.querySelector('tbody');tb.innerHTML=L.slice(0,10).map(b=>`<tr class="${b.t>feedLast?'new':''}"><td>${(GAMES[b.g]||{name:b.g}).name}</td><td>${b.me?'<b>You</b>':esc(b.u)}</td><td class="dim">${new Date(b.t).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}</td><td class="r n">${fmt(b.s)}</td><td class="r n ${b.p>b.s?'w':'l'}">${b.m.toFixed(2)}×</td><td class="r n ${b.p>b.s?'w':'l'}">${b.p>0?'+':''}${fmt(b.p)}</td></tr>`).join('')||`<tr><td colspan="6" class="empty">No bets yet</td></tr>`});feedLast=Date.now()}
/* other players: each game's own payout shape, so the feed looks like the real distribution */
function simBet(){const g=pickA(ORDER),G=GAMES[g];if(!G)return;const s=pickA([.5,1,2,5,10,10,20,25,50,100,100,250,500,1000,2500]);let m=G.sim?G.sim():(R()<.47?pickA([1.5,2,2,2.5,3]):0);feedPush({u:pickA(NAMES),g,s,m,p:Math.round(s*m*100)/100})}
setInterval(()=>{if(!document.hidden&&loggedIn())simBet()},1300);

/* ---------- search ---------- */
$('q').oninput=()=>{const q=$('q').value.trim().toLowerCase(),r=$('sres');if(!q){r.hidden=true;return}
 const gs=ORDER.filter(g=>GAMES[g].name.toLowerCase().includes(q)).map(g=>[`#/play/${g}`,GAMES[g].name,CATS[GAMES[g].cat]]);
 const ms=(typeof MATCHES!=='undefined'?MATCHES:[]).filter(m=>(m.h.n+' '+m.a.n+' '+m.lg).toLowerCase().includes(q)).map(m=>[`#/match/${m.id}`,`${m.h.n} v ${m.a.n}`,m.live?'Live':m.lg]);
 const L=gs.concat(ms).slice(0,8);r.innerHTML=L.map(([h,n,s])=>`<a href="${h}">${n}<span class="mono">${s}</span></a>`).join('')||'<div class="empty" style="padding:14px">Nothing found</div>';r.hidden=false};
$('q').onblur=()=>setTimeout(()=>$('sres').hidden=true,200);$('sres').onclick=()=>{$('q').value='';$('sres').hidden=true};

/* ---------- account pages ---------- */
function footer(){return `<footer class="site"><div><a class="brand" style="padding:0;height:auto"><svg class="rib" viewBox="0 0 96 96"><path d="M84 22 H30 A13 13 0 0 0 30 48 H66 A13 13 0 0 1 66 74 H12"/></svg><span class="wm dw">stack</span><sup>CASINO</sup></a>
 <p style="max-width:44ch;line-height:1.6;margin:12px 0 0">Stack is a play-money social casino and sportsbook. Credits have no cash value and cannot be bought, sold or withdrawn. Every game shows its return to player.</p><div class="badges"><span>18+</span><span>PLAY MONEY</span><span>RTP SHOWN</span><span>FAIR ODDS</span></div></div>
 <div><h4>Casino</h4><a href="#/c/orig">Originals</a><a href="#/c/cards">Card games</a><a href="#/c/poker">Poker</a><a href="#/c/table">Table games</a></div>
 <div><h4>Sports</h4><a href="#/sports/live">Live now</a><a href="#/micro">Micro betting</a><a href="#/sports/football">Football</a><a href="#/sports/tennis">Tennis</a></div>
 <div><h4>Help</h4><a href="#/safer">Safer gambling</a><a href="#/account/bets">My bets</a><a href="#/promos">Promotions</a><a href="#/vip">VIP club</a></div></footer>`}
ROUTES.account=(tab)=>{tab=tab||'wallet';const v=$('view'),x=X(),p=P();
 const tabs=[['wallet','Wallet'],['bets','My bets'],['tx','Transactions'],['stats','Statistics'],['settings','Settings']];
 let body='';
 if(tab==='wallet')body=`<div class="hgrid" style="grid-template-columns:1.3fr 1fr 1fr"><div style="padding:24px"><span class="mono">Balance</span><div class="dn" style="font-size:54px;line-height:1.1" id="wBal">${fmt(p.bal)}</div><div style="display:flex;gap:8px;margin-top:12px">${BTN('Top up +1,000','f','id="wTop"')}${BTN('Limits','','id="wLim"')}</div><p class="mut" style="font-size:12.5px;margin:12px 0 0">Top up adds 1,000 credits when your balance is under 100.</p></div>
  <div style="padding:24px"><span class="mono">Today</span><div class="dn" style="font-size:30px">${todayNet()>=0?'+':''}${fmt(todayNet())}</div><div class="kv"><span>Wagered (all time)</span>${fmt(x.wag)}</div><div class="kv"><span>Bets</span>${x.n}</div></div>
  <div style="padding:24px"><span class="mono">Rakeback</span><div class="dn" style="font-size:30px">${fmt(x.rake)}</div><p class="mut" style="font-size:12.5px">0.2% of everything you bet comes back here.</p>${BTN('Claim rakeback','sm','id="wRake"'+(x.rake<1?' disabled':''))}</div></div>`;
 else if(tab==='bets')body=`<div class="card"><table class="feedt"><thead><tr><th>Game</th><th>Bet</th><th>Time</th><th class="r">Stake</th><th class="r">Multiplier</th><th class="r">Payout</th></tr></thead><tbody>${x.bets.slice(0,60).map(b=>`<tr><td>${(GAMES[b.g]||{name:b.g}).name}</td><td class="mut">${esc(b.d)}</td><td class="dim">${ago(b.t)}</td><td class="r n">${fmt(b.s)}</td><td class="r n">${b.s?(b.p/b.s).toFixed(2):'0.00'}×</td><td class="r n ${b.p>b.s?'w':'l'}">${fmt(b.p)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No bets yet</td></tr>'}</tbody></table></div>`;
 else if(tab==='tx')body=`<div class="card"><table class="feedt"><thead><tr><th>Type</th><th>Note</th><th>Time</th><th class="r">Amount</th></tr></thead><tbody>${x.tx.map(t=>`<tr><td>${t.k}</td><td class="mut">${esc(t.n)}</td><td class="dim">${ago(t.t)}</td><td class="r n">+${fmt(t.a)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No transactions yet</td></tr>'}</tbody></table></div>`;
 else if(tab==='stats'){const by={};x.bets.forEach(b=>{const o=by[b.g]=by[b.g]||{n:0,s:0,p:0};o.n++;o.s+=b.s;o.p+=b.p});
  body=`<div class="hgrid" style="grid-template-columns:repeat(4,1fr)">${[['Wagered',fmt(x.wag)],['Bets',x.n],['Biggest win',fmt(x.best)],['Member since',new Date(x.joined).toLocaleDateString('en-AU')]].map(([k,v])=>`<div style="padding:20px"><span class="mono">${k}</span><div class="dn" style="font-size:26px">${v}</div></div>`).join('')}</div>
  <div class="card" style="margin-top:14px"><table class="feedt"><thead><tr><th>Game</th><th class="r">Bets</th><th class="r">Wagered</th><th class="r">Returned</th><th class="r">Net</th></tr></thead><tbody>${Object.entries(by).map(([g,o])=>`<tr><td>${(GAMES[g]||{name:g}).name}</td><td class="r n">${o.n}</td><td class="r n">${fmt(o.s)}</td><td class="r n">${fmt(o.p)}</td><td class="r n">${o.p-o.s>=0?'+':''}${fmt(o.p-o.s)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No bets yet</td></tr>'}</tbody></table></div>`}
 else body=`<div class="card" style="padding:8px 22px 18px;max-width:640px">${[['Sound effects','snd'],['Dark mode','dark']].map(([l,k])=>`<div class="kv"><span>${l}</span><button class="chip${(k==='snd'?x.snd:document.documentElement.dataset.theme==='dark')?' on':''}" data-set="${k}">${(k==='snd'?x.snd:document.documentElement.dataset.theme==='dark')?'On':'Off'}</button></div>`).join('')}
  <div class="kv"><span>Reality check every</span><select class="inp" style="width:140px;height:36px" id="rcSel">${[15,30,45,60].map(m=>`<option ${x.rc===m?'selected':''} value="${m}">${m} minutes</option>`).join('')}</select></div>
  <div class="kv"><span>Username</span>${esc(p.user||p.name)}</div><div style="margin-top:14px">${BTN('Log out','','id="lo"')}</div></div>`;
 v.innerHTML=`<div class="sh"><div><span class="mono">Account · ${esc(p.name)}</span><h2 class="dw">${tabs.find(t=>t[0]===tab)[1]}</h2></div></div><div class="tabs">${tabs.map(([k,l])=>`<a href="#/account/${k}"><button class="${k===tab?'on':''}">${l}</button></a>`).join('')}</div>${body}${footer()}`;
 if($('wTop'))$('wTop').onclick=()=>{topUp();route()};if($('wLim'))$('wLim').onclick=()=>location.hash='#/safer';
 if($('wRake'))$('wRake').onclick=()=>{const a=Math.floor(x.rake*100)/100;x.rake-=a;credit(a,'rake');tx('rakeback',a,'Rakeback claimed');sfx('coins');toast('Rakeback claimed','+'+fmt(a));route()};
 v.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>{if(b.dataset.set==='snd'){x.snd=x.snd?0:1;AU.on=x.snd}else themeToggle();save();route()});
 if($('rcSel'))$('rcSel').onchange=()=>{x.rc=+$('rcSel').value;save();toast('Reality check updated',`Every ${x.rc} minutes`)};if($('lo'))$('lo').onclick=logout};
function themeToggle(){const r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('stack2.theme',r.dataset.theme)}catch(e){}}
$('themeBtn').onclick=()=>{themeToggle();sfx('click')};try{const t=localStorage.getItem('stack2.theme');if(t)document.documentElement.dataset.theme=t}catch(e){}
$('topBtn').onclick=()=>topUp();
$('avBtn').onclick=()=>{const p=P(),x=X(),lv=vipLevel();drawer(`<header><div class="av" style="margin-right:12px">${esc(p.name[0].toUpperCase())}</div><div><b style="font-size:16px">${esc(p.name)}</b><div class="mono">${lv.n} · ${fmt(p.bal)} credits</div></div><span class="sp"></span><button class="icb" data-close>${svg('x')}</button></header>
 <div class="body"><div style="padding:18px 22px;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between" class="mono"><span>${lv.n}</span><span>${lv.next?lv.next.n:'Top level'}</span></div><div class="bar" style="margin-top:8px"><i style="width:${lv.pct}%"></i></div><p class="mut" style="font-size:12px;margin:8px 0 0">${lv.next?`Wager ${fmt(lv.next.at-x.vip)} more to reach ${lv.next.n}.`:'You are at the top.'}</p></div>
 ${[['#/account/wallet','wallet','Wallet'],['#/account/bets','list','My bets'],['#/account/tx','coin','Transactions'],['#/account/stats','chart','Statistics'],['#/vip','crown','VIP club'],['#/missions','trophy','Daily missions'],['#/safer','shield','Safer gambling'],['#/account/settings','user','Settings']].map(([h,ic,l])=>`<a class="nt" href="${h}" data-close style="grid-template-columns:24px 1fr;align-items:center"><span>${svg(ic)}</span><b>${l}</b></a>`).join('')}
 <div style="padding:18px 22px">${BTN('Log out','w','id="lo2"')}</div></div>`);$('drawer').querySelectorAll('[data-close]').forEach(a=>a.addEventListener('click',closeAll));$('lo2').onclick=logout};
