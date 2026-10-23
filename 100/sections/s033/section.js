export default function init(root, ctx) {
  let visible = true, lastMove = -1e9, lx = ctx.mouse.x, ly = ctx.mouse.y;
  const t0 = performance.now();
  const st = { x: root.clientWidth / 2, y: root.clientHeight / 2, r: 200 };
  const qx = gsap.quickTo(st, 'x', { duration: .55, ease: 'power3.out' });
  const qy = gsap.quickTo(st, 'y', { duration: .55, ease: 'power3.out' });
  const qr = gsap.quickTo(st, 'r', { duration: .9, ease: 'expo.out' });
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
      tx = rect.width * (.5 + .38 * Math.sin(t * .5) * Math.cos(t * .21)); ty = rect.height * (.5 + .3 * Math.sin(t * .77 + 1));
    }
    qx(tx); qy(ty);
    qr(190 + Math.min(mv, 60) * 3.2 + (ctx.reduced ? 0 : Math.sin(now / 90) * 4));
    root.style.setProperty('--x', st.x.toFixed(1) + 'px');
    root.style.setProperty('--y', st.y.toFixed(1) + 'px');
    root.style.setProperty('--r', st.r.toFixed(1) + 'px');
  });
  return () => { off(); io.disconnect(); };
}
