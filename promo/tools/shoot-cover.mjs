/** 封面截图：按给定尺寸渲染 cover/index.html 并截图 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
const SHELL='/Users/yedapeng/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const PORT=9352, OUT='/tmp/mosaic-video/cover/out';
mkdirSync(OUT,{recursive:true});
const JOBS=[
  {size:'1920x1080', name:'cover-16x9-1920', scale:1},
  {size:'1280x720',  name:'cover-16x9-1280', scale:1},
  {size:'1080x1440', name:'cover-3x4-1080',  scale:1},
  {size:'1080x1920', name:'cover-9x16-1080', scale:1},
];
const chrome=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--hide-scrollbars',
  '--force-color-profile=srgb','--allow-file-access-from-files',`--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/mosaic-cover-profile','about:blank'],{stdio:'ignore'});
for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/version`);if(r.ok)break;}catch{}await sleep(250);}
const t=await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(ok=>ws.addEventListener('open',ok,{once:true}));
let id=0; const pend=new Map(); const errs=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);return;}
  if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{resolve:res,reject:rej});ws.send(JSON.stringify({id:i,method:m,params:p}));});
await send('Runtime.enable'); await send('Page.enable');
let nav = 0;
for(const j of JOBS){
  const [w,h]=j.size.split('x').map(Number);
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
  // 关键：hash 变化不会触发页面重载，必须换查询参数强制真实导航
  await send('Page.navigate',{url:`file:///tmp/mosaic-video/cover/index.html?v=${++nav}#${j.size}`});
  let ok=false;
  for(let i=0;i<50;i++){const r=await send('Runtime.evaluate',{expression:'window.__ready===true',returnByValue:true}).catch(()=>({result:{}})); if(r.result.value){ok=true;break;} await sleep(300);}
  await sleep(500);
  const r=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:w,height:h,scale:j.scale}});
  const buf=Buffer.from(r.data,'base64');
  writeFileSync(`${OUT}/${j.name}.png`,buf);
  console.log(`${j.name}.png  ${w}×${h}  ${Math.round(buf.length/1024)}KB  ready=${ok}`);
}
if(errs.length) console.log('错误:',[...new Set(errs)].slice(0,5).join(' | ')); else console.log('无控制台错误');
chrome.kill(); process.exit(0);
