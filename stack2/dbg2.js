const pw=require('playwright');(async()=>{const b=await pw.chromium.launch(),e=[];const pg=await b.newPage({viewport:{width:1500,height:920}});pg.on('pageerror',x=>e.push(''+x));
await pg.goto('file:///D:/Stack Casino/stack-casino.html');await pg.waitForTimeout(500);await pg.click('#auSw');await pg.fill('#auU','f2');await pg.fill('#auP','p');await pg.fill('#auP2','p');await pg.click('#auGo');await pg.waitForTimeout(2500);await pg.evaluate('closeAll()');
await pg.evaluate("location.hash='#/c/orig'");await pg.waitForTimeout(800);await pg.hover('.tile[data-g="dice"]');await pg.click('.tile[data-g="dice"] [data-fav]');await pg.waitForTimeout(400);
console.log('fav',await pg.evaluate("[X().favs.join(),location.hash,document.querySelector('#nav a[href=\"#/c/favs\"] .ct').textContent]"));
const slow=async sel=>{const el=await pg.$(sel);const bb=await el.boundingBox();await pg.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await pg.mouse.down();await pg.waitForTimeout(400);await pg.mouse.up()};
let ok=0;for(let i=0;i<10&&!ok;i++){if(await pg.$('#mtrack .ob[data-x]:not([disabled])')){await slow('#mtrack .ob[data-x]:not([disabled])');ok=1}else await pg.waitForTimeout(500)}
console.log('slow click placed',await pg.evaluate('MB.length'));
const m=await pg.evaluate("(()=>{const m=MATCHES.find(z=>z.live&&z.sp==='basketball');const x=MICRO.find(z=>z.mid===m.id&&z.open);spend(5,'micro');MB.push({x:x.id,sel:'y',st:5,od:2});const b=P().bal;end(m,true);return{left:MB.filter(q=>q.x===x.id).length,back:+(P().bal-b).toFixed(2)}})()");console.log('match ended',JSON.stringify(m));
console.log(e.join('\n')||'no errors');await b.close()})();
