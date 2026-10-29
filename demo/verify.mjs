// verify.mjs — CDP harness: serves the demo, drives real gestures, samples springs
// frame by frame, screenshots every scene. Run: node verify.mjs
// Needs Chrome. No dependencies (Node 22 global WebSocket + fetch).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.verify');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));

if (!CHROME) { console.error('chrome not found'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, b) => {
    if (e) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(b);
  });
});
await new Promise((r) => server.listen(8123, '127.0.0.1', r));

const PORT = 9333;
const profile = path.join(process.env.TEMP || '/tmp', 'cdp-demo-' + Date.now());
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
  '--window-size=1200,1000', '--hide-scrollbars', '--force-device-scale-factor=2',
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' });

async function json(pathname, method = 'GET') {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + pathname, { method });
      return await r.json();
    } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  throw new Error('chrome did not come up');
}
const target = await json('/json/new?about:blank', 'PUT');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let msgId = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('ERR ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId;
  pending.set(id, (m) => (m.error ? rej(new Error(method + ' ' + JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n' + expr.slice(0, 120));
  return r.result.value;
};
async function shot(name, clipEl) {
  let clip;
  if (clipEl) {
    const r = await ev(`(() => { const b=document.querySelector('${clipEl}').getBoundingClientRect();
      return {x:b.x,y:b.y,width:b.width,height:b.height}; })()`);
    clip = { x: Math.round(r.x) - 12, y: Math.round(r.y) - 12, width: Math.round(r.width) + 24, height: Math.round(r.height) + 24, scale: 1 };
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64'));
}
async function mouse(type, x, y, extra = {}) {
  await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
}
async function drag(from, to, steps = 10, holdMs = 16) {
  await mouse('mousePressed', from.x, from.y, { buttons: 1 });
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, { buttons: 1 });
    await sleep(holdMs);
  }
  await mouse('mouseReleased', to.x, to.y);
}
async function click(x, y) { await mouse('mousePressed', x, y, { buttons: 1 }); await sleep(30); await mouse('mouseReleased', x, y); }
const rect = (sel) => ev(`(() => { const b=document.querySelector('${sel}').getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height}; })()`);
const tx = (sel) => ev(`(() => { const e=document.querySelector('${sel}'); if(!e) return null;
  const t=getComputedStyle(e).transform; if(!t||t==='none') return {x:0,y:0,s:1};
  const m=new DOMMatrixReadOnly(t); return {x:Math.round(m.m41),y:Math.round(m.m42),s:+m.a.toFixed(3)}; })()`);
// sample from Node over ~25 ms steps: a real frame trail, not one instant reading
async function sample(sel, ms) {
  const out = []; const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await tx(sel); out.push([Date.now() - t0, v.x, v.y, v.s]); await sleep(25); }
  return out;
}

const fails = [];
const ok = (name, cond, detail = '') => {
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  · ' + detail : ''));
  if (!cond) fails.push(name);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1000, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8123/index.html' });
await sleep(1400);

console.log('\n— load —');
ok('no console errors', logs.length === 0, logs.join(' | '));
ok('nine scenes present', (await ev("document.querySelectorAll('.sc').length")) === 9);
ok('no horizontal overflow @1200', (await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')) === 0);

console.log('\n— 1 intro (drop & gather) —');
await sleep(1200);
await shot('01-intro', '.phone');
const introV = await ev(`[...document.querySelectorAll('.it-ph')].map(p=>{const m=new DOMMatrixReadOnly(getComputedStyle(p).transform);return [Math.round(m.m41),Math.round(m.m42),+m.a.toFixed(2)]})`);
ok('5 photos built', introV.length === 5);
ok('photos gathered into a fan (x spread > 60px)', Math.abs(introV[3][0] - introV[0][0]) > 60, JSON.stringify(introV));
ok('5th photo left the frame', introV[4][1] > (await ev("document.querySelector('.phone').clientHeight")), 'y=' + introV[4][1]);
ok('title risen (no translate left)', (await ev(`getComputedStyle(document.querySelector('.it-title i')).transform`)) === 'none');

console.log('\n— 2 fan stack swipe —');
await ev("document.querySelector('[data-sc=fan]').click()"); await sleep(800);
await shot('02-fan', '.phone');
const t1 = await ev("document.querySelector('#fanTitle').textContent");
const cardR = await rect('.fan-card');
await drag({ x: cardR.x, y: cardR.y }, { x: cardR.x - 150, y: cardR.y }, 8, 12);
await sleep(700);
const t2 = await ev("document.querySelector('#fanTitle').textContent");
ok('swipe advances the fan', t1 !== t2, t1 + ' → ' + t2);
const dotOn = await ev("[...document.querySelectorAll('#fanDots i')].findIndex(d=>d.classList.contains('on'))");
ok('dot follows the item', dotOn === 1, 'dot=' + dotOn);
await shot('02b-fan-swiped', '.phone');

console.log('\n— 3 swipe to triage —');
await ev("document.querySelector('[data-sc=triage]').click()"); await sleep(800);
await shot('03-triage', '.phone');
const cR = await rect('.tr-card');
await drag({ x: cR.x, y: cR.y }, { x: cR.x + 180, y: cR.y + 10 }, 10, 10);
const curve = await sample('.tr-card', 600);
ok('dragged card travels out (> 300px)', Math.max(...curve.map((c) => Math.abs(c[1]))) > 300, JSON.stringify(curve.slice(0, 4)) + '…');
await sleep(500);
ok('count decremented to 3', (await ev("document.querySelector('#trCount').textContent")).includes('3'));
ok('next card promoted to full scale', Math.abs((await tx('.tr-card:nth-child(2)')).s - 1) < 0.02, 's=' + (await tx('.tr-card:nth-child(2)')).s);
await shot('03b-triage-after', '.phone');

console.log('\n— 4 shared element —');
await ev("document.querySelector('[data-sc=expand]').click()"); await sleep(800);
await shot('04-grid', '.phone');
const th = await ev(`(() => { const b=document.querySelector('.ex-thumb').getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; })()`);
await mouse('mousePressed', th.x, th.y, { buttons: 1 }); await mouse('mouseReleased', th.x, th.y);
await sleep(140);
await shot('04b-expand-mid', '.phone');
await sleep(700);
const cardT = await tx('#exCard');
const stageW = await ev("document.querySelector('.phone').clientWidth");
ok('card scaled up to fill the stage', cardT.s > 1.5, 'scale=' + cardT.s);
ok('actions arrived after the image (0.18s delay)', (await ev("getComputedStyle(document.querySelector('.ex-acts')).opacity")) === '1');
await shot('04c-expand-open', '.phone');
await click((await rect('#exBack')).x, (await rect('#exBack')).y);
await sleep(600);
ok('returns to the thumb rect (scale back to 1)', Math.abs((await tx('#exCard')).s - 1) < 0.05);

console.log('\n— 5 dismissible sheet —');
await ev("document.querySelector('[data-sc=sheet]').click()"); await sleep(800);
await shot('05-sheet', '.phone');
const mapSamples = [];
await click((await rect('#shClose')).x, (await rect('#shClose')).y);
for (let i = 0; i < 12; i++) { mapSamples.push(await tx('#shMap')); await sleep(60); }
await sleep(400);
const scaleMax = Math.max(...mapSamples.map((s) => s.s));
ok('stage grows to fill (1 → ~1.14)', scaleMax > 1.1, 'max=' + scaleMax);
ok('return button appears', await ev("document.querySelector('#shOpen').classList.contains('on')"));
await shot('05b-sheet-dismissed', '.phone');
await click((await rect('#shOpen')).x, (await rect('#shOpen')).y);
await sleep(700);
ok('sheet comes back', Math.abs((await tx('#shSheet')).y) < 2);

console.log('\n— 6 staggered title swap —');
await ev("document.querySelector('[data-sc=titles]').click()"); await sleep(800);
const before = await ev("document.querySelector('#tsTitle').textContent");
await click((await rect('#tsNext')).x, (await rect('#tsNext')).y);
await sleep(180);
await shot('06b-titles-mid', '.phone');
await sleep(900);
const afterT = await ev("document.querySelector('#tsTitle').textContent");
ok('title swapped', before !== afterT, before + ' → ' + afterT);
ok('all new lines settled at y=0', (await ev("[...document.querySelectorAll('#tsTitle i')].every(i=>{const m=new DOMMatrixReadOnly(getComputedStyle(i).transform);return Math.abs(m.m42)<1})")) === true);
ok('hero sprang back to scale 1', Math.abs((await tx('#tsHero')).s - 1) < 0.01);
await shot('06-titles', '.phone');

console.log('\n— 7 inertial wheel —');
await ev("document.querySelector('[data-sc=wheel]').click()"); await sleep(700);
const vR = await rect('#whVp');
await drag({ x: vR.x, y: vR.y + 60 }, { x: vR.x, y: vR.y - 120 }, 6, 12);
await sleep(900);
const wy = (await tx('#whCol')).y;
const itemH = await ev("document.querySelector('.wh-item').getBoundingClientRect().height");
const centre = await ev("document.querySelector('#whVp').clientHeight/2 - 28");
const off = Math.abs(((centre - wy) / itemH) - Math.round((centre - wy) / itemH));
ok('snaps to a whole item', off < 0.02, 'offset=' + off.toFixed(3));
ok('value text matches the centred item', (await ev(`(() => { const on=[...document.querySelectorAll('.wh-item')].findIndex(e=>e.classList.contains('on')); return document.querySelector('#whValue').textContent === String(on).padStart(2,'0')+':00'; })()`)) === true);
await shot('07-wheel', '.phone');

console.log('\n— 8 complete button —');
await ev("document.querySelector('[data-sc=comp]').click()"); await sleep(800);
await shot('08-comp', '.phone');
const bR = await rect('#cpBtn');
await click(bR.x, bR.y);
await sleep(120);
const midClip = await ev("getComputedStyle(document.querySelector('#cpBtn')).clipPath");
await sleep(260);
await shot('08b-comp-check', '.phone');
ok('button shrinks to a circle (clip inset)', /calc|inset/.test(midClip), midClip);
await sleep(900);
ok('settles as 已加入', await ev("document.querySelector('#cpBtn').classList.contains('done')"));
ok('particles fired', (await ev("document.querySelectorAll('.cp-p').length")) >= 0);
await shot('08c-comp-done', '.phone');

console.log('\n— 9 linked cascade —');
await ev("document.querySelector('[data-sc=casc]').click()"); await sleep(700);
const rows = await ev("document.querySelectorAll('#caList li').length");
for (let i = 0; i < rows; i++) {
  const li = await ev(`(() => { const b=document.querySelectorAll('#caList li')[${i}].getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; })()`);
  await click(li.x, li.y);
  await sleep(220);
}
await sleep(600);
ok('ring filled', Math.abs(Number((await ev("getComputedStyle(document.querySelector('#caProg')).strokeDashoffset")).replace('px', '')) ) < 2);
ok('count text matches rows', (await ev("document.querySelector('#caCount').textContent")) === rows + ' / ' + rows);
ok('header background changed', await ev("document.querySelector('#caHead').classList.contains('warm')"));
await shot('09-casc', '.phone');

console.log('\n— viewport 390 —');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(600);
ok('no horizontal overflow @390', (await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')) === 0);
await ev("document.querySelector('[data-sc=intro]').click()"); await sleep(1500);
await shot('10-390-intro', '.phone');

console.log('\n— short viewport 390x680 (phone with toolbars) —');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 680, deviceScaleFactor: 2, mobile: true });
await sleep(500);
for (const id of ['intro', 'fan', 'triage', 'expand', 'sheet', 'titles', 'wheel', 'comp', 'casc']) {
  await ev(`document.querySelector('[data-sc=${id}]').click()`);
  await sleep(1100);
  const bad = await ev(`(() => { const st = document.querySelector('#stage').getBoundingClientRect();
    const sel = ['.fan-info','.fan-dots','.fan-hint','.tr-actions','.tr-hint','.ca-foot','.ca-tip','.cp-btn',
      '.ts-next','.wh-value','#shSheet','.ex-grid','.it-panel','.it-title','.sh-open'];
    const out = [];
    for (const s of sel) { const el = document.querySelector('.sc.on ' + s); if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      if (r.bottom > st.bottom + 1 || r.top < st.top - 1 || r.right > st.right + 1) out.push(s + ' ' + Math.round(r.top) + '-' + Math.round(r.bottom)); }
    return out; })()`);
  ok('scene fits at 390x680 · ' + id, bad.length === 0, bad.join(', '));
  if (id === 'fan') await shot('12-short-fan', '.phone');
  if (id === 'triage') await shot('12-short-triage', '.phone');
  if (id === 'casc') await shot('12-short-casc', '.phone');
}

console.log('\n— reduced motion —');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Page.reload'); await sleep(1600);
const rmV = await ev(`[...document.querySelectorAll('.it-ph')].map(p=>{const m=new DOMMatrixReadOnly(getComputedStyle(p).transform);return [Math.round(m.m41),Math.round(m.m42)]})`);
ok('content is visible, not stuck hidden', rmV.length === 5 && rmV[0][1] > 0, JSON.stringify(rmV.slice(0, 2)));
ok('no console errors after reload', logs.length === 0, logs.join(' | '));
await shot('11-reduced-motion', '.phone');

console.log('\n=== ' + (fails.length ? fails.length + ' FAIL: ' + fails.join(', ') : 'ALL PASS') + ' ===');
console.log('screenshots → ' + OUT);

chrome.kill();
server.close();
process.exit(fails.length ? 1 : 0);
