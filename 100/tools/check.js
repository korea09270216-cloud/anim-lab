// 사용: node C:/Users/H/Desktop/anim-lab/100/tools/check.js 011 012 ...   (서버 http://localhost:8090 가 떠 있어야 함)
// 섹션마다: 마운트 성공 · 콘솔/페이지 에러 · 가로 오버플로 · 높이 · 모션 유무(시간/스크롤 픽셀 변화) 를 재고 스크린샷을 shots/ 에 남긴다.
const R = 'C:/Users/H/Desktop/갱상도/node_modules/';
const { chromium } = require(R + 'playwright');
const sharp = require(R + 'sharp');
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'shots');
const BASE = 'http://localhost:8090/100/view.html?s=';

async function tiny(buf) { return sharp(buf).resize(160, 90, { fit: 'fill' }).greyscale().raw().toBuffer(); }
function diff(a, b) { let c = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 12) c++; return +(c / a.length * 100).toFixed(2); }

async function wheelTo(p, y) {
  const cur = await p.evaluate(() => scrollY);
  const steps = Math.max(8, Math.min(40, Math.abs(y - cur) / 120 | 0));
  for (let k = 0; k < steps; k++) { await p.mouse.wheel(0, (y - cur) / steps); await p.waitForTimeout(35); }
  await p.waitForTimeout(1400);
}

async function one(browser, id) {
  const out = { id, ok: true, errors: [], warn: [] };
  const p = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  p.on('console', m => { if (m.type() === 'error') out.errors.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => out.errors.push('PAGEERR ' + e.message.slice(0, 200)));
  try {
    await p.goto(BASE + id, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__mounted || window.__mountError, null, { timeout: 15000 });
    if (await p.evaluate(() => window.__mountError)) { out.ok = false; out.errors.push(await p.evaluate(() => window.__mountError)); throw 0; }
    await p.waitForTimeout(800);
    const g = await p.evaluate(() => {
      const r = document.querySelector('[data-sec]'); const b = r.getBoundingClientRect();
      return { top: b.top + scrollY, h: b.height, ow: document.documentElement.scrollWidth - innerWidth, vh: innerHeight };
    });
    out.h = Math.round(g.h); out.ow = g.ow;
    if (g.h < 400) { out.ok = false; out.errors.push(`section 높이 ${Math.round(g.h)}px < 400`); }
    if (g.ow > 2) out.warn.push(`가로 오버플로 +${g.ow}px`);

    await wheelTo(p, Math.max(0, g.top - 20));
    await p.mouse.move(500, 300); await p.mouse.move(900, 450, { steps: 12 });
    await p.waitForTimeout(500);
    const A = await p.screenshot({ type: 'jpeg', quality: 72 });
    await p.mouse.move(300, 500, { steps: 12 }); await p.mouse.move(1000, 250, { steps: 12 });
    await p.waitForTimeout(700);
    const A2 = await p.screenshot({ type: 'jpeg', quality: 60 });
    const span = Math.max(0, g.h - g.vh);
    await wheelTo(p, g.top + span * .5 + (span ? 0 : 200));
    const B = await p.screenshot({ type: 'jpeg', quality: 72 });
    require('fs').writeFileSync(path.join(SHOTS, `s${id}_a.jpg`), A);
    require('fs').writeFileSync(path.join(SHOTS, `s${id}_b.jpg`), B);
    const [ta, ta2, tb] = await Promise.all([tiny(A), tiny(A2), tiny(B)]);
    out.motion = { time: diff(ta, ta2), scroll: diff(ta, tb) };
    if (out.motion.time < .3 && out.motion.scroll < 2) { out.ok = false; out.errors.push('죽은 섹션: 시간/마우스/스크롤 어느 쪽에도 화면 변화가 거의 없음'); }
  } catch (e) { if (e) { out.ok = false; out.errors.push(String(e.message || e).slice(0, 200)); } }
  if (out.errors.length) out.ok = false;
  await p.close();
  return out;
}

// CPU 보호: 전역 락(동시에 크로미움 1개만) + 낮은 프로세스 우선순위(자식 크로미움이 상속)
const fs = require('fs'), os = require('os');
const LOCK = path.join(__dirname, '.lock');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function acquire() {
  const t0 = Date.now();
  for (;;) {
    try { fs.mkdirSync(LOCK); return; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 120000) fs.rmdirSync(LOCK); } catch {}
      if (Date.now() - t0 > 900000) throw new Error('락 대기 15분 초과');
      await sleep(1500 + Math.random() * 1500);
    }
  }
}
const release = () => { try { fs.rmdirSync(LOCK); } catch {} };
process.on('exit', release);
process.on('SIGINT', () => process.exit(130));
try { os.setPriority(os.constants.priority.PRIORITY_LOW); } catch {}

(async () => {
  const ids = process.argv.slice(2).map(s => s.replace(/^s/, '').padStart(3, '0'));
  let bad = 0;
  for (const id of ids) {
    await acquire();
    let r, browser;
    try {
      browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
      r = await one(browser, id);
    } finally { if (browser) await browser.close(); release(); }
    if (!r.ok) bad++;
    console.log((r.ok ? 'PASS ' : 'FAIL ') + JSON.stringify(r));
  }
  console.log(`done ${ids.length - bad}/${ids.length} pass`);
  process.exit(bad ? 1 : 0);
})();
