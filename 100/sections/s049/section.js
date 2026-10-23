export default function init(root, ctx) {
  const stage = root.querySelector('.s049__stage');
  const proxy = root.querySelector('.s049__proxy');
  const cards = [...root.querySelectorAll('.s049__card')];
  const nameEl = root.querySelector('.s049__name span');
  const bar = root.querySelector('.s049__bar i');
  const N = cards.length;
  const names = cards.map(c => c.querySelector('strong').innerHTML.replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim());
  const STEP = 220; // 카드 1장 = 드래그 220px
  let cur = 0, dragging = false, tl = null, timer = null, offTick = null;

  const wrap = d => { d = ((d % N) + N) % N; return d > N / 2 ? d - N : d; };
  const layout = () => {
    const pos = -gsap.getProperty(proxy, 'x') / STEP;
    cards.forEach((c, i) => {
      const d = wrap(i - pos), a = Math.abs(d), s = Math.sign(d), m = Math.min(a, 1);
      const x = d * 120 + s * m * 210;
      const z = -m * 220 - Math.max(a - 1, 0) * 90;
      const ry = -s * m * 54;
      gsap.set(c, { x, z, rotateY: ry, scale: 1 - Math.min(a, 3) * .02, opacity: a > 3.4 ? 0 : 1, zIndex: 100 - Math.round(a * 10), filter: `brightness(${(1 - m * .38).toFixed(2)})` });
    });
    const idx = ((Math.round(pos) % N) + N) % N;
    if (idx !== cur) {
      cur = idx;
      gsap.to(nameEl, { yPercent: 110, duration: .25, ease: 'power3.in', onComplete: () => { nameEl.textContent = names[cur]; gsap.fromTo(nameEl, { yPercent: 110 }, { yPercent: 0, duration: .8, ease: 'expo.out' }); } });
      root.style.setProperty('--glow', cards[cur].dataset.c);
    }
  };

  const snap = v => Math.round(v / STEP) * STEP;
  const drag = Draggable.create(proxy, {
    type: 'x', trigger: stage, inertia: true, minimumMovement: 3, throwResistance: 1800,
    snap: { x: snap },
    onPress() { dragging = true; timer && timer.kill(); tl && tl.kill(); },
    onRelease() { dragging = false; schedule(3.2); },
  })[0];

  const schedule = (t = 2.2) => {
    timer && timer.kill();
    timer = gsap.delayedCall(t, () => {
      if (dragging) return schedule();
      const x = gsap.getProperty(proxy, 'x');
      bar.style.transform = 'scaleX(0)';
      tl = gsap.to(proxy, { x: snap(x) - STEP, duration: 1.4, ease: 'expo.inOut', onComplete: schedule });
    });
  };
  const onClick = e => {
    const c = e.target.closest('.s049__card'); if (!c || drag.isDragging) return;
    const i = cards.indexOf(c), pos = Math.round(-gsap.getProperty(proxy, 'x') / STEP), d = wrap(i - pos);
    if (!d) return;
    timer && timer.kill(); tl && tl.kill();
    tl = gsap.to(proxy, { x: gsap.getProperty(proxy, 'x') - d * STEP, duration: 1.1, ease: 'expo.out', onComplete: schedule });
  };
  stage.addEventListener('click', onClick);

  offTick = ctx.tick(() => {
    layout();
    const x = gsap.getProperty(proxy, 'x'); const f = ((-x / STEP) % 1 + 1) % 1;
    bar.style.transform = `scaleX(${f.toFixed(3)})`;
  });
  gsap.set(proxy, { x: 0 });
  layout();
  gsap.from(cards, { opacity: 0, y: 80, duration: 1.2, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: root, start: 'top 80%' } });
  schedule();
  return () => { timer && timer.kill(); tl && tl.kill(); drag.kill(); stage.removeEventListener('click', onClick); offTick && offTick(); gsap.killTweensOf(root.querySelectorAll('*')); };
}
