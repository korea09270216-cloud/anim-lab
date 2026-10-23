export default function init(root, ctx) {
  const track = root.querySelector('[data-track]');
  const tpl = root.querySelector('[data-tpl]');
  track.appendChild(tpl.content.cloneNode(true));
  const items = [...track.querySelectorAll('.s062__item')];
  const N = items.length;
  const stage = root.querySelector('.s062__stage');
  const bg = root.querySelector('.s062__bgtrack');
  const fill = root.querySelector('.s062__fill');
  const knob = root.querySelector('.s062__knob');
  const rail = root.querySelector('.s062__rail');
  const cur = root.querySelector('[data-cur]');
  root.querySelector('[data-tot]').textContent = String(N).padStart(2, '0');
  bg.innerHTML = items.map(i => `<span>${i.dataset.y}</span>`).join('');

  let STEP = 420, PAD = 0, idx = 0, auto = true, dragging = false;
  const measure = () => {
    STEP = items[0].offsetWidth;
    PAD = innerWidth * .06;
    track.style.paddingLeft = PAD + 'px';
  };
  measure();
  const minX = () => -STEP * (N - 1);
  const snap = v => Math.max(minX(), Math.min(0, Math.round(v / STEP) * STEP));

  // 거리 기반 스타일: 활성 카드는 크고 밝게, 먼 카드는 작고 흐리게
  const paint = () => {
    const x = gsap.getProperty(track, 'x');
    const f = -x / STEP; // 연속 인덱스
    items.forEach((it, i) => {
      const d = Math.min(1.6, Math.abs(i - f));
      const s = 1 - d * .09;
      gsap.set(it, { scale: s, opacity: 1 - d * .38 });
    });
    gsap.set(bg, { yPercent: -Math.max(0, Math.min(N - 1, f)) * (100 / N) });
    const p = N > 1 ? f / (N - 1) : 0;
    gsap.set(fill, { scaleX: Math.max(0, Math.min(1, p)) });
    gsap.set(knob, { x: Math.max(0, Math.min(1, p)) * rail.offsetWidth });
    const n = Math.max(0, Math.min(N - 1, Math.round(f)));
    if (n !== idx) { idx = n; mark(); }
  };
  const mark = () => {
    items.forEach((it, i) => it.classList.toggle('is-on', i === idx));
    cur.textContent = String(idx + 1).padStart(2, '0');
  };
  mark(); paint();

  const goTo = (i, dur = 1.5) => {
    idx = Math.max(0, Math.min(N - 1, i));
    mark();
    gsap.to(track, { x: -STEP * idx, duration: dur, ease: 'expo.out', overwrite: true, onUpdate: paint });
  };

  const [drag] = Draggable.create(track, {
    type: 'x', trigger: stage, inertia: true, edgeResistance: .75, dragResistance: 0,
    bounds: { minX: minX(), maxX: 0 },
    snap: { x: v => snap(v) },
    onPress: () => { auto = false; dragging = true; gsap.killTweensOf(track); },
    onDrag: paint, onThrowUpdate: paint,
    onRelease: () => { dragging = false; },
    onThrowComplete: paint
  });
  // 던지기 속도에 반응하는 기울기
  const off = ctx.tick(() => {
    if (!dragging && !drag.isThrowing) return;
    paint();
  });

  const prev = root.querySelector('[data-prev]'), next = root.querySelector('[data-next]');
  const onPrev = () => { auto = false; goTo(idx - 1); };
  const onNext = () => { auto = false; goTo(idx + 1); };
  prev.addEventListener('click', onPrev); next.addEventListener('click', onNext);

  // 자동 진행(사용자가 만지기 전까지)
  const iv = setInterval(() => { if (!auto || !isVisible) return; goTo(idx >= N - 1 ? 0 : idx + 1, idx >= N - 1 ? 2.2 : 1.6); }, 3200);
  let isVisible = false;
  const io = new IntersectionObserver(e => { isVisible = e[0].isIntersecting; }, { threshold: .15 });
  io.observe(root);

  const onResize = () => { measure(); drag.applyBounds({ minX: minX(), maxX: 0 }); gsap.set(track, { x: -STEP * idx }); paint(); };
  addEventListener('resize', onResize);

  // 진입 연출: 카드가 오른쪽에서 선 따라 등장
  const st = gsap.from(items, { x: 140, autoAlpha: 0, duration: 1.4, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: root, start: 'top 70%', once: true }, onComplete: paint });

  return () => { clearInterval(iv); io.disconnect(); off(); drag.kill(); prev.removeEventListener('click', onPrev); next.removeEventListener('click', onNext); removeEventListener('resize', onResize); st.scrollTrigger && st.scrollTrigger.kill(); st.kill(); gsap.killTweensOf(track); };
}
