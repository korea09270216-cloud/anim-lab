export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const sl = q('.s125__slider'), track = q('.s125__track'), fill = q('.s125__fill'), blob = q('.s125__blob'), path = blob.querySelector('path');
  const szn = q('.s125__szn'), seat = q('.s125__seat'), tg = q('.s125__tg'), knob = q('.s125__knob'), unit = q('.s125__unit');
  const roll = q('.s125__roll'), cb = q('.s125__cb'), bg = q('.s125__bg'), ck = q('.s125__ck'), cta = q('.s125__cta');
  const MIN = 10, MAX = 40;
  let val = 24, year = false, drag = false, user = false, vis = false, lastN = '';

  // ── 숫자 롤링 (10칸: 8자리 + 콤마 2)
  const TPL = 'dd,ddd,ddd'.split('');
  const slots = TPL.map(t => {
    const s = document.createElement('span'); s.className = 's' + (t === ',' ? ' c' : '');
    if (t === 'd') { const c = document.createElement('span'); c.className = 'col'; for (let i = 0; i < 10; i++) c.insertAdjacentHTML('beforeend', `<i>${i}</i>`); s.appendChild(c); s._c = c; }
    else s.textContent = ',';
    roll.appendChild(s); return s;
  });
  roll.insertAdjacentHTML('beforeend', '<span class="won">원</span>');
  const W = { d: .58, c: .28 };
  function price() { const m = 380000 + val * 21000; return year ? Math.round(m * 12 * .9 / 1000) * 1000 : m; }
  function setNum(n, instant) {
    const str = String(n).padStart(8, '0'); let cnt = 0;
    const digitIdx = slots.map(s => s._c ? cnt++ : -1);
    const firstDigit = str.search(/[1-9]/);
    slots.forEach((s, i) => {
      if (s._c) {
        const d = +str[digitIdx[i]], show = digitIdx[i] >= firstDigit;
        gsap.to(s._c, { yPercent: -d * 10, duration: instant ? 0 : 1, ease: 'expo.out', delay: instant ? 0 : (9 - i) * .03, overwrite: 'auto' });
        gsap.to(s, { width: show ? W.d + 'em' : '0em', opacity: show ? 1 : 0, duration: instant ? 0 : .5, ease: 'power3.out', overwrite: 'auto' });
      } else {
        const show = digitIdx[i - 1] >= firstDigit;
        gsap.to(s, { width: show ? W.c + 'em' : '0em', opacity: show ? 1 : 0, duration: instant ? 0 : .5, ease: 'power3.out', overwrite: 'auto' });
      }
    });
  }
  function refresh(instant) {
    szn.textContent = val; seat.textContent = Math.round(val * 1.8);
    sl.setAttribute('aria-valuenow', val);
    const n = price(); if (String(n) !== lastN) { lastN = String(n); setNum(n, instant); }
  }

  // ── 액체 핸들: lead(포인터) + lag(탄성 스프링) 사이를 허리 잘록한 알약으로 이음
  let tw = 0, lead = 0, lag = 0, lv = 0, target = 0, hold = 0;
  const frac = () => (val - MIN) / (MAX - MIN);
  const measure = () => { tw = track.offsetWidth; const pad = track.offsetLeft; blob.setAttribute('viewBox', `0 0 ${sl.offsetWidth} ${sl.offsetHeight}`); return pad; };
  let pad = measure();
  const cy = () => track.offsetTop + track.offsetHeight / 2;
  const posOf = f => pad + f * tw;
  lead = lag = target = posOf(frac());
  const draw = (t) => {
    const R0 = 15 + hold * 7 + Math.sin(t * 2.2) * .8;
    const d = Math.abs(lead - lag), xa = Math.min(lead, lag), xb = Math.max(lead, lag);
    const r = R0 * (1 - Math.min(.16, d / 500)), w = r * Math.max(.38, 1 - d / 120), m = (xa + xb) / 2, y = cy();
    path.setAttribute('d', `M${xa},${y - r}Q${m},${y - w} ${xb},${y - r}A${r},${r} 0 0 1 ${xb},${y + r}Q${m},${y + w} ${xa},${y + r}A${r},${r} 0 0 1 ${xa},${y - r}Z`);
    fill.style.transform = `scaleX(${Math.max(0, (lead - pad) / tw)})`;
  };
  const off = ctx.tick((t, dt) => {
    if (!vis) return;
    const d = Math.min(dt, 50) / 1000;
    lead += (target - lead) * Math.min(1, d * 22);
    const a = (lead - lag) * 160 - lv * 9;
    lv += a * d; lag += lv * d;
    draw(performance.now() / 1000);
  });
  function setFrac(f, fromUser) {
    f = Math.max(0, Math.min(1, f)); target = posOf(f);
    const v = Math.round(MIN + f * (MAX - MIN)); if (v !== val) { val = v; refresh(); }
  }
  const fx = e => { const r = track.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  const stop = () => { if (user) return; user = true; demo.kill(); };
  const down = e => { stop(); drag = true; sl.setPointerCapture && sl.setPointerCapture(e.pointerId); gsap.to({}, { duration: .35, onUpdate() { hold = this.progress(); } }); setFrac(fx(e), true); };
  const move = e => { if (drag) setFrac(fx(e), true); };
  const up = () => { if (!drag) return; drag = false; const o = { h: hold }; gsap.to(o, { h: 0, duration: .8, ease: 'power2.out', onUpdate: () => { hold = o.h; } }); };
  sl.addEventListener('pointerdown', down); sl.addEventListener('pointermove', move); sl.addEventListener('pointerup', up); sl.addEventListener('pointercancel', up);
  const key = e => { const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (!k) return; e.preventDefault(); stop(); setFrac((val + k - MIN) / (MAX - MIN)); };
  sl.addEventListener('keydown', key);
  const onRs = () => { pad = measure(); lead = lag = target = posOf(frac()); };
  window.addEventListener('resize', onRs);

  // ── 월/연 액체 토글
  const mEl = q('.s125__tl--m'), yEl = q('.s125__tl--y');
  const kPos = () => year ? yEl.offsetLeft : mEl.offsetLeft, kW = () => (year ? yEl : mEl).offsetWidth;
  gsap.set(knob, { left: 0, x: mEl.offsetLeft, width: mEl.offsetWidth });
  function setPlan(y, instant) {
    if (year === y && !instant) return; year = y;
    tg.setAttribute('aria-checked', y); unit.textContent = y ? '/ 연' : '/ 월';
    const tl = gsap.timeline();
    tl.to(knob, { x: kPos(), width: kW(), duration: instant ? 0 : .9, ease: 'elastic.out(1,.55)' }, 0)
      .fromTo(knob, { scaleX: 1, scaleY: 1 }, { keyframes: [{ scaleX: 1.22, scaleY: .82, duration: .18, ease: 'power2.out' }, { scaleX: 1, scaleY: 1, duration: .7, ease: 'elastic.out(1,.4)' }] }, 0);
    refresh();
  }
  const onTg = () => { stop(); setPlan(!year); };
  tg.addEventListener('click', onTg);

  // ── 동의 체크 모프
  gsap.set(ck, { drawSVG: '0%' });
  function setAgree(on) {
    if (cb.checked !== on) cb.checked = on;
    gsap.to(bg, { fill: on ? '#ff5a36' : '#f2d7cb', stroke: on ? '#ff5a36' : '#d9b6aa', duration: .35, overwrite: 'auto' });
    if (on) { gsap.fromTo(bg, { scale: .78 }, { scale: 1, duration: .9, ease: 'elastic.out(1,.4)' }); gsap.to(ck, { drawSVG: '100%', duration: .45, ease: 'power3.out', delay: .1 }); }
    else gsap.to(ck, { drawSVG: '0%', duration: .2, ease: 'power2.in' });
    cta.classList.toggle('on', on);
  }
  const onCb = () => { stop(); setAgree(cb.checked); };
  cb.addEventListener('change', onCb);

  refresh(true); draw(0);

  // ── 자동 데모
  const dm = { f: frac() };
  const sweep = (tl, f, dur) => tl.to(dm, { f, duration: dur, ease: 'power3.inOut', onUpdate: () => setFrac(dm.f) });
  const demo = gsap.timeline({ repeat: -1, paused: true });
  demo.call(() => { setPlan(false); setAgree(false); dm.f = frac(); });
  sweep(demo, 0.85, 1.6); demo.to({}, { duration: .5 });
  sweep(demo, 0.1, 1.8); demo.to({}, { duration: .4 });
  demo.call(() => setPlan(true));
  demo.to({}, { duration: 1.2 });
  sweep(demo, 0.5, 1.4);
  demo.call(() => setAgree(true)).to({}, { duration: 2 });
  demo.call(() => { setAgree(false); setPlan(false); }).to({}, { duration: 1.2 });
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; if (!user) demo.paused(!vis); }, { threshold: .2 });
  io.observe(root);
  return () => { io.disconnect(); off(); demo.kill(); sl.removeEventListener('pointerdown', down); sl.removeEventListener('pointermove', move); sl.removeEventListener('pointerup', up); sl.removeEventListener('pointercancel', up); sl.removeEventListener('keydown', key); window.removeEventListener('resize', onRs); tg.removeEventListener('click', onTg); cb.removeEventListener('change', onCb); gsap.killTweensOf([knob, bg, ck, ...slots, ...slots.map(s => s._c).filter(Boolean)]); };
}
