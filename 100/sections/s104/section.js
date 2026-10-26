export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const TOTAL = 9000, PROFIT = 600, ARC = Math.PI * 150;
  const st = { A: 4000, B: 7500, rate: 5.2, years: 5 };
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const fill = el => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');

  // 오도미터 (만원, 소수 1자리: 값*10)
  const host = $('[data-odo]'); const cols = []; let dot;
  for (let i = 3; i >= 0; i--) {
    if (i === 0) { dot = document.createElement('span'); dot.className = 's104__sep'; dot.textContent = '.'; host.appendChild(dot); }
    const c = document.createElement('span'); c.className = 's104__col';
    const s = document.createElement('span'); s.className = 's104__strip';
    s.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<span>${d}</span>`).join('');
    c.appendChild(s); host.appendChild(c); cols[i] = { c, s };
  }
  function odo(v) {
    for (let i = 0; i < 4; i++) {
      const pos = i === 0 ? v % 10 : Math.floor(v / Math.pow(10, i)) % 10 + Math.max(0, (v / Math.pow(10, i - 1)) % 10 - 9);
      gsap.set(cols[i].s, { yPercent: -pos * 100 / 11 });
      cols[i].c.style.opacity = (v >= Math.pow(10, i) || i <= 1) ? 1 : 0;
    }
  }

  // 레이아웃: 핸들·구간
  const A = $('[data-h=a]'), B = $('[data-h=b]'), bar = $('[data-bar]');
  const sa = $('[data-sa]'), sb = $('[data-sb]'), sc = $('[data-sc]');
  function layout() {
    const a = st.A / TOTAL * 100, b = st.B / TOTAL * 100;
    sa.style.width = a + '%'; sb.style.width = (b - a) + '%'; sc.style.width = (100 - b) + '%';
    A.style.left = a + '%'; B.style.left = b + '%';
    $('[data-ta]').textContent = fmt(st.A); $('[data-tb]').textContent = fmt(st.B - st.A); $('[data-tc]').textContent = fmt(TOTAL - st.B);
    A.setAttribute('aria-valuenow', st.A); B.setAttribute('aria-valuenow', st.B);
  }
  // 계산 + 표시
  const D = { v: 0, fill: 0, loan: 0, intr: 0, tot: 0, ratio: 0 };
  const arc = $('[data-arc]'), needle = $('[data-needle]');
  const col = p => gsap.utils.interpolate(['#19b36b', '#19b36b', '#ffb020', '#ff4d4f'], Math.max(0, Math.min(1, p)));
  gsap.set(arc, { strokeDasharray: ARC + ' ' + ARC });
  gsap.set(needle, { svgOrigin: '200 210' });
  function paint() {
    odo(D.v);
    gsap.set(arc, { strokeDashoffset: ARC * (1 - D.fill) });
    gsap.set(needle, { rotation: -90 + 180 * D.fill });
    arc.style.stroke = col(D.fill);
    $('[data-burden]').textContent = `월 순이익(가정 ${PROFIT}만원) 대비 ${Math.round(D.ratio * 100)}%`;
    $('[data-sl]').textContent = fmt(D.loan) + '만원'; $('[data-si]').textContent = fmt(D.intr) + '만원'; $('[data-st]').textContent = fmt(D.tot) + '만원';
  }
  function calc(dur) {
    const L = Math.max(0, st.B - st.A), n = st.years * 12, r = st.rate / 100 / 12;
    const M = L === 0 ? 0 : L * r / (1 - Math.pow(1 + r, -n));
    const ratio = M / PROFIT;
    gsap.to(D, { v: M * 10, fill: Math.min(1, ratio / .5), loan: L, intr: M * n - L, tot: M * n, ratio, duration: dur, ease: 'expo.out', overwrite: true, onUpdate: paint });
  }
  const rateIn = $('[data-in=rate]');
  const chips = [...root.querySelectorAll('[data-y]')];
  function setYears(y) { st.years = y; chips.forEach(c => c.classList.toggle('is-on', +c.dataset.y === y)); }
  function setRate(r) { st.rate = r; rateIn.value = r; $('[data-rate]').textContent = r.toFixed(1) + '%'; fill(rateIn); }

  // 이중 핸들 드래그
  let dragging = null;
  const stopDemo = () => demo && demo.kill();
  const pos = e => { const r = bar.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * TOTAL / 100) * 100; };
  const downs = [A, B].map(h => {
    const f = e => { stopDemo(); dragging = h; h.setPointerCapture(e.pointerId); e.preventDefault(); };
    const mv = e => { if (dragging !== h) return; const v = pos(e); if (h === A) st.A = Math.min(v, st.B); else st.B = Math.max(v, st.A); layout(); calc(.7); };
    const up = () => { dragging = null; };
    const key = e => { const d = e.key === 'ArrowRight' ? 100 : e.key === 'ArrowLeft' ? -100 : 0; if (!d) return; stopDemo(); e.preventDefault(); if (h === A) st.A = Math.max(0, Math.min(st.B, st.A + d)); else st.B = Math.max(st.A, Math.min(TOTAL, st.B + d)); layout(); calc(.7); };
    h.addEventListener('pointerdown', f); h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('keydown', key);
    return () => { h.removeEventListener('pointerdown', f); h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('keydown', key); };
  });
  const onRate = () => { stopDemo(); setRate(+rateIn.value); calc(.7); };
  rateIn.addEventListener('input', onRate);
  const onChip = e => { const b = e.target.closest('[data-y]'); if (!b) return; stopDemo(); setYears(+b.dataset.y); calc(.8); };
  $('[data-chips]').addEventListener('click', onChip);

  layout(); setRate(st.rate); paint();

  // 데모 루프: 상태 사이를 보간
  let demo = null;
  const STEPS = [[2500, 8000, 6.8, 3], [5500, 8500, 4.4, 7], [3000, 6500, 7.6, 5], [4000, 7500, 5.2, 5]];
  function startDemo() {
    const P = { A: st.A, B: st.B, r: st.rate };
    demo = gsap.timeline({ repeat: -1 });
    STEPS.forEach(([a, b, r, y]) => {
      demo.call(() => setYears(y))
        .to(P, { A: a, B: b, r, duration: 2, ease: 'power3.inOut', onUpdate: () => {
          st.A = Math.round(P.A / 100) * 100; st.B = Math.max(st.A, Math.round(P.B / 100) * 100); setRate(Math.round(P.r * 10) / 10); layout(); calc(.6);
        } })
        .to({}, { duration: 1.6 });
    });
  }
  let intro = null;
  const trig = ScrollTrigger.create({ trigger: root, start: 'top 78%', once: true, onEnter: () => {
    calc(2);
    intro = gsap.from(root.querySelectorAll('.s104__seg, .s104__h'), { scaleY: 0, transformOrigin: '50% 100%', duration: 1.1, ease: 'expo.out', stagger: .1 });
    gsap.from(root.querySelectorAll('.s104__title,.s104__eyebrow'), { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .1 });
    gsap.delayedCall(2.6, startDemo);
  } });
  return () => { trig.kill(); demo && demo.kill(); intro && intro.kill(); gsap.killTweensOf(D); rateIn.removeEventListener('input', onRate); $('[data-chips]').removeEventListener('click', onChip); downs.forEach(f => f()); };
}
