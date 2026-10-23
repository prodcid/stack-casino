/* ================= SPORTS + MICRO BETTING =================
   Simulated leagues played in real time: football (90' in 6 minutes), basketball (48' in 6 minutes), tennis (best of 3,
   short sets). Prices come from each sport's own model (Poisson goals, a normal on the points margin, Monte Carlo
   on tennis) and every price is fair / 0.97, so each selection returns 97%. Markets suspend for a few seconds after
   a goal, like a real book. Micro markets cover the next slice of play (next 5 minutes, next basket, next point) and
   close before it starts. The micro bar adds the next Crash round and a live roulette wheel. */
const M3=.97,ODD=p=>p<=.015||p>=.985?0:Math.max(1.01,Math.floor(M3/p*100)/100);
const TEAMS={football:[['Northbank FC',.3],['Riverside Utd',.18],['Harbour City',.12],['Kingsway',.05],['Stonebridge',0],['Ashford Town',-.05],['Westgate',-.1],['Millhaven',-.15],['Redcliffe',-.2],['Port Elm',-.28]],
 basketball:[['Metro Kings',.3],['Coast Hawks',.15],['Summit Bears',.05],['Valley Wolves',0],['Harbor Tide',-.1],['Desert Suns',-.2]],
 tennis:[['A. Varga',.68],['L. Moreau',.66],['K. Sato',.64],['D. Okafor',.63],['R. Lindqvist',.62],['T. Brennan',.6],['P. Novak',.59],['J. Reyes',.58]]};
const LEAGUE={football:'Stack Premier',basketball:'Stack Hoops',tennis:'Stack Open'};
let MATCHES=[],mid=0;const SPB=[];/* open sports + micro bets */
const pois=(k,m)=>{let p=Math.exp(-m);for(let i=1;i<=k;i++)p*=m/i;return p};
const PhiN=x=>{const t=1/(1+.2316419*Math.abs(x)),d=.3989423*Math.exp(-x*x/2),p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p};
/* ---------- making fixtures ---------- */
function newMatch(sp,startIn){const pool=TEAMS[sp].slice().sort(()=>R()-.5),busy=new Set(MATCHES.filter(m=>m.sp===sp&&!m.done).flatMap(m=>[m.h.n,m.a.n])),two=pool.filter(t=>!busy.has(t[0])).slice(0,2);if(two.length<2)return;
 const m={id:++mid,sp,lg:LEAGUE[sp],h:{n:two[0][0],r:two[0][1]},a:{n:two[1][0],r:two[1][1]},start:Date.now()+startIn*1000,live:0,done:0,hs:0,as:0,ev:[],sus:0,clock:0,stats:{hp:50,hsh:0,ash:0,hc:0,ac:0}};
 if(sp==='football'){m.lh=1.5*Math.exp((m.h.r-m.a.r)*1.2);m.la=1.15*Math.exp((m.a.r-m.h.r)*1.2);m.min=0}
 if(sp==='basketball'){m.ph=.555+(m.h.r-m.a.r)*.08;m.pa=.555-(m.h.r-m.a.r)*.08;m.min=0;m.off=0;m.line=Math.round(99*(m.ph+m.pa)*2.25)+.5;m.spr=Math.round(99*(m.ph-m.pa)*2.25)+.5;m.last3=null}
 if(sp==='tennis'){m.sv=0;m.sets=[0,0];m.games=[0,0];m.pts=[0,0];m.tb=0;m.setsHist=[];m.server=rint(2)}
 MATCHES.push(m);return m}
function seedMatches(){for(const [sp,n,live] of [['football',5,3],['basketball',3,2],['tennis',3,2]]){for(let i=0;i<n;i++){const m=newMatch(sp,i<live?-1:60+i*90);if(m&&i<live){m.live=1;const steps=sp==='football'?rint(75)*16:sp==='basketball'?rint(1200):rint(500);/* ticks: 16 a football minute, 4 a second */for(let k=0;k<steps;k++)tickMatch(m,1,true);if(!m.done)evt(m,`Live coverage joined · ${m.sp==='tennis'?m.setsHist.map(g=>g.join('–')).concat([m.games.join('–')]).join(', '):m.hs+'–'+m.as}`,0)}}}}
/* ---------- one tick (a quarter second; quiet = fast-forward without news) ---------- */
function tickMatch(m,steps,quiet){for(let s=0;s<steps;s++){if(m.done)return;if(!m.live){if(Date.now()>=m.start){m.live=1;if(!quiet){evt(m,'Kick-off',0);if(m.sp==='tennis')m.ev[0].t='Players are on court'}}else return}
 if(m.sus>0)m.sus-=.25;
 if(m.sp==='football'){m.clock+=.25;const mn=Math.floor(m.clock/4);/* 4 real seconds a minute */
  if(mn>m.min){m.min=mn;if(m.min===45&&!quiet)evt(m,'Half-time',0);
   const gh=R()<m.lh/90,ga=R()<m.la/90;if(gh)goal(m,'h',quiet);if(ga)goal(m,'a',quiet);if(R()<5/90)m.stats.hc++,quiet||note(m,'corner','h');if(R()<4.2/90)m.stats.ac++,quiet||note(m,'corner','a');
   if(R()<.12)m.stats.hsh++;if(R()<.1)m.stats.ash++;m.stats.hp=clamp(Math.round(50+(m.h.r-m.a.r)*30+(R()-.5)*8),30,70);
   if(m.min>=90+(m.stop||(m.stop=2+rint(4)))){end(m,quiet)}}}
 else if(m.sp==='basketball'){m.clock+=.25;if(Math.floor(m.clock*4)%2===0&&R()<.55*.5){const t=m.off,p=t?m.pa:m.ph,r=R();let pts=0;if(r<p){pts=R()<.25?3:2;if(t)m.as+=pts;else m.hs+=pts;m.last3=pts===3;if(!quiet)note(m,'score',t?'a':'h',pts);microSettle('bb',m,{t,pts})}m.off^=1}
  m.min=Math.min(48,Math.floor(m.clock/7.5));if(m.clock>=360+(m.ot||0)){if(m.hs===m.as)m.ot=(m.ot||0)+40;else end(m,quiet)}}
 else{m.clock+=.25;if(Math.round(m.clock*4)%10===0)point(m,quiet)}}}
function evt(m,t,side){m.ev.unshift({t,side,min:m.sp==='football'?m.min:m.sp==='basketball'?m.min:null,w:Date.now()});m.ev.length=Math.min(m.ev.length,40)}
function note(m,k,side,pts){if(k==='corner'){evt(m,`Corner, ${m[side].n}`,side);microSettle('corner',m,side)}if(k==='score'&&pts===3)evt(m,`Three-pointer, ${m[side].n}`,side)}
function goal(m,side,quiet){m[side==='h'?'hs':'as']++;m.sus=3;microSettle('goal',m,side);if(quiet)return;evt(m,`GOAL! ${m[side].n} · ${m.hs}–${m.as}`,side);
 if(CURMATCH===m.id||SPB.some(b=>b.mid===m.id))sfx('goal');if(SPB.some(b=>b.mid===m.id))toast(`GOAL · ${m.h.n} ${m.hs}–${m.as} ${m.a.n}`,`${m.min}' · ${m[side].n}`,'','ball','#/match/'+m.id)}
function point(m,quiet){const sv=m.server,p=TEAMS.tennis.find(t=>t[0]===(sv?m.a.n:m.h.n))[1]-.04*(sv?m.h.r-m.a.r:m.a.r-m.h.r)*0,won=R()<p?sv:1-sv;m.pts[won]++;microSettle('pt',m,{won,sv});
 const P=m.pts,tb=m.tb,need=tb?5:4;if(P[won]>=need&&P[won]-P[1-won]>=2){m.games[won]++;m.pts=[0,0];if(!tb)m.server^=1;else m.server^=1;microSettle('game',m,{won,sv});
  const G=m.games;if((G[won]>=4&&G[won]-G[1-won]>=2)||tb){m.sets[won]++;m.setsHist.push(G.slice());m.games=[0,0];m.tb=0;if(!quiet)evt(m,`Set to ${won?m.a.n:m.h.n} · ${m.setsHist.map(g=>g.join('–')).join(', ')}`,won?'a':'h');if(m.sets[won]===2){m.hs=m.sets[0];m.as=m.sets[1];end(m,quiet)}}
  else if(G[0]===4&&G[1]===4){m.tb=1;if(!quiet)evt(m,'Tie-break',0)}else if(!quiet&&R()<.4)evt(m,`Game ${won?m.a.n:m.h.n} · ${G.join('–')}`,won?'a':'h')}
 m.hs=m.sets[0];m.as=m.sets[1]}
function end(m,quiet){m.done=1;m.live=0;m.endW=Date.now();for(const x of MICRO)if(x.mid===m.id&&!x.done)microResolve(x,null,'Match over, stake returned');if(!quiet)evt(m,`Full time · ${m.hs}–${m.as}`,0);settleMatch(m);setTimeout(()=>newMatch(m.sp,60+rint(120)),2000)}
/* ---------- prices ---------- */
function probs(m){const o={};if(m.done)return o;
 if(m.sp==='football'){const left=Math.max(0,90-m.min)/90,mh=m.lh*left,ma=m.la*left;let ph=0,pd=0,po=0,pb=0,p15=0,p35=0,hc=0;const cs={};
  for(let i=0;i<=9;i++)for(let j=0;j<=9;j++){const p=pois(i,mh)*pois(j,ma),H=m.hs+i,A=m.as+j;if(H>A)ph+=p;else if(H===A)pd+=p;if(H+A>2.5)po+=p;if(H+A>1.5)p15+=p;if(H+A>3.5)p35+=p;if(H>0&&A>0)pb+=p;if(H-A>=2)hc+=p;if(H<=5&&A<=5){const k=H+'-'+A;cs[k]=(cs[k]||0)+p}}
  const pa=1-ph-pd,mu=mh+ma,none=Math.exp(-mu);o.res={h:ph,d:pd,a:pa};o.ou={o:po,u:1-po};o.ou15={o:p15,u:1-p15};o.ou35={o:p35,u:1-p35};o.btts={y:pb,n:1-pb};o.ng={h:(1-none)*mh/(mu||1),n:none,a:(1-none)*ma/(mu||1)};
  o.dc={hd:ph+pd,da:pd+pa,ha:ph+pa};o.dnb={h:ph/(ph+pa||1),a:pa/(ph+pa||1)};o.hc={h:hc,a:1-hc};
  o.cs=Object.fromEntries(Object.entries(cs).filter(([,p])=>p>=.025).sort((a,b)=>b[1]-a[1]).slice(0,9))}
 if(m.sp==='basketball'){/* possessions left (0.55 a real second, alternating); a scoring trip is 2 (75%) or 3 (25%) points */
  const n=Math.max(0,360+(m.ot||0)-m.clock)*.55/2,vh=m.ph*5.25-Math.pow(m.ph*2.25,2),va=m.pa*5.25-Math.pow(m.pa*2.25,2),mh=n*m.ph*2.25,ma=n*m.pa*2.25,sd=Math.sqrt(n*(vh+va))+.35;
  const pH=PhiN((m.hs-m.as+mh-ma)/sd);o.ml={h:pH,a:1-pH};const po=1-PhiN((m.line-(m.hs+m.as+mh+ma))/sd);o.tot={o:po,u:1-po};const pc=PhiN((m.hs-m.as+mh-ma-m.spr)/sd);o.spr={h:pc,a:1-pc}}
 if(m.sp==='tennis'){const n=200;let w=0,t3=0,s1=0;for(let k=0;k<n;k++){const r=simTennis(m);w+=r.w;t3+=r.three;s1+=r.s1}o.mw={h:w/n,a:1-w/n};o.sets={o:t3/n,u:1-t3/n};if(!m.setsHist.length)o.set1={h:s1/n,a:1-s1/n}}
 return o}
function simTennis(m){let s1=m.setsHist.length?(m.setsHist[0][0]>m.setsHist[0][1]?1:0):null;const s={sets:m.sets.slice(),games:m.games.slice(),pts:m.pts.slice(),tb:m.tb,server:m.server};const ps=[TEAMS.tennis.find(t=>t[0]===m.h.n)[1],TEAMS.tennis.find(t=>t[0]===m.a.n)[1]];
 for(let g=0;g<400;g++){const sv=s.server,won=R()<ps[sv]?sv:1-sv;s.pts[won]++;const need=s.tb?5:4;if(s.pts[won]>=need&&s.pts[won]-s.pts[1-won]>=2){s.games[won]++;s.pts=[0,0];s.server^=1;const G=s.games;
  if((G[won]>=4&&G[won]-G[1-won]>=2)||s.tb){s.sets[won]++;if(s1==null)s1=won===0?1:0;s.games=[0,0];s.tb=0;if(s.sets[won]===2)return{w:won===0?1:0,three:s.sets[0]+s.sets[1]===3?1:0,s1}}else if(G[0]===4&&G[1]===4)s.tb=1}}return{w:.5,three:.5,s1:.5}}
const MKT={res:['Match result',{h:'Home',d:'Draw',a:'Away'},'Who wins after 90 minutes. Draw is its own result.'],dc:['Double chance',{hd:'Home or draw',da:'Draw or away',ha:'Home or away'},'Two results in one bet. Safer, so it pays less.'],
 dnb:['Draw no bet',{h:'Home',a:'Away'},'Pick the winner. If it ends a draw you get your stake back.'],ou:['Total goals 2.5',{o:'Over 2.5',u:'Under 2.5'},'Over pays if 3 or more goals are scored in total, Under if 2 or fewer.'],
 ou15:['Total goals 1.5',{o:'Over 1.5',u:'Under 1.5'},'Over pays on 2 or more goals in total.'],ou35:['Total goals 3.5',{o:'Over 3.5',u:'Under 3.5'},'Over pays on 4 or more goals in total.'],
 btts:['Both teams to score',{y:'Yes',n:'No'},'Yes pays if each team scores at least once.'],hc:['Handicap',{h:'Home -1.5',a:'Away +1.5'},'Home -1.5 needs the home team to win by 2 or more. Away +1.5 wins if the away team wins, draws or loses by just 1.'],
 ng:['Next goal',{h:'Home',n:'No more goals',a:'Away'},'Who scores the next goal. Settles the moment it goes in.'],cs:['Correct score',{},'The exact final score. Hard to hit, pays big.'],
 spr:['Points spread',{h:'Home',a:'Away'},'The favourite has to win by more than the spread; the underdog covers if it loses by less.'],sets:['Total sets 2.5',{o:'Over 2.5 (three sets)',u:'Under 2.5 (straight sets)'},'Over pays if the match goes to a third set.'],set1:['First set winner',{h:'Home',a:'Away'},'Who wins the first set.'],
 ml:['Money line',{h:'Home',a:'Away'},'Who wins the game, overtime included.'],tot:['Total points',{o:'Over',u:'Under'},'Combined points of both teams, over or under the line.'],mw:['Match winner',{h:'Home',a:'Away'},'Who wins the match.']};
const selLabel=(m,k,s)=>{if(k==='cs')return s.replace('-','–');if(k==='spr')return s==='h'?`${m.h.n} ${m.spr>0?'-':'+'}${Math.abs(m.spr)}`:`${m.a.n} ${m.spr>0?'+':'-'}${Math.abs(m.spr)}`;const L=MKT[k][1][s];return L==='Home'?m.h.n:L==='Away'?m.a.n:k==='tot'?`${L} ${m.line}`:L};
/* ---------- the loop ---------- */
setInterval(()=>{for(const m of MATCHES)tickMatch(m,1);MATCHES=MATCHES.filter(m=>!m.done||Date.now()-m.endW<300000);microTick();if(document.hidden)return;
 if(++uiN%4===0){refreshOdds();drawMicro();if(CURMATCH)drawMatchLive();if($('lobLive'))drawLobLive();drawSlip(1)}},250);
let uiN=0,CURMATCH=0;
function refreshOdds(){for(const m of MATCHES)if(m.live||!m.done){const o=probs(m),prev=m.P||{};m.P=o;m.Pprev=prev}
 document.querySelectorAll('.ob[data-m]').forEach(b=>{const m=MATCHES.find(z=>z.id==b.dataset.m);if(!m)return;const p=m.P&&m.P[b.dataset.k]&&m.P[b.dataset.k][b.dataset.s],od=p==null?0:ODD(p),sus=m.sus>0||m.done||!od;const v=b.querySelector('b');const t=sus?'—':od.toFixed(2);if(v.textContent!==t){v.textContent=t;b.classList.remove('tk');void b.offsetWidth;b.classList.add('tk')}b.disabled=sus})}
const oddBtn=(m,k,s,lab)=>{const p=m.P&&m.P[k]?m.P[k][s]:null,od=p==null?0:ODD(p),sus=m.sus>0||!od;return `<button class="ob${SLIP.some(x=>x.mid===m.id&&x.k===k&&x.s===s)?' on':''}" data-m="${m.id}" data-k="${k}" data-s="${s}" ${sus?'disabled':''}>${lab}<b>${sus?'—':od.toFixed(2)}</b></button>`};
function wireOdds(root){root.querySelectorAll('.ob[data-m]').forEach(b=>b.onclick=()=>{const m=MATCHES.find(z=>z.id==b.dataset.m);if(!m)return;toggleSel(m,b.dataset.k,b.dataset.s);sfx('click');root.querySelectorAll(`.ob[data-m="${m.id}"]`).forEach(x=>x.classList.toggle('on',SLIP.some(s=>s.mid===m.id&&s.k===x.dataset.k&&s.s===x.dataset.s)))})}
const scoreTxt=m=>m.sp==='tennis'?`${m.sets[0]}–${m.sets[1]} <span class="dim" style="font-size:.75em">${m.games.join('–')} · ${['0','15','30','40','AD'][Math.min(4,m.pts[0])]||m.pts[0]}–${['0','15','30','40','AD'][Math.min(4,m.pts[1])]||m.pts[1]}</span>`:`${m.hs}–${m.as}`;
const realLeft=m=>m.sp==='football'?Math.max(0,(90+(m.stop||3))*4-m.clock):m.sp==='basketball'?Math.max(0,360+(m.ot||0)-m.clock):null;
const progress=m=>m.done?1:!m.live?0:m.sp==='football'?Math.min(1,m.min/90):m.sp==='basketball'?Math.min(1,m.clock/360):Math.min(1,(m.sets[0]+m.sets[1]+(m.games[0]+m.games[1])/8)/2.5);
const clockTxt=m=>{if(m.done)return 'Full time';if(!m.live){const s=Math.max(0,Math.ceil((m.start-Date.now())/1000));return `Starts in ${s>=60?Math.floor(s/60)+'m '+s%60+'s':s+'s'}`}
 if(m.sp==='football')return m.min>=90?`90+${m.min-90}' · stoppage time`:`${m.min}' · ${90-m.min} min left${m.min<45?' · 1st half':' · 2nd half'}`;
 if(m.sp==='basketball'){const q=Math.min(4,Math.floor(m.clock/90)+1),ql=Math.max(0,90-(m.clock%90))*8/60;return m.clock>=360?'Overtime':`Q${q} · ${Math.floor(ql)}:${String(Math.round((ql%1)*60)).padStart(2,'0')} left in the quarter`}
 return `Set ${m.sets[0]+m.sets[1]+1} · games ${m.games.join('–')} · ${(m.server?m.a.n:m.h.n).split(' ').pop()} serving`};
/* the list view: a big minute, then how long is left in plain words */
const rowClock=m=>{if(m.done)return `<b class="dn" style="font-size:15px">FT</b><div class="dim" style="font-size:11.5px">Full time</div>`;if(!m.live)return `<b class="dn" style="font-size:15px">${new Date(m.start).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false})}</b><div class="dim" style="font-size:11.5px">${clockTxt(m)}</div>`;
 const big=m.sp==='football'?(m.min>=90?"90+'":m.min+"'"):m.sp==='basketball'?'Q'+Math.min(4,Math.floor(m.clock/90)+1):'Set '+(m.sets[0]+m.sets[1]+1),sub=m.sp==='football'?(m.min>=90?'Stoppage time':`${90-m.min} min left`):m.sp==='basketball'?`${Math.max(0,Math.ceil((360-m.clock)*8/60))} min left`:`Games ${m.games.join('–')}`;
 return `<b class="dn" style="font-size:15px;color:var(--live)">● ${big}</b><div class="dim" style="font-size:11.5px">${sub}</div>`};
const pbar=m=>`<div style="height:3px;border-radius:3px;background:var(--line);margin-top:5px;overflow:hidden"><i style="display:block;height:100%;width:${progress(m)*100}%;background:${m.live?'var(--live)':'var(--ink-3)'}"></i></div>`;
function matchRow(m){const k=m.sp==='football'?'res':m.sp==='basketball'?'ml':'mw',sel=m.sp==='football'?[['h','1'],['d','X'],['a','2']]:[['h','1'],['a','2']];
 return `<div style="display:grid;grid-template-columns:150px minmax(0,1fr) 110px auto;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid var(--line);cursor:pointer" data-mt="${m.id}">
  <div>${rowClock(m)}${pbar(m)}<div class="dim" style="font-size:11px;margin-top:3px">${m.lg}</div></div>
  <div><b>${m.h.n}</b><br><b>${m.a.n}</b></div><div class="dn" style="font-size:18px">${m.live||m.done?scoreTxt(m).replace('–','<br>'):'<span class="dim" style="font-size:12px">vs</span>'}</div>
  <div style="display:flex;gap:6px">${sel.map(([s,l])=>oddBtn(m,k,s,l)).join('')}</div></div>`}
function drawLobLive(){const el=$('lobLive');if(!el)return;const L=MATCHES.filter(m=>m.live).slice(0,5);el.innerHTML=`<div class="card">${L.map(matchRow).join('')||'<div class="empty">Nothing live right now</div>'}</div>`;wireMatchRows(el)}
function wireMatchRows(el){wireOdds(el);el.querySelectorAll('[data-mt]').forEach(r=>r.onclick=e=>{if(e.target.closest('.ob'))return;location.hash='#/match/'+r.dataset.mt})}
/* ---------- pages ---------- */
ROUTES.sports=(f)=>{const v=$('view'),sp=['football','basketball','tennis'].includes(f)?f:null,live=f==='live';
 const L=MATCHES.filter(m=>(!sp||m.sp===sp)&&(!live||m.live)),grp=(t,a)=>a.length?`<div class="sh"><div><span class="mono">${a.length} matches</span><h2 class="dw">${t}</h2></div></div><div class="card">${a.map(matchRow).join('')}</div>`:'';
 v.innerHTML=`<div class="sh"><div><span class="mono">Sports${sp?' · '+LEAGUE[sp]:''}</span><h2 class="dw">${live?'Live now':sp?sp[0].toUpperCase()+sp.slice(1):'Sports'}</h2></div><div class="chips">${[['','All'],['live','Live'],['football','Football'],['basketball','Basketball'],['tennis','Tennis']].map(([k,l])=>`<a class="chip${(f||'')===k?' on':''}" href="#/sports${k?'/'+k:''}">${l}</a>`).join('')}</div></div>
  <div class="help" style="margin-bottom:14px"><div><b class="n">1</b><h4>Pick a price</h4><p>Click any odds button. It goes into your bet slip on the right. Odds of 2.50 mean a win pays 2.50× your stake (your stake included).</p></div>
   <div><b class="n">2</b><h4>Set your stake</h4><p>Type how much to bet. The slip shows what you get back. Add more picks and switch to Multi to combine them: all must win, the odds multiply.</p></div>
   <div><b class="n">3</b><h4>Place it, watch it live</h4><p>Your bets settle when the market is decided. Live matches update every second. Prices go blank for a few seconds after a goal.</p></div>
   <div><b class="n">4</b><h4>Cash out or go micro</h4><p>Open bets can be cashed out early for their current value. Micro bets cover the next few minutes, the next point or the next basket.</p></div></div>
  ${!f?`<div class="hero" style="grid-template-columns:1fr 1fr;margin-bottom:6px"><div class="ban inv" style="min-height:160px" onclick="location.hash='#/micro'"><div><span class="mono">Micro betting</span><h3 class="dw">The next five minutes.</h3><p>Every live match, sliced into the next play. Settles in under a minute.</p></div></div><div class="ban out" style="min-height:160px" onclick="location.hash='#/sports/live'"><div><span class="mono">Acca boost</span><h3 class="dw">Up to +15%.</h3><p>Three legs +5%, four +10%, five or more +15% on your accumulator odds.</p></div></div></div>`:''}
  ${grp('In play',L.filter(m=>m.live))}${live?'':grp('Starting soon',L.filter(m=>!m.live&&!m.done))+grp('Results',L.filter(m=>m.done))}${footer()}`;
 refreshOdds();wireMatchRows(v);v.querySelectorAll('[data-mt]').forEach(r=>{const m=MATCHES.find(z=>z.id==r.dataset.mt);r.querySelectorAll('.ob').forEach(b=>{const p=m.P&&m.P[b.dataset.k];})})};
ROUTES.match=(id)=>{const m=MATCHES.find(z=>z.id==id);if(!m){$('view').innerHTML=`<div class="card empty">That match has finished and left the board. <a href="#/sports"><b>Back to sports</b></a></div>`;return}CURMATCH=m.id;refreshOdds();
 const mk=m.sp==='football'?['res','dc','dnb','ou','ou15','ou35','btts','hc','ng','cs']:m.sp==='basketball'?['ml','spr','tot']:['mw','set1','sets'];
 $('view').innerHTML=`<div class="ban inv" style="min-height:0;cursor:default;padding:22px 28px"><div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px"><div><span class="mono">${m.lg}</span><h3 class="dw" style="font-size:32px">${m.h.n}</h3></div><div style="text-align:center"><div class="dn" id="mcS" style="font-size:54px;line-height:1">${scoreTxt(m)}</div><span class="mono" id="mcC">${m.live?'● LIVE · ':''}${clockTxt(m)}</span><div id="mcPb" style="width:240px;margin:6px auto 0">${pbar(m)}</div></div><div style="text-align:right"><span class="mono">${m.sp}</span><h3 class="dw" style="font-size:32px">${m.a.n}</h3></div></div>
  <div id="mcPitch" style="margin-top:16px"></div></div>
 <div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px;margin-top:14px"><div><div class="sh" style="margin-top:6px"><div><span class="mono">Micro markets · settle in seconds</span><h2 class="dw">Next play</h2></div></div><div id="mcMicro" class="card"></div>
  <div class="sh"><div><span class="mono">Markets</span><h2 class="dw">Match</h2></div></div><div class="card" id="mcM">${mk.map(k=>`<div style="padding:14px 16px;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:8px"><span class="mono" style="color:var(--ink)">${MKT[k][0]}${k==='tot'?' '+m.line:''}</span><span class="dim" style="font-size:11.5px;text-align:right;max-width:60%">${MKT[k][2]}</span></div><div style="display:flex;gap:6px;flex-wrap:wrap" data-mk="${k}">${(k==='cs'?Object.keys((m.P&&m.P.cs)||{}):Object.keys(MKT[k][1])).map(s=>oddBtn(m,k,s,selLabel(m,k,s))).join('')||'<span class="dim">Closed</span>'}</div></div>`).join('')}</div></div>
  <div><div class="sh" style="margin-top:6px"><div><span class="mono">Live</span><h2 class="dw">Commentary</h2></div></div><div class="card" id="mcEv" style="max-height:520px;overflow:auto"></div>${m.sp==='football'?`<div class="card" style="margin-top:12px;padding:6px 16px" id="mcSt"></div>`:''}</div></div>`;
 wireOdds($('mcM'));drawMatchLive()};
function drawMatchLive(){const m=MATCHES.find(z=>z.id===CURMATCH);if(!m||!$('mcS')){CURMATCH=0;return}$('mcS').innerHTML=scoreTxt(m);$('mcC').textContent=(m.live?'● LIVE · ':'')+clockTxt(m)+(m.sus>0?' · markets suspended':'');$('mcPb').innerHTML=pbar(m);
 $('mcEv').innerHTML=m.ev.map(e=>`<div class="nt" style="grid-template-columns:44px 1fr"><span class="mono">${e.min!=null?e.min+"'":''}</span><div><b style="${/GOAL|Set|Full/.test(e.t)?'font-size:15px':'font-weight:600'}">${esc(e.t)}</b></div></div>`).join('')||'<div class="empty">Waiting for kick-off</div>';
 if($('mcSt')){const s=m.stats;$('mcSt').innerHTML=[['Possession',s.hp+'%',(100-s.hp)+'%'],['Shots',s.hsh,s.ash],['Corners',s.hc,s.ac]].map(([k,a,b])=>`<div class="kv"><b>${a}</b><span>${k}</span><b>${b}</b></div>`).join('')}
 if(m.sp==='football'&&m.live){const x=clamp(50+(m.stats.hp-50)*1.4+Math.sin(Date.now()/900)*28,6,94);$('mcPitch').innerHTML=`<div style="position:relative;height:70px;border:1.5px solid rgba(255,255,255,.4);border-radius:8px"><div style="position:absolute;left:50%;top:0;bottom:0;border-left:1.5px solid rgba(255,255,255,.4)"></div><div style="position:absolute;left:${x}%;top:50%;width:14px;height:14px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);transition:left .9s var(--io)"></div><span class="mono" style="position:absolute;left:10px;top:6px">${x>60?m.h.n+' attacking':x<40?m.a.n+' attacking':'Midfield'}</span></div>`}
 else $('mcPitch').innerHTML='';
 const mm=MICRO.filter(x=>x.mid===m.id);$('mcMicro').innerHTML=mm.map(microRow).join('')||'<div class="empty">Micro markets open when the match is live</div>';wireMicro($('mcMicro'))}
/* ---------- bet slip ---------- */
const SLIP=[];let SLIPMODE='single';
function toggleSel(m,k,s){const i=SLIP.findIndex(x=>x.mid===m.id&&x.k===k&&x.s===s);if(i>=0)SLIP.splice(i,1);else{const same=SLIP.findIndex(x=>x.mid===m.id&&x.k===k);if(same>=0)SLIP.splice(same,1);SLIP.push({mid:m.id,k,s,st:5})}$('slip').classList.toggle('on',SLIP.length>0||$('slip').classList.contains('pin'));drawSlip()}
const selOdd=x=>{const m=MATCHES.find(z=>z.id===x.mid);if(!m||m.done||m.sus>0||!m.P||!m.P[x.k])return 0;return ODD(m.P[x.k][x.s])};
const boost=n=>n>=5?.15:n===4?.1:n===3?.05:0;
function drawSlip(tickOnly){const el=$('slip'),n=SLIP.length,nOpen=SPB.filter(b=>!b.micro).length;$('slipN').hidden=!(n+nOpen);$('slipN').textContent=n||nOpen;if(!el.classList.contains('on'))return;if(tickOnly&&document.activeElement&&el.contains(document.activeElement))return;
 const acc=SLIP.reduce((a,x)=>a*(selOdd(x)||0),1)*(1+boost(n)),open=SPB.filter(b=>!b.micro);
 el.innerHTML=`<div style="padding:16px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center"><b class="dw" style="font-size:22px">Bet slip</b><span class="sp"></span><button class="icb" id="slX" style="width:34px;height:34px">${svg('x')}</button></div>
 <div class="tabs" style="padding:0 10px;margin:0"><button class="${SLIPMODE==='single'?'on':''}" data-sm="single">Singles</button><button class="${SLIPMODE==='multi'?'on':''}" data-sm="multi" ${n<2?'disabled':''}>Multi (${n})</button><button class="${SLIPMODE==='open'?'on':''}" data-sm="open">Open (${open.length})</button></div>
 <div style="flex:1;overflow:auto">${SLIPMODE==='open'?open.map(b=>{const co=cashOutVal(b);return `<div style="padding:12px 18px;border-bottom:1px solid var(--line)"><b>${esc(b.lab)}</b><div class="mut" style="font-size:12px">${esc(b.ev)} · @ ${b.od.toFixed(2)}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><span class="dn">${fmt(b.st)} → ${fmt(b.st*b.od)}</span>${co?BTN('Cash out '+fmt(co),'sm','data-co="'+b.id+'"'):''}</div></div>`}).join('')||'<div class="empty">No open bets</div>'
  :SLIP.map((x,i)=>{const m=MATCHES.find(z=>z.id===x.mid),od=selOdd(x);return `<div style="padding:12px 18px;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between"><b>${m?selLabel(m,x.k,x.s):'—'}</b><b class="dn">${od?od.toFixed(2):'SUSP'}</b></div><div class="mut" style="font-size:12px">${MKT[x.k][0]} · ${m?m.h.n+' v '+m.a.n:''}</div>
   ${SLIPMODE==='single'?`<div class="betin" style="height:38px;margin-top:8px"><span>¢</span><input data-st="${i}" type="number" min=".1" value="${x.st}"><button data-rm="${i}">✕</button></div><div class="mono" style="margin-top:4px">Returns ${fmt(x.st*(od||0))}</div>`:`<button class="mono" data-rm="${i}" style="margin-top:4px">Remove</button>`}</div>`}).join('')||'<div class="empty">Click any odds to add a selection</div>'}</div>
 ${SLIPMODE!=='open'&&n?`<div style="padding:14px 18px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px">${SLIPMODE==='multi'?`<div class="kv" style="padding:4px 0"><span>Odds${boost(n)?` (boost +${boost(n)*100}%)`:''}</span><b class="dn">${acc?acc.toFixed(2):'—'}</b></div><div class="betin"><span>¢</span><input id="slMS" type="number" min=".1" value="${SLIP.mst||5}"></div><div class="mono">Returns ${fmt((SLIP.mst||5)*acc)}</div>`:''}
  <label class="mut" style="font-size:12px;display:flex;gap:6px"><input type="checkbox" checked disabled> Accept odds changes</label>${BTN(SLIPMODE==='multi'?'Place multi':'Place '+n+' bet'+(n>1?'s':''),'f lg w','id="slGo"')}</div>`:''}`;
 $('slX').onclick=()=>{el.classList.remove('on','pin')};el.querySelectorAll('[data-sm]').forEach(b=>b.onclick=()=>{SLIPMODE=b.dataset.sm;drawSlip()});
 el.querySelectorAll('[data-st]').forEach(i=>i.oninput=()=>{SLIP[+i.dataset.st].st=Math.max(0,+i.value||0)});if($('slMS'))$('slMS').oninput=()=>SLIP.mst=Math.max(0,+$('slMS').value||0);
 el.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{SLIP.splice(+b.dataset.rm,1);if(!SLIP.length&&SLIPMODE==='multi')SLIPMODE='single';drawSlip();refreshOdds()});
 el.querySelectorAll('[data-co]').forEach(b=>b.onclick=()=>cashOut(+b.dataset.co));if($('slGo'))$('slGo').onclick=placeSlip}
$('slipBtn').onclick=()=>{const s=$('slip');const on=!s.classList.contains('on');s.classList.toggle('on',on);s.classList.toggle('pin',on);if(on&&!SLIP.length)SLIPMODE='open';drawSlip()};
let bid=0;
function placeSlip(){if(SLIPMODE==='multi'){const st=SLIP.mst||5,legs=SLIP.map(x=>({...x,od:selOdd(x)}));if(legs.some(l=>!l.od))return toast('A selection is suspended','Remove it or wait a moment','lt');const od=Math.floor(legs.reduce((a,l)=>a*l.od,1)*(1+boost(legs.length))*100)/100;
  if(!spend(st,'sport-multi'))return;SPB.push({id:++bid,multi:1,legs,st,od,lab:`${legs.length}-leg multi`,ev:legs.map(l=>{const m=MATCHES.find(z=>z.id===l.mid);return selLabel(m,l.k,l.s)}).join(' + '),mid:-1});SLIP.length=0;sfx('bet');toast('Multi placed',`${fmt(st)} @ ${od.toFixed(2)}`,'','list')}
 else{for(const x of SLIP.slice()){const od=selOdd(x),m=MATCHES.find(z=>z.id===x.mid);if(!od){toast(`${m?selLabel(m,x.k,x.s):'Selection'} is suspended`,'','lt');continue}if(!spend(x.st,'sport'))break;
  SPB.push({id:++bid,mid:x.mid,k:x.k,s:x.s,st:x.st,od,lab:selLabel(m,x.k,x.s),ev:`${MKT[x.k][0]} · ${m.h.n} v ${m.a.n}`});SLIP.splice(SLIP.indexOf(x),1);sfx('bet')}if(!SLIP.length)toast('Bets placed','Follow them under Open','','list')}
 SLIPMODE='open';saveSPB();drawSlip();refreshOdds()}
function cashOutVal(b){if(b.multi||b.micro)return 0;const m=MATCHES.find(z=>z.id===b.mid);if(!m||m.done||m.sus>0||!m.P||!m.P[b.k])return 0;return Math.floor(b.st*b.od*m.P[b.k][b.s]*.95*100)/100}
function cashOut(id){const b=SPB.find(z=>z.id===id),v=b&&cashOutVal(b);if(!v)return;SPB.splice(SPB.indexOf(b),1);credit(v,'sport');record('sport',b.st,v,`${b.lab} · cashed out`);sfx('cash');toast('Cashed out',fmt(v));saveSPB();drawSlip()}
function legResult(l,m){if(!m.done)return null;const r=m.hs>m.as?'h':m.hs<m.as?'a':'d',t=m.hs+m.as;
 switch(l.k){case 'res':return r===l.s;case 'dc':return l.s.includes(r);case 'dnb':return r==='d'?'push':r===l.s;case 'ou':return(t>2.5?'o':'u')===l.s;case 'ou15':return(t>1.5?'o':'u')===l.s;case 'ou35':return(t>3.5?'o':'u')===l.s;
  case 'btts':return(m.hs>0&&m.as>0?'y':'n')===l.s;case 'hc':return(m.hs-m.as>=2?'h':'a')===l.s;case 'cs':return `${m.hs}-${m.as}`===l.s;case 'ng':return l.s==='n';
  case 'ml':case 'mw':return(m.hs>m.as?'h':'a')===l.s;case 'tot':return(t>m.line?'o':'u')===l.s;case 'spr':return(m.hs-m.as>m.spr?'h':'a')===l.s;case 'sets':return(t===3?'o':'u')===l.s;case 'set1':return((m.setsHist[0]||[0,0])[0]>(m.setsHist[0]||[0,0])[1]?'h':'a')===l.s}return false}
function settleMatch(m){for(const b of SPB.slice()){if(b.micro)continue;let res=null;
 let pushOd=1;if(b.multi){const rs=b.legs.map(l=>{const mm=MATCHES.find(z=>z.id===l.mid);return mm?legResult(l,mm):false});if(rs.includes(false))res=false;else if(rs.every(r=>r===true||r==='push')){res=true;b.legs.forEach((l,i)=>{if(rs[i]==='push')pushOd*=l.od})}}else if(b.mid===m.id)res=legResult(b,m);
 if(res===null)continue;SPB.splice(SPB.indexOf(b),1);const pay=res==='push'?b.st:res?b.st*b.od/pushOd:0;if(res==='push'){credit(pay,'sport');record('sport',b.st,pay,`${b.lab} · draw, stake back`);toast('Draw: stake returned',b.lab,'lt','ball');continue}if(pay)credit(pay,'sport');record(b.multi?'sport-multi':'sport',b.st,pay,`${b.lab} · ${b.ev}`);
 if(res){sfx('win');notify(`Bet won · +${fmt(pay)}`,`${b.lab} @ ${b.od.toFixed(2)}`,'trophy','#/account/bets')}else toast('Bet lost',`${b.lab} · ${m.h.n} ${m.hs}–${m.as} ${m.a.n}`,'lt','ball');outcome(res)}saveSPB()}
/* next-goal bets settle the moment a goal goes in (or at full time for "no more goals") */
function settleNextGoal(m,side){for(const b of SPB.slice()){if(b.multi||b.micro||b.mid!==m.id||b.k!=='ng')continue;SPB.splice(SPB.indexOf(b),1);const win=b.s===side,pay=win?b.st*b.od:0;if(pay)credit(pay,'sport');record('sport',b.st,pay,`Next goal · ${b.lab}`);outcome(win);if(win){sfx('win');toast('Next goal · won','+'+fmt(pay),'','ball')}}saveSPB()}
/* open bets are tied to live matches; a reload can't bring the match back, so they are voided and refunded */
function saveSPB(){if(!loggedIn())return;const x=X();x.spb=SPB.map(b=>({st:b.st,lab:b.lab}));save()}
function voidOldBets(){const x=X();if(x.spb&&x.spb.length){const tot=x.spb.reduce((a,b)=>a+b.st,0);P().bal=Math.round((P().bal+tot)*100)/100;tx('refund',tot,`${x.spb.length} open sports bet(s) voided after reload`);setTimeout(()=>notify('Open bets voided',`${x.spb.length} bet(s) from your last visit were refunded: ${fmt(tot)}`,'list','#/account/tx'),2500)}x.spb=[];save()}

/* ================= MICRO MARKETS ================= */
const MICRO=[];let mcid=0;
function microTick(){const now=Date.now();
 for(const m of MATCHES){if(!m.live||m.done)continue;
  if(m.sp==='football'&&m.min<88){const w0=Math.ceil((m.min+1)/5)*5;for(const k of['goal','corner']){if(!MICRO.some(x=>x.mid===m.id&&x.k===k&&x.w0===w0)){const rate=k==='goal'?(m.lh+m.la)/90:(9.2/90),p=1-Math.exp(-rate*5);
   MICRO.push({id:++mcid,mid:m.id,k,w0,w1:w0+5,p,q:k==='goal'?`Goal between ${w0}' and ${w0+5}'?`:`Corner between ${w0}' and ${w0+5}'?`,sel:[['y','Yes',p],['n','No',1-p]],ev:`${m.h.n} v ${m.a.n}`,closes:()=>m.min>=w0,open:1})}}}
  if(m.sp==='basketball'&&!MICRO.some(x=>x.mid===m.id&&x.k==='three'&&x.open)){const p=.25;MICRO.push({id:++mcid,mid:m.id,k:'three',p,q:'Next basket a three-pointer?',sel:[['y','Yes',p],['n','No',1-p]],ev:`${m.h.n} v ${m.a.n}`,open:1,born:now})}
  if(m.sp==='tennis'&&!MICRO.some(x=>x.mid===m.id&&x.k==='pt'&&x.open)){const sv=m.server,ps=TEAMS.tennis.find(t=>t[0]===(sv?m.a.n:m.h.n))[1];MICRO.push({id:++mcid,mid:m.id,k:'pt',sv,q:`Next point: ${sv?m.a.n:m.h.n} to serve`,sel:[['s','Server',ps],['r','Receiver',1-ps]],ev:`${m.h.n} v ${m.a.n}`,open:1,born:now,closeAt:m.clock+2.2,m})}}
 if(CR.st==='wait'&&!MICRO.some(x=>x.k==='crash'&&x.open)){const p=.99/2;MICRO.push({id:++mcid,mid:0,k:'crash',q:'Next Crash round busts at 2.00× or higher?',sel:[['y','Yes',p],['n','No',1-p]],ev:'Crash · live',open:1})}
 if(CR.st==='wait'&&!MICRO.some(x=>x.k==='ladder'&&x.open)){MICRO.push({id:++mcid,mid:0,k:'ladder',q:'Next Crash round reaches…',sel:[[1.5,'1.5×',.99/1.5],[2,'2×',.99/2],[5,'5×',.99/5],[10,'10×',.99/10]],ev:'Crash · live',open:1})}
 for(const m of MATCHES)if(m.sp==='tennis'&&m.live&&!m.done&&m.pts[0]+m.pts[1]===0&&!MICRO.some(x=>x.mid===m.id&&x.k==='hold'&&!x.done)){const sv=m.server,ps=TEAMS.tennis.find(t=>t[0]===(sv?m.a.n:m.h.n))[1],ph=holdP(ps);MICRO.push({id:++mcid,mid:m.id,k:'hold',sv,q:`${(sv?m.a.n:m.h.n)} holds serve this game?`,sel:[['y','Holds',ph],['n','Broken',1-ph]],ev:`${m.h.n} v ${m.a.n}`,open:1,m,born:now})}
 if(!MICRO.some(x=>x.k==='rou'&&!x.done)){const t=now+40000;MICRO.push({id:++mcid,mid:0,k:'rou',at:t,q:'Live roulette: next spin',sel:[['r','Red',18/37],['b','Black',18/37],['z','Zero',1/37]],ev:'Live roulette',open:1})}
 for(const x of MICRO){if(!x.open)continue;if(x.k==='hold'&&x.m&&x.m.pts[0]+x.m.pts[1]>0)x.open=0;if(x.k==='ladder'&&CR.st!=='wait')x.open=0;if(x.closes&&x.closes()){x.open=0}if(x.k==='pt'&&x.m&&x.m.clock>=x.closeAt){x.open=0}if(x.k==='crash'&&CR.st!=='wait')x.open=0;if(x.k==='rou'&&now>=x.at-3000)x.open=0}
 for(const x of MICRO)if(x.k==='rou'&&!x.done&&now>=x.at){x.done=1;const n=rint(37);LIVEROU.unshift(n);LIVEROU.length=Math.min(LIVEROU.length,12);microResolve(x,n===0?'z':REDS.has(n)?'r':'b',`Landed ${n}`)}
 for(const m of MATCHES){if(m.sp!=='football')continue;for(const x of MICRO)if(x.mid===m.id&&!x.done&&x.w1&&(m.min>=x.w1||m.done))microResolve(x,'n','Nothing in the window')}
 for(let i=MICRO.length-1;i>=0;i--)if(MICRO[i].done&&!MB.some(b=>b.x===MICRO[i].id)&&now-(MICRO[i].doneW||0)>4000)MICRO.splice(i,1)}
const LIVEROU=[];
/* the chance a server holds a game from 0-0, given the chance of winning each point on serve */
function holdP(p){const q=1-p,d=p*p/(1-2*p*q);return Math.pow(p,4)*(1+4*q+10*q*q)+20*Math.pow(p*q,3)*d}
function microSettle(kind,m,arg){if(kind==='goal'){settleNextGoal(m,arg);for(const x of MICRO)if(x.mid===m.id&&x.k==='goal'&&!x.done&&m.min>=x.w0&&m.min<x.w1)microResolve(x,'y',`Goal ${m.min}'`)}
 if(kind==='corner')for(const x of MICRO)if(x.mid===m.id&&x.k==='corner'&&!x.done&&m.min>=x.w0&&m.min<x.w1)microResolve(x,'y',`Corner ${m.min}'`);
 if(kind==='bb')for(const x of MICRO)if(x.mid===m.id&&x.k==='three'&&!x.done&&!x.open)microResolve(x,arg.pts===3?'y':'n',arg.pts===3?'Three!':'Two-pointer');else if(kind==='bb')for(const x of MICRO)if(x.mid===m.id&&x.k==='three'&&x.open&&Date.now()-x.born>1500)x.open=0;
 if(kind==='pt')for(const x of MICRO)if(x.mid===m.id&&x.k==='pt'&&!x.done)microResolve(x,arg.won===x.sv?'s':'r',arg.won===x.sv?'Server won the point':'Receiver won the point');
 if(kind==='crashBust'){for(const x of MICRO)if(x.k==='crash'&&!x.done&&!x.open)microResolve(x,arg>=2?'y':'n',`Bust at ${arg.toFixed(2)}×`);for(const x of MICRO)if(x.k==='ladder'&&!x.done&&!x.open)microResolve(x,s=>arg>=s,`Bust at ${arg.toFixed(2)}×`)}
 if(kind==='game')for(const x of MICRO)if(x.mid===m.id&&x.k==='hold'&&!x.done&&!x.open)microResolve(x,arg.won===x.sv?'y':'n',arg.won===x.sv?'Held':'Broken!')}
const MB=[];/* placed micro bets: {x,sel,st,od} */
function microResolve(x,win,why){x.done=1;x.open=0;x.doneW=Date.now();x.res=typeof win==='function'?null:win;x.why=why;for(const b of MB.slice()){if(b.x!==x.id)continue;MB.splice(MB.indexOf(b),1);if(win===null){credit(b.st,'micro');record('micro-'+x.k,b.st,b.st,`${x.q} · void`);toast('Micro bet void',`${x.q} · stake returned`,'lt','bolt');continue}
 const ok=typeof win==='function'?win(b.sel):b.sel===win,pay=ok?b.st*b.od:0;if(pay)credit(pay,'micro');record('micro-'+x.k,b.st,pay,`${x.q} · ${why}`);outcome(ok);
 if(ok){sfx('win');toast(`Micro win · +${fmt(pay)}`,`${x.q} ${why}`,'','bolt')}else toast('Micro bet lost',`${x.q} ${why}`,'lt','bolt')}}
let MST=X0()?5:5;function X0(){return 1}
function microRow(x){const placed=MB.filter(b=>b.x===x.id);return `<div class="mk" style="min-width:0;grid-template-columns:repeat(${x.sel.length},auto) 1fr;border-right:0;border-bottom:1px solid var(--line);padding:10px 14px"><div class="q" style="grid-column:1/-1">${esc(x.q)}<span class="t">${x.done?esc(x.why):x.open?'OPEN':'IN PLAY'}</span></div>
 ${x.sel.map(([s,l,p])=>`<button class="ob${placed.some(b=>b.sel===s)?' on':''}" data-x="${x.id}" data-s="${s}" ${x.open?'':'disabled'}>${l}<b>${ODD(p)?ODD(p).toFixed(2):'—'}</b></button>`).join('')}<span class="mono" style="text-align:right">${placed.length?'You: '+placed.map(b=>fmt(b.st)).join(', '):''}</span></div>`}
function wireMicro(root){root.querySelectorAll('[data-x]').forEach(b=>b.onpointerdown=e=>{e.preventDefault();const x=MICRO.find(z=>z.id==b.dataset.x);if(!x||!x.open)return;const sel=x.sel.find(s=>String(s[0])===b.dataset.s),od=ODD(sel[2]);if(!od)return;
 if(!spend(MST,'micro'))return;MB.push({x:x.id,sel:sel[0],st:MST,od});sfx('bet');toast('Micro bet placed',`${fmt(MST)} on ${sel[1]} @ ${od.toFixed(2)}`,'','bolt');drawMicro();if(CURMATCH)drawMatchLive()})}
function drawMicro(){const t=$('mtrack');if(!t||!loggedIn())return;const L=MICRO.filter(x=>x.open||MB.some(b=>b.x===x.id)||(x.done&&Date.now()-x.doneW<4000)).slice(0,14);
 const key=L.map(x=>x.id+(x.open?'o':'c')+(x.done?'d':'')+MB.filter(b=>b.x===x.id).length).join(',');if(t._k===key&&!t._force){return}t._k=key;
 t.innerHTML=`<div class="mk" style="min-width:150px"><div class="q">Quick stake</div>${[1,5,25].map(v=>`<button class="ob${MST===v?' on':''}" data-qs="${v}">${v}</button>`).join('')}</div>`+L.map(x=>{const m=MATCHES.find(z=>z.id===x.mid),placed=MB.filter(b=>b.x===x.id);
  return `<div class="mk"><div class="q"><span style="overflow:hidden;text-overflow:ellipsis;max-width:200px">${esc(x.q)}</span><span class="t" data-cd="${x.id}">${x.done?'SETTLED':x.open?(x.k==='rou'?Math.max(0,Math.ceil((x.at-3000-Date.now())/1000))+'s':m&&m.sp==='football'?m.min+"'":'OPEN'):'LIVE'}</span></div>
   ${x.sel.slice(0,4).map(([s,l,p])=>`<button class="ob${placed.some(b=>b.sel===s)?' on':''}${x.done&&x.res===s?' on':''}" data-x="${x.id}" data-s="${s}" ${x.open?'':'disabled'}>${l}<b>${ODD(p)?ODD(p).toFixed(2):'—'}</b></button>`).join('')}</div>`}).join('');
 t.querySelectorAll('[data-qs]').forEach(b=>b.onpointerdown=()=>{MST=+b.dataset.qs;t._k='';drawMicro()});wireMicro(t)}
/* countdowns tick in place, without rebuilding the buttons */
setInterval(()=>{document.querySelectorAll('#mtrack [data-cd]').forEach(e=>{const x=MICRO.find(z=>z.id==e.dataset.cd);if(x&&x.k==='rou'&&x.open)e.textContent=Math.max(0,Math.ceil((x.at-3000-Date.now())/1000))+'s'})},1000);
ROUTES.micro=()=>{const v=$('view');v.innerHTML=`<div class="sh"><div><span class="mono">Live · settles in seconds</span><h2 class="dw">Micro betting</h2></div><p class="mut" style="max-width:46ch;margin:0">One click bets your quick stake on the next slice of play, and it settles within a minute or so: the next five minutes of football, the next basket, the next point, the next Crash round, the next live roulette spin. Every price returns 97%. Quick stake is set in the micro bar below.</p></div><div class="card" id="mcAll"></div>
 <div class="sh"><div><span class="mono">Live roulette · spins every 40 seconds</span><h2 class="dw" style="font-size:22px">Last spins</h2></div></div><div class="card" style="padding:14px 18px" id="mcRou"></div>${footer()}`;const up=()=>{if(!$('mcAll'))return clearInterval(tm);$('mcAll').innerHTML=MICRO.filter(x=>!x.done||Date.now()-x.doneW<4000).map(x=>`<div style="display:grid;grid-template-columns:200px 1fr"><div style="padding:14px 16px;border-bottom:1px solid var(--line)" class="mono">${esc(x.ev)}</div>${microRow(x)}</div>`).join('')||'<div class="empty">Opening markets…</div>';wireMicro($('mcAll'));
 $('mcRou').innerHTML=`<div class="hist">${LIVEROU.map(n=>`<i class="${REDS.has(n)?'w':''}">${n}</i>`).join('')||'<span class="mut">First spin soon</span>'}</div>`},tm=setInterval(up,1000);up()};
