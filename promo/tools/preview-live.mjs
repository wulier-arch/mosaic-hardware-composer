/** 实拍版预览：渲染指定帧为 PNG */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE=dirname(fileURLToPath(import.meta.url)), ROOT=resolve(HERE,'..');
const SHELL='/Users/yedapeng/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const PORT=9355, OUT=resolve(ROOT,'preview-live');
mkdirSync(OUT,{recursive:true});
const chrome=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--hide-scrollbars','--force-color-profile=srgb','--allow-file-access-from-files',`--remote-debugging-port=${PORT}`,'--user-data-dir=/tmp/mosaic-prevlive','about:blank'],{stdio:'ignore'});
for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/version`);if(r.ok)break;}catch{}await sleep(250);}
const t=await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(ok=>ws.addEventListener('open',ok,{once:true}));
let id=0;const pend=new Map();const errs=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
 if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
 if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errs.push(m.params.entry.text);});
const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{resolve:res,reject:rej});ws.send(JSON.stringify({id:i,method:m,params:p}));});
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'file://'+resolve(ROOT,'compose-live/index.html')});
for(let i=0;i<60;i++){const r=await send('Runtime.evaluate',{expression:'window.__ready===true',returnByValue:true}).catch(()=>({result:{}})); if(r.result.value)break; await sleep(400);}
console.log('就绪');
const frames=(process.argv.slice(2).map(Number).filter(n=>!isNaN(n)));
const list=frames.length?frames:[30,120,240,300,370,420,470,540,640,720,800,870,890];
for(const f of list){
  await send('Runtime.evaluate',{expression:`window.seek(${f})`,awaitPromise:true});
  await sleep(160);
  const r=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1920,height:1080,scale:1}});
  const buf=Buffer.from(r.data,'base64');
  writeFileSync(`${OUT}/f${String(f).padStart(4,'0')}.png`,buf);
  console.log(`  帧 ${String(f).padStart(4)} (t=${(f/30).toFixed(2)}s)  ${Math.round(buf.length/1024)}KB`);
}
console.log(errs.length?('错误: '+[...new Set(errs)].slice(0,5).join(' | ')):'无控制台错误');
chrome.kill(); process.exit(0);
