export default function init(root, ctx) {
  const poster = root.querySelector('.s079__poster'), glare = root.querySelector('.s079__glare');
  const shadow = root.querySelector('.s079__shadow');
  const lys = [...root.querySelectorAll('.s079__ly')];
  // 레이어별 깊이: 배경 → 해 → 포도 → 타이포 → 메타 → 잎(포스터 밖으로 튀어나옴)
  const Z = [0, 22, 56, 96, 130, 170];
  lys.forEach((l, i) => { l.style.transform = `translateZ(${Z[i]}px)`; });
  const st = { tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, gyro: false, last: 0 };
  const onGyro = (e) => { if (e.gamma == null) return; st.gyro = true; st.tx = Math.max(-1, Math.min(1, e.gamma / 28)); st.ty = Math.max(-1, Math.min(1, (e.beta - 40) / 28)); st.last = performance.now(); };
  addEventListener('deviceorientation', onGyro);
  let mouseAt = 0, lm = [0, 0];
  gsap.from(root.querySelector('.s079__scene'), { y: 120, opacity: 0, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 70%' } });
  const off = ctx.tick((t) => {
    const mx = (ctx.mouse.nx - .5) * 2, my = (ctx.mouse.ny - .5) * 2;
    if (Math.hypot(mx - lm[0], my - lm[1]) > .004) { mouseAt = t; lm = [mx, my]; }
    const gyroLive = st.gyro && performance.now() - st.last < 800;
    if (gyroLive) { /* tx, ty 는 자이로 핸들러가 갱신 */ }
    else if (t - mouseAt < 2.5 && ctx.fine) { st.tx = mx; st.ty = my; }
    else { const k = ctx.reduced ? .3 : 1; st.tx = Math.cos(t * .7) * .75 * k; st.ty = Math.sin(t * .9) * .55 * k; }   // 입력 없으면 스스로 원을 그림
    // 스프링 감쇠(오버슈트가 살짝 남는 값)
    const kS = .09, d = .82;
    st.vx = (st.vx + (st.tx - st.x) * kS) * d; st.vy = (st.vy + (st.ty - st.y) * kS) * d;
    st.x += st.vx; st.y += st.vy;
    poster.style.transform = `rotateY(${st.x * 26}deg) rotateX(${st.y * -22}deg)`;
    glare.style.setProperty('--gx', (50 + st.x * 55).toFixed(1) + '%');
    glare.style.setProperty('--gy', (35 + st.y * 55).toFixed(1) + '%');
    shadow.style.transform = `translateX(${st.x * -30}px) scaleX(${1 - Math.abs(st.x) * .1})`;
  });
  return () => { off(); removeEventListener('deviceorientation', onGyro); };
}
