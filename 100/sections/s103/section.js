export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const R = 140, C = 2 * Math.PI * R, GAP = 5;
  const input = $('[data-in]');
  const fill = el => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
  // 가상 손익 모델 (만원/월)
  const PARTS = [
    { n: '원재료비', c: '#f08c00', f: s => s * .33 },
    { n: '인건비', c: '#1971c2', f: s => 700 + s * .08 },
    { n: '임대료', c: '#7048e8', f: () => 440 },
    { n: '로열티', c: '#0c8f6d', f: s => s * .05 },
    { n: '기타 운영비', c: '#868e96', f: () => 250 },
  ];
  const PROFIT = { n: '순이익', c: '#e8486a' };
  function model(s) {
    const a = PARTS.map(p => p.f(s)); const profit = s - a.reduce((x, y) => x + y, 0);
    return [...a, profit];
  }
  const NAMES = [...PARTS.map(p => p.n), PROFIT.n], COLORS = [...PARTS.map(p => p.c), PROFIT.c];
  const N = NAMES.length;

  const slicesG = $('[data-slices]'), legend = $('[data-legend]');
  const circles = [], lis = [], amts = [], pcts = [];
  NAMES.forEach((n, i) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', 200); c.setAttribute('cy', 200); c.setAttribute('r', R); c.setAttribute('fill', 'none');
    c.setAttribute('stroke', COLORS[i]); c.setAttribute('stroke-width', 56); c.setAttribute('data-slice', i);
    slicesG.appendChild(c); circles.push(c);
    const li = document.createElement('li'); li.style.setProperty('--c', COLORS[i]);
    li.innerHTML = `<i></i><span>${n}</span><b>0만원</b><em>0%</em>`; legend.appendChild(li); lis.push(li);
    amts.push(li.querySelector('b')); pcts.push(li.querySelector('em'));
    [c, li].forEach(el => { el.addEventListener('pointerenter', () => hover(i)); el.addEventListener('pointerleave', () => hover(-1)); });
  });

  const S = { sales: 4000, p0: 0, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 };   // p* = 조각별 그리기 진행도
  const V = { v0: 0, v1: 0, v2: 0, v3: 0, v4: 0, v5: 0 };               // 조각별 금액
  const prog = [0, 0, 0, 0, 0, 0];
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  function render() {
    // V.v* 는 tween 중 금액, 합이 곧 매출
    const arr = [V.v0, V.v1, V.v2, V.v3, V.v4, V.v5]; const tot = arr.reduce((a, b) => a + Math.max(b, 0), 0) || 1;
    let acc = 0;
    arr.forEach((v, i) => {
      const f = Math.max(v, 0) / tot, len = Math.max(0, f * C - GAP) * (S['p' + i] || 0);
      circles[i].setAttribute('stroke-dasharray', `${len} ${C}`);
      circles[i].setAttribute('stroke-dashoffset', -(acc * C + GAP / 2));
      acc += f;
      amts[i].textContent = fmt(v) + '만원'; pcts[i].textContent = (f * 100).toFixed(1) + '%';
    });
    if (hl < 0) setCenter(5, false);
    else setCenter(hl, false);
  }
  const cl = $('[data-cl]'), cn = $('[data-cn]'), cp = $('[data-cp]');
  function setCenter(i, anim) {
    const arr = [V.v0, V.v1, V.v2, V.v3, V.v4, V.v5]; const tot = arr.reduce((a, b) => a + Math.max(b, 0), 0) || 1;
    const t = `${fmt(arr[i])}<small>만원</small>`;
    if (cl.textContent !== (i === 5 ? '월 순이익' : NAMES[i])) cl.textContent = i === 5 ? '월 순이익' : NAMES[i];
    cn.innerHTML = t; cp.textContent = `매출의 ${(Math.max(arr[i], 0) / tot * 100).toFixed(1)}%`;
    cn.style.color = i === 5 ? '#d6336c' : COLORS[i];
    if (anim) gsap.fromTo([cl, cn, cp], { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .6, ease: 'expo.out', stagger: .04, overwrite: true });
  }
  let hl = -1;
  function hover(i) {
    if (i === hl) return;
    hl = i;
    circles.forEach((c, k) => gsap.to(c, { attr: { 'stroke-width': k === i ? 70 : 56 }, opacity: i < 0 || k === i ? 1 : .2, duration: .5, ease: 'expo.out', overwrite: 'auto' }));
    lis.forEach((l, k) => { l.classList.toggle('is-on', k === i); l.classList.toggle('is-dim', i >= 0 && k !== i); });
    setCenter(i < 0 ? 5 : i, true);
  }
  function applySales(s, dur) {
    const m = model(s); const to = { duration: dur, ease: 'expo.out', overwrite: 'auto', onUpdate: render };
    m.forEach((v, i) => to['v' + i] = v);
    gsap.to(V, to);
    $('[data-sales]').textContent = fmt(s) + '만원'; fill(input);
  }
  // 초기 상태(진입 전): 금액은 세팅, 그리기 진행도 0
  { const m = model(4000); m.forEach((v, i) => V['v' + i] = v); }
  fill(input); render();

  input.addEventListener('input', () => applySales(+input.value, .9));

  // 데모 루프: 순차 하이라이트 + 월 매출 변경, 사용자가 만지면 중단
  let touched = false, hovering = false, call = null, idx = 0, started = false;
  const stage = $('.s103__stage');
  const stopDemo = () => { touched = true; call && call.kill(); call = null; };
  input.addEventListener('pointerdown', stopDemo); input.addEventListener('keydown', stopDemo);
  stage.addEventListener('pointerenter', () => { hovering = true; call && call.kill(); call = null; });
  stage.addEventListener('pointerleave', () => { hovering = false; if (!touched && started && !call) call = gsap.delayedCall(1.2, step); });
  legend.addEventListener('pointerenter', () => { hovering = true; call && call.kill(); call = null; });
  legend.addEventListener('pointerleave', () => { hovering = false; if (!touched && started && !call) call = gsap.delayedCall(1.2, step); });
  const SALES = [4000, 6200, 3400, 5200];
  function step() {
    call = null; if (hovering) return;
    const k = idx % 7;
    if (k === 6) { hover(-1); if (!touched) { const s = SALES[(idx / 7 | 0) % SALES.length]; applySales(s, 1.6); input.value = s; fill(input); $('[data-sales]').textContent = fmt(s) + '만원'; } }
    else hover(k);
    idx++;
    call = gsap.delayedCall(k === 6 ? 2.2 : 1.7, step);
  }

  let intro = null;
  const st = ScrollTrigger.create({ trigger: root, start: 'top 78%', once: true, onEnter: () => {
    intro = gsap.timeline({ onComplete: () => { started = true; call = gsap.delayedCall(.6, step); } });
    intro.to(S, { p0: 1, duration: .8, ease: 'power3.inOut', onUpdate: pr }, 0);
    for (let i = 1; i < N; i++) intro.to(S, { ['p' + i]: 1, duration: .8, ease: 'power3.inOut', onUpdate: pr }, i * .42);
    function pr() { render(); }
    intro.fromTo($('[data-svg]'), { rotation: -40, transformOrigin: '50% 50%' }, { rotation: 0, duration: 3, ease: 'expo.out' }, 0);
    gsap.from(root.querySelectorAll('.s103__title,.s103__eyebrow'), { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .1 });
  } });
  return () => { st.kill(); call && call.kill(); intro && intro.kill(); gsap.killTweensOf(V); gsap.killTweensOf(S); };
}
