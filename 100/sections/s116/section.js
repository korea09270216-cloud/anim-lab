export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const stage = q('.s116__stage'), act = q('.s116__act'), btn = q('.s116__btn'), bl = q('.s116__bl');
  const sp = q('.s116__sp'), spc = q('.s116__sp circle'), bckSvg = q('.s116__bck'), bck = q('.s116__bck path');
  const plane = q('.s116__plane'), trail = q('.s116__trail path'), fx = q('.s116__fx');
  const ticket = q('.s116__ticket'), badge = q('.s116__badge'), ring = q('.s116__ring'), tck = q('.s116__tck');
  const num = q('.s116__num'), st = q('.s116__st');
  const INK = '#12301f', OK = '#1f9d63';
  const rel = el => { const a = el.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: a.left - s.left + a.width / 2, y: a.top - s.top + a.height / 2 }; };
  const pad = n => String(Math.round(n)).padStart(4, '0');

  const pieces = [];
  const cols = ['#ff6b3d', '#9cf0bd', '#ffd45e', '#ffffff'];
  for (let i = 0; i < 16; i++) { const p = document.createElement('i'); p.style.background = cols[i % cols.length]; fx.appendChild(p); pieces.push(p); }

  const setIdle = () => {
    gsap.set(btn, { width: '100%', scale: 1, backgroundColor: INK });
    bl.textContent = '상담 신청하기';
    gsap.set(bl, { opacity: 1, y: 0 });
    gsap.set([sp, bckSvg], { opacity: 0, rotation: 0, scale: 1 });
    gsap.set(spc, { drawSVG: '0% 0%' });
    gsap.set(bck, { drawSVG: '0% 0%' });
    gsap.set(plane, { opacity: 0 });
    gsap.set(trail, { drawSVG: '0% 0%' });
    gsap.set(ring, { drawSVG: '0% 0%' });
    gsap.set(tck, { drawSVG: '0% 0%' });
    gsap.set(badge, { scale: 1 });
    gsap.set(ticket, { opacity: .55 });
    gsap.set(pieces, { opacity: 0 });
    num.textContent = '0000'; st.textContent = '접수 대기 중';
  };
  setIdle();

  let running = false, auto = true, cur = null, timer = null, spin = null;

  function run() {
    running = true;
    const W = act.clientWidth;
    const a = rel(btn), b = rel(badge);
    const dx = b.x - a.x, dy = b.y - a.y;
    const pts = [{ x: a.x, y: a.y }, { x: a.x + dx * .08 - 40, y: a.y - 150 }, { x: a.x + dx * .5, y: a.y + dy * .5 + 70 }, { x: a.x + dx * .82, y: b.y - 120 }, { x: b.x, y: b.y }];
    trail.setAttribute('d', MotionPathPlugin.rawPathToString(MotionPathPlugin.arrayToRawPath(pts, { curviness: 1.4 })));
    const cnt = { v: 0 };
    const tl = gsap.timeline({ onComplete: () => { running = false; if (auto) timer = gsap.delayedCall(.8, run); } });
    cur = tl;
    // 1 눌림 -> 폭 축소 + 스피너
    tl.to(btn, { scale: .965, duration: .14, ease: 'power2.in' }, .5)
      .to(btn, { scale: 1, duration: .5, ease: 'expo.out' })
      .to(bl, { opacity: 0, y: -10, duration: .25, ease: 'power3.in' }, '<-.35')
      .to(btn, { width: 60, duration: .8, ease: 'expo.inOut' }, '<')
      .set(sp, { opacity: 1 }, '-=.35')
      .fromTo(spc, { drawSVG: '0% 22%' }, { drawSVG: '0% 70%', duration: .9, ease: 'sine.inOut', yoyo: true, repeat: 1 }, '<')
      .call(() => { spin = gsap.to(sp, { rotation: '+=360', duration: .8, ease: 'none', repeat: -1 }); }, null, '<')
      // 2 비행기 이륙
      .call(() => { spin && spin.kill(); }, null, '>')
      .to(sp, { opacity: 0, scale: .6, duration: .25, ease: 'power3.in' }, '>-.05')
      .set(plane, { x: a.x, y: a.y, xPercent: -50, yPercent: -50, scale: .3, opacity: 1, rotation: 0 }, '<')
      .to(plane, { scale: 1, duration: .35, ease: 'expo.out' }, '<')
      .to(plane, { motionPath: { path: pts, curviness: 1.4, autoRotate: true }, duration: 1.45, ease: 'power2.inOut' }, '<.1')
      .to(trail, { drawSVG: '0% 100%', duration: 1.45, ease: 'power2.inOut' }, '<')
      .to(plane, { scale: .25, opacity: 0, duration: .3, ease: 'power3.in' }, '-=.28')
      .to(trail, { drawSVG: '100% 100%', duration: .6, ease: 'expo.out' }, '-=.15')
      // 3 도착: 접수증 점등 -> 체크 -> 카운트업
      .to(ticket, { opacity: 1, duration: .5, ease: 'expo.out' }, '<-.35')
      .fromTo(badge, { scale: .86 }, { scale: 1, duration: .8, ease: 'expo.out' }, '<')
      .to(ring, { drawSVG: '0% 100%', duration: .7, ease: 'expo.inOut' }, '<')
      .to(tck, { drawSVG: '0% 100%', duration: .5, ease: 'power3.out' }, '-=.15')
      .call(() => { st.textContent = '접수 완료'; }, null, '<')
      .to(btn, { backgroundColor: OK, duration: .5, ease: 'power2.out' }, '<-.3')
      .set(bckSvg, { opacity: 1 }, '<')
      .to(bck, { drawSVG: '0% 100%', duration: .45, ease: 'power3.out' }, '<')
      .to(cnt, { v: 482, duration: 1.5, ease: 'expo.out', onUpdate: () => { num.textContent = pad(cnt.v); } }, '-=.35')
      .add(() => {
        const o = rel(badge);
        pieces.forEach(p => {
          gsap.set(p, { x: o.x, y: o.y, opacity: 1, rotation: gsap.utils.random(0, 180), scale: gsap.utils.random(.7, 1.2) });
          gsap.to(p, { physics2D: { velocity: gsap.utils.random(160, 340), angle: gsap.utils.random(-160, -20), gravity: 520 }, rotation: '+=' + gsap.utils.random(-260, 260), duration: 1.5, ease: 'none' });
          gsap.to(p, { opacity: 0, duration: .5, delay: .9, ease: 'power1.in' });
        });
      }, '-=1.3')
      // 4 버튼이 알약으로 복귀
      .to(btn, { width: W, duration: .8, ease: 'expo.inOut' }, '+=.1')
      .to(bckSvg, { opacity: 0, duration: .25 }, '<')
      .call(() => { bl.textContent = '접수가 완료되었어요'; }, null, '<.3')
      .to(bl, { opacity: 1, y: 0, duration: .5, ease: 'expo.out' }, '<.2')
      // 5 정지 후 초기화
      .to({}, { duration: 2.2 })
      .to(ticket, { opacity: .55, duration: .6, ease: 'power2.inOut' })
      .to(btn, { backgroundColor: INK, duration: .6, ease: 'power2.inOut' }, '<')
      .call(() => { setIdle(); });
    return tl;
  }

  const stop = () => { auto = false; if (timer) timer.kill(); };
  const onDown = e => { if (e.isTrusted) stop(); };
  const onClick = e => { if (!e.isTrusted) return; stop(); if (!running) { setIdle(); run(); } };
  root.addEventListener('pointerdown', onDown);
  btn.addEventListener('click', onClick);

  const io = new IntersectionObserver(es => { es.forEach(en => { if (cur) cur.paused(!en.isIntersecting); }); }, { threshold: 0 });
  io.observe(stage);
  timer = gsap.delayedCall(.5, run);

  return () => {
    stop(); io.disconnect(); spin && spin.kill();
    root.removeEventListener('pointerdown', onDown); btn.removeEventListener('click', onClick);
    cur && cur.kill();
    gsap.killTweensOf([btn, bl, sp, spc, plane, trail, ring, tck, badge, ticket, pieces, num, bck, bckSvg]);
  };
}
