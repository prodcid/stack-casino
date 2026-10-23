const pw=require('playwright');(async()=>{const b=await pw.chromium.launch(),e=[];const pg=await b.newPage({viewport:{width:1500,height:920}});pg.on('pageerror',x=>e.push(''+x));
await pg.goto('file:///D:/Stack Casino/stack-casino.html');await pg.waitForTimeout(500);await pg.click('#auSw');await pg.fill('#auU','f1');await pg.fill('#auP','p');await pg.fill('#auP2','p');await pg.click('#auGo');await pg.waitForTimeout(2500);await pg.evaluate('closeAll()');
await pg.evaluate("location.hash='#/play/dice'");await pg.waitForTimeout(900);await pg.click('#gFav');await pg.waitForTimeout(600);
console.log('fav',await pg.evaluate("JSON.stringify(X().favs)"),await pg.evaluate("JSON.parse(localStorage.getItem('stack-casino')).players[0].s2.favs"));
const b0=await pg.evaluate('P().bal');let clicked=0;for(let i=0;i<10&&!clicked;i++){const el=await pg.$('#mtrack .ob[data-x]:not([disabled])');if(el){await el.click();clicked=1}else await pg.waitForTimeout(500)}
await pg.waitForTimeout(500);console.log('micro placed',await pg.evaluate("MB.length"),b0,await pg.evaluate('P().bal'));
for(let i=0;i<90;i++){if(!(await pg.evaluate('MB.length')))break;await pg.waitForTimeout(1000)}
console.log('after',await pg.evaluate("JSON.stringify({mb:MB.map(b=>{const x=MICRO.find(z=>z.id===b.x);return x?{k:x.k,open:x.open,done:x.done,w:x.w0,w1:x.w1,min:(MATCHES.find(m=>m.id===x.mid)||{}).min}:'gone'}),bets:X().bets.length})"));console.log(e.join('\n')||'no errors');await b.close()})();
