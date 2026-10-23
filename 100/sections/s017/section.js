export default function init(root, ctx) {
  const R = root.querySelector('.s017__l--r'), C = root.querySelector('.s017__l--c'), Wt = root.querySelector('.s017__l--w');
  const words = ['심야라멘', 'NIGHT SHIFT', '새벽 5시', 'OPEN 24/7'];
  let wi = 0, scr = null, visible = true, burst = 0;
  const sync = () => { R.textContent = C.textContent = Wt.textContent; };
  Wt.textContent = words[0]; sync();
  const slice = () => { // 가로 띠 형태로 잘린 조각
    const a = Math.random() * 80, b = a + 6 + Math.random() * 22;
    return `inset(${a.toFixed(0)}% 0 ${(100 - b).toFixed(0)}% 0)`;
  };
  const next = () => {
    wi = (wi + 1) % words.length;
    scr && scr.kill();
    scr = gsap.to(Wt, { duration: 1.2, ease: 'none', scrambleText: { text: words[wi], chars: '▓▒░█#@%&/\\01', speed: .7, revealDelay: .15 }, onUpdate: sync, onComplete: sync });
    burst = 1;
  };
  const cycle = setInterval(() => { if (visible) next(); }, 3600);
  // 글리치: 무작위 시점에 RGB 분리 + 조각 점프
  let gl = null;
  const glitch = () => {
    if (!visible) return;
    gl && gl.kill();
    gl = gsap.timeline();
    gl.set([R, C], { visibility: 'visible' }, 0).set(Wt, { textShadow: 'none' }, 0);
    for (let i = 0; i < 6; i++) {
      gl.set(R, { x: (Math.random() - .5) * 70, y: (Math.random() - .5) * 8, clipPath: slice() }, i * .05)
        .set(C, { x: (Math.random() - .5) * -70, y: (Math.random() - .5) * 8, clipPath: slice() }, i * .05)
        .set(Wt, { x: (Math.random() - .5) * 14, skewX: (Math.random() - .5) * 14 }, i * .05);
    }
    gl.set([R, C], { clipPath: 'none', visibility: 'hidden' }).set(Wt, { x: 0, skewX: 0 });
  };
  let gt; const loop = () => { glitch(); gt = setTimeout(loop, 900 + Math.random() * 1800); }; gt = setTimeout(loop, 800);
  // 커서 속도/위치에 비례한 상시 RGB 분리
  let sx = 0, lx = ctx.mouse.x, sv = 0;
  const off = ctx.tick((time) => {
    if (!visible) return;
    const vx = ctx.mouse.x - lx; lx = ctx.mouse.x;
    sv += (Math.min(60, Math.abs(vx)) - sv) * .1;
    const tgt = (ctx.mouse.nx - .5) * 36 + Math.sin(time * 2.2) * 3;
    sx += (tgt - sx) * .1;
    const split = sx + (sx >= 0 ? sv : -sv) * .6 + burst * 18; burst *= .92;
    if (!gl || !gl.isActive()) { const o = split.toFixed(1); Wt.style.textShadow = `${o}px 0 #ff1f45, ${-o}px 0 #17e8ff`; }
  });
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  return () => { clearInterval(cycle); clearTimeout(gt); gl && gl.kill(); scr && scr.kill(); off(); io.disconnect(); };
}
