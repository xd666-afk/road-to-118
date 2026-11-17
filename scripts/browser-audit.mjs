import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
const output=await build({entryPoints:['src/game/engine.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {Engine,createState}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const baseURL=process.env.AUDIT_URL || 'http://127.0.0.1:5173/';
mkdirSync('artifacts',{recursive:true});
const report={browser:'Microsoft Edge / Chromium',realMobileDevice:false,errors:[],responses:[],viewports:[],performance:null};
try {
  const fresh=createState(491); fresh.reactors[0].discoveryHazard=100;
  const context=await browser.newContext({viewport:{width:1440,height:1080}});
  await context.addInitScript(text=>localStorage.setItem('road-to-118.save.v1',text),JSON.stringify(fresh));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.responses.push({url:r.url(),status:r.status()});});
  await page.goto(baseURL);await page.waitForTimeout(700);
  await page.screenshot({path:'artifacts/desktop-laboratory.png',fullPage:true});
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'周期表'}).click();
  await page.screenshot({path:'artifacts/desktop-periodic-table.png',fullPage:true});
  await page.locator('[data-z="1"]').click();await page.screenshot({path:'artifacts/hydrogen-card.png'});await page.keyboard.press('Escape');
  for(const width of [360,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    for(const tab of ['实验室','周期表','科研与工业','成就','统计']) {
      await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:tab,exact:true}).click();
      const size=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));
      report.viewports.push({width,tab,...size,overflow:size.content>size.viewport});
    }
  }
  await context.close();
  const e=new Engine(createState(542));e.state.coins=e.state.coins.plus('1e8');e.state.data=e.state.data.plus('1e8');
  for(let z=2;z<=10;z++){e.target(1,z);e.state.reactors[0].discoveryHazard=0;e.step(.1);}
  e.build(2);e.build(3);for(const key of ['feed','reaction','allocation'])e.research(key);
  e.state.automation.feed=false;e.state.automation.allocation=false;e.state.notices=[];e.state.savedAt=Date.now();
  for(const r of e.state.reactors){r.upgrades.atoms=80;r.upgrades.speed=4;r.target=10;r.exploring=false;}
  const advanced=await browser.newContext({viewport:{width:1440,height:1080}});
  await advanced.addInitScript(text=>localStorage.setItem('road-to-118.save.v1',text),JSON.stringify(e.state));
  const advancedPage=await advanced.newPage();advancedPage.on('pageerror',e=>report.errors.push(e.message));
  await advancedPage.goto(baseURL);await advancedPage.getByRole('button',{name:/III 先进核反应装置/}).click();
  await advancedPage.screenshot({path:'artifacts/advanced-laboratory.png',fullPage:true});
  await advancedPage.setViewportSize({width:390,height:844});
  const cdp=await advanced.newCDPSession(advancedPage);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  report.performance=await advancedPage.evaluate(async()=>{
    const longs=[];const observer=new PerformanceObserver(list=>longs.push(...list.getEntries().map(e=>e.duration)));observer.observe({entryTypes:['longtask']});
    const frames=[];let previous=performance.now();for(let i=0;i<180;i++)await new Promise(resolve=>requestAnimationFrame(now=>{frames.push(now-previous);previous=now;resolve();}));observer.disconnect();
    frames.sort((a,b)=>a-b);return{cpuSlowdown:4,renderedParticles:60,samples:frames.length,frameP50ms:+frames[90].toFixed(2),frameP90ms:+frames[162].toFixed(2),longTaskCount:longs.length,maxLongTaskMs:longs.length?+Math.max(...longs).toFixed(2):0};
  });
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  await advancedPage.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'周期表'}).click();await advancedPage.locator('[data-z="10"]').click();
  await advancedPage.screenshot({path:'artifacts/neon-card-mobile.png'});
  await advanced.close();
} finally {await browser.close();}
writeFileSync('artifacts/browser-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(report.errors.length||report.responses.length||report.viewports.some(v=>v.overflow))process.exitCode=1;
