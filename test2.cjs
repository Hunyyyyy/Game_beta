const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:400,height:850},colorScheme:'dark',deviceScaleFactor:2,hasTouch:true});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('file://'+process.cwd()+'/dist/index.html');await pg.waitForTimeout(600);
await pg.click('#btnAll');await pg.click('[data-mode="move"]');
const bb=await pg.locator('#view').boundingBox();
await pg.mouse.click(bb.x+bb.width*0.3,bb.y+bb.height*0.2);
await pg.waitForTimeout(2500);
await pg.screenshot({path:'m1.png'});
// wheel zoom + pan keys on desktop
const p2=await b.newPage({viewport:{width:1200,height:900}});p2.on('pageerror',e=>errs.push(e.message));
await p2.goto('file://'+process.cwd()+'/dist/index.html');await p2.waitForTimeout(400);
const v=await p2.locator('#view').boundingBox();await p2.mouse.move(v.x+300,v.y+300);await p2.mouse.wheel(0,-300);await p2.waitForTimeout(200);
await p2.keyboard.down('d');await p2.waitForTimeout(500);await p2.keyboard.up('d');
console.log(await p2.evaluate(()=>({z:__game.cam.zoom,x:Math.round(__game.cam.x)})));
console.log('errors',errs);await b.close();})();
