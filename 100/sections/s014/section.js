export default function init(root, ctx) {
  const items = [...root.querySelectorAll('li')];
  const washes = [...root.querySelectorAll('.s014__wash')];
  const words = items.map(li => li.querySelector('.s014__word'));
  const chars = words.map(w => {
    const t = w.dataset.w; w.textContent = '';
    return [...t].map(c => {
      const s = document.createElement('span'); s.className = 's014__c';
      s.innerHTML = `<span data-t="${c}">${c}</span>`; w.appendChild(s); return s.firstChild;
    });
  });
  let active = -1, z = 1, lastPt = { x: 0, y: 0 }, hovering = false;
  const R = () => Math.hypot(root.offsetWidth, root.offsetHeight);
  const rel = (x, y) => { const r = root.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
  const activate = (i, pt) => {
    if (i === active) return;
    const prev = active; active = i; lastPt = pt;
    const w = washes[i]; w.style.zIndex = ++z;
    gsap.killTweensOf(w);
    gsap.fromTo(w, { clipPath: `circle(0px at ${pt.x}px ${pt.y}px)` }, { clipPath: `circle(${R()}px at ${pt.x}px ${pt.y}px)`, duration: 1.1, ease: 'expo.out', onComplete: () => washes.forEach((o, j) => { if (j !== active) gsap.set(o, { clipPath: 'circle(0px at 50% 50%)' }); }) });
    root.style.color = items[i].dataset.fg;
    items.forEach((li, j) => gsap.to(li, { opacity: j === i ? 1 : .55, duration: .5, ease: 'power3.out' }));
    gsap.to(chars[i], { yPercent: -100, duration: .7, ease: 'expo.out', stagger: .035, overwrite: true });
    gsap.to(words[i], { x: 28, duration: .8, ease: 'expo.out' });
    if (prev >= 0) {
      gsap.to(chars[prev], { yPercent: 0, duration: .6, ease: 'expo.out', stagger: .02, overwrite: true });
      gsap.to(words[prev], { x: 0, duration: .8, ease: 'expo.out' });
    }
  };
  const deactivate = () => {
    if (active < 0) return;
    const i = active; active = -1;
    gsap.to(washes[i], { clipPath: `circle(0px at ${lastPt.x}px ${lastPt.y}px)`, duration: .8, ease: 'expo.inOut' });
    root.style.color = '#111';
    items.forEach(li => gsap.to(li, { opacity: 1, duration: .5 }));
    gsap.to(chars[i], { yPercent: 0, duration: .6, ease: 'expo.out', stagger: .02, overwrite: true });
    gsap.to(words[i], { x: 0, duration: .8, ease: 'expo.out' });
  };
  const offs = items.map((li, i) => {
    const enter = e => { hovering = true; activate(i, rel(e.clientX, e.clientY)); };
    const move = e => { lastPt = rel(e.clientX, e.clientY); };
    li.addEventListener('pointerenter', enter); li.addEventListener('pointermove', move);
    return () => { li.removeEventListener('pointerenter', enter); li.removeEventListener('pointermove', move); };
  });
  const leave = e => { hovering = false; lastPt = rel(e.clientX, e.clientY); deactivate(); };
  root.addEventListener('pointerleave', leave);
  // 포인터가 없을 때 스스로 한 줄씩 롤링 (idle)
  let seq = 0, visible = true;
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  const auto = setInterval(() => {
    if (hovering || !visible) return;
    const idx = seq % items.length, r = items[idx].getBoundingClientRect(), rr = root.getBoundingClientRect();
    activate(idx, { x: rr.width * .82, y: r.top - rr.top + r.height / 2 });
    seq++;
  }, 2200);
  return () => { clearInterval(auto); offs.forEach(f => f()); root.removeEventListener('pointerleave', leave); io.disconnect(); gsap.killTweensOf([...washes, ...items, ...words, ...chars.flat()]); };
}
