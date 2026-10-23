export default function init(root, ctx) {
  const cube = root.querySelector('.s071__cube');
  const faces = [...root.querySelectorAll('.s071__face')];
  const idx = [...root.querySelectorAll('.s071__idx li')];
  const ease = gsap.parseEase('expo.inOut');
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const st = { p: 0, cur: 0, mx: 0, my: 0 };
  // 스크롤 → 면 인덱스(0~3). 면마다 머무르는 구간(dwell)을 두고 사이 구간에서만 굴린다
  const map = (p) => { const u = p * 3, i = Math.min(2, Math.floor(u)), f = u - i; return i + ease(clamp((f - .3) / .4)); };
  const stt = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', scrub: false, onUpdate: s => { st.p = s.progress; } });
  let t0 = 0, last = -1;
  const off = ctx.tick((time) => {
    t0 = time;
    const target = map(st.p);
    st.cur += (target - st.cur) * .09;            // 스크롤 관성 (마지막 한 박자 따라붙기)
    const k = st.cur, f = k - Math.floor(k);
    const trans = Math.sin(Math.PI * clamp(f * 1)) ;   // 전환 중 0→1→0
    const dip = -trans * 260;                      // 구르는 동안 뒤로 물러남
    st.mx += ((ctx.mouse.nx - .5) - st.mx) * .06; st.my += ((ctx.mouse.ny - .5) - st.my) * .06;
    const idle = ctx.reduced ? 0 : 1;
    const ry = Math.sin(time * .7) * 5 * idle + st.mx * 14;
    const rz = Math.sin(time * .5 + 1) * 1.2 * idle;
    cube.style.transform = `translateZ(${dip}px) translateZ(calc(var(--h) / -2)) rotateX(${-k * 90 + st.my * -5}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
    faces.forEach((fc, i) => {
      let d = Math.abs(((k - i + 2) % 4 + 4) % 4 - 2);   // 0=정면, 2=뒷면
      fc.style.setProperty('--sh', Math.min(.7, d * .42).toFixed(3));
    });
    const on = Math.round(k) % 4;
    if (on !== last) { last = on; idx.forEach((li, i) => li.classList.toggle('is-on', i === on)); }
  });
  return () => { off(); stt.kill(); };
}
