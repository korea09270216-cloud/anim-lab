export default function init(root, ctx) {
  const $ = (s, r = root) => r.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const svg = $('.s107__radar');
  const AX = ['상권 이해', '운영 체력', '자금 여력', '서비스 감각', '성장 의지'];
  const TYPES = ['입지 분석가형', '현장 장인형', '안정 투자형', '단골 메이커형', '다점포 확장형'];
  const DESC = [
    '상권과 고객 동선을 읽는 감각이 뛰어난 유형이에요. 슈퍼바이저 동행 상권 분석으로 강점을 매출로 연결해 드립니다.',
    '직접 뛰는 체력과 손맛이 강점인 유형이에요. 원팩 조리 시스템으로 현장 완성도를 일정하게 지켜 드립니다.',
    '자금 계획이 단단한 유형이에요. 투자금 회수 구간을 보수적으로 설계한 안정 패키지를 안내해 드립니다.',
    '손님을 단골로 만드는 서비스 감각의 유형이에요. 멤버십 CRM 도구와 응대 매뉴얼로 재방문을 키워 드립니다.',
    '두 번째 점포를 그리는 확장 지향 유형이에요. 다점포 점주 전용 물류·교육 지원 트랙을 안내해 드립니다.'
  ];
  const PROFILES = [[.84, .56, .7, .92, .6], [.52, .9, .62, .66, .58], [.62, .5, .94, .56, .82]];
  const R = 140, C = 528;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / 5;
  const pt = (i, t, r = R) => [Math.cos(ang(i)) * r * t, Math.sin(ang(i)) * r * t];
  const pts = arr => arr.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

  /* 정적 그리드 */
  const gRings = $('.s107__rings'), gAxes = $('.s107__axes'), gH = $('.s107__handles'), gL = $('.s107__labels');
  [.25, .5, .75, 1].forEach(l => gRings.appendChild(mk('polygon', { points: pts(AX.map((_, i) => pt(i, l))) })));
  const handles = [];
  AX.forEach((a, i) => {
    const [x, y] = pt(i, 1);
    gAxes.appendChild(mk('line', { x1: 0, y1: 0, x2: x, y2: y }));
    const [lx, ly] = pt(i, 1, R + 38);
    const t = mk('text', { x: lx, y: ly }); t.textContent = a;
    gL.appendChild(t);
    const h = mk('circle', { r: 9, cx: 0, cy: 0, 'data-i': i });
    gH.appendChild(h); handles.push(h);
  });
  const poly = $('.s107__poly'), halo = $('.s107__halo'), scan = $('.s107__scan');
  const status = $('.s107__status'), typeEl = $('.s107__type');
  const ringFg = $('.s107__ring-fg'), numEl = $('.s107__num b'), rankEl = $('.s107__rank');
  const descEl = $('.s107__desc'), ctaEl = $('.s107__cta'), noteEl = $('.s107__note');
  const objs = AX.map(() => ({ v: 0 }));
  let tl = null, ready = false, demoOn = true, inView = false, drag = -1, curType = -1, split = null, call = null, pi = 0, started = false, haloI = -1;

  function topIdx() { let b = 0; objs.forEach((o, i) => { if (o.v > objs[b].v) b = i; }); return b; }
  function draw() {
    const P = objs.map((o, i) => pt(i, o.v));
    poly.setAttribute('points', pts(P));
    handles.forEach((h, i) => { h.setAttribute('cx', P[i][0].toFixed(1)); h.setAttribute('cy', P[i][1].toFixed(1)); });
    if (haloI >= 0) { halo.setAttribute('cx', P[haloI][0].toFixed(1)); halo.setAttribute('cy', P[haloI][1].toFixed(1)); }
    const sc = objs.reduce((s, o) => s + o.v, 0) / objs.length * 100;
    numEl.textContent = Math.round(sc);
    ringFg.style.strokeDashoffset = C * (1 - Math.min(1, sc / 100));
    rankEl.textContent = '상위 ' + Math.max(3, Math.round((100 - sc) * .8)) + '%';
  }
  function setType(i, intro) {
    if (i === curType && !intro) return;
    curType = i;
    if (split) split.revert();
    typeEl.textContent = TYPES[i];
    descEl.textContent = DESC[i];
    gsap.set(typeEl, { opacity: 1 });
    split = SplitText.create(typeEl, { type: 'chars', mask: 'chars' });
    gsap.from(split.chars, { yPercent: 115, rotate: 6, duration: intro ? 1 : .6, stagger: intro ? .06 : .03, ease: 'expo.out' });
  }

  function reveal(n) {
    if (tl) tl.kill();
    ready = false; haloI = -1; gsap.set(halo, { opacity: 0 });
    const target = PROFILES[n % PROFILES.length];
    objs.forEach(o => { o.v = 0; }); draw();
    if (split) { split.revert(); split = null; }
    curType = -1;
    gsap.set(typeEl, { opacity: 0 });
    gsap.set([descEl, ctaEl, noteEl], { opacity: 0, y: 22 });
    status.textContent = '분석 중…';
    tl = gsap.timeline({ onComplete: () => { ready = true; status.textContent = '분석 완료'; tail(); } });
    tl.fromTo(scan, { y: -215, opacity: 1 }, { y: 215, duration: 1.25, ease: 'sine.inOut' })
      .to(scan, { opacity: 0, duration: .25 }, '-=.2')
      .to(status, { duration: .8, scrambleText: { text: '분석 완료', chars: '01', speed: .5, revealDelay: .15 } }, '-=.55')
      .to(objs, { v: i => target[i], duration: 1.7, stagger: .1, ease: 'back.out(1.6)', onUpdate: draw }, '-=.5')
      .add(() => setType(topIdx(), true), '-=1.1')
      .to([descEl, ctaEl, noteEl], { opacity: 1, y: 0, stagger: .12, duration: .9, ease: 'expo.out' }, '-=.9');
  }

  /* 자동 데모: 리빌 → 꼭짓점 자동 조정 → 다음 프로필 */
  function tail() {
    if (!demoOn) return;
    call = gsap.delayedCall(1.2, () => {
      if (!demoOn) return;
      const top = topIdx(); let k = (top + 2) % 5;
      haloI = k; gsap.set(halo, { opacity: 1 });
      gsap.fromTo(halo, { attr: { r: 10 } }, { attr: { r: 24 }, opacity: 0, duration: .9, repeat: 2, ease: 'power2.out' });
      const to = objs[k].v < .7 ? .98 : .28;
      gsap.to(objs[k], { v: to, duration: 1.4, ease: 'power3.inOut', onUpdate: () => { draw(); if (topIdx() !== curType) setType(topIdx(), false); } });
      call = gsap.delayedCall(3.6, () => { if (!demoOn) return; pi++; reveal(pi); });
    });
  }
  const stopDemo = () => { demoOn = false; if (call) call.kill(); haloI = -1; gsap.killTweensOf(halo); gsap.set(halo, { opacity: 0 }); objs.forEach(o => gsap.killTweensOf(o)); };

  /* 꼭짓점 드래그 */
  const toLocal = e => { const m = svg.getScreenCTM().inverse(); const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(m); };
  const onDown = e => {
    const h = e.target.closest('circle[data-i]'); if (!h) return;
    stopDemo(); if (tl && tl.progress() < 1) tl.progress(1);
    drag = +h.dataset.i; h.setPointerCapture && h.setPointerCapture(e.pointerId); e.preventDefault();
  };
  const onMove = e => {
    if (drag < 0) return;
    const p = toLocal(e), a = ang(drag);
    const t = (p.x * Math.cos(a) + p.y * Math.sin(a)) / R;
    objs[drag].v = Math.max(.12, Math.min(1, t));
    draw(); if (topIdx() !== curType) setType(topIdx(), false);
  };
  const onUp = () => { drag = -1; };
  svg.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  root.addEventListener('pointerdown', stopDemo);

  const io = new IntersectionObserver(es => {
    inView = es[0].isIntersecting;
    if (inView && !started) { started = true; gsap.delayedCall(.5, () => reveal(0)); }
  }, { threshold: .4 });
  io.observe(root);
  draw();

  return () => {
    svg.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    root.removeEventListener('pointerdown', stopDemo);
    io.disconnect();
    if (tl) tl.kill(); if (call) call.kill();
    if (split) split.revert();
    gsap.killTweensOf(halo); objs.forEach(o => gsap.killTweensOf(o));
  };
}
