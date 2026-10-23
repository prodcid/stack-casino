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
   const gh=R()<m.lh/90,ga=R()<m.la/90;const press=clamp((m.h.r-m.a.r)*1.4+(R()-.5)*1.3+(gh?1.2:0)-(ga?1.2:0),-1,1);(m.mom=m.mom||[]).push(+press.toFixed(2));if(R()<.08+Math.max(0,press)*.08)m.stats.hst=(m.stats.hst||0)+1;if(R()<.07+Math.max(0,-press)*.08)m.stats.ast=(m.stats.ast||0)+1;if(gh)goal(m,'h',quiet);if(ga)goal(m,'a',quiet);if(R()<5/90)m.stats.hc++,quiet||note(m,'corner','h');if(R()<4.2/90)m.stats.ac++,quiet||note(m,'corner','a');
   if(R()<.12)m.stats.hsh++;if(R()<.1)m.stats.ash++;m.stats.hp=clamp(Math.round(50+(m.h.r-m.a.r)*30+(R()-.5)*8),30,70);if(m.min%9===0&&R()<.5){const sd=R()<.5?'h':'a';m.stats[sd+'f']=(m.stats[sd+'f']||0)+1;if(R()<.25&&!quiet){m.stats[sd+'y']=(m.stats[sd+'y']||0)+1;evt(m,`Yellow card, ${m[sd].n}`,sd)}}
   if(m.min>=90+(m.stop||(m.stop=2+rint(4)))){end(m,quiet)}}}
 else if(m.sp==='basketball'){m.clock+=.25;if(Math.floor(m.clock*4)%2===0&&R()<.55*.5){const t=m.off,p=t?m.pa:m.ph,r=R();let pts=0;const three=R()<.27,ang=R()*Math.PI,rad=three?.86+R()*.1:.15+R()*.55;(m.shots=m.shots||[]).push({t,x:.5+Math.cos(ang)*rad*.47,y:Math.sin(ang)*rad*.9,made:r<p,three:r<p?0:three});if(m.shots.length>60)m.shots.shift();if(r<p){pts=three?3:2;m.shots[m.shots.length-1].three=three;if(t)m.as+=pts;else m.hs+=pts;m.last3=pts===3;if(!quiet)note(m,'score',t?'a':'h',pts);microSettle('bb',m,{t,pts})}m.off^=1}
  m.min=Math.min(48,Math.floor(m.clock/7.5));if(Math.round(m.clock*4)%40===0)(m.run=m.run||[]).push(m.hs-m.as);if(m.clock>=360+(m.ot||0)){if(m.hs===m.as)m.ot=(m.ot||0)+40;else end(m,quiet)}}
 else{m.clock+=.25;if(Math.round(m.clock*4)%10===0)point(m,quiet)}}}
function evt(m,t,side){m.ev.unshift({t,side,min:m.sp==='football'?m.min:m.sp==='basketball'?m.min:null,w:Date.now()});m.ev.length=Math.min(m.ev.length,40)}
function note(m,k,side,pts){if(k==='corner'){evt(m,`Corner, ${m[side].n}`,side);microSettle('corner',m,side)}if(k==='score'&&pts===3)evt(m,`Three-pointer, ${m[side].n}`,side)}
function goal(m,side,quiet){m[side==='h'?'hs':'as']++;m.sus=3;microSettle('goal',m,side);if(quiet)return;evt(m,`GOAL! ${m[side].n} · ${m.hs}–${m.as}`,side);
 if(CURMATCH===m.id||SPB.some(b=>b.mid===m.id))sfx('goal');if(SPB.some(b=>b.mid===m.id))toast(`GOAL · ${m.h.n} ${m.hs}–${m.as} ${m.a.n}`,`${m.min}' · ${m[side].n}`,'','ball','#/match/'+m.id)}
function point(m,quiet){const sv=m.server,p=TEAMS.tennis.find(t=>t[0]===(sv?m.a.n:m.h.n))[1]-.04*(sv?m.h.r-m.a.r:m.a.r-m.h.r)*0,won=R()<p?sv:1-sv;m.last={won,sv,w:Date.now(),rally:won===sv&&R()<.12?0:1+rint(7),df:won!==sv&&R()<.06};(m.ptl=m.ptl||[]).push(won);if(m.ptl.length>24)m.ptl.shift();m.pts[won]++;microSettle('pt',m,{won,sv});
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
function refreshOdds(){for(const m of MATCHES)if(m.live||!m.done){const o=probs(m),prev=m.P||{};m.P=o;m.Pprev=prev;m.mv=m.mv||{};for(const k in o)for(const sl in o[k]){const a=prev[k]&&prev[k][sl],b=o[k][sl];if(a&&b&&Math.abs(ODD(b)-ODD(a))>=.02)m.mv[k+sl]={d:ODD(b)>ODD(a)?1:-1,w:Date.now()}}}
 document.querySelectorAll('.ob[data-m]').forEach(b=>{const m=MATCHES.find(z=>z.id==b.dataset.m);if(!m)return;const p=m.P&&m.P[b.dataset.k]&&m.P[b.dataset.k][b.dataset.s],od=p==null?0:ODD(p),sus=m.sus>0||m.done||!od;const v=b.querySelector('b');const t=sus?'—':od.toFixed(2);if(v.textContent!==t){v.textContent=t;b.classList.remove('tk');void b.offsetWidth;b.classList.add('tk')}b.disabled=sus;const mv=m.mv&&m.mv[b.dataset.k+b.dataset.s];b.classList.toggle('up',!!mv&&mv.d>0&&Date.now()-mv.w<4000);b.classList.toggle('dn',!!mv&&mv.d<0&&Date.now()-mv.w<4000)})}
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
function cashOutVal(b){if(b.multi||b.micro)return 0;const m=MATCHES.find(z=>z.id===b.mid);if(!m||m.done||m.sus>0||!m.P||!m.P[b.k])return 0;return Math.floor(b.st*b.od*m.P[b.k][b.s]*.95*100)/100}
function cashOut(id){const b=SPB.find(z=>z.id===id),v=b&&cashOutVal(b);if(!v)return;SPB.splice(SPB.indexOf(b),1);credit(v,'sport');record('sport',b.st,v,`${b.lab} · cashed out`);sfx('cash');toast('Cashed out',fmt(v));saveSPB();drawSlip()}
function legResult(l,m){if(!m.done)return null;const r=m.hs>m.as?'h':m.hs<m.as?'a':'d',t=m.hs+m.as;
 switch(l.k){case 'res':return r===l.s;case 'dc':return l.s.includes(r);case 'dnb':return r==='d'?'push':r===l.s;case 'ou':return(t>2.5?'o':'u')===l.s;case 'ou15':return(t>1.5?'o':'u')===l.s;case 'ou35':return(t>3.5?'o':'u')===l.s;
  case 'btts':return(m.hs>0&&m.as>0?'y':'n')===l.s;case 'hc':return(m.hs-m.as>=2?'h':'a')===l.s;case 'cs':return `${m.hs}-${m.as}`===l.s;case 'ng':return l.s==='n';
  case 'ml':case 'mw':return(m.hs>m.as?'h':'a')===l.s;case 'tot':return(t>m.line?'o':'u')===l.s;case 'spr':return(m.hs-m.as>m.spr?'h':'a')===l.s;case 'sets':return(t===3?'o':'u')===l.s;case 'set1':return((m.setsHist[0]||[0,0])[0]>(m.setsHist[0]||[0,0])[1]?'h':'a')===l.s}return false}
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
