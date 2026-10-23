export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const scene = $('.s002__scene'), bub = $('.s002__bubbles'), z = $('.s002__z');
  const mask = $('.s002__mask'), ui = $('.s002__ui'), fin = $('.s002__final');
  const ringtxt = $('.s002__ringtxt'), hs = [...root.querySelectorAll('.s002__h i')];
  const FW = 1440, FH = 810;

  // 구멍 속 장면: 둥둥 떠다니는 커피 체리
  const cherries = [];
  for (let i = 0; i < 10; i++) {
    const e = document.createElement('i');
    const s = gsap.utils.random(70, 260, 1);
    e.style.cssText = `width:${s}px;height:${s}px;left:${gsap.utils.random(-4, 96)}%;top:${gsap.utils.random(-6, 92)}%`;
    bub.appendChild(e); cherries.push(e);
    gsap.to(e, { y: gsap.utils.random(-70, 70), x: gsap.utils.random(-40, 40), rotation: gsap.utils.random(-25, 25), duration: gsap.utils.random(3.5, 7), ease: 'sine.inOut', repeat: -1, yoyo: true, delay: -Math.random() * 5 });
  }

  // 글자(OROT)는 굵은 선 도형이라 글리프 크기 한계 없이 수십 배 확대된다. 줌 원점 = T 줄기 중심(선 반폭 42)
  const ox = 1225, oy = 410, r = 42;
  const D = Math.max(Math.hypot(ox, oy), Math.hypot(FW - ox, oy), Math.hypot(ox, FH - oy), Math.hypot(FW - ox, FH - oy));
  const S = D / r * 1.3;
  gsap.set(z, { svgOrigin: `${ox} ${oy}`, scale: 1 });

  const win = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const ease = gsap.parseEase('power3.inOut');
  const outE = gsap.parseEase('expo.out');
  let target = 0, cur = 0;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; } });
  const t0 = performance.now();
  const off = ctx.tick(() => {
    cur += (target - cur) * .1;
    const t = (performance.now() - t0) / 1000;
    const e = ease(win(cur, .08, .82));
    const breathe = ctx.reduced ? 1 : 1 + .018 * Math.sin(t * 1.5) * (1 - e);
    gsap.set(z, { scale: Math.exp(Math.log(S) * e) * breathe });
    const mx = (ctx.mouse.nx - .5), my = (ctx.mouse.ny - .5);
    gsap.set(scene, { scale: 1.2 - .2 * e, x: -mx * 60 * (1 - e * .6), y: -my * 40 * (1 - e * .6) });
    gsap.set(ringtxt, { x: Math.sin(t * .35) * 80 - cur * 300 });
    mask.style.opacity = 1 - win(cur, .83, .88);
    ui.style.opacity = 1 - win(cur, .03, .12);
    const f = outE(win(cur, .86, 1));
    fin.style.opacity = win(cur, .86, .93);
    hs.forEach((h, i) => { h.style.transform = `translateY(${(1 - outE(win(cur, .86 + i * .03, 1))) * 110}%)`; });
    fin.querySelectorAll('p,a').forEach(n => { n.style.transform = `translateY(${(1 - f) * 40}px)`; });
  });
  return () => { off(); st.kill(); cherries.forEach(c => gsap.killTweensOf(c)); };
}
