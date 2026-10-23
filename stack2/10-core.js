/* ================= CORE: accounts, wallet, history, sound, ui helpers =================
   Storage is the same store and format as Stack v1 (key 'stack-casino', {v:3,players,session,...}) and the same
   password hash, so every existing account logs straight in with its balance. Stack 2 keeps its own data per
   player under p.s2. Top up: +1,000 credits, only when the balance is under 100 (the v1 rule). */
const $=id=>document.getElementById(id);
const SKEY='stack-casino';
const S={players:[],session:null,hist:[],roster:{},audit:[],cur:-1};
const LS=(()=>{try{localStorage.setItem('__t','1');localStorage.removeItem('__t');return localStorage}catch(e){return null}})();
function loadStore(){let raw=null;try{raw=LS&&LS.getItem(SKEY)}catch(e){}if(!raw)return;try{const d=JSON.parse(raw);if(Array.isArray(d.players))S.players=d.players;if(Array.isArray(d.hist))S.hist=d.hist;if(d.roster)S.roster=d.roster;if(Array.isArray(d.audit))S.audit=d.audit;S.session=d.session||null}catch(e){}}
let saveT=0;function saveNow(){clearTimeout(saveT);saveT=0;try{LS&&LS.setItem(SKEY,JSON.stringify({v:3,players:S.players,session:S.session,hist:S.hist.slice(0,20),roster:S.roster,audit:S.audit.slice(-300)}))}catch(e){}}
function save(now){if(now)return saveNow();clearTimeout(saveT);saveT=setTimeout(saveNow,300)}
addEventListener('pagehide',()=>{if(saveT)saveNow()});
function hashPw(user,pw){const str='stack1:'+String(user).toLowerCase()+':'+String(pw);let a=0x811c9dc5,b=0x9e3779b9;
 for(let i=0;i<str.length;i++)a=Math.imul(a^str.charCodeAt(i),0x01000193)>>>0;for(let i=str.length-1;i>=0;i--)b=Math.imul(b^str.charCodeAt(i),0x85ebca6b)>>>0;return a.toString(36)+'.'+b.toString(36)}
const acctIdx=u=>S.players.findIndex(a=>a.user&&a.user.toLowerCase()===String(u).toLowerCase().trim());
const P=()=>S.players[S.cur];
const loggedIn=()=>S.cur>=0&&!!S.players[S.cur];
function X(){const p=P();if(!p.s2)p.s2={};const x=p.s2;
 const d={tx:[],bets:[],wag:0,won:0,n:0,best:0,limits:{dep:0,loss:0,sess:0},rc:30,daily:{d:'',streak:0},notifs:[],favs:[],snd:1,vip:0,rake:0,joined:Date.now(),missions:{},cool:0,firstDep:0,seen:{}};
 for(const k in d)if(x[k]==null)x[k]=d[k];return x}
const fmt=(n,d=2)=>(+n).toLocaleString('en-AU',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtS=n=>Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e4?(n/1e3).toFixed(1)+'K':fmt(n);
const R=Math.random,rint=n=>Math.floor(R()*n),pickA=a=>a[rint(a.length)],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ago=t=>{const s=Math.round((Date.now()-t)/1000);return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago'};
const dur=ms=>{const m=Math.floor(ms/60000);return m<60?m+' min':Math.floor(m/60)+'h '+(m%60)+'m'};
const HOUSE=.97;

/* ---------- the session: what the reality check reports ---------- */
const SES={start:Date.now(),wag:0,won:0,bets:0,lastRc:Date.now(),topups:0};
/* ---------- wallet ---------- */
function bal(){return loggedIn()?P().bal:0}
let LIMITHIT='';
function canStake(n){const x=X();if(!(n>0)){toast('Enter a stake above 0','','lt');return false}if(n>bal()+1e-9){toast('Not enough credits','Top up unlocks under 100 credits','lt');sfx('err');return false}
 if(x.cool&&x.cool>Date.now()){toast('Your break is on',`Back in ${dur(x.cool-Date.now())}`,'lt');return false}
 if(x.limits.loss>0){const net=todayNet();if(-net+n>x.limits.loss+1e-9){toast('Daily loss limit reached',`You set ${fmt(x.limits.loss)} a day`,'lt');sfx('err');return false}}
 if(x.limits.sess>0&&Date.now()-SES.start>x.limits.sess*60000){toast('Session time limit reached','Log out and back in for a new session','lt');return false}return true}
function spend(n,game){n=Math.round(n*100)/100;if(!canStake(n))return false;const p=P(),x=X();p.bal=Math.round((p.bal-n)*100)/100;p.bets=(p.bets||0)+1;p.wagered=(p.wagered||0)+n;
 x.wag+=n;x.n++;SES.wag+=n;SES.bets++;x.vip+=n;x.rake+=n*.002;drawBal(-1);save();retainTick(game,n);return true}
function credit(n,game,quiet){n=Math.round(n*100)/100;if(!(n>0))return;const p=P(),x=X();p.bal=Math.round((p.bal+n)*100)/100;x.won+=n;SES.won+=n;drawBal(1);save()}
/* every settled bet goes in the history (and the public feed) */
function record(game,stake,pay,detail){const x=X(),net=Math.round((pay-stake)*100)/100;x.bets.unshift({t:Date.now(),g:game,s:stake,p:pay,d:detail||''});x.bets=x.bets.slice(0,300);
 if(net>x.best)x.best=net;const p=P();if(pay>(p.big||0))p.big=pay;feedPush({u:p.name,g:game,s:stake,m:stake?pay/stake:0,p:pay,me:1});
 if(pay>=stake*10&&pay>=100)bigWin(game,pay,pay/stake);save();missionTick(game,stake,pay)}
function tx(kind,amt,note){const x=X();x.tx.unshift({t:Date.now(),k:kind,a:amt,n:note||''});x.tx=x.tx.slice(0,200);save()}
function todayNet(){const d=new Date().toDateString();return X().bets.filter(b=>new Date(b.t).toDateString()===d).reduce((a,b)=>a+b.p-b.s,0)}
function topUp(){if(!loggedIn())return;if(P().bal>=100){toast('Top up unlocks under 100 credits',`You have ${fmt(P().bal)}`,'lt');sfx('err');return}
 const x=X();if(x.limits.dep>0){const d=new Date().toDateString(),today=x.tx.filter(t=>t.k==='topup'&&new Date(t.t).toDateString()===d).reduce((a,t)=>a+t.a,0);if(today+1000>x.limits.dep){toast('Top-up limit reached',`You set ${fmt(x.limits.dep)} a day`,'lt');return}}
 P().bal+=1000;SES.topups++;tx('topup',1000,'Top up');drawBal(1);save(true);sfx('coins');toast('+1,000.00 credits','Topped up. Good luck.');
 if(!x.firstDep){x.firstDep=1;setTimeout(()=>offer('first'),1600)}}
/* ---------- balance odometer ---------- */
function odoHTML(s){return[...s].map(c=>/\d/.test(c)?`<span class="d"><span>${'0123456789'.split('').map(n=>`<i>${n}</i>`).join('')}</span></span>`:`<span>${c}</span>`).join('')}
function odoSet(el,s){if(el.dataset.len!=String(s.length)){el.innerHTML=odoHTML(s);el.dataset.len=s.length}const ds=el.querySelectorAll('.d>span');let k=0;for(const c of s)if(/\d/.test(c)){ds[k].style.transform=`translateY(${-c*1.15}em)`;k++}}
/* win effects: a number that floats up from the game, coins flying to the balance, the balance glowing. Bigger wins
   send more coins; losses get a quiet red edge on the stage and nothing else. */
function winFx(pay,mult){const st=document.querySelector('.gstage'),bl=$('bal');if(!st||!bl)return;const a=st.getBoundingClientRect(),b=bl.getBoundingClientRect();
 st.classList.remove('wonfx');void st.offsetWidth;st.classList.add('wonfx');const p=document.createElement('div');p.className='pop';p.textContent='+'+fmt(pay);p.style.left=(a.left+a.width/2)+'px';p.style.top=(a.top+a.height*.42)+'px';document.body.appendChild(p);setTimeout(()=>p.remove(),1500);
 const n=Math.min(16,3+Math.round(Math.log2(Math.max(1,mult))*3));for(let i=0;i<n;i++){const c=document.createElement('div');c.className='coin';const x0=a.left+a.width/2+(R()-.5)*120,y0=a.top+a.height*.45+(R()-.5)*60;c.style.left=x0+'px';c.style.top=y0+'px';document.body.appendChild(c);
  const dx=b.left+b.width/2-x0,dy=b.top+b.height/2-y0;c.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.4+(R()-.5)*80}px,${dy*.4-60}px) scale(1.1)`,opacity:1,offset:.45},{transform:`translate(${dx}px,${dy}px) scale(.5)`,opacity:.9}],{duration:750+i*45,easing:'cubic-bezier(.5,0,.3,1)'}).onfinish=()=>{c.remove();if(i%3===0)sfx('tickup')}}
 bl.classList.add('won');clearTimeout(bl._w);bl._w=setTimeout(()=>bl.classList.remove('won'),1200)}
function loseFx(){const st=document.querySelector('.gstage');if(!st)return;st.classList.remove('lostfx');void st.offsetWidth;st.classList.add('lostfx')}
function drawXp(){const b=$('avBtn');if(!b||!loggedIn()||typeof vipLevel!=='function')return;let x=b.querySelector('.xpbar');if(!x){x=document.createElement('span');x.className='xpbar';x.innerHTML='<i></i>';b.appendChild(x)}x.firstChild.style.width=vipLevel().pct+'%';b.title=`${vipLevel().n} · ${Math.round(vipLevel().pct)}% to ${vipLevel().next?vipLevel().next.n:'the top'}`}
function drawBal(dir){if(typeof drawXp==='function')setTimeout(drawXp,0);const e=$('bal');if(!e)return;e.classList.add('odo');odoSet(e,fmt(bal()));e.setAttribute('aria-label',fmt(bal()));if(dir>0){e.classList.remove('up');void e.offsetWidth;e.classList.add('up')}if(typeof onBal==='function')onBal()}

/* ---------- sound: recorded cards / chips / dice (Kenney CC0) + a new synthesized UI palette ---------- */
const AU={c:null,buf:{},on:1,master:null};
function auInit(){if(AU.c)return;try{AU.c=new(window.AudioContext||window.webkitAudioContext)();AU.master=AU.c.createGain();AU.master.gain.value=.8;AU.master.connect(AU.c.destination);
 for(const [k,b64] of Object.entries(SND_B64)){const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);AU.c.decodeAudioData(u.buffer).then(b=>AU.buf[k]=b).catch(()=>{})}}catch(e){}}
addEventListener('pointerdown',()=>{auInit();if(AU.c&&AU.c.state==='suspended')AU.c.resume()},{capture:true});
function smp(name,vol=.8,rate=1){if(!AU.c||!AU.on)return;const ks=Object.keys(AU.buf).filter(k=>k.startsWith(name));if(!ks.length)return;const s=AU.c.createBufferSource(),g=AU.c.createGain();s.buffer=AU.buf[pickA(ks)];s.playbackRate.value=rate*(.96+R()*.08);g.gain.value=vol;s.connect(g);g.connect(AU.master);s.start()}
function tone(f,d,v=.08,type='sine',at=0,f2){if(!AU.c||!AU.on)return;const o=AU.c.createOscillator(),g=AU.c.createGain(),t=AU.c.currentTime+at;o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(AU.master);o.start(t);o.stop(t+d+.05)}
function noise(d,v=.05,hp=2000,at=0){if(!AU.c||!AU.on)return;const n=AU.c.sampleRate*d,b=AU.c.createBuffer(1,n,AU.c.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(R()*2-1)*(1-i/n);const s=AU.c.createBufferSource(),f=AU.c.createBiquadFilter(),g=AU.c.createGain();f.type='highpass';f.frequency.value=hp;s.buffer=b;g.gain.value=v;s.connect(f);f.connect(g);g.connect(AU.master);s.start(AU.c.currentTime+at)}
const SFX={
 click:()=>tone(2600,.035,.03,'square'),tick:()=>tone(1900,.025,.025,'triangle'),hover:()=>tone(3400,.02,.012,'sine'),
 card:()=>smp('card-place',.7),deal:()=>smp('card-slide',.75),flip:()=>smp('card-place',.6,1.1),shuffle:()=>smp('card-shuffle',.7),fan:()=>smp('card-fan',.6),
 chip:()=>smp('chip-lay',.8),chips:()=>smp('chips-stack',.75),collect:()=>smp('chips-collide',.7),handle:()=>smp('chips-handle',.5),
 dice:()=>smp('dice-throw',.8),shake:()=>smp('dice-shake',.7),
 bet:()=>{smp('chip-lay',.7);tone(880,.06,.03,'triangle')},
 win:()=>{[0,4,7,12].forEach((s,i)=>tone(523*Math.pow(2,s/12),.32,.07,'triangle',i*.07));smp('chips-stack',.6)},
 big:()=>{[0,4,7,12,16,19,24].forEach((s,i)=>{tone(392*Math.pow(2,s/12),.5,.07,'triangle',i*.08);tone(784*Math.pow(2,s/12),.3,.02,'sine',i*.08)});smp('chips-collide',.8)},
 lose:()=>{tone(330,.18,.05,'triangle',0,220);tone(247,.3,.04,'triangle',.12,165)},
 coins:()=>{for(let i=0;i<7;i++)tone(1800+R()*900,.09,.035,'square',i*.05);smp('chips-handle',.6)},
 notif:()=>{tone(1320,.12,.05,'sine');tone(1760,.2,.045,'sine',.1)},
 err:()=>{tone(180,.12,.06,'square');tone(140,.16,.05,'square',.09)},
 cash:()=>{tone(988,.08,.06,'square');tone(1319,.25,.06,'square',.08);smp('chips-stack',.5)},
 gem:()=>{tone(1568,.14,.05,'sine');tone(2093,.22,.04,'sine',.06)},bomb:()=>{noise(.5,.12,200);tone(90,.4,.15,'sine',0,40)},
 peg:()=>tone(2000+R()*1400,.03,.02,'triangle'),tickup:()=>tone(1200,.03,.02,'sine'),
 whoosh:()=>noise(.35,.04,1200),crash:()=>{noise(.6,.12,300);tone(220,.5,.08,'sawtooth',0,60)},
 goal:()=>{noise(1.2,.05,800);[0,4,7].forEach((s,i)=>tone(440*Math.pow(2,s/12),.4,.05,'triangle',i*.1))},
 whistle:()=>{tone(2800,.25,.04,'sine');tone(2700,.3,.04,'sine',.28)},
 spin:()=>{for(let i=0;i<14;i++)tone(900-i*30,.03,.02,'triangle',i*.06)},ball:()=>tone(2400+R()*400,.02,.03,'sine')};
function sfx(k){try{SFX[k]&&SFX[k]()}catch(e){}}

/* ---------- toasts, modal, drawer ---------- */
const ICONS={bell:'<path d="M6 17h12M8 17v-6a4 4 0 0 1 8 0v6M10.5 20a1.5 1.5 0 0 0 3 0"/>',gift:'<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M12 10v10M3 7h18v3H3zM12 7c-1.5-3-5-3-4.5-1S12 7 12 7zm0 0c1.5-3 5-3 4.5-1S12 7 12 7z"/>',
 clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
 bolt:'<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',ball:'<circle cx="12" cy="12" r="8"/><path d="M12 7l3 2-1 4h-4l-1-4z"/>',star:'<path d="M12 4l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z"/>',
 chart:'<path d="M4 18l5-6 4 3 7-9"/>',user:'<circle cx="12" cy="9" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',fire:'<path d="M12 21a6 6 0 0 0 6-6c0-4-3-5-3-9-3 2-4 4-4 6-1-1-2-2-2-4-2 2-3 4-3 7a6 6 0 0 0 6 6z"/>',
 shield:'<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',cards:'<rect x="4" y="5" width="11" height="15" rx="2"/><path d="M15 7l4 1-3 12-4-1"/>',
 dice:'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
 home:'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',rocket:'<path d="M5 19l3-1 8-8a5 5 0 0 0-2-6c-3 0-5 2-6 4L5 15zM14 10l5 5-3 4-2-3M9 5L4 4l1 5"/>',
 wheel:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M12 14v6M4 12h6M14 12h6"/>',spade:'<path d="M12 3c3 4 7 6 7 10a4 4 0 0 1-7 2 4 4 0 0 1-7-2c0-4 4-6 7-10zM12 15l-2 6h4z"/>',
 crown:'<path d="M4 18l2-10 4 5 2-7 2 7 4-5 2 10z"/>',list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',wallet:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h2M3 9h18"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',heart:'<path d="M12 20s-7-4.5-7-9.5a4 4 0 0 1 7-2.6 4 4 0 0 1 7 2.6c0 5-7 9.5-7 9.5z"/>',coin:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>'};
const svg=(k,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]||''}</svg>`;
function toast(t,sub,cls,ic,go){const d=document.createElement('div');d.className='toast '+(cls||'');d.innerHTML=`<span class="ic">${svg(ic||'bell')}</span><div><b>${t}</b>${sub?`<small>${sub}</small>`:''}</div>`;
 if(go)d.onclick=()=>{location.hash=go};$('toasts').appendChild(d);while($('toasts').children.length>4)$('toasts').firstChild.remove();setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),260)},cls==='keep'?7000:3600);return d}
function modal(html,cls){const m=$('modal');m.className='modal on '+(cls||'');m.innerHTML=`<button class="icb x" data-close>${svg('x')}</button>`+html;$('scrim').classList.add('on');m.querySelector('[data-close]').onclick=closeAll;return m}
function drawer(html){const d=$('drawer');d.innerHTML=html;d.classList.add('on');$('scrim').classList.add('on');return d}
function closeAll(){$('modal').classList.remove('on');$('drawer').classList.remove('on');$('scrim').classList.remove('on')}
$('scrim').onclick=()=>{if(!$('modal').classList.contains('rcm'))closeAll()};addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').classList.contains('rcm'))closeAll()});
const BTN=(label,cls='',attr='')=>`<button class="btn ${cls}" ${attr}><i class="b"></i><i class="b"></i><i class="b"></i>${label}</button>`;
/* bet amount input with ½, 2x, max */
function betBox(id,v=1){return `<div class="field"><label>Bet amount</label><div class="betin"><span>¢</span><input id="${id}" type="number" min="0.1" step="0.1" value="${v}"><button data-bx="h">½</button><button data-bx="d">2×</button><button data-bx="m">Max</button></div></div>`}
function wireBet(root,id){root.querySelectorAll('[data-bx]').forEach(b=>b.onclick=()=>{const i=$(id);let v=+i.value||0;v=b.dataset.bx==='h'?v/2:b.dataset.bx==='d'?v*2:bal();i.value=Math.max(.1,Math.floor(v*100)/100);sfx('chip')})}
const betVal=id=>Math.round((+$(id).value||0)*100)/100;
