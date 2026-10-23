export default function init(root, ctx) {
  const rows = [...root.querySelectorAll('.s019__f')];
  const pct = root.querySelector('[data-pct]'), stack = root.querySelector('.s019__stack');
  let prog = 0, sm = 0, visible = true;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { prog = s.progress; } });
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  const ease = gsap.parseEase('power3.inOut');
  const off = ctx.tick((time) => {
    if (!visible) return;
    sm += (prog - sm) * .1; // 스크롤 관성
    const n = rows.length, tilt = 7; // 경사진 와이프 모서리
    rows.forEach((f, i) => {
      const local = Math.max(0, Math.min(1, sm * n * 1.04 - i));
      const x = ease(local) * (100 + tilt * 2) - tilt; // -tilt ~ 100+tilt
      const wob = Math.sin(time * 2 + i) * 1.2 * (local > 0 && local < 1 ? 1 : 0);
      f.style.clipPath = `polygon(0 0,${Math.max(0, x + tilt + wob)}% 0,${Math.max(0, x - tilt - wob)}% 100%,0 100%)`;
    });
    pct.textContent = String(Math.round(sm * 100)).padStart(2, '0') + '%';
    stack.style.transform = `translateX(${(ctx.mouse.nx - .5) * -24}px)`;
  });
  return () => { off(); st.kill(); io.disconnect(); };
}
