export default function init(root, ctx) {
  const stage = root.querySelector('.s149__stage');
  const wrap = root.querySelector('.s149__cards');
  const cards = [...root.querySelectorAll('.s149__card')];
  const N = cards.length;
  const S = { p: 0, pos: 0, prev: 0, vel: 0, auto: 0 };
  let unit = 360, vis = true, lastT = performance.now(), lastF = '', lastB = [];

  const measure = () => {
    unit = Math.max(200, Math.min(400, stage.clientWidth * .27));
    wrap.style.setProperty('--cw', Math.round(unit * .82) + 'px');
  };
  measure();
  window.addEventListener('resize', measure);

  const st = ScrollTrigger.create({
    trigger: stage, start: 'top top', end: '+=320%', pin: true,
    onUpdate: self => { S.p = self.progress; }
  });
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }); io.observe(stage);

  gsap.from(root.querySelector('.s149__title'), { yPercent: 30, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 70%' } });

  function frame() {
    if (!vis) return;
    const now = performance.now();
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
    S.auto += dt * .14;
    // 스크롤 위치를 부드럽게 따라가며(관성) 속도를 얻는다
    const tgt = S.p * N * 1.25;
    S.pos += (tgt - S.pos) * Math.min(1, dt * 5);
    const dv = (S.pos - S.prev) / Math.max(dt, .001); S.prev = S.pos;
    S.vel += (Math.max(-4, Math.min(4, dv * .45)) - S.vel) * .15;
    const pos = S.pos + S.auto, vel = S.vel;
    const t = now / 1000;
    const sat = 1 + Math.min(.9, Math.abs(vel) * .35);
    const f = Math.abs(vel) > .05 ? 'saturate(' + sat.toFixed(2) + ')' : 'none';
    if (f !== lastF) { wrap.style.filter = f; lastF = f; }
    for (let i = 0; i < N; i++) {
      let u = (((i - pos) % N) + N + N / 2) % N - N / 2;
      const au = Math.abs(u);
      const x = u * unit * 1.02;
      const y = Math.sin(u * .85 + t * .6) * unit * .3 - Math.abs(vel) * 6;
      const z = -au * au * unit * .1 - au * unit * .05;
      const ry = Math.max(-58, Math.min(58, -u * 20));
      const rz = Math.cos(u * .85 + t * .6) * 4 + vel * 3.5;
      const rx = vel * 5 * Math.sin(u * .6 + 1);
      const el = cards[i];
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + ry.toFixed(1) + 'deg) rotateX(' + rx.toFixed(1) + 'deg) rotateZ(' + rz.toFixed(1) + 'deg)';
      el.style.zIndex = String(100 - Math.round(au * 10));
      const o = au > 3.6 ? 0 : au > 3 ? (3.6 - au) / .6 : 1;
      el.style.opacity = o.toFixed(2);
      // 블러는 가장자리 최대 2장(좌/우 하나씩)에만
      const bl = au > 1.7 && Math.abs(vel) > .25 ? Math.min(5, (au - 1.2) * Math.abs(vel) * 1.6) : 0;
      const bs = bl > .3 ? 'blur(' + bl.toFixed(1) + 'px)' : 'none';
      if (bs !== lastB[i]) { el.style.filter = bs; lastB[i] = bs; }
    }
  }
  const off = ctx.tick(frame);

  return () => { off(); io.disconnect(); st.kill(); window.removeEventListener('resize', measure); };
}
