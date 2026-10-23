export default function init(root, ctx) {
  const pages = [...root.querySelectorAll('.s045__page')];
  const btns = [...root.querySelectorAll('.s045__nav button')];
  const nextBtn = root.querySelector('.s045__next');
  const ov = root.querySelector('.s045__ov');
  const A1 = ov.querySelector('.s045__a1'), A2 = ov.querySelector('.s045__a2');
  const B1 = ov.querySelector('.s045__b1'), B2 = ov.querySelector('.s045__b2');
  const W = 1440, H = 810, N = 10;
  const ease = CustomEase.create('s045', 'M0,0 C0.8,0 0.2,1 1,1');
  let idx = 0, busy = false, tl = null, timer = null;

  // 결정적 난수 -> 매번 같은 모양의 유기적 블롭
  const rnd = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  const blob = (cx, cy, r, s) => {
    const pts = Array.from({ length: N }, (_, i) => { const a = i / N * Math.PI * 2; const rr = r * (.86 + rnd(i, s) * .3); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
    let d = '';
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
      if (!i) d += `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  };
  const rect = `M-100 -100H${W + 100}V${H + 100}H-100Z`;
  const R = 1900;

  const originOf = el => {
    const b = el.getBoundingClientRect(), r = root.getBoundingClientRect();
    return [(b.left + b.width / 2 - r.left) / r.width * W, (b.top + b.height / 2 - r.top) / r.height * H];
  };

  const enter = p => {
    const t = p.querySelector('.s045__title');
    if (!t.dataset.split) {
      t.dataset.split = 1;
      const walk = n => [...n.childNodes].forEach(c => {
        if (c.nodeType === 3) { const f = document.createDocumentFragment(); [...c.textContent].forEach(ch => { if (ch === ' ') f.append(' '); else { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; f.append(s); } }); c.replaceWith(f); }
        else walk(c);
      });
      walk(t);
    }
    gsap.fromTo(t.querySelectorAll('.ch'), { yPercent: 70, opacity: 0, rotate: 8 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: .025 });
    gsap.fromTo(p.querySelectorAll('.s045__eyebrow,.s045__desc'), { opacity: 0, y: 24 }, { opacity: (i, el) => el.className.includes('desc') ? .8 : 1, y: 0, duration: 1, ease: 'power4.out', stagger: .1, delay: .2 });
    gsap.fromTo(p.querySelector('.s045__orb'), { scale: .6, x: 120 }, { scale: 1, x: 0, duration: 1.8, ease: 'expo.out' });
  };

  const go = (n, from) => {
    n = (n + pages.length) % pages.length;
    if (busy || n === idx) return;
    busy = true;
    const next = pages[n], cs = getComputedStyle(next);
    const bg = cs.getPropertyValue('--bg').trim(), ac = cs.getPropertyValue('--ac').trim(), ink = cs.getPropertyValue('--ink').trim();
    const [cx, cy] = originOf(from || nextBtn);
    const seed = n + 1;
    const small = blob(cx, cy, 14, seed), big = blob(cx, cy, R, seed + 3);
    const holeSmall = rect + blob(cx, cy, 14, seed + 7), holeBig = rect + blob(cx, cy, R, seed + 9);
    gsap.set(ov, { opacity: 1 });
    gsap.set([A1, A2, B1, B2], { opacity: 0 });
    gsap.set(A1, { attr: { d: small, fill: ac }, opacity: 1 });
    gsap.set(A2, { attr: { d: small, fill: bg }, opacity: 1 });
    gsap.set(B1, { attr: { d: holeSmall, fill: bg } });
    gsap.set(B2, { attr: { d: holeSmall, fill: ac } });
    tl = gsap.timeline({ onComplete: () => { gsap.set([A1, A2, B1, B2], { opacity: 0 }); busy = false; schedule(); } });
    tl.to(A1, { morphSVG: { shape: big, shapeIndex: 0 }, duration: 1.15, ease }, 0);
    tl.to(A2, { morphSVG: { shape: big, shapeIndex: 0 }, duration: 1.15, ease }, .16);
    tl.add(() => {
      pages[idx].classList.remove('is-on'); next.classList.add('is-on');
      btns.forEach((b, i) => b.classList.toggle('is-on', i === n));
      root.style.setProperty('--ink', ink);
      gsap.set(next.querySelectorAll('.ch,.s045__eyebrow,.s045__desc'), { opacity: 0 });
      gsap.set(B2, { opacity: 1 }); gsap.set(B1, { opacity: 1 }); gsap.set([A1, A2], { opacity: 0 });
      idx = n;
    }, 1.45);
    tl.to(B1, { morphSVG: { shape: holeBig, shapeIndex: 0 }, duration: 1.15, ease }, 1.5);
    tl.to(B2, { morphSVG: { shape: holeBig, shapeIndex: 0 }, duration: 1.15, ease }, 1.66);
    tl.add(() => enter(next), 1.95);
  };
  const schedule = () => { timer && timer.kill(); timer = gsap.delayedCall(2.6, () => go(idx + 1)); };

  const onNext = () => go(idx + 1);
  nextBtn.addEventListener('click', onNext);
  const hs = btns.map((b, i) => { const f = () => go(i, b); b.addEventListener('click', f); return [b, f]; });
  enter(pages[0]);
  schedule();
  return () => { timer && timer.kill(); tl && tl.kill(); nextBtn.removeEventListener('click', onNext); hs.forEach(([b, f]) => b.removeEventListener('click', f)); gsap.killTweensOf(root.querySelectorAll('*')); };
}
