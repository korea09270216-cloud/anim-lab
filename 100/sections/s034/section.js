export default function init(root, ctx) {
  const lens = root.querySelector('.s034__lens'), zoom = root.querySelector('.s034__zoom'), ring = root.querySelector('.s034__ring');
  const Z = 2.1;
  let visible = true, lastMove = -1e9, lx = ctx.mouse.x, ly = ctx.mouse.y;
  const t0 = performance.now();
  const st = { x: root.clientWidth * .5, y: root.clientHeight * .5, r: 140 };
  const qx = gsap.quickTo(st, 'x', { duration: .7, ease: 'expo.out' });
  const qy = gsap.quickTo(st, 'y', { duration: .7, ease: 'expo.out' });
  const qr = gsap.quickTo(st, 'r', { duration: .8, ease: 'power4.out' });
  gsap.to(ring, { opacity: 1, duration: 1, delay: .3, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 80%' } });
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  const off = ctx.tick(() => {
    if (!visible) return;
    const now = performance.now(), rect = root.getBoundingClientRect();
    const mv = Math.abs(ctx.mouse.x - lx) + Math.abs(ctx.mouse.y - ly);
    if (mv > 1) { lastMove = now; lx = ctx.mouse.x; ly = ctx.mouse.y; }
    let tx, ty;
    if (now - lastMove < 2200) { tx = ctx.mouse.x - rect.left; ty = ctx.mouse.y - rect.top; }
    else {
      const t = (now - t0) / 1000;
      tx = rect.width * (.5 + .36 * Math.sin(t * .42)); ty = rect.height * (.5 + .22 * Math.sin(t * .9 + .5) + .1 * Math.sin(t * .33));
    }
    qx(tx); qy(ty); qr(140 + Math.min(mv, 50) * 1.4);
    lens.style.clipPath = `circle(${st.r.toFixed(1)}px at ${st.x.toFixed(1)}px ${st.y.toFixed(1)}px)`;
    zoom.style.transform = `translate(${(st.x * (1 - Z)).toFixed(1)}px,${(st.y * (1 - Z)).toFixed(1)}px) scale(${Z})`;
    ring.style.setProperty('--d', (st.r * 2).toFixed(1) + 'px');
    ring.style.transform = `translate(${st.x.toFixed(1)}px,${st.y.toFixed(1)}px)`;
  });
  return () => { off(); io.disconnect(); };
}
