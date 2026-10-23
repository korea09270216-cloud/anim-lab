export default function init(root, ctx) {
  const cur = root.querySelector('.s035__cur'), lab = cur.querySelector('span');
  const track = root.querySelector('.s035__track'), strip = root.querySelector('.s035__strip');
  if (ctx.fine) root.classList.add('is-fine');
  const STATES = {
    dot:   { w: 14, h: 14, r: 7, bg: '#141414', c: '#fff', t: '' },
    label: { w: 104, h: 104, r: 52, bg: '#ff4b1f', c: '#fff', t: '' },
    arrow: { w: 78, h: 78, r: 39, bg: '#141414', c: '#f4f1ea', t: '→' },
    drag:  { w: 118, h: 118, r: 59, bg: '#2b3dff', c: '#fff', t: '← 드래그 →' },
    text:  { w: 3, h: 34, r: 2, bg: '#141414', c: '#fff', t: '' }
  };
  let state = '', dragging = false;
  function setState(name, label) {
    const key = name + (label || '');
    if (key === state) return; state = key;
    const s = STATES[name];
    gsap.to(cur, { width: s.w, height: s.h, borderRadius: s.r, backgroundColor: s.bg, color: s.c, duration: .7, ease: 'expo.out', overwrite: 'auto' });
    gsap.to(lab, { opacity: 0, y: -8, duration: .15, overwrite: true, onComplete() {
      lab.textContent = label || s.t; gsap.set(lab, { y: 8 });
      gsap.to(lab, { opacity: s.t || label ? 1 : 0, y: 0, duration: .5, ease: 'expo.out' });
    } });
  }
  const qx = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3.out' });
  const qy = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3.out' });
  gsap.set(cur, { xPercent: -50, yPercent: -50, x: 300, y: 300 });
  setState('dot');

  const drag = Draggable.create(track, { type: 'x', bounds: { minX: -Math.max(0, track.scrollWidth - strip.clientWidth), maxX: 0 }, inertia: true, edgeResistance: .85,
    onPress() { dragging = true; gsap.to(cur, { scale: .82, duration: .3, ease: 'expo.out' }); },
    onRelease() { dragging = false; gsap.to(cur, { scale: 1, duration: .6, ease: 'expo.out' }); } })[0];

  const ghostTargets = ['.s035__lead h2', '.s035__lead p', '.s035__rooms li:nth-child(2)', '.s035__card:nth-child(2)'];
  let gi = 0, gAt = 0, lastMove = -1e9, lx = ctx.mouse.x, ly = ctx.mouse.y, visible = true, ghostXY = { x: 0, y: 0 };
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);

  const off = ctx.tick(() => {
    if (!visible) return;
    const now = performance.now(), rect = root.getBoundingClientRect();
    if (Math.abs(ctx.mouse.x - lx) + Math.abs(ctx.mouse.y - ly) > 1) { lastMove = now; lx = ctx.mouse.x; ly = ctx.mouse.y; }
    let px, py;
    if (now - lastMove < 2500) { px = ctx.mouse.x; py = ctx.mouse.y; }
    else {
      if (now - gAt > 2300) {
        gAt = now; const sel = ghostTargets[gi++ % ghostTargets.length];
        const el = root.querySelector(sel), r = el.getBoundingClientRect();
        ghostXY = { x: r.left + r.width * .45, y: r.top + r.height * .5 };
        if (sel.includes('card')) gsap.to(track, { x: gsap.getProperty(track, 'x') < -50 ? 0 : -300, duration: 1.8, ease: 'power3.inOut', onUpdate: () => drag.update() });
      }
      px = ghostXY.x; py = ghostXY.y;
    }
    qx(px - rect.left); qy(py - rect.top);
    if (dragging) return;
    const el = document.elementFromPoint(px, py), z = el && root.contains(el) ? el.closest('[data-cur]') : null;
    if (z) setState(z.dataset.cur, z.dataset.label); else setState('dot');
  });
  return () => { off(); io.disconnect(); drag.kill(); };
}
