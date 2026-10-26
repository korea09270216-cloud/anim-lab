export default function init(root, ctx) {
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const defs = root.querySelector('.s142__defs'), scenes = root.querySelector('.s142__scenes');
  const texts = [...root.querySelectorAll('.s142__t')], dots = [...root.querySelectorAll('.s142__dots li')];

  // 5개 장면 (그라디언트 + 도형). 보이는 영역은 100x100 중 가운데 가로띠라 도형을 y 25~75 에 모은다
  const S = [
    { a: '#0e5e55', b: '#42c9a0', c: '#c8f26b', d: '#ffffff' },
    { a: '#ff5a3c', b: '#ffa07a', c: '#fff0d6', d: '#7a1a10' },
    { a: '#ffc21a', b: '#ffe98a', c: '#e8541c', d: '#4a2a00' },
    { a: '#5b3df5', b: '#c58bff', c: '#ffd1e8', d: '#ffffff' },
    { a: '#f6efe0', b: '#bfe3a2', c: '#ff7a59', d: '#1c3a2a' }
  ];
  const drift = [];
  S.forEach((s, i) => {
    const g = mk('linearGradient', { id: 's142lg' + i, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    mk('stop', { offset: 0, 'stop-color': s.a }, g); mk('stop', { offset: 1, 'stop-color': s.b }, g);
    const sc = mk('g', { class: 's142__sc' }, scenes);
    mk('rect', { x: 0, y: 0, width: 100, height: 100, fill: 'url(#s142lg' + i + ')' }, sc);
    const c1 = mk('circle', { cx: 68, cy: 46, r: 17, fill: s.c }, sc);
    const c2 = mk('circle', { cx: 68, cy: 46, r: 9, fill: s.d, 'fill-opacity': .22 }, sc);
    const c3 = mk('circle', { cx: 22, cy: 66, r: 6, fill: s.d, 'fill-opacity': .18 }, sc);
    const c4 = mk('circle', { cx: 84, cy: 70, r: 3.4, fill: s.c }, sc);
    const rg = mk('g', {}, sc);
    for (let k = 0; k < 5; k++) mk('rect', { x: 10 + k * 5, y: 30, width: 2.2, height: 12 + k * 3, rx: 1.1, fill: s.d, 'fill-opacity': .16 }, rg);
    drift.push(gsap.to([c1, c2], { attr: { cy: 52 }, duration: 3.2 + i * .3, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
               gsap.to(c3, { attr: { cx: 28 }, duration: 2.6 + i * .2, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
               gsap.to(c4, { attr: { cx: 90 }, duration: 2.2 + i * .2, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
  });
  const sc = [...scenes.children];

  // 마스크 패턴 4종 (viewBox 100x100 고정 → 화면 비율과 무관) — 전체 rect 수 70
  const rnd = (n) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.inOut' } });
  const HOLD = 1.1, DUR = 1.4;
  const patterns = [
    // 1 가로 블라인드 (16줄, 위에서 아래로 순차)
    (m, T) => { const n = 16, h = 100 / n;
      for (let i = 0; i < n; i++) { const r = mk('rect', { x: 0, y: i * h, width: 100, height: 0, fill: '#fff' }, m);
        tl.to(r, { attr: { height: h + .05 }, duration: .55 }, T + i * .05); } },
    // 2 랜덤 그리드 (6x6, 셀 중심에서 자라남)
    (m, T) => { const n = 6, c = 100 / n, ord = rnd(n * n);
      for (let i = 0; i < n * n; i++) { const x = (i % n) * c, y = (i / n | 0) * c;
        const r = mk('rect', { x: x + c / 2, y: y + c / 2, width: 0, height: 0, fill: '#fff' }, m);
        tl.to(r, { attr: { x: x - .05, y: y - .05, width: c + .1, height: c + .1 }, duration: .5 }, T + ord[i] / (n * n) * .85); } },
    // 3 세로 블라인드 (10줄, 가운데서 바깥으로)
    (m, T) => { const n = 10, w = 100 / n;
      for (let i = 0; i < n; i++) { const r = mk('rect', { x: i * w, y: 0, width: 0, height: 100, fill: '#fff' }, m);
        tl.to(r, { attr: { width: w + .05 }, duration: .6 }, T + Math.abs(i - (n - 1) / 2) * .09); } },
    // 4 열별 랜덤 그리드 (8열, 각 열이 무작위 시점에 아래로 열림)
    (m, T) => { const n = 8, w = 100 / n, ord = rnd(n);
      for (let i = 0; i < n; i++) { const r = mk('rect', { x: i * w, y: 0, width: w + .05, height: 0, fill: '#fff' }, m);
        tl.to(r, { attr: { height: 100 }, duration: .7 }, T + ord[i] * .1); } }
  ];
  const tI = [];
  for (let k = 1; k < 5; k++) {
    const m = mk('mask', { id: 's142m' + k, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 100, height: 100 }, defs);
    sc[k].setAttribute('mask', 'url(#s142m' + k + ')');
    const T = HOLD + (k - 1) * (DUR + HOLD);
    patterns[k - 1](m, T);
    // 텍스트 교체 (마스크가 절반쯤 열릴 때)
    tl.to(texts[k - 1], { opacity: 0, yPercent: -30, duration: .5, ease: 'power3.in' }, T + .1)
      .fromTo(texts[k], { opacity: 0, yPercent: 40 }, { opacity: 1, yPercent: 0, duration: .8, ease: 'expo.out' }, T + .7);
    tI.push(T + .6);
  }
  tl.to({}, { duration: HOLD }, '>');
  gsap.set(texts[0], { opacity: 1 });

  const setDot = (p) => { const tt = p * tl.duration(); let a = 0; tI.forEach((x, i) => { if (tt > x) a = i + 1; }); dots.forEach((d, i) => d.classList.toggle('on', i === a)); };
  const stt = ScrollTrigger.create({
    trigger: root, start: 'top top', end: 'bottom bottom', scrub: 1.8,
    animation: tl, onUpdate: s => setDot(s.progress)
  });
  setDot(0);

  return () => { stt.kill(); tl.kill(); drift.forEach(d => d.kill()); };
}
