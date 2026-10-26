export default function init(root, ctx) {
  const L = [...root.querySelectorAll('.s141__col--l li')];
  const R = [...root.querySelectorAll('.s141__col--r li')];
  const orb = root.querySelector('.s141__orb');
  const noEl = root.querySelector('.s141__no'), nmEl = root.querySelector('.s141__nm');
  const st1 = root.querySelector('.s141__st1'), st2 = root.querySelector('.s141__st2');
  const N = L.length;
  const pal = [['#ffd27a','#e2683c'],['#ffe3a0','#d9893a'],['#f3d9b1','#a8693a'],['#d8a0a8','#7a3a52'],
               ['#f4e6c4','#9a7a3a'],['#d9e3a0','#5f8a3a'],['#e8cfa6','#7a5230'],['#f6c9a0','#c2562f']];
  const names = L.map(l => l.textContent);
  const st = { f: 0 };
  let fs = 0, last = -1, t = 0;
  const A = () => Math.min(innerWidth * 0.07, 120);

  const qxL = L.map(el => gsap.quickTo(el, 'x', { duration: .7, ease: 'power3.out' }));
  const qxR = R.map(el => gsap.quickTo(el, 'x', { duration: .7, ease: 'power3.out' }));
  const qox = gsap.quickTo(orb, 'x', { duration: .9, ease: 'power3.out' });
  const qoy = gsap.quickTo(orb, 'y', { duration: .9, ease: 'power3.out' });
  const qor = gsap.quickTo(orb, 'rotation', { duration: 1.1, ease: 'power3.out' });

  const stt = ScrollTrigger.create({
    trigger: root, start: 'top top', end: 'bottom bottom',
    onUpdate: s => gsap.to(st, { f: s.progress * (N - 1), duration: .9, ease: 'power3.out', overwrite: true })
  });

  let vis = true;
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; });
  io.observe(root);

  const off = ctx.tick((time, dt) => {
    if (!vis) return;
    t += (dt || 16) / 1000;
    const f = st.f + Math.sin(t * .55) * .7;           // 숨쉬는 포커스 (idle 모션)
    fs += (f - fs) * .14;
    const a = A(), vh = innerHeight, lh = Math.max(64, vh * .15);
    for (let i = 0; i < N; i++) {
      const d = i - fs, g = Math.exp(-d * d * .45);
      const wave = Math.sin(d * .85 - t * 1.1) * a * Math.exp(-d * d / 22);
      const push = g * a * .22;
      qxL[i](wave + push);
      qxR[i](-wave - push);                              // 반대 위상
      const y = d * lh, sc = .72 + .28 * g, op = .1 + .9 * g;
      gsap.set(L[i], { y, scale: sc, opacity: op, transformOrigin: '100% 50%' });
      gsap.set(R[i], { y, scale: sc, opacity: op, transformOrigin: '0% 50%' });
    }
    const dw = fs - Math.round(fs);
    const cw = Math.sin(fs * .85 - t * 1.1) * a * .5;
    qox(cw * .9); qoy(Math.sin(t * .9) * 14 + dw * 30); qor(cw * .25 + Math.sin(t * .6) * 4);
    const idx = Math.max(0, Math.min(N - 1, Math.round(fs)));
    if (idx !== last) {
      last = idx;
      noEl.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
      nmEl.textContent = names[idx];
      gsap.to(st1, { attr: { 'stop-color': pal[idx][0] }, duration: .8, overwrite: true });
      gsap.to(st2, { attr: { 'stop-color': pal[idx][1] }, duration: .8, overwrite: true });
    }
  });

  return () => { off(); stt.kill(); io.disconnect(); gsap.killTweensOf([st, st1, st2, orb, ...L, ...R]); };
}
