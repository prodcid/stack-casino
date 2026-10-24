/* ================= SUNKEN RICHES: a 5x4, 1,024-ways video slot =================
   The whole outcome of a spin (base reels, any Kraken wilds, every free spin, every Hold & Win respin) is drawn up front by
   srSpin(), then the screen plays it back. Nothing on screen is staged: reels show what was drawn, anticipation only plays when
   the remaining reels really can land the third chest. Line pays are scaled by SR.K so the game returns 97% (measured, see test). */
/*SR-ENGINE*/
const SR={K:.827,
 SYM:['10','J','Q','K','A','shell','anchor','compass','crown','wild','chest','pearl'],
 /* weight of each symbol per cell, per reel (wild never on reel 1) */
 W:[[15,15,14,13,12,8,7,6,5,0,1.9,6.6],[15,15,14,13,12,8,7,6,5,2.6,1.9,6.6],[15,15,14,13,12,8,7,6,5,2.8,1.9,6.6],[15,15,14,13,12,8,7,6,5,2.8,1.9,6.6],[15,15,14,13,12,8,7,6,5,2.6,1.9,6.6]],
 PAY:{'10':[.1,.2,.5],J:[.1,.2,.5],Q:[.1,.25,.6],K:[.15,.3,.8],A:[.15,.3,.8],shell:[.25,.6,1.5],anchor:[.3,.8,2],compass:[.4,1,3],crown:[.5,1.5,5]},
 CHEST:{3:[2,8],4:[5,12],5:[20,20]},  /* chests anywhere: [pay x bet, free spins] */
 PV:[[1,40],[2,25],[3,15],[5,10],[10,5],[25,2],['MINI',2],['MINOR',.7],['MAJOR',.15]],JP:{MINI:20,MINOR:50,MAJOR:250,GRAND:1000},
 KRAKEN:1/70,HWQ:.055};
const srW=(w)=>{let t=0;for(const x of w)t+=x;let r=R()*t;for(let i=0;i<w.length;i++){r-=w[i];if(r<0)return i}return 0};
const srPV=()=>{const i=srW(SR.PV.map(p=>p[1]));return SR.PV[i][0]};
function srGrid(fs){const g=[];for(let r=0;r<5;r++){const col=[],w=SR.W[r].slice();if(fs){w[9]*=2;w[11]=0}
  for(let y=0;y<4;y++){const s=SR.SYM[srW(w)];col.push(s==='pearl'?{s,v:srPV()}:{s})}
  if(R()<.16){const s=SR.SYM[5+Math.floor(R()*4)],n=2+Math.floor(R()*3),y0=Math.floor(R()*(5-n));for(let y=y0;y<y0+n;y++)col[y]={s}}g.push(col)}return g}
function srWays(g,mult){const out=[];for(const s in SR.PAY){let ways=1,n=0;const cells=[];for(let r=0;r<5;r++){let c=0;g[r].forEach((x,y)=>{if(x.s===s||(r&&x.s==='wild')){c++;cells.push([r,y])}});if(!c)break;ways*=c;n++}
  if(n>=3){const win=SR.PAY[s][n-3]*ways*SR.K*(mult||1);out.push({s,n,ways,win,cells:cells.filter(([r])=>r<n)})}}return out}
const srCount=(g,s)=>g.reduce((a,c)=>a+c.filter(x=>x.s===s).length,0);
function srHold(g){const L=g.map(c=>c.map(x=>x.s==='pearl'?x.v:null)),steps=[];let rs=3;
 while(rs>0&&L.flat().some(v=>v==null)){const nw=[];L.forEach((c,r)=>c.forEach((v,y)=>{if(v==null&&R()<SR.HWQ){c[y]=srPV();nw.push([r,y,c[y]])}}));rs=nw.length?3:rs-1;steps.push({nw,rs})}
 const full=L.flat().every(v=>v!=null);let pay=0;for(const v of L.flat())if(v!=null)pay+=typeof v==='number'?v:SR.JP[v];if(full)pay+=SR.JP.GRAND;return{L,steps,full,pay}}
function srSpin(){const g=srGrid(0);let krak=null;if(R()<SR.KRAKEN){krak=[];const n=3+Math.floor(R()*6);for(let k=0;k<40&&krak.length<n;k++){const r=1+Math.floor(R()*4),y=Math.floor(R()*4);if(!['chest','pearl','wild'].includes(g[r][y].s)&&!krak.some(([a,b])=>a===r&&b===y))krak.push([r,y])}}
 const g2=g.map(c=>c.map(x=>({...x})));if(krak)krak.forEach(([r,y])=>g2[r][y]={s:'wild',kr:1});
 const wins=srWays(g2);let pay=wins.reduce((a,w)=>a+w.win,0);const ch=Math.min(5,srCount(g2,'chest'));let fs=null,chestPay=0;
 if(ch>=3){chestPay=SR.CHEST[ch][0]*SR.K;pay+=chestPay;fs={spins:[],total:0};let left=SR.CHEST[ch][1],mult=1,tot=SR.CHEST[ch][1];
  while(left>0){left--;const fg=srGrid(1),w=srWays(fg,mult),p=w.reduce((a,x)=>a+x.win,0),c=srCount(fg,'chest'),re=c>=3&&tot<50?5:0;left+=re;tot+=re;fs.spins.push({g:fg,wins:w,pay:p,mult,re});fs.total+=p;if(p>0)mult=Math.min(10,mult+1)}pay+=fs.total}
 let hw=null;if(srCount(g2,'pearl')>=6){hw=srHold(g2);pay+=hw.pay}
 return{g,g2,krak,wins,chestPay,ch,fs,hw,pay}}
/*SR-END*/

/* ================= ART: every symbol painted once into a sprite, from paths and gradients ================= */
const SRA={spr:{},blur:{},S:220};
function srArt(){const S=SRA.S,mk=()=>{const c=document.createElement('canvas');c.width=c.height=S;return c},C=S/2;
 const RR=(x,a,b,w,h,r)=>{x.beginPath();if(x.roundRect)x.roundRect(a,b,w,h,r);else x.rect(a,b,w,h)};
 const gold=(x,y0,y1)=>{const g=x.createLinearGradient(0,y0,0,y1);g.addColorStop(0,'#fff6c2');g.addColorStop(.28,'#f7cf55');g.addColorStop(.55,'#c8901c');g.addColorStop(.8,'#8a5a0c');g.addColorStop(1,'#f0c048');return g};
 const shine=(x,cx,cy,r,a)=>{const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,`rgba(255,255,255,${a||.9})`);g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,7);x.fill()};
 const star=(x,cx,cy,r)=>{x.save();x.fillStyle='#fff';x.shadowColor='#fff';x.shadowBlur=r*1.5;x.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.22:r;x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}x.fill();x.restore()};
 const gem=(x,cx,cy,r,col,dk)=>{x.save();x.fillStyle=dk;x.beginPath();x.ellipse(cx,cy+1,r,r*.8,0,0,7);x.fill();const g=x.createRadialGradient(cx-r*.3,cy-r*.3,0,cx,cy,r);g.addColorStop(0,'#fff');g.addColorStop(.25,col);g.addColorStop(1,dk);x.fillStyle=g;x.beginPath();x.ellipse(cx,cy,r*.86,r*.68,0,0,7);x.fill();x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=1;x.beginPath();x.moveTo(cx-r*.5,cy);x.lineTo(cx,cy-r*.5);x.lineTo(cx+r*.5,cy);x.stroke();x.restore()};
 /* royals: cut-gem letters with depth, gold rim and gloss */
 const royal=(ch,c1,c2,c3,gc)=>{const cv=mk(),x=cv.getContext('2d'),fs=ch==='10'?S*.5:S*.64,ty=S*.56;const font=`900 ${fs}px Cinzel, Georgia, serif`;
  const glow=x.createRadialGradient(C,C,10,C,C,S*.48);glow.addColorStop(0,gc+'55');glow.addColorStop(1,gc+'00');x.fillStyle=glow;x.fillRect(0,0,S,S);
  x.font=font;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
  for(let i=8;i>0;i--){x.fillStyle=i>6?'#0a0503':c3;x.fillText(ch,C+i*.35,ty+i*.9)}
  x.strokeStyle='#120803';x.lineWidth=S*.075;x.strokeText(ch,C,ty);x.strokeStyle=gold(x,S*.2,S*.85);x.lineWidth=S*.038;x.strokeText(ch,C,ty);
  const g=x.createLinearGradient(0,S*.22,0,S*.86);g.addColorStop(0,c1);g.addColorStop(.42,c2);g.addColorStop(.5,c3);g.addColorStop(1,c2);x.fillStyle=g;x.fillText(ch,C,ty);
  const F=mk(),f=F.getContext('2d');f.font=font;f.textAlign='center';f.textBaseline='middle';f.fillText(ch,C,ty);f.globalCompositeOperation='source-in';const gl=f.createLinearGradient(0,S*.2,0,S*.6);gl.addColorStop(0,'rgba(255,255,255,.75)');gl.addColorStop(.5,'rgba(255,255,255,.12)');gl.addColorStop(.52,'rgba(255,255,255,0)');f.fillStyle=gl;f.fillRect(0,0,S,S);
  f.fillStyle='rgba(255,255,255,.22)';for(let i=0;i<5;i++){f.beginPath();f.moveTo(S*.1+i*S*.2,S);f.lineTo(S*.25+i*S*.2,0);f.lineTo(S*.28+i*S*.2,0);f.lineTo(S*.13+i*S*.2,S);f.fill()}x.drawImage(F,0,0);
  star(x,S*.74,S*.27,S*.07);star(x,S*.3,S*.78,S*.04);return cv};
 SRA.spr['10']=royal('10','#ffd3a8','#ff7a2e','#8c2a06','#ff7a2e');SRA.spr.J=royal('J','#f0d4ff','#a64dff','#3d0f73','#a64dff');SRA.spr.Q=royal('Q','#c9ffe0','#19c46b','#04492a','#19c46b');
 SRA.spr.K=royal('K','#cfe6ff','#2f7bff','#0a2766','#2f7bff');SRA.spr.A=royal('A','#ffd0d4','#ff2d46','#6e0412','#ff2d46');
 /* conch shell */{const cv=mk(),x=cv.getContext('2d');x.translate(C,C+6);x.rotate(-.5);
  const body=x.createLinearGradient(-70,-40,70,50);body.addColorStop(0,'#fff1e0');body.addColorStop(.4,'#ffc79e');body.addColorStop(.75,'#e07a5f');body.addColorStop(1,'#7a2e1c');
  x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=14;x.shadowOffsetY=6;x.fillStyle=body;x.beginPath();x.moveTo(-86,4);x.bezierCurveTo(-60,-60,30,-74,72,-30);x.bezierCurveTo(92,-6,88,30,60,48);x.bezierCurveTo(10,70,-50,46,-86,4);x.fill();x.shadowColor='transparent';
  x.strokeStyle='rgba(120,40,20,.55)';x.lineWidth=3;for(let i=0;i<6;i++){x.beginPath();x.moveTo(-70+i*24,-30+i*2);x.bezierCurveTo(-60+i*24,0,-64+i*24,28,-74+i*26,40);x.stroke()}
  x.fillStyle='#ffe9d6';for(let i=0;i<5;i++){x.beginPath();x.moveTo(-50+i*26,-46+i*3);x.lineTo(-44+i*26,-70+i*4);x.lineTo(-36+i*26,-46+i*4);x.fill()}
  const ap=x.createRadialGradient(40,14,4,40,14,46);ap.addColorStop(0,'#fff');ap.addColorStop(.3,'#ffb7c5');ap.addColorStop(.8,'#e85d8a');ap.addColorStop(1,'#8c1f45');x.fillStyle=ap;x.beginPath();x.ellipse(40,12,40,26,-.35,0,7);x.fill();
  x.strokeStyle='#fff3e8';x.lineWidth=5;x.beginPath();x.ellipse(40,12,40,26,-.35,3.6,6.4);x.stroke();
  x.fillStyle='#ffd8b8';x.beginPath();x.moveTo(-86,4);x.lineTo(-104,-2);x.lineTo(-84,12);x.fill();shine(x,-10,-34,30,.7);shine(x,30,0,14,.9);x.setTransform(1,0,0,1,0,0);star(x,S*.8,S*.24,S*.05);SRA.spr.shell=cv}
 /* anchor with rope and barnacles */{const cv=mk(),x=cv.getContext('2d');const iron=(a,b)=>{const g=x.createLinearGradient(a,0,b,0);g.addColorStop(0,'#2b3440');g.addColorStop(.35,'#9fb3c8');g.addColorStop(.5,'#e6f0fb');g.addColorStop(.7,'#5d6f84');g.addColorStop(1,'#1c232c');return g};
  x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=12;x.shadowOffsetY=6;x.strokeStyle=iron(C-18,C+18);x.lineWidth=14;x.beginPath();x.arc(C,40,16,0,7);x.stroke();
  x.fillStyle=iron(C-11,C+11);x.fillRect(C-10,52,20,118);x.fillStyle=iron(C-60,C+60);RR(x,C-58,64,116,16,8);x.fill();
  x.strokeStyle=iron(C-80,C+80);x.lineWidth=16;x.lineCap='round';x.beginPath();x.arc(C,110,66,.35,Math.PI-.35);x.stroke();x.shadowColor='transparent';
  x.fillStyle=iron(C-90,C+90);for(const s of[-1,1]){x.beginPath();x.moveTo(C+s*62,128);x.lineTo(C+s*92,112);x.lineTo(C+s*74,150);x.closePath();x.fill()}x.beginPath();x.moveTo(C,186);x.lineTo(C-16,168);x.lineTo(C+16,168);x.fill();
  for(let i=0;i<7;i++){const y=86+i*11;x.fillStyle=i%2?'#c9a26b':'#e8c58e';x.strokeStyle='#6b4a22';x.lineWidth=1.5;x.beginPath();x.ellipse(C,y,17,6,i%2?.25:-.25,0,7);x.fill();x.stroke()}
  x.strokeStyle='#c9a26b';x.lineWidth=5;x.beginPath();x.moveTo(C+16,152);x.bezierCurveTo(C+50,170,C+40,196,C+10,200);x.stroke();
  x.fillStyle='#d8e4d0';for(const [a,b,r] of[[C-48,124,5],[C-54,116,3],[C+44,136,4],[C+4,150,3]]){x.beginPath();x.arc(a,b,r,0,7);x.fill()}shine(x,C-3,70,22,.45);star(x,S*.72,S*.2,S*.05);SRA.spr.anchor=cv}
 /* brass compass */{const cv=mk(),x=cv.getContext('2d');x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=14;x.shadowOffsetY=6;const rg=x.createRadialGradient(C-30,C-30,10,C,C,92);rg.addColorStop(0,'#fff3b8');rg.addColorStop(.5,'#d9a62e');rg.addColorStop(.85,'#7a4d08');rg.addColorStop(1,'#f3c64d');
  x.fillStyle=rg;x.beginPath();x.arc(C,C+4,88,0,7);x.fill();x.shadowColor='transparent';x.fillStyle=gold(x,0,30);x.beginPath();x.arc(C,12,13,0,7);x.fill();x.fillStyle='#3a2604';x.beginPath();x.arc(C,12,6,0,7);x.fill();
  const face=x.createRadialGradient(C,C,10,C,C+4,72);face.addColorStop(0,'#fffaf0');face.addColorStop(1,'#d9c9a3');x.fillStyle=face;x.beginPath();x.arc(C,C+4,70,0,7);x.fill();x.strokeStyle='#5a3a06';x.lineWidth=2;x.stroke();
  for(let i=0;i<32;i++){const a=i*Math.PI/16,r1=i%4?64:58;x.strokeStyle='#4a3a20';x.lineWidth=i%4?1:2.5;x.beginPath();x.moveTo(C+Math.cos(a)*r1,C+4+Math.sin(a)*r1);x.lineTo(C+Math.cos(a)*69,C+4+Math.sin(a)*69);x.stroke()}
  const pt=(a,len,w,c1,c2)=>{for(const s of[-1,1]){x.fillStyle=s<0?c1:c2;x.beginPath();x.moveTo(C,C+4);x.lineTo(C+Math.cos(a)*len,C+4+Math.sin(a)*len);x.lineTo(C+Math.cos(a+s*Math.PI/2)*w,C+4+Math.sin(a+s*Math.PI/2)*w);x.fill()}};
  for(let i=0;i<4;i++)pt(i*Math.PI/2+Math.PI/4,40,9,'#1d3557','#457b9d');for(let i=0;i<4;i++)pt(i*Math.PI/2-Math.PI/2,58,13,i?'#1d3557':'#b5121b',i?'#a8c5e0':'#ff5a5f');
  x.font="900 15px Cinzel, Georgia, serif";x.textAlign='center';x.textBaseline='middle';x.fillStyle='#b5121b';x.fillText('N',C,C-48);
  x.fillStyle=gold(x,C-8,C+12);x.beginPath();x.arc(C,C+4,8,0,7);x.fill();
  const gl=x.createLinearGradient(C-70,C-60,C+30,C+40);gl.addColorStop(0,'rgba(255,255,255,.55)');gl.addColorStop(.45,'rgba(255,255,255,.08)');gl.addColorStop(.5,'rgba(255,255,255,0)');x.fillStyle=gl;x.beginPath();x.arc(C,C+4,70,0,7);x.fill();star(x,S*.78,S*.3,S*.05);SRA.spr.compass=cv}
 /* sunken crown */{const cv=mk(),x=cv.getContext('2d');x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=14;x.shadowOffsetY=6;x.fillStyle=gold(x,40,170);x.beginPath();x.moveTo(30,160);x.lineTo(22,72);x.lineTo(62,112);x.lineTo(80,52);x.lineTo(C,100);x.lineTo(140,52);x.lineTo(158,112);x.lineTo(198,72);x.lineTo(190,160);x.closePath();x.fill();x.shadowColor='transparent';
  x.strokeStyle='#5a3a06';x.lineWidth=3;x.stroke();x.fillStyle=gold(x,140,186);RR(x,26,142,168,36,8);x.fill();x.stroke();
  gem(x,C,160,16,'#ff2d46','#5a0410');gem(x,C-50,160,11,'#19c46b','#04381f');gem(x,C+50,160,11,'#2f7bff','#081f52');
  for(const [a,b] of[[22,70],[80,50],[140,50],[198,70],[C,96]]){const g=x.createRadialGradient(a-3,b-3,1,a,b,10);g.addColorStop(0,'#fff');g.addColorStop(.6,'#f2e8ff');g.addColorStop(1,'#a99cc4');x.fillStyle=g;x.beginPath();x.arc(a,b,9,0,7);x.fill()}
  x.strokeStyle='#2f6b3a';x.lineWidth=5;x.lineCap='round';x.beginPath();x.moveTo(36,150);x.bezierCurveTo(20,176,48,186,34,204);x.stroke();x.strokeStyle='#4a9c52';x.lineWidth=3;x.beginPath();x.moveTo(178,146);x.bezierCurveTo(196,168,170,182,186,200);x.stroke();
  shine(x,70,120,34,.45);star(x,S*.66,S*.2,S*.06);SRA.spr.crown=cv}
 /* WILD: golden trident on a sea-glass orb, with a ribbon */{const cv=mk(),x=cv.getContext('2d');const o=x.createRadialGradient(C,C-10,6,C,C-4,96);o.addColorStop(0,'#c9fff6');o.addColorStop(.35,'#1fc8b8');o.addColorStop(.75,'#06516b');o.addColorStop(1,'rgba(3,30,50,0)');x.fillStyle=o;x.beginPath();x.arc(C,C-4,96,0,7);x.fill();
  x.strokeStyle=gold(x,10,200);x.lineWidth=6;x.beginPath();x.arc(C,C-4,84,0,7);x.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;x.fillStyle='#ffe28a';x.beginPath();x.arc(C+Math.cos(a)*84,C-4+Math.sin(a)*84,3.2,0,7);x.fill()}
  x.shadowColor='rgba(0,0,0,.7)';x.shadowBlur=10;x.shadowOffsetY=4;x.fillStyle=gold(x,20,190);x.fillRect(C-6,64,12,124);
  x.beginPath();x.moveTo(C-46,70);x.lineTo(C+46,70);x.lineTo(C+40,84);x.lineTo(C-40,84);x.fill();for(const dx of[-40,0,40]){x.beginPath();x.moveTo(C+dx-7,76);x.lineTo(C+dx-7,36);x.lineTo(C+dx,10+Math.abs(dx)*.3);x.lineTo(C+dx+7,36);x.lineTo(C+dx+7,76);x.fill();
   if(dx){x.beginPath();x.moveTo(C+dx+(dx<0?-7:7),40);x.lineTo(C+dx+(dx<0?-17:17),48);x.lineTo(C+dx+(dx<0?-7:7),54);x.fill()}}x.shadowColor='transparent';
  x.fillStyle='rgba(255,255,255,.6)';x.fillRect(C-3,64,2.5,120);
  x.fillStyle='#7a0f1d';x.beginPath();x.moveTo(18,150);x.lineTo(202,150);x.lineTo(190,168);x.lineTo(202,188);x.lineTo(18,188);x.lineTo(30,168);x.closePath();x.fill();x.strokeStyle=gold(x,150,190);x.lineWidth=4;x.stroke();
  x.font="900 34px Cinzel, Georgia, serif";x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.strokeStyle='#2a0306';x.lineWidth=7;x.strokeText('WILD',C,171);x.fillStyle=gold(x,154,186);x.fillText('WILD',C,171);shine(x,C-30,C-40,30,.5);star(x,S*.82,S*.2,S*.06);SRA.spr.wild=cv}
 /* SCATTER: open treasure chest */{const cv=mk(),x=cv.getContext('2d');for(let i=0;i<14;i++){const a=-Math.PI+i*Math.PI/13;x.fillStyle=i%2?'rgba(255,214,90,.22)':'rgba(255,240,180,.12)';x.beginPath();x.moveTo(C,96);x.arc(C,96,110,a,a+Math.PI/26);x.fill()}
  const wood=(y0,y1)=>{const g=x.createLinearGradient(0,y0,0,y1);g.addColorStop(0,'#a0622d');g.addColorStop(.5,'#6b3a17');g.addColorStop(1,'#3a1d08');return g};
  x.fillStyle=wood(30,92);x.beginPath();x.moveTo(36,92);x.lineTo(50,34);x.lineTo(170,34);x.lineTo(184,92);x.fill();x.strokeStyle='#2a1405';x.lineWidth=3;x.stroke();
  const glow=x.createRadialGradient(C,96,4,C,96,90);glow.addColorStop(0,'rgba(255,250,200,1)');glow.addColorStop(.4,'rgba(255,200,60,.8)');glow.addColorStop(1,'rgba(255,160,0,0)');x.fillStyle=glow;x.fillRect(10,30,200,110);
  for(let i=0;i<16;i++){const a=48+(i*37)%124,b=90+((i*13)%14)-(i%3)*4;const g=x.createLinearGradient(a-9,b-4,a+9,b+4);g.addColorStop(0,'#fff3a8');g.addColorStop(.5,'#e8a91c');g.addColorStop(1,'#8a5a0c');x.fillStyle=g;x.beginPath();x.ellipse(a,b,10,4.5,0,0,7);x.fill();x.strokeStyle='#7a4a06';x.lineWidth=1;x.stroke()}
  gem(x,86,84,9,'#ff2d46','#5a0410');gem(x,134,82,8,'#2f7bff','#081f52');gem(x,112,78,7,'#19c46b','#04381f');
  x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=12;x.shadowOffsetY=5;x.fillStyle=wood(96,190);RR(x,26,96,168,92,8);x.fill();x.shadowColor='transparent';
  x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=2;for(let i=1;i<4;i++){x.beginPath();x.moveTo(28,96+i*23);x.lineTo(192,96+i*23);x.stroke()}
  x.fillStyle=gold(x,96,190);for(const a of[36,166])x.fillRect(a,96,18,92);x.fillRect(26,96,168,10);x.fillRect(26,178,168,10);
  x.fillStyle=gold(x,120,160);RR(x,C-18,118,36,40,6);x.fill();x.fillStyle='#2a1405';x.beginPath();x.arc(C,134,6,0,7);x.fill();x.fillRect(C-2.5,134,5,12);
  x.fillStyle='#ffe28a';for(const [a,b] of[[45,104],[175,104],[45,182],[175,182]]){x.beginPath();x.arc(a,b,3,0,7);x.fill()}
  x.fillStyle='#0d4f6b';x.beginPath();x.moveTo(30,196);x.lineTo(190,196);x.lineTo(182,214);x.lineTo(38,214);x.fill();x.strokeStyle=gold(x,196,214);x.lineWidth=3;x.stroke();x.font="900 17px Cinzel, Georgia, serif";x.textAlign='center';x.textBaseline='middle';x.fillStyle=gold(x,198,214);x.fillText('BONUS',C,206);
  star(x,60,60,10);star(x,170,48,7);SRA.spr.chest=cv}
 /* PEARL in an open clam (its value is written on at draw time) */{const cv=mk(),x=cv.getContext('2d');
  const g=x.createLinearGradient(0,40,0,150);g.addColorStop(0,'#f8e7f0');g.addColorStop(.5,'#c98fb0');g.addColorStop(1,'#5e2f55');x.shadowColor='rgba(0,0,0,.5)';x.shadowBlur=12;x.fillStyle=g;x.beginPath();x.moveTo(20,140);
  for(let i=0;i<=10;i++){const a=Math.PI+i*Math.PI/10;x.quadraticCurveTo(C+Math.cos(a-Math.PI/20)*96,142+Math.sin(a-Math.PI/20)*102,C+Math.cos(a)*90,140+Math.sin(a)*92)}x.closePath();x.fill();x.shadowColor='transparent';
  x.strokeStyle='rgba(90,40,80,.45)';x.lineWidth=2;for(let i=1;i<10;i++){const a=Math.PI+i*Math.PI/10;x.beginPath();x.moveTo(C,140);x.lineTo(C+Math.cos(a)*88,140+Math.sin(a)*88);x.stroke()}
  const lo=x.createLinearGradient(0,130,0,200);lo.addColorStop(0,'#fde7f2');lo.addColorStop(1,'#7a3c6a');x.fillStyle=lo;x.beginPath();x.moveTo(16,140);x.bezierCurveTo(26,212,194,212,204,140);x.bezierCurveTo(150,162,70,162,16,140);x.fill();
  for(let i=0;i<9;i++){x.strokeStyle='rgba(90,40,80,.4)';x.lineWidth=2;x.beginPath();x.moveTo(C,200);x.lineTo(28+i*20.5,148+Math.abs(4-i)*1.5);x.stroke()}
  const p=x.createRadialGradient(C-18,108,4,C,124,44);p.addColorStop(0,'#ffffff');p.addColorStop(.25,'#fff4fb');p.addColorStop(.55,'#f2d8ef');p.addColorStop(.8,'#c9b8e8');p.addColorStop(1,'#8a7fb8');x.shadowColor='rgba(255,220,255,.8)';x.shadowBlur=24;x.fillStyle=p;x.beginPath();x.arc(C,124,44,0,7);x.fill();x.shadowColor='transparent';
  const ir=x.createLinearGradient(C-44,90,C+44,160);ir.addColorStop(0,'rgba(120,220,255,0)');ir.addColorStop(.5,'rgba(120,220,255,.22)');ir.addColorStop(.7,'rgba(255,170,230,.22)');ir.addColorStop(1,'rgba(255,170,230,0)');x.fillStyle=ir;x.beginPath();x.arc(C,124,44,0,7);x.fill();
  shine(x,C-16,104,14,1);star(x,C+26,98,10);SRA.spr.pearl=cv}
 /* motion-blurred copies for spinning reels */
 for(const k in SRA.spr){const cv=mk(),x=cv.getContext('2d');for(let i=-6;i<=6;i++){x.globalAlpha=.16;x.drawImage(SRA.spr[k],0,i*7)}SRA.blur[k]=cv}}

/* ================= THE MACHINE: cabinet, reels, effects, features ================= */
const SRBETS=[.2,.4,1,2,4,10,20,40,100,200,300],SRNAME={'10':'TEN',J:'JACK',Q:'QUEEN',K:'KING',A:'ACE',shell:'CONCH',anchor:'ANCHOR',compass:'COMPASS',crown:'CROWN'};
const SRV={on:0};
const srFill=()=>{const w=SR.W[2],s=SR.SYM[srW(w)];return s==='pearl'?{s,v:srPV()}:{s}};
const srBet=()=>SRBETS[SRV.bi];
function srSnd(k){try{const T=tone,N=noise;({
 start:()=>{N(.3,.05,1400);T(180,.3,.05,'triangle',0,420)},tick:()=>T(650+R()*90,.02,.01,'square'),
 stop:()=>{T(96,.16,.16,'sine',0,52);N(.05,.05,2600)},chest:()=>{T(1318,.4,.07,'triangle');T(1975,.5,.05,'sine',.06);T(2637,.6,.035,'sine',.12)},
 pearl:()=>{T(1760,.35,.06,'sine');T(2349,.45,.035,'sine',.05)},ant:()=>{T(260,1.4,.05,'sawtooth',0,980);T(130,1.4,.04,'square',0,490)},
 win:()=>[0,4,7,12].forEach((s,i)=>T(523*Math.pow(2,s/12),.3,.06,'triangle',i*.06)),roll:()=>T(1500+R()*400,.025,.014,'square'),
 roar:()=>{T(46,1.6,.25,'sawtooth',0,28);T(61,1.4,.12,'square',.1,35);N(1.4,.09,160)},slam:()=>{T(70,.4,.28,'sine',0,28);N(.35,.14,260)},
 fan:()=>[0,4,7,12,16,19,24].forEach((s,i)=>{T(392*Math.pow(2,s/12),.45,.06,'triangle',i*.09);T(784*Math.pow(2,s/12),.3,.02,'sine',i*.09)}),
 mult:()=>{T(880,.12,.06,'square');T(1320,.25,.05,'square',.08);T(1760,.3,.04,'sine',.16)},ding:()=>T(1200+R()*900,.18,.05,'sine'),
 tier:()=>{sfx('big');N(.5,.06,900)},bubble:()=>T(400+R()*300,.08,.02,'sine',0,900)})[k]()}catch(e){}}
function srSleep(ms){return new Promise(res=>{const end=performance.now()+ms*(SRV.turbo?.5:1),k=()=>{if(!SRV.on||SRV.skip||performance.now()>=end)res();else setTimeout(k,25)};k()})}
const srUntil=f=>new Promise(res=>{const k=()=>{if(!SRV.on||f())res();else setTimeout(k,25)};k()});
function srParts(n,o){for(let i=0;i<n;i++)SRV.parts.push(Object.assign({x:0,y:0,vx:(R()-.5)*300,vy:(R()-.5)*300,g:0,life:1,max:1,r:3,rot:R()*6,spin:6+R()*8,type:'spark'},typeof o==='function'?o(i):o))}
/* ---------- mount ---------- */
function srMount(h){h.innerHTML=`<div class="sr" id="sr"><div class="srcab"><canvas id="srC"></canvas></div>
 <div class="srcon"><div class="srm"><span>Balance</span><b id="srBal">0.00</b></div><div class="srm"><span>Win</span><b id="srWin">0.00</b></div><span class="sp"></span>
  <div class="srbet"><button id="srMinus" aria-label="Lower bet">−</button><div class="srm" style="text-align:center;min-width:96px"><span>Total bet</span><b id="srBetV">1.00</b></div><button id="srPlus" aria-label="Raise bet">+</button></div>
  <button class="srspin" id="srSpin" title="Spin (Space)"><svg viewBox="0 0 48 48"><path d="M38 24a14 14 0 1 1-4.1-9.9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M36 6v10H26" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg><span id="srAutoN"></span></button>
  <div class="srbtns"><button class="srsq" id="srAuto">Auto</button><button class="srsq" id="srTurbo">Turbo</button><button class="srsq" id="srInfo">Paytable</button></div><span class="sp"></span>
  <div class="srodds">Free spins ≈ 1 in 260 · Hold &amp; Win ≈ 1 in 1,600 · RTP 97%</div></div></div>`;
 const reels=[0,1,2,3,4].map(()=>({S:new Map(),o:0,v:0,vis:0,st:'idle'}));const g0=srGrid(0);reels.forEach((rl,r)=>{for(let y=-2;y<6;y++)rl.S.set(y,y>=0&&y<4?g0[r][y]:srFill())});
 Object.assign(SRV,{on:1,busy:0,bi:SRV.bi!=null?SRV.bi:2,reels,parts:[],shake:0,flash:0,winShown:0,cap:'',capT:0,hl:null,dim:0,kw:[],kr:null,bw:null,banner:null,mode:'base',fs:null,hw:null,antR:-1,turbo:SRV.turbo||0,auto:0,skip:0,t:performance.now(),
  snow:Array.from({length:90},()=>({x:R(),y:R(),s:.5+R()*1.6,sp:.01+R()*.025})),bub:Array.from({length:22},()=>({x:R(),y:R(),r:2+R()*6,sp:.04+R()*.08,ph:R()*6})),
  kelp:Array.from({length:10},(_,i)=>({x:i<5?.01+i*.035:.83+(i-5)*.035,h:.35+R()*.4,ph:R()*6,c:R()<.5?'#0c3b2c':'#125a3f'}))});
 if(!SRA.spr.A)srArt();if(document.fonts&&!SRA.fl){document.fonts.load("900 60px Cinzel").then(()=>{SRA.fl=1;srArt()}).catch(()=>{})}
 $('srSpin').onclick=()=>{if(SRV.auto){SRV.auto=0;srUI();return}srPlay()};$('srMinus').onclick=()=>{if(SRV.busy)return;SRV.bi=Math.max(0,SRV.bi-1);sfx('click');srUI()};$('srPlus').onclick=()=>{if(SRV.busy)return;SRV.bi=Math.min(SRBETS.length-1,SRV.bi+1);sfx('click');srUI()};
 $('srTurbo').onclick=()=>{SRV.turbo^=1;sfx('click');srUI()};$('srInfo').onclick=srPaytable;
 $('srAuto').onclick=()=>{if(SRV.auto){SRV.auto=0;srUI();return}modal(`<span class="mono">Autoplay</span><h3 class="dw">How many spins?</h3><p class="mut">Stops on any feature, or if your balance runs short. Press Spin to stop at any time.</p><div class="chips">${[10,25,50,100].map(n=>`<button class="chip" data-an="${n}">${n} spins</button>`).join('')}</div>`);
  document.querySelectorAll('[data-an]').forEach(b=>b.onclick=()=>{SRV.auto=+b.dataset.an;closeAll();srUI();if(!SRV.busy)srPlay()})};
 $('srC').onclick=()=>{if(SRV.bw){if(SRV.bw.p<1)SRV.bw.t0=-1e9;else SRV.bw.end=1;return}if(SRV.banner){SRV.banner.end=1;return}if(SRV.busy)SRV.skip=1};
 SRV.key=e=>{if(e.code==='Space'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&$('srC')){e.preventDefault();if(SRV.bw||SRV.banner||SRV.busy)$('srC').click();else srPlay()}};addEventListener('keydown',SRV.key);
 srUI();requestAnimationFrame(srLoop)}
function srLeave(){SRV.on=0;SRV.auto=0;removeEventListener('keydown',SRV.key);(SRV.reels||[]).forEach(r=>{if(r.res){r.res();r.res=null}})}
function srUI(){if(!$('srBal'))return;$('srBal').textContent=fmt(bal());$('srBetV').textContent=fmt(srBet());$('srTurbo').classList.toggle('on',!!SRV.turbo);$('srAuto').classList.toggle('on',!!SRV.auto);$('srAuto').textContent=SRV.auto?'Stop':'Auto';
 $('srAutoN').textContent=SRV.auto||'';$('srSpin').classList.toggle('busy',!!SRV.busy);$('srMinus').disabled=$('srPlus').disabled=!!SRV.busy}
function srPaytable(){const b=srBet(),img=k=>`<img src="${SRA.spr[k].toDataURL()}" width="64" height="64" alt="">`;
 modal(`<span class="mono">Sunken Riches · paytable for a ${fmt(b)} bet</span><h3 class="dw">How it pays</h3><p class="mut">1,024 ways: a symbol pays when it lands on reels next to each other from the left, anywhere in each column. Every matching position multiplies the ways. Wilds (reels 2–5) stand in for every paying symbol.</p>
 <div class="srpt">${['crown','compass','anchor','shell','A','K','Q','J','10'].map(k=>`<div>${img(k)}<div>${[5,4,3].map(n=>`<b>${n}×</b> ${fmt(SR.PAY[k][n-3]*SR.K*b)}`).join('<br>')}</div></div>`).join('')}</div><p class="mut" style="font-size:12px">Per way. Wins on different symbols add up.</p>
 <div class="srpt f"><div>${img('wild')}<div><b>Wild</b><br>Reels 2–5. Doubled on the reels during free spins.</div></div><div>${img('chest')}<div><b>3 / 4 / 5 chests</b> anywhere pay ${fmt(2*SR.K*b)} / ${fmt(5*SR.K*b)} / ${fmt(20*SR.K*b)} and award 8 / 12 / 20 free spins. The multiplier starts at ×1 and rises by 1 after every winning free spin (to ×10). 3 chests in free spins add 5 more.</div></div>
 <div>${img('pearl')}<div><b>6+ pearls</b> start Hold &amp; Win: pearls lock, you get 3 respins, and every new pearl resets them to 3. Pearls pay 1× to 25× your bet or a jackpot: Mini ${fmt(20*b)}, Minor ${fmt(50*b)}, Major ${fmt(250*b)}. Fill all 20 for the Grand, ${fmt(1000*b)}.</div></div></div>
 <h4>The three features, from likely to rare</h4><p class="mut">Kraken Strike: about 1 spin in 70, tentacles turn 3–8 positions wild.<br>Treasure Free Spins: about 1 in 260 spins.<br>Pearl of the Deep (Hold &amp; Win): about 1 in 1,600 spins. The Grand needs a full screen and is far rarer.</p>
 <p class="mut">Return to player: 97%, measured over 6 million spins. Each spin is independent; the reels show exactly what was drawn, and the slow-down on the last reels only happens when a third chest can really land.</p>`)}
/* ---------- the reels ---------- */
function srStart(){SRV.reels.forEach((rl,r)=>{rl.st='spin';rl.v=-3;rl.t0=performance.now()+r*45});SRV.tk=setInterval(()=>{if(SRV.reels.some(r=>r.st!=='idle'))srSnd('tick');else clearInterval(SRV.tk)},75)}
function srStop(r,col){const rl=SRV.reels[r],from=rl.o,to=Math.ceil(from)+4;col.forEach((c,y)=>rl.S.set(y-to,c));rl.S.set(-1-to,srFill());rl.st='stop';rl.ts=performance.now();rl.from=from;rl.to=to;rl.dur=Math.max(260,(to-from)/Math.max(12,rl.v)*1700*(SRV.turbo?.6:1));rl.th=0;
 return new Promise(res=>rl.res=res)}
async function srReels(cols,krak){SRV.cap='';srStart();srSnd('start');await srSleep(380);if(krak&&SRV.on)await srKraken(krak);let chests=0;
 for(let r=0;r<5;r++){if(r)await srSleep(SRV.antR>=0&&r>=SRV.antR?1400:160);if(!SRV.on)break;await srStop(r,cols[r]);const c=cols[r].filter(x=>x.s==='chest').length;chests+=c;
  if(c){srSnd('chest');srCellFx(r,cols[r].findIndex(x=>x.s==='chest'),'#ffd76a')}if(cols[r].some(x=>x.s==='pearl'))srSnd('pearl');
  if(chests===2&&r<4&&SRV.antR<0&&SRV.mode!=='hw'){SRV.antR=r+1;srSnd('ant')}else if(SRV.antR>=0&&r<4)srSnd('ant')}
 SRV.antR=-1;if(!SRV.on)SRV.reels.forEach((rl,r)=>{rl.st='idle';rl.o=0;cols[r].forEach((c,y)=>rl.S.set(y,c))})}
function srSetGrid(g){SRV.reels.forEach((rl,r)=>{rl.st='idle';rl.o=0;rl.v=0;g[r].forEach((c,y)=>rl.S.set(y,c))})}
function srGeo(W,H){const rw=W*.62,rh=H*.66,rx=(W-rw)/2,ry=H*.245;return{rx,ry,rw,rh,cw:rw/5,ch:rh/4}}
function srCell(r,y){const c=SRV.cv;if(!c)return[0,0];const G=srGeo(c.W,c.H);return[G.rx+G.cw*(r+.5),G.ry+G.ch*(y+.5)]}
function srCellFx(r,y,col){if(y<0)return;const [x,yy]=srCell(r,y);srParts(18,i=>({x,y:yy,vx:Math.cos(i/18*6.28)*(140+R()*120),vy:Math.sin(i/18*6.28)*(140+R()*120),r:2+R()*3,col,life:.7,max:.7}));SRV.parts.push({type:'ring',x,y:yy,life:.6,max:.6,r:10,col})}
/* ---------- wins ---------- */
async function srShowWins(wins,mult){if(!wins.length||!SRV.on)return 0;const b=srBet(),sum=wins.reduce((a,w)=>a+w.win,0)*b,base=SRV.winShown;
 SRV.hl=new Set(wins.flatMap(w=>w.cells.map(([r,y])=>r+','+y)));SRV.dim=1;SRV.hlT=performance.now();srSnd('win');SRV.cap=`WIN ${fmt(sum)}${mult>1?'  ·  ×'+mult+' MULTIPLIER':''}`;SRV.capT=performance.now();
 SRV.hl.forEach(k=>{const [r,y]=k.split(',').map(Number),[x,yy]=srCell(r,y);srParts(6,()=>({x:x+(R()-.5)*60,y:yy+(R()-.5)*50,vy:-60-R()*80,vx:(R()-.5)*40,r:1.5+R()*2.5,col:'#fff2b0',life:.9,max:.9}))});
 if(sum>=b*3)srCoins(Math.min(70,10+sum/b*3),.55);
 const dur=Math.min(2600,400+sum/b*140);await srRoll(base,base+sum,dur);await srSleep(500);
 if(!SRV.turbo&&!SRV.auto&&wins.length>1&&!SRV.skip)for(const w of wins.slice().sort((a,c)=>c.win-a.win).slice(0,4)){SRV.hl=new Set(w.cells.map(([r,y])=>r+','+y));SRV.hlT=performance.now();SRV.cap=`${w.n} ${SRNAME[w.s]}  ·  ${w.ways} WAY${w.ways>1?'S':''}${mult>1?'  ·  ×'+mult:''}  ·  ${fmt(w.win*b)}`;SRV.capT=performance.now();await srSleep(950)}
 SRV.hl=null;SRV.dim=0;return sum}
async function srRoll(a,b,ms){const t0=performance.now();let lt=0;await new Promise(res=>{const k=()=>{const t=Math.min(1,(performance.now()-t0)/(ms*(SRV.turbo?.4:1)));SRV.winShown=a+(b-a)*(1-Math.pow(1-t,2));if(performance.now()-lt>60){srSnd('roll');lt=performance.now()}if(t>=1||SRV.skip||!SRV.on){SRV.winShown=b;res()}else setTimeout(k,20)};k()})}
function srCoins(n,spread){const c=SRV.cv;if(!c)return;for(let i=0;i<n;i++)SRV.parts.push({type:'coin',x:c.W/2+(R()-.5)*c.W*.2,y:c.H*.95,vx:(R()-.5)*c.W*spread*1.6,vy:-(c.H*1.3+R()*c.H*1.1),g:c.H*2.6,r:9+R()*9,rot:R()*6,spin:6+R()*10,life:3,max:3})}
/* ---------- feature 1: the Kraken ---------- */
async function srKraken(cells){SRV.kr={t0:performance.now(),cells,slam:{}};srSnd('roar');SRV.shake=10;await srSleep(1100);
 for(let i=0;i<cells.length&&SRV.on;i++){await srSleep(260);const [r,y]=cells[i];SRV.kr.slam[i]=performance.now();SRV.kw.push([r,y]);SRV.shake=14;SRV.flash=.25;srSnd('slam');const [x,yy]=srCell(r,y);
  srParts(26,()=>({type:'ink',x,y:yy,vx:(R()-.5)*420,vy:(R()-.5)*420,r:4+R()*9,life:.9,max:.9,col:'#1a0630'}));srCellFx(r,y,'#c58cff')}
 await srSleep(700);SRV.kr.out=performance.now();await srSleep(450);SRV.kr=null}
/* ---------- feature 2: free spins ---------- */
async function srFree(o){const b=srBet(),fs=o.fs,start=SR.CHEST[o.ch][1];
 SRV.banner={t0:performance.now(),title:`${start} FREE SPINS`,sub:'The multiplier climbs after every winning spin',spr:'chest',col:'#ffd76a'};srSnd('fan');srCoins(40,.6);await srUntil(()=>SRV.banner.end||performance.now()-SRV.banner.t0>3800);SRV.banner=null;
 SRV.mode='fs';SRV.fs={i:0,n:start,mult:1,pop:0,tot:0};
 for(let i=0;i<fs.spins.length&&SRV.on;i++){const s=fs.spins[i];SRV.fs.i=i+1;SRV.fs.mult=s.mult;SRV.skip=0;await srReels(s.g,null);const w=await srShowWins(s.wins,s.mult);SRV.fs.tot+=w;
  if(s.pay>0&&s.mult<10){SRV.fs.mult=s.mult+1;SRV.fs.pop=performance.now();srSnd('mult')}
  if(s.re){SRV.fs.n+=s.re;SRV.banner={t0:performance.now(),title:`+${s.re} FREE SPINS`,sub:'Three chests landed again',spr:'chest',col:'#ffd76a',small:1};srSnd('fan');await srUntil(()=>SRV.banner.end||performance.now()-SRV.banner.t0>2000);SRV.banner=null}
  await srSleep(350)}
 SRV.banner={t0:performance.now(),title:'FREE SPINS WIN',sub:fmt(fs.total*b),spr:'chest',col:'#ffd76a'};srSnd('fan');await srUntil(()=>SRV.banner.end||!SRV.on||performance.now()-SRV.banner.t0>3200);SRV.banner=null;SRV.mode='base';SRV.fs=null;srSetGrid(o.g2)}
/* ---------- feature 3: Hold & Win ---------- */
async function srHoldWin(o){const b=srBet(),hw=o.hw;SRV.banner={t0:performance.now(),title:'PEARL OF THE DEEP',sub:'Hold & Win · 3 respins · every new pearl resets them',spr:'pearl',col:'#f2d8ff'};srSnd('fan');
 await srUntil(()=>SRV.banner.end||performance.now()-SRV.banner.t0>3800);SRV.banner=null;
 SRV.mode='hw';SRV.hw={L:o.g2.map(c=>c.map(x=>x.s==='pearl'?x.v:null)),rs:3,spin:0,land:{},cur:null,tot:0};
 for(const st of hw.steps){if(!SRV.on)break;SRV.hw.spin=performance.now();srSnd('start');await srSleep(1100);SRV.hw.spin=0;
  for(const [r,y,v] of st.nw){SRV.hw.L[r][y]=v;SRV.hw.land[r+','+y]=performance.now();srCellFx(r,y,'#f6d8ff');srSnd('pearl');SRV.shake=4}SRV.hw.rs=st.rs;await srSleep(st.nw.length?800:450)}
 await srSleep(500);
 for(let r=0;r<5;r++)for(let y=0;y<4;y++){const v=SRV.hw.L[r][y];if(v==null||!SRV.on)continue;SRV.hw.cur=[r,y];const amt=(typeof v==='number'?v:SR.JP[v])*b;
  if(typeof v!=='number'){SRV.banner={t0:performance.now(),title:`${v} JACKPOT`,sub:fmt(amt),spr:'pearl',col:'#ffd76a',small:1};srSnd('tier');srCoins(60,.7);SRV.shake=10;await srUntil(()=>SRV.banner.end||performance.now()-SRV.banner.t0>2200);SRV.banner=null}
  SRV.hw.tot+=amt;srSnd('ding');await srRoll(SRV.winShown,SRV.winShown+amt,180);await srSleep(120)}
 if(hw.full){SRV.banner={t0:performance.now(),title:'GRAND JACKPOT',sub:fmt(SR.JP.GRAND*b),spr:'pearl',col:'#ff5a5f'};srSnd('tier');srCoins(120,.9);SRV.shake=18;await srRoll(SRV.winShown,SRV.winShown+SR.JP.GRAND*b,1500);await srUntil(()=>SRV.banner.end||performance.now()-SRV.banner.t0>3500);SRV.banner=null}
 await srSleep(700);SRV.mode='base';SRV.hw=null}
/* ---------- big wins ---------- */
const SRTIER=[[10,'BIG WIN','#ffd76a'],[25,'MEGA WIN','#5ef0ff'],[50,'EPIC WIN','#ff6ad5'],[100,'LEGENDARY','#ff5a3c']];
async function srBig(pay,b){const x=pay/b,top=SRTIER.filter(t=>x>=t[0]).length;SRV.bw={amt:pay,b,t0:performance.now(),dur:[0,3800,6000,8000,10000][top]*(SRV.turbo?.6:1),tier:-1,p:0};
 await srUntil(()=>!SRV.bw||SRV.bw.end||(SRV.bw.p>=1&&performance.now()-SRV.bw.t1>2600));SRV.bw=null}
/* ---------- a spin, start to finish ---------- */
async function srPlay(){if(SRV.busy){SRV.skip=1;return}const b=srBet();if(!spend(b,'sunken')){SRV.auto=0;srUI();return}
 SRV.busy=1;SRV.skip=0;SRV.winShown=0;SRV.cap='';SRV.kw=[];srUI();const o=srSpin();
 await srReels(o.g,o.krak);if(o.krak){o.krak.forEach(([r,y])=>SRV.reels[r].S.set(y,{s:'wild',kr:1}));SRV.kw=[]}
 if(SRV.on){SRV.skip=0;await srShowWins(o.wins,1);
  if(o.fs){const cells=[];o.g2.forEach((c,r)=>c.forEach((x,y)=>{if(x.s==='chest')cells.push([r,y])}));SRV.hl=new Set(cells.map(c=>c.join(',')));SRV.dim=1;SRV.hlT=performance.now();cells.forEach(([r,y])=>srCellFx(r,y,'#ffd76a'));srSnd('chest');SRV.cap=`${o.ch} CHESTS  ·  ${fmt(o.chestPay*b)}`;SRV.capT=performance.now();
   await srRoll(SRV.winShown,SRV.winShown+o.chestPay*b,600);await srSleep(1200);SRV.hl=null;SRV.dim=0;SRV.skip=0;await srFree(o)}
  if(o.hw&&SRV.on){SRV.skip=0;const cells=[];o.g2.forEach((c,r)=>c.forEach((x,y)=>{if(x.s==='pearl')cells.push([r,y])}));SRV.hl=new Set(cells.map(c=>c.join(',')));SRV.dim=1;SRV.hlT=performance.now();await srSleep(1300);SRV.hl=null;SRV.dim=0;await srHoldWin(o)}}
 const pay=Math.round(o.pay*b*100)/100;if(SRV.on&&pay>=b*10){SRV.skip=0;await srBig(pay,b)}SRV.winShown=pay;
 if(pay>0)credit(pay,'sunken');record('sunken',b,pay,`Sunken Riches${o.krak?' · Kraken':''}${o.fs?' · free spins':''}${o.hw?' · Hold & Win':''}`);outcome(pay>b);if(typeof drawBal==='function')drawBal(pay>b?1:0);
 SRV.busy=0;SRV.skip=0;if(SRV.auto){SRV.auto--;if(o.fs||o.hw)SRV.auto=0}srUI();if(SRV.auto&&SRV.on)setTimeout(()=>{if(SRV.on&&SRV.auto&&!SRV.busy)srPlay()},SRV.turbo?200:500)}
/* ================= DRAWING ================= */
function srLoop(now){if(!SRV.on)return;const cv=$('srC');if(!cv){srLeave();return}const dt=Math.min(.05,(now-SRV.t)/1000);SRV.t=now;srUpdate(dt,now);try{srDraw(cv,now,dt)}catch(e){console.error(e)}
 if($('srWin'))$('srWin').textContent=fmt(SRV.winShown);requestAnimationFrame(srLoop)}
function srUpdate(dt,now){for(const rl of SRV.reels){const o0=rl.o;
  if(rl.st==='spin'){if(now<rl.t0)continue;rl.v=Math.min(SRV.turbo?36:27,rl.v+dt*120);rl.o+=rl.v*dt}
  else if(rl.st==='stop'){const t=(now-rl.ts)/rl.dur;if(t<.84){const e=1-Math.pow(1-t/.84,3);rl.o=rl.from+(rl.to+.17-rl.from)*e}else if(t<1){if(!rl.th){rl.th=1;srSnd('stop')}const k=(t-.84)/.16;rl.o=rl.to+.17*(1-k*k*(3-2*k))}
   else{rl.o=rl.to;const S2=new Map();for(let y=-2;y<6;y++)S2.set(y,rl.S.get(y-rl.to)||srFill());rl.S=S2;rl.o=0;rl.v=0;rl.st='idle';if(rl.res){rl.res();rl.res=null}}}
  rl.vis=dt?Math.abs(rl.o-o0)/dt:0}
 SRV.shake*=Math.pow(.02,dt);SRV.flash=Math.max(0,SRV.flash-dt*1.5);
 for(const p of SRV.parts){p.life-=dt;p.vy+=(p.g||0)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.spin*dt;if(p.type==='ink'){p.vx*=.92;p.vy*=.92;p.r+=dt*14}if(p.type==='ring')p.r+=dt*160}SRV.parts=SRV.parts.filter(p=>p.life>0);
 if(SRV.bw){const bw=SRV.bw,p=Math.min(1,(now-bw.t0)/bw.dur);bw.p=p;bw.shown=bw.amt*(1-Math.pow(1-p,2.2));const tier=SRTIER.filter(t=>bw.shown/bw.b>=t[0]).length-1;if(tier>bw.tier){bw.tier=tier;bw.pop=now;SRV.shake=16;SRV.flash=.6;srSnd('tier')}
  if(p>=1&&!bw.t1){bw.t1=now;srSnd('fan')}if(R()<.9)srCoins(p<1?3:1,.75);if(now-(bw.lt||0)>70&&p<1){bw.lt=now;srSnd('roll')}}
 for(const s of SRV.snow){s.y+=s.sp*dt*.5;s.x+=Math.sin(now/2000+s.y*9)*dt*.004;if(s.y>1)s.y=0}for(const b of SRV.bub){b.y-=b.sp*dt;if(b.y<-.05){b.y=1.05;b.x=R()}}}
function srDraw(cv,now){const r=cv.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(r.width*d)||cv.height!==Math.round(r.height*d)){cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d)}
 const W=r.width,H=r.height,x=cv.getContext('2d');SRV.cv={W,H};x.setTransform(d,0,0,d,0,0);const G=srGeo(W,H),b=srBet();
 x.save();if(SRV.shake>.3)x.translate((R()-.5)*SRV.shake,(R()-.5)*SRV.shake);
 srBg(x,W,H,now);srTitle(x,W,H,now,b);srSide(x,W,H,G,now);
 /* cabinet frame */const fx=G.rx-14,fy=G.ry-14,fw=G.rw+28,fh=G.rh+28;x.save();x.shadowColor='rgba(0,0,0,.8)';x.shadowBlur=30;const fg=x.createLinearGradient(0,fy,0,fy+fh);fg.addColorStop(0,'#fff0b0');fg.addColorStop(.15,'#d9a43a');fg.addColorStop(.5,'#7a4d0c');fg.addColorStop(.85,'#d9a43a');fg.addColorStop(1,'#5a3806');
 x.fillStyle=fg;x.beginPath();x.roundRect?x.roundRect(fx,fy,fw,fh,18):x.rect(fx,fy,fw,fh);x.fill();x.restore();x.fillStyle='#2a1a04';x.beginPath();x.roundRect?x.roundRect(fx+7,fy+7,fw-14,fh-14,12):x.rect(fx+7,fy+7,fw-14,fh-14);x.fill();
 for(let i=0;i<14;i++){for(const yy of[fy+3.5,fy+fh-3.5]){const xx=fx+20+i*(fw-40)/13;const rg=x.createRadialGradient(xx-1,yy-1,0,xx,yy,3.5);rg.addColorStop(0,'#fff');rg.addColorStop(1,'#6b4a10');x.fillStyle=rg;x.beginPath();x.arc(xx,yy,3,0,7);x.fill()}}
 const glass=x.createLinearGradient(0,G.ry,0,G.ry+G.rh);glass.addColorStop(0,SRV.mode==='fs'?'#1a1404':'#04121f');glass.addColorStop(.5,SRV.mode==='fs'?'#2a1d05':'#072338');glass.addColorStop(1,SRV.mode==='fs'?'#140e02':'#020a14');x.fillStyle=glass;x.fillRect(G.rx,G.ry,G.rw,G.rh);
 for(let r=1;r<5;r++){const lg=x.createLinearGradient(0,G.ry,0,G.ry+G.rh);lg.addColorStop(0,'rgba(255,215,106,0)');lg.addColorStop(.5,'rgba(255,215,106,.35)');lg.addColorStop(1,'rgba(255,215,106,0)');x.fillStyle=lg;x.fillRect(G.rx+G.cw*r-1,G.ry,2,G.rh)}
 /* anticipation glow on the reels still to land */
 if(SRV.antR>=0){for(let r=SRV.antR;r<5;r++){const a=.5+Math.sin(now/90)*.35;x.save();x.shadowColor='#ffd76a';x.shadowBlur=30;x.strokeStyle=`rgba(255,215,106,${a})`;x.lineWidth=4;x.strokeRect(G.rx+G.cw*r+3,G.ry+3,G.cw-6,G.rh-6);x.restore();
  if(R()<.6)SRV.parts.push({type:'spark',x:G.rx+G.cw*(r+R()),y:G.ry+G.rh,vx:0,vy:-120-R()*200,r:1.5+R()*2,col:'#ffd76a',life:1,max:1,rot:0,spin:0})}}
 x.save();x.beginPath();x.rect(G.rx,G.ry,G.rw,G.rh);x.clip();
 if(SRV.mode==='hw')srDrawHW(x,G,now,b);else{for(let r=0;r<5;r++)srDrawReel(x,G,r,now,b);
  if(SRV.dim){x.fillStyle='rgba(0,6,14,.62)';x.fillRect(G.rx,G.ry,G.rw,G.rh);if(SRV.hl)SRV.hl.forEach(k=>{const [r,y]=k.split(',').map(Number),sym=SRV.reels[r].S.get(y);if(!sym)return;const t=(now-SRV.hlT)/1000,sc=1+.09*Math.abs(Math.sin(t*4.2));
   const cx=G.rx+G.cw*(r+.5),cy=G.ry+G.ch*(y+.5);x.save();x.shadowColor='#ffd76a';x.shadowBlur=26;srSym(x,cx,cy,Math.min(G.cw,G.ch)*.96*sc,sym,0,b);x.restore();
   x.save();x.strokeStyle='#ffd76a';x.lineWidth=2.5;x.setLineDash([10,6]);x.lineDashOffset=-now/30;x.strokeRect(G.rx+G.cw*r+4,G.ry+G.ch*y+4,G.cw-8,G.ch-8);x.restore()})}}
 /* Kraken wilds sit over the spinning reels */
 for(const [r,y] of SRV.kw){const cx=G.rx+G.cw*(r+.5),cy=G.ry+G.ch*(y+.5);x.fillStyle='rgba(40,6,70,.85)';x.fillRect(G.rx+G.cw*r+2,G.ry+G.ch*y+2,G.cw-4,G.ch-4);x.save();x.shadowColor='#c58cff';x.shadowBlur=24;srSym(x,cx,cy,Math.min(G.cw,G.ch)*.96*(1+.05*Math.sin(now/120)),{s:'wild'},0,b);x.restore()}
 const vg=x.createLinearGradient(0,G.ry,0,G.ry+G.rh);vg.addColorStop(0,'rgba(0,0,0,.55)');vg.addColorStop(.12,'rgba(0,0,0,0)');vg.addColorStop(.88,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.55)');x.fillStyle=vg;x.fillRect(G.rx,G.ry,G.rw,G.rh);
 const sh=x.createLinearGradient(G.rx,G.ry,G.rx+G.rw*.6,G.ry+G.rh);sh.addColorStop(0,'rgba(255,255,255,.07)');sh.addColorStop(.4,'rgba(255,255,255,.015)');sh.addColorStop(.41,'rgba(255,255,255,0)');x.fillStyle=sh;x.fillRect(G.rx,G.ry,G.rw,G.rh);x.restore();
 if(SRV.kr)srDrawKraken(x,W,H,G,now);
 /* win caption plate */const cy=G.ry+G.rh+H*.045;if(SRV.cap&&(SRV.busy||now-SRV.capT<4000)){const a=Math.min(1,(now-SRV.capT)/200);x.globalAlpha=a;x.font=`800 ${H*.04}px 'Barlow Condensed',sans-serif`;const tw=x.measureText(SRV.cap).width+60;
  const pg=x.createLinearGradient(0,cy-H*.03,0,cy+H*.03);pg.addColorStop(0,'#3a2604');pg.addColorStop(1,'#120a01');x.fillStyle=pg;x.beginPath();x.roundRect?x.roundRect(W/2-tw/2,cy-H*.03,tw,H*.06,H*.03):x.rect(W/2-tw/2,cy-H*.03,tw,H*.06);x.fill();x.strokeStyle='#d9a43a';x.lineWidth=2;x.stroke();
  x.fillStyle='#ffe28a';x.textAlign='center';x.textBaseline='middle';x.fillText(SRV.cap,W/2,cy+1);x.globalAlpha=1}
 if(SRV.mode==='hw'&&SRV.hw){x.font=`800 ${H*.04}px 'Barlow Condensed',sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillStyle='#f6d8ff';x.fillText('RESPINS',W/2-60,cy);for(let i=0;i<3;i++){x.fillStyle=i<SRV.hw.rs?'#f6d8ff':'rgba(255,255,255,.15)';x.shadowColor='#f6d8ff';x.shadowBlur=i<SRV.hw.rs?14:0;x.beginPath();x.arc(W/2+i*26,cy,8,0,7);x.fill()}x.shadowBlur=0}
 /* particles */for(const p of SRV.parts){const a=Math.max(0,p.life/p.max);if(p.type==='coin'){const w=Math.abs(Math.cos(p.rot))*p.r;const g=x.createLinearGradient(p.x-p.r,p.y-p.r,p.x+p.r,p.y+p.r);g.addColorStop(0,'#fff6c2');g.addColorStop(.5,'#e8a91c');g.addColorStop(1,'#7a4a06');x.fillStyle=g;x.beginPath();x.ellipse(p.x,p.y,Math.max(1.5,w),p.r,0,0,7);x.fill();x.strokeStyle='#8a5a0c';x.lineWidth=1.2;x.stroke();if(w>p.r*.5){x.fillStyle='rgba(255,255,255,.6)';x.beginPath();x.ellipse(p.x-w*.3,p.y-p.r*.35,w*.25,p.r*.2,0,0,7);x.fill()}}
  else if(p.type==='ink'){x.fillStyle=`rgba(26,6,48,${a*.7})`;x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill()}
  else if(p.type==='ring'){x.strokeStyle=p.col;x.globalAlpha=a;x.lineWidth=3;x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.stroke();x.globalAlpha=1}
  else{x.globalCompositeOperation='lighter';x.fillStyle=p.col||'#fff';x.globalAlpha=a;x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill();x.globalAlpha=1;x.globalCompositeOperation='source-over'}}
 x.restore();
 if(SRV.banner)srDrawBanner(x,W,H,now);if(SRV.bw)srDrawBig(x,W,H,now);
 if(SRV.flash>0){x.fillStyle=`rgba(255,255,240,${SRV.flash})`;x.fillRect(0,0,W,H)}}
function srSym(x,cx,cy,sz,sym,blur,b){const im=(blur?SRA.blur:SRA.spr)[sym.s];if(!im)return;x.drawImage(im,cx-sz/2,cy-sz/2,sz,sz);
 if(sym.s==='pearl'&&sym.v!=null&&!blur){const t=typeof sym.v==='number'?fmt(sym.v*b):sym.v;x.font=`800 ${sz*(typeof sym.v==='number'?.2:.18)}px 'Barlow Condensed',sans-serif`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.strokeStyle='#2a0838';x.lineWidth=sz*.05;x.strokeText(t,cx,cy+sz*.33);
  const g=x.createLinearGradient(0,cy+sz*.25,0,cy+sz*.41);g.addColorStop(0,'#fff6c2');g.addColorStop(1,typeof sym.v==='number'?'#e8a91c':'#ff7ad9');x.fillStyle=g;x.fillText(t,cx,cy+sz*.33)}}
function srDrawReel(x,G,r,now,b){const rl=SRV.reels[r],blur=rl.vis>8,sz=Math.min(G.cw,G.ch)*.96;for(let j=Math.floor(-rl.o)-1;j<=Math.ceil(4-rl.o);j++){const row=j+rl.o,cy=G.ry+G.ch*(row+.5);if(cy<G.ry-G.ch||cy>G.ry+G.rh+G.ch)continue;
  if(!rl.S.has(j))rl.S.set(j,srFill());srSym(x,G.rx+G.cw*(r+.5),cy,sz,rl.S.get(j),blur,b)}}
function srDrawHW(x,G,now,b){const H=SRV.hw,sz=Math.min(G.cw,G.ch)*.92;for(let r=0;r<5;r++)for(let y=0;y<4;y++){const cx=G.rx+G.cw*(r+.5),cy=G.ry+G.ch*(y+.5),v=H.L[r][y];
  x.fillStyle=v!=null?'rgba(80,30,110,.55)':'rgba(0,0,0,.45)';x.strokeStyle=v!=null?'rgba(246,216,255,.7)':'rgba(255,215,106,.2)';x.lineWidth=2;x.beginPath();x.roundRect?x.roundRect(G.rx+G.cw*r+5,G.ry+G.ch*y+5,G.cw-10,G.ch-10,10):x.rect(G.rx+G.cw*r+5,G.ry+G.ch*y+5,G.cw-10,G.ch-10);x.fill();x.stroke();
  if(v!=null){const lt=H.land[r+','+y],pop=lt?Math.max(0,1-(now-lt)/400):0,cur=H.cur&&H.cur[0]===r&&H.cur[1]===y;x.save();x.shadowColor=cur?'#ffd76a':'#e9b8ff';x.shadowBlur=cur?36:16+Math.sin(now/300+r+y)*6;srSym(x,cx,cy,sz*(1+pop*.35),{s:'pearl',v},0,b);x.restore()}
  else if(H.spin){const k=Math.floor(now/70+r*3+y*7)%3;x.globalAlpha=.35;srSym(x,cx,cy+((now/3+r*40+y*60)%G.ch)-G.ch/2,sz*.9,{s:k?'pearl':'shell'},1,b);x.globalAlpha=1}}}
function srDrawKraken(x,W,H,G,now){const K=SRV.kr,t=(now-K.t0)/1000,out=K.out?Math.min(1,(now-K.out)/450):0;x.fillStyle=`rgba(30,0,50,${Math.min(.5,t*.8)*(1-out)})`;x.fillRect(0,0,W,H);
 /* tentacles first, so the head sits over their roots */
 K.cells.forEach(([r,y],i)=>{const st=K.slam[i],t1=1.1+i*.26-.2;if(!st&&t<t1)return;const k=st?1:Math.min(1,(t-t1)/.2),[tx,ty]=[G.rx+G.cw*(r+.5),G.ry+G.ch*(y+.5)],sx=W/2+(r-2)*W*.09,sy=H*1.02;
  const ex=sx+(tx-sx)*k*(1-out),eyy=sy+(ty-sy)*k*(1-out),wob=Math.sin(now/160+i*1.3)*40*(1-k*.5),N=70,pts=[];for(let n=0;n<=N;n++){const u=n/N;pts.push([sx+(ex-sx)*u+Math.sin(u*Math.PI)*wob+Math.sin(u*9+now/200)*6*u,sy+(eyy-sy)*u])}
  for(let n=0;n<N;n++){const u=n/N,w=30*(1-u)+5;x.strokeStyle=`rgb(${90+u*60|0},${20+u*20|0},${120+u*40|0})`;x.lineWidth=w;x.lineCap='round';x.beginPath();x.moveTo(pts[n][0],pts[n][1]);x.lineTo(pts[n+1][0],pts[n+1][1]);x.stroke()}
  x.strokeStyle='rgba(255,200,255,.28)';x.lineWidth=3;x.beginPath();pts.forEach(([a,c],n)=>{const w=(30*(1-n/N)+5)*.3;n?x.lineTo(a-w,c):x.moveTo(a-w,c)});x.stroke();
  for(let n=4;n<N-2;n+=5){const u=n/N,w=(30*(1-u)+5)*.42,[a,c]=pts[n];const g=x.createRadialGradient(a+w-1,c-1,0,a+w,c,w*.7);g.addColorStop(0,'#ffe6ff');g.addColorStop(1,'#b46bc8');x.fillStyle=g;x.beginPath();x.ellipse(a+w,c,w*.62,w*.5,0,0,7);x.fill();x.fillStyle='rgba(90,20,110,.6)';x.beginPath();x.arc(a+w,c,w*.22,0,7);x.fill()}});
 /* the head and eye rising out of the deep */
 const rise=Math.min(1,t*1.2)*(1-out),hy=H*1.18-rise*H*.36,hw=W*.2;x.save();const hg=x.createRadialGradient(W/2-hw*.3,hy-hw*.4,10,W/2,hy,hw*1.1);hg.addColorStop(0,'#9b4fc0');hg.addColorStop(.6,'#4a1468');hg.addColorStop(1,'#1a0428');x.fillStyle=hg;x.beginPath();x.ellipse(W/2,hy,hw,hw*.62,0,Math.PI,0);x.lineTo(W/2+hw,H);x.lineTo(W/2-hw,H);x.fill();
 x.fillStyle='rgba(255,190,255,.12)';for(let i=0;i<26;i++){const a=Math.PI+((i*.61)%1)*Math.PI,rr=hw*(.3+((i*.37)%1)*.6);x.beginPath();x.arc(W/2+Math.cos(a)*rr,hy+Math.sin(a)*rr*.6,3+(i%4)*2,0,7);x.fill()}
 const ey=hy-hw*.18,er=hw*.24,blink=Math.max(.08,Math.abs(Math.sin(now/900))>.98?.1:1);for(const s of[-1,1]){const ex=W/2+s*hw*.42;x.fillStyle='#2a0838';x.beginPath();x.ellipse(ex,ey,er*1.15,er*.82,0,0,7);x.fill();
  const ig=x.createRadialGradient(ex,ey,er*.1,ex,ey,er);ig.addColorStop(0,'#fff3a0');ig.addColorStop(.45,'#ffb000');ig.addColorStop(.85,'#b33d00');ig.addColorStop(1,'#4a1000');x.fillStyle=ig;x.beginPath();x.ellipse(ex,ey,er,er*.72*blink,0,0,7);x.fill();
  x.strokeStyle='rgba(120,30,0,.5)';x.lineWidth=1;for(let i=0;i<14;i++){const a=i/14*6.28;x.beginPath();x.moveTo(ex+Math.cos(a)*er*.25,ey+Math.sin(a)*er*.18*blink);x.lineTo(ex+Math.cos(a)*er*.9,ey+Math.sin(a)*er*.65*blink);x.stroke()}
  x.fillStyle='#050005';x.beginPath();x.ellipse(ex+Math.sin(now/700)*er*.15,ey,er*.13*(1+.5*Math.sin(t*2)),er*.62*blink,0,0,7);x.fill();x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.ellipse(ex-er*.38,ey-er*.3*blink,er*.14,er*.09,-.5,0,7);x.fill()}
 x.restore()}
function srDrawBanner(x,W,H,now){const B=SRV.banner,a=Math.min(1,(now-B.t0)/250),s=B.small?.75:1;x.fillStyle=`rgba(0,4,12,${.72*a})`;x.fillRect(0,0,W,H);
 x.save();x.translate(W/2,H*.4);x.rotate(now/3000);for(let i=0;i<18;i++){x.rotate(Math.PI/9);x.fillStyle=`rgba(255,215,106,${.08*a})`;x.beginPath();x.moveTo(0,0);x.lineTo(W,-40);x.lineTo(W,40);x.fill()}x.restore();
 const sc=(.6+.4*Math.min(1,(now-B.t0)/350))*s;x.save();x.translate(W/2,H*.32);x.scale(sc,sc);x.shadowColor=B.col;x.shadowBlur=40;x.drawImage(SRA.spr[B.spr],-H*.16,-H*.16,H*.32,H*.32);x.restore();
 const ttl=(t,y,sz,c)=>{x.font=`900 ${sz}px Cinzel, Georgia, serif`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.strokeStyle='#120803';x.lineWidth=sz*.14;x.strokeText(t,W/2,y);const g=x.createLinearGradient(0,y-sz/2,0,y+sz/2);g.addColorStop(0,'#fff6c2');g.addColorStop(.5,c);g.addColorStop(1,'#7a4a06');x.fillStyle=g;x.fillText(t,W/2,y)};
 x.globalAlpha=a;ttl(B.title,H*.58,H*.1*s,B.col);x.font=`700 ${H*.042}px 'Barlow Condensed',sans-serif`;x.fillStyle='#fff';x.fillText(B.sub,W/2,H*.68);x.font=`600 ${H*.026}px 'IBM Plex Mono',monospace`;x.fillStyle='rgba(255,255,255,.5)';x.fillText('CLICK TO CONTINUE',W/2,H*.9);x.globalAlpha=1}
function srDrawBig(x,W,H,now){const bw=SRV.bw,T=SRTIER[Math.max(0,bw.tier)];x.fillStyle='rgba(0,3,10,.78)';x.fillRect(0,0,W,H);
 x.save();x.translate(W/2,H*.42);x.rotate(now/2500);for(let i=0;i<24;i++){x.rotate(Math.PI/12);const g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,T[2]+'55');g.addColorStop(1,T[2]+'00');x.fillStyle=g;x.beginPath();x.moveTo(0,0);x.lineTo(W,-60);x.lineTo(W,60);x.fill()}x.restore();
 const pop=bw.pop?Math.max(0,1-(now-bw.pop)/450):0,sc=1+pop*.5+Math.sin(now/220)*.03,sz=H*.15;x.save();x.translate(W/2,H*.4);x.scale(sc,sc);x.font=`900 ${sz}px Cinzel, Georgia, serif`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
 x.shadowColor=T[2];x.shadowBlur=50;x.strokeStyle='#120803';x.lineWidth=sz*.16;x.strokeText(T[1],0,0);x.shadowBlur=0;const g=x.createLinearGradient(0,-sz/2,0,sz/2);g.addColorStop(0,'#ffffff');g.addColorStop(.45,T[2]);g.addColorStop(.55,'#8a5a0c');g.addColorStop(1,T[2]);x.fillStyle=g;x.fillText(T[1],0,0);x.restore();
 const az=H*.1;x.font=`800 ${az}px 'Barlow Condensed',sans-serif`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.strokeStyle='#120803';x.lineWidth=az*.14;x.strokeText(fmt(bw.shown),W/2,H*.6);const ag=x.createLinearGradient(0,H*.55,0,H*.66);ag.addColorStop(0,'#fff6c2');ag.addColorStop(1,'#e8a91c');x.fillStyle=ag;x.fillText(fmt(bw.shown),W/2,H*.6);
 x.font=`700 ${H*.034}px 'Barlow Condensed',sans-serif`;x.fillStyle='rgba(255,255,255,.75)';x.fillText(`${(bw.shown/bw.b).toFixed(1)}× YOUR BET`,W/2,H*.69)}
function srBg(x,W,H,now){const fs=SRV.mode==='fs',hw=SRV.mode==='hw';const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,hw?'#1a0a2e':fs?'#1f3a3a':'#0a3a5c');g.addColorStop(.45,hw?'#0d0420':fs?'#0e2228':'#04203a');g.addColorStop(1,'#010812');x.fillStyle=g;x.fillRect(0,0,W,H);
 x.save();x.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const sw=Math.sin(now/3800+i*1.7)*.06,x0=W*(.08+i*.17+sw),a=.05+.03*Math.sin(now/2100+i);const lg=x.createLinearGradient(0,0,0,H);lg.addColorStop(0,`rgba(150,230,255,${a})`);lg.addColorStop(1,'rgba(150,230,255,0)');x.fillStyle=lg;x.beginPath();x.moveTo(x0-14,0);x.lineTo(x0+22,0);x.lineTo(x0+130+sw*400,H);x.lineTo(x0-60+sw*400,H);x.fill()}x.restore();
 /* wreck silhouette and sand */x.fillStyle='rgba(2,14,26,.85)';x.beginPath();x.moveTo(W*.62,H);x.lineTo(W*.68,H*.8);x.lineTo(W*.95,H*.76);x.lineTo(W,H*.82);x.lineTo(W,H);x.fill();x.fillRect(W*.78,H*.45,4,H*.33);x.fillRect(W*.88,H*.52,3,H*.26);x.beginPath();x.moveTo(W*.78,H*.5);x.lineTo(W*.72,H*.62);x.lineTo(W*.78,H*.64);x.fill();
 x.fillStyle='rgba(2,14,26,.7)';x.beginPath();x.moveTo(0,H);x.lineTo(0,H*.84);x.quadraticCurveTo(W*.12,H*.78,W*.22,H*.86);x.lineTo(W*.3,H);x.fill();
 const sd=x.createLinearGradient(0,H*.88,0,H);sd.addColorStop(0,'rgba(120,100,60,0)');sd.addColorStop(1,'rgba(90,72,40,.55)');x.fillStyle=sd;x.fillRect(0,H*.88,W,H*.12);
 for(const k of SRV.kelp){const bx=k.x*W;x.strokeStyle=k.c;x.lineCap='round';for(let s=0;s<3;s++){x.lineWidth=9-s*2.5;x.beginPath();x.moveTo(bx+s*6,H);let px=bx+s*6,py=H;for(let i=1;i<=8;i++){const yy=H-i*H*k.h/8,xx=bx+s*6+Math.sin(now/1400+k.ph+i*.6)*i*2.6;x.quadraticCurveTo(px,(py+yy)/2,xx,yy);px=xx;py=yy}x.stroke()}}
 x.fillStyle='rgba(220,240,255,.35)';for(const s of SRV.snow){x.fillRect(s.x*W,s.y*H,s.s,s.s)}
 for(const bb of SRV.bub){const bx=bb.x*W+Math.sin(now/600+bb.ph)*6,by=bb.y*H;x.strokeStyle='rgba(200,240,255,.4)';x.lineWidth=1;x.beginPath();x.arc(bx,by,bb.r,0,7);x.stroke();x.fillStyle='rgba(255,255,255,.5)';x.beginPath();x.arc(bx-bb.r*.35,by-bb.r*.35,bb.r*.25,0,7);x.fill()}}
function srTitle(x,W,H,now,b){const sz=H*.075,y=H*.075;x.save();x.font=`900 ${sz}px Cinzel, Georgia, serif`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.shadowColor='#1fc8b8';x.shadowBlur=24;x.strokeStyle='#120803';x.lineWidth=sz*.16;x.strokeText('SUNKEN RICHES',W/2,y);x.shadowBlur=0;
 const g=x.createLinearGradient(0,y-sz/2,0,y+sz/2);g.addColorStop(0,'#fff6c2');g.addColorStop(.45,'#f7cf55');g.addColorStop(.55,'#8a5a0c');g.addColorStop(1,'#f0c048');x.fillStyle=g;x.fillText('SUNKEN RICHES',W/2,y);
 const sw=(now/2500)%1.6-.3,tw=x.measureText('SUNKEN RICHES').width;x.globalCompositeOperation='source-atop';const sh=x.createLinearGradient(W/2-tw/2+tw*sw-60,0,W/2-tw/2+tw*sw+60,0);sh.addColorStop(0,'rgba(255,255,255,0)');sh.addColorStop(.5,'rgba(255,255,255,.7)');sh.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=sh;x.fillRect(W/2-tw/2,y-sz/2,tw,sz);x.restore();
 /* jackpot plaques */const J=[['GRAND',SR.JP.GRAND,'#ff3c4c','#5a0410'],['MAJOR',SR.JP.MAJOR,'#b46bff','#2a0a50'],['MINOR',SR.JP.MINOR,'#3a8bff','#081f52'],['MINI',SR.JP.MINI,'#19c46b','#04381f']],G=srGeo(W,H),pw=G.rw/4-10,ph=H*.065,py=H*.135;
 J.forEach(([n,v,c,dk],i)=>{const px=G.rx+i*(pw+13)-4;const pg=x.createLinearGradient(0,py,0,py+ph);pg.addColorStop(0,c);pg.addColorStop(1,dk);x.fillStyle=pg;x.beginPath();x.roundRect?x.roundRect(px,py,pw,ph,ph/2):x.rect(px,py,pw,ph);x.fill();x.strokeStyle='#ffd76a';x.lineWidth=2;x.stroke();
  x.font=`700 ${ph*.3}px 'IBM Plex Mono',monospace`;x.fillStyle='rgba(255,255,255,.85)';x.textAlign='left';x.textBaseline='middle';x.fillText(n,px+ph*.45,py+ph/2);x.font=`800 ${ph*.52}px 'Barlow Condensed',sans-serif`;x.fillStyle='#fff6c2';x.textAlign='right';x.fillText(fmt(v*b),px+pw-ph*.45,py+ph/2+1)})}
function srSide(x,W,H,G,now){const pw=G.rx-40,cxL=G.rx/2,cxR=W-G.rx/2,yy=G.ry+G.rh*.5;if(pw<60)return;
 const plate=(cx,lines,spr,col,big)=>{const w=Math.min(pw,170),h=H*.34;x.save();const pg=x.createLinearGradient(0,yy-h/2,0,yy+h/2);pg.addColorStop(0,'rgba(10,30,50,.85)');pg.addColorStop(1,'rgba(2,10,20,.9)');x.fillStyle=pg;x.beginPath();x.roundRect?x.roundRect(cx-w/2,yy-h/2,w,h,16):x.rect(cx-w/2,yy-h/2,w,h);x.fill();x.strokeStyle=col;x.lineWidth=2;x.stroke();
  if(spr)x.drawImage(SRA.spr[spr],cx-w*.32,yy-h*.47,w*.64,w*.64);x.textAlign='center';x.textBaseline='middle';lines.forEach(([t,sz,c],i)=>{x.font=`800 ${sz}px 'Barlow Condensed',sans-serif`;x.fillStyle=c;x.fillText(t,cx,yy+h*.1+i*sz*1.1)});x.restore()};
 if(SRV.mode==='fs'&&SRV.fs){plate(cxL,[['FREE SPIN',H*.03,'#9fd8ff'],[`${SRV.fs.i} / ${SRV.fs.n}`,H*.07,'#fff6c2']],'chest','#ffd76a');
  const pop=Math.max(0,1-(now-SRV.fs.pop)/500),w=Math.min(pw,170),h=H*.34;x.save();x.translate(cxR,yy);x.scale(1+pop*.4,1+pop*.4);const og=x.createRadialGradient(0,-10,4,0,0,w*.42);og.addColorStop(0,'#fff6c2');og.addColorStop(.5,'#e8a91c');og.addColorStop(1,'#5a3806');x.shadowColor='#ffd76a';x.shadowBlur=30+pop*40;x.fillStyle=og;x.beginPath();x.arc(0,0,w*.38,0,7);x.fill();
  x.shadowBlur=0;x.font=`900 ${w*.3}px Cinzel, Georgia, serif`;x.textAlign='center';x.textBaseline='middle';x.fillStyle='#3a1d02';x.fillText('×'+SRV.fs.mult,0,4);x.font=`800 ${H*.028}px 'Barlow Condensed',sans-serif`;x.fillStyle='#ffe28a';x.fillText('MULTIPLIER',0,w*.38+H*.035);x.restore()}
 else{plate(cxL,[['3+ CHESTS',H*.032,'#ffe28a'],['FREE SPINS',H*.03,'#9fd8ff']],'chest','rgba(255,215,106,.5)');plate(cxR,[['6+ PEARLS',H*.032,'#f6d8ff'],['HOLD & WIN',H*.03,'#9fd8ff']],'pearl','rgba(246,216,255,.5)')}}
game('sunken',{name:'Sunken Riches',cat:'slots',glyph:'1024',rtp:'97%',tag:'NEW',sim:()=>srSpin().pay,
 rules:'A 5-reel, 4-row video slot with 1,024 ways. Bets from 0.20 to 300 a spin. Three features: Kraken Strike turns 3 to 8 positions wild (about 1 spin in 70); 3+ treasure chests give 8 to 20 free spins with a multiplier that rises after every win (about 1 in 260); 6+ pearls start Hold & Win with Mini, Minor, Major and Grand jackpots (about 1 in 1,600). Returns 97%, measured over 6 million spins.',
 mount(h){srMount(h)},leave(){srLeave()}});
