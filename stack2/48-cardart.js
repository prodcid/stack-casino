/* ================= CARD ROOM v2: real playing cards (SVG pips + court figures), felt tables, chips, dealt-from-the-shoe motion, room sound =================
   Every card is an SVG drawn once and cached. A card element is two faces on a 3D inner (.pci) so a reveal is a real flip.
   A watcher sees any newly dealt card (.pc.nw) and flies it from the table's shoe; a turned card (.pc.fl) flips in place. */
const CA_SUIT=['M50 2C63 22 100 40 100 64C100 80 88 90 74 90C64 90 57 85 54 79C55 90 60 96 69 100H31C40 96 45 90 46 79C43 85 36 90 26 90C12 90 0 80 0 64C0 40 37 22 50 2Z',
 'M50 96C22 74 0 56 0 30C0 12 13 1 28 1C38 1 46 7 50 16C54 7 62 1 72 1C87 1 100 12 100 30C100 56 78 74 50 96Z',
 'M50 0Q68 26 90 50Q68 74 50 100Q32 74 10 50Q32 26 50 0Z',
 'M50 2a22 22 0 0 1 20 31a22 22 0 1 1 -4 36c1 14 6 23 14 31H20c8 -8 13 -17 14 -31a22 22 0 1 1 -4 -36A22 22 0 0 1 50 2Z'];
const CA_RED=s=>s===1||s===2,CA_INK=s=>CA_RED(s)?'#c8102e':'#15151a';
(function caDefs(){const d=document.createElement('div');d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
 d.innerHTML=`<svg width="0" height="0"><defs>${CA_SUIT.map((p,i)=>`<symbol id="caS${i}" viewBox="0 0 100 100"><path d="${p}"/></symbol>`).join('')}
 <pattern id="caLat" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="#8d1522"/><path d="M0 8H16M8 0V16" stroke="#b8323f" stroke-width="2.2"/><circle cx="8" cy="8" r="2.6" fill="#f1d9a8"/><circle cx="0" cy="0" r="1.6" fill="#e9c47a"/></pattern>
 <linearGradient id="caFace" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f1ede2"/></linearGradient>
 <linearGradient id="caGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8dc84"/><stop offset=".55" stop-color="#d6a536"/><stop offset="1" stop-color="#9b6d14"/></linearGradient>
 <linearGradient id="caCourt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#f3e7cc"/></linearGradient></defs></svg>`;
 (document.body||document.documentElement).appendChild(d)})();
const CA_PIPS={1:[],2:[[1,0],[1,1]],3:[[1,0],[1,.5],[1,1]],4:[[0,0],[2,0],[0,1],[2,1]],5:[[0,0],[2,0],[1,.5],[0,1],[2,1]],6:[[0,0],[2,0],[0,.5],[2,.5],[0,1],[2,1]],
 7:[[0,0],[2,0],[1,.25],[0,.5],[2,.5],[0,1],[2,1]],8:[[0,0],[2,0],[1,.25],[0,.5],[2,.5],[1,.75],[0,1],[2,1]],
 9:[[0,0],[2,0],[0,1/3],[2,1/3],[1,.5],[0,2/3],[2,2/3],[0,1],[2,1]],10:[[0,0],[2,0],[1,1/6],[0,1/3],[2,1/3],[0,2/3],[2,2/3],[1,5/6],[0,1],[2,1]]};
const caPip=(s,x,y,z,flip)=>`<use href="#caS${s}" x="${x-z/2}" y="${y-z/2}" width="${z}" height="${z}"${flip?` transform="rotate(180 ${x} ${y})"`:''}/>`;
function caCourt(r,s){/* a mirrored double-ended court figure in a gold frame: K crown and beard, Q floral crown, J feathered cap */
 const ink=CA_INK(s),robe=r===12?(CA_RED(s)?'#c8102e':'#1d3c8f'):r===11?(CA_RED(s)?'#1d3c8f':'#c8102e'):(CA_RED(s)?'#c8102e':'#1d3c8f'),alt=robe==='#c8102e'?'#1d3c8f':'#c8102e';
 const crown=r===12?`<path d="M80 66L82 44L90 54L100 38L110 54L118 44L120 66Z" fill="url(#caGold)" stroke="#5a3d06" stroke-width="1.5"/><circle cx="100" cy="38" r="3.5" fill="${alt}"/><rect x="80" y="62" width="40" height="6" fill="${alt}" stroke="#5a3d06" stroke-width="1"/>`
  :r===11?`<path d="M82 66Q84 50 90 56Q94 44 100 52Q106 44 110 56Q116 50 118 66Z" fill="url(#caGold)" stroke="#5a3d06" stroke-width="1.5"/>${[86,100,114].map(x=>`<circle cx="${x}" cy="${x===100?47:53}" r="3.2" fill="${alt}" stroke="#5a3d06" stroke-width=".8"/>`).join('')}`
  :`<path d="M78 68Q80 50 100 48Q120 50 122 68Z" fill="${alt}" stroke="#2a1a05" stroke-width="1.5"/><path d="M118 56Q134 34 142 44Q130 46 122 62Z" fill="url(#caGold)" stroke="#5a3d06" stroke-width="1"/>`;
 const face=`<ellipse cx="100" cy="82" rx="15" ry="17" fill="#f7d9b5" stroke="#3a2412" stroke-width="1.4"/><path d="M93 80h4M103 80h4" stroke="#3a2412" stroke-width="1.8" stroke-linecap="round"/><path d="M96 90q4 3 8 0" stroke="#8a2a1a" stroke-width="1.6" fill="none"/>`
  +(r===12?`<path d="M85 86Q86 106 100 110Q114 106 115 86Q108 96 100 96Q92 96 85 86Z" fill="#e8e0d0" stroke="#3a2412" stroke-width="1.2"/>`:r===11?`<path d="M84 74Q80 100 86 108L90 84ZM116 74Q120 100 114 108L110 84Z" fill="#c9962e" stroke="#5a3d06" stroke-width="1"/>`:`<path d="M84 72Q82 88 88 94L90 76ZM116 72Q118 88 112 94L110 76Z" fill="#6b4220"/>`);
 const robeP=`<path d="M56 140L62 110Q78 98 100 108Q122 98 138 110L144 140Z" fill="${robe}" stroke="#14141a" stroke-width="1.6"/><path d="M88 104L100 140L112 104" fill="url(#caGold)" stroke="#5a3d06" stroke-width="1.2"/>`
  +`<path d="M62 118L80 122M66 128L84 132M120 122L138 118M116 132L134 128" stroke="url(#caGold)" stroke-width="3"/>${[0,1,2,3].map(i=>`<circle cx="100" cy="${112+i*8}" r="1.8" fill="${alt}"/>`).join('')}`;
 const prop=r===12?`<path d="M136 64L140 132" stroke="#9aa3b2" stroke-width="4"/><path d="M130 72h16" stroke="url(#caGold)" stroke-width="4"/>`:r===11?`<circle cx="66" cy="98" r="6" fill="${alt}" stroke="#14141a"/><path d="M66 104V136" stroke="#2d6b2d" stroke-width="2.5"/><circle cx="60" cy="94" r="3" fill="url(#caGold)"/><circle cx="72" cy="94" r="3" fill="url(#caGold)"/>`:`<path d="M132 70Q148 98 134 132" stroke="#6b4220" stroke-width="3" fill="none"/><path d="M132 70l-6 -10 10 4z" fill="#9aa3b2"/>`;
 const half=`<g>${robeP}${prop}${face}${crown}</g>`;
 return `<rect x="40" y="34" width="120" height="212" rx="6" fill="url(#caCourt)" stroke="${ink}" stroke-width="2.5"/><clipPath id="caCl${r}${s}"><rect x="40" y="34" width="120" height="212" rx="6"/></clipPath><g clip-path="url(#caCl${r}${s})">${half}<g transform="rotate(180 100 140)">${half}</g><path d="M40 140H160" stroke="${ink}" stroke-width="1" opacity=".4"/></g>
  ${caPip(s,54,50,18)}${caPip(s,146,230,18,1)}`}
const CA_CACHE={};
function caSvg(c){if(CA_CACHE[c])return CA_CACHE[c];const r=rk(c),s=su(c),ink=CA_INK(s),n=r+1,lab=RK[r];let mid='';
 if(r>=10)mid=caCourt(r,s);else if(r===0)mid=s===0?`<ellipse cx="100" cy="140" rx="54" ry="54" fill="none" stroke="#15151a" stroke-width="1.2" opacity=".25"/>${caPip(0,100,140,92)}<path d="M100 104v40" stroke="#fff" stroke-width="2" opacity=".5"/>`:caPip(s,100,140,64);
 else mid=CA_PIPS[n].map(([cx,v])=>caPip(s,58+cx*42,56+v*168,40,v>.5)).join('');
 const idx=`<text x="21" y="42" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="${lab.length>1?30:36}" fill="${ink}" letter-spacing="${lab.length>1?-2:0}">${lab}</text>${caPip(s,21,60,22)}`;
 return CA_CACHE[c]=`<svg viewBox="0 0 200 280" preserveAspectRatio="none"><rect width="200" height="280" fill="url(#caFace)"/><g fill="${ink}">${idx}<g transform="rotate(180 100 140)">${idx}</g>${mid}</g></svg>`}
const CA_BACK=`<svg viewBox="0 0 200 280" preserveAspectRatio="none"><rect width="200" height="280" fill="#fbf7ee"/><rect x="10" y="10" width="180" height="260" rx="10" fill="url(#caLat)"/><rect x="10" y="10" width="180" height="260" rx="10" fill="none" stroke="#5e0c15" stroke-width="3"/><rect x="18" y="18" width="164" height="244" rx="7" fill="none" stroke="#f1d9a8" stroke-width="1.6" opacity=".8"/>
 <ellipse cx="100" cy="140" rx="40" ry="52" fill="#8d1522" stroke="url(#caGold)" stroke-width="4"/><ellipse cx="100" cy="140" rx="32" ry="44" fill="none" stroke="#f1d9a8" stroke-width="1.2"/><text x="100" y="158" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="52" fill="url(#caGold)">S</text></svg>`;
const caInner=c=>`<div class="pci"><div class="pcf">${c==null?'':caSvg(c)}</div><div class="pcb">${CA_BACK}</div></div>`;

/* ---------- chips: real casino colours, stacked; a stack is built from the largest denominations down ---------- */
const CHIPV=[[1000,'#d9a514','#5a3d00'],[500,'#6b2fa8','#fff'],[100,'#1c1c22','#fff'],[25,'#1f8a4c','#fff'],[5,'#c8102e','#fff'],[1,'#eef0f3','#1c1c22'],[.25,'#2d7dd2','#fff']];
function chipsH(a,o={}){a=Math.round((+a||0)*100)/100;if(a<=0)return'';const out=[];let left=a;for(const [v,c,t] of CHIPV){while(left>=v-1e-9&&out.length<(o.max||10)){out.push([v,c,t]);left=Math.round((left-v)*100)/100}}if(!out.length)out.push(CHIPV[CHIPV.length-1]);
 const top=out[out.length-1],z=o.sz||40,st=Math.max(3,Math.round(z*.13)),n=out.length;return `<div class="chst${o.cls?' '+o.cls:''}" title="${fmt(a)}" style="width:${z}px;height:${z+(n-1)*st}px">${out.map(([v,c,t],i)=>`<i class="chp" style="--c:${c};width:${z}px;height:${z}px;bottom:${i*st}px"></i>`).join('')}${z>=36?`<b class="chv" style="color:${top[2]};bottom:${(n-1)*st+z/2-6}px">${top[0]>=1000?'1K':top[0]<1?'¼':top[0]}</b>`:''}${o.lab===0?'':`<span class="chl">${fmt(a)}</span>`}</div>`}

/* ---------- the felt: printed arc text, a dealing shoe, a discard tray ---------- */
let FELTN=0;
function feltPrint(top,sub){const id='caArc'+(++FELTN);return `<svg class="feltprint" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet"><defs><path id="${id}" d="M90 190Q400 330 710 190"/><path id="${id}b" d="M150 232Q400 360 650 232"/></defs>
 <text class="fp1"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${top||''}</textPath></text><text class="fp2"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${sub||''}</textPath></text></svg>`}

/* ---------- motion: deal from the shoe, flip on reveal (runs for every card game automatically) ---------- */
function caFly(el){if(el._cf)return;el._cf=1;const st=el.closest('.gstage,.pktable');if(!st||!el.isConnected)return;const shoe=st.querySelector('.shoe');const sb=shoe?shoe.getBoundingClientRect():null,stb=st.getBoundingClientRect(),b=el.getBoundingClientRect();
 const sx=sb?sb.left+sb.width*.3:stb.right-90,sy=sb?sb.top+sb.height*.5:stb.top+60,dx=sx-(b.left+b.width/2),dy=sy-(b.top+b.height/2),dl=parseFloat(el.style.animationDelay)||0,inner=el.querySelector('.pci'),back=el.classList.contains('back');
 const dur=Math.min(620,380+Math.hypot(dx,dy)*.35);el.animate([{transform:`translate(${dx}px,${dy}px) rotate(${-28+R()*8}deg) scale(.82)`,boxShadow:'0 2px 3px rgba(0,0,0,.4)'},{transform:`translate(${dx*.12}px,${dy*.12-10}px) rotate(${-3+R()*2}deg) scale(1.03)`,boxShadow:'0 22px 30px -10px rgba(0,0,0,.55)',offset:.8},{transform:'none',boxShadow:'0 8px 16px -8px rgba(0,0,0,.5)'}],{duration:dur,delay:dl,easing:'cubic-bezier(.25,.8,.25,1)',fill:'backwards'});
 if(inner&&!back)inner.animate([{transform:'rotateY(180deg)'},{transform:'rotateY(180deg)',offset:.5},{transform:'rotateY(0deg)'}],{duration:dur,delay:dl,easing:'ease-in-out',fill:'backwards'});
 if(dl)setTimeout(()=>sfx('deal'),dl)}
function caFlip(el){if(el._cf)return;el._cf=1;const inner=el.querySelector('.pci');if(!inner)return;sfx('flip');
 el.animate([{transform:'none'},{transform:'translateY(-16px) scale(1.07)',offset:.45},{transform:'none'}],{duration:560,easing:'cubic-bezier(.3,.7,.3,1)'});
 inner.animate([{transform:'rotateY(180deg)'},{transform:'rotateY(0deg)'}],{duration:560,easing:'cubic-bezier(.45,0,.2,1)',fill:'backwards'})}
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType!==1)continue;const L=n.matches&&n.matches('.pc')?[n]:n.querySelectorAll?n.querySelectorAll('.pc'):[];
 for(const el of L){if(el.classList.contains('nw'))caFly(el);else if(el.classList.contains('fl'))caFlip(el)}}}).observe(document.documentElement,{childList:true,subtree:true});
async function shuffleFx(){const st=document.querySelector('.gstage .felt');if(!st)return;const o=document.createElement('div');o.className='shufx';o.innerHTML='<div class="shl"></div><div class="shr"></div><b>Shuffling a fresh shoe</b>';st.appendChild(o);sfx('newshoe');await wait(250);sfx('shuffle');await wait(1300);o.remove()}
/* a stack of chips flies between two points on the stage (bet to dealer, dealer to you, bets to the pot) */
function chipFly(fromEl,toEl,amt,ms=520){if(!fromEl||!toEl)return;const a=fromEl.getBoundingClientRect(),b=toEl.getBoundingClientRect(),d=document.createElement('div');d.className='chfly';d.innerHTML=chipsH(amt,{lab:0,max:6});d.style.left=a.left+a.width/2+'px';d.style.top=a.top+a.height/2+'px';document.body.appendChild(d);
 d.animate([{transform:'translate(-50%,-50%) scale(1)'},{transform:`translate(calc(-50% + ${(b.left+b.width/2-a.left-a.width/2)/2}px),calc(-50% + ${(b.top+b.height/2-a.top-a.height/2)/2-40}px)) scale(1.12)`,offset:.5},{transform:`translate(calc(-50% + ${b.left+b.width/2-a.left-a.width/2}px),calc(-50% + ${b.top+b.height/2-a.top-a.height/2}px)) scale(.9)`}],{duration:ms,easing:'cubic-bezier(.45,0,.25,1)'}).onfinish=()=>{d.remove();sfx('chips')}}

/* ---------- card-room sound: a quiet room tone and far-off chip clatter whenever a felt is on screen ---------- */
const AMB={on:(()=>{try{return localStorage.getItem('stack-amb')!=='0'}catch(e){return true}})(),g:null,src:null,t:0};
function ambStart(){if(!AU.c||AMB.src)return;const n=AU.c.sampleRate*4,b=AU.c.createBuffer(2,n,AU.c.sampleRate);for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch);let l=0;for(let i=0;i<n;i++){l=(l+.02*(R()*2-1))/1.02;a[i]=l*3.2}}
 const s=AU.c.createBufferSource(),f=AU.c.createBiquadFilter(),g=AU.c.createGain();s.buffer=b;s.loop=true;f.type='lowpass';f.frequency.value=520;g.gain.value=0;s.connect(f);f.connect(g);g.connect(AU.master);s.start();g.gain.linearRampToValueAtTime(.07,AU.c.currentTime+1.5);AMB.src=s;AMB.g=g}
function ambStop(){if(!AMB.src)return;const s=AMB.src,g=AMB.g;AMB.src=null;try{g.gain.linearRampToValueAtTime(0,AU.c.currentTime+.6);setTimeout(()=>{try{s.stop()}catch(e){}},700)}catch(e){}}
setInterval(()=>{const want=AMB.on&&AU.on&&AU.c&&document.querySelector('.felt,.pktable')&&!document.hidden;if(want){ambStart();if(R()<.12)smp(pickA(['chips-handle','chips-collide','chip-lay','card-slide']),.05+R()*.06,.9+R()*.2)}else ambStop();
 const b=document.querySelector('.ambB');if(b)b.classList.toggle('on',AMB.on)},1000);
document.addEventListener('click',e=>{const b=e.target.closest('.ambB');if(!b)return;AMB.on=!AMB.on;try{localStorage.setItem('stack-amb',AMB.on?'1':'0')}catch(x){}b.classList.toggle('on',AMB.on);if(!AMB.on)ambStop()});
const ambBtn=()=>`<button class="ambB${AMB.on?' on':''}" title="Card room sound"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>Room</button>`;
