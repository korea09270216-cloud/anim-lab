export default function init(root, ctx) {
  const world = root.querySelector('.s074__world'), listEl = root.querySelector('.s074__list');
  const wave = (n, a) => `polygon(${Array.from({ length: n * 2 }, (_, i) => { const t = i / (n * 2) * Math.PI * 2, r = 50 - (i % 2 ? a : 0); return `${50 + Math.cos(t) * r}% ${50 + Math.sin(t) * r}%`; }).join(',')})`;
  const L = [
    { n: '접시', s: '도자기 · 지름 26cm', sz: 520, c: '#f6f2e8', t: 3, step: 0 },
    { n: '버터 구운 번 하단', s: '브리오슈 · 매일 새벽 베이킹', sz: 340, c: '#d98a3a', t: 12, shrink: .06, step: 1 },
    { n: '수제 패티', s: '한우 앞다리 · 180g', sz: 350, c: '#4b2a1c', t: 10, step: 1.8 },
    { n: '체다 치즈', s: '숙성 18개월', sz: 330, c: '#ffc62b', t: 2, sq: true, step: 2.4 },
    { n: '아삭 양상추', s: '당일 입고', sz: 390, c: '#7fc243', t: 2, clip: wave(14, 4), step: 3 },
    { n: '완숙 토마토', s: '대저 토마토', sz: 300, c: '#e23a2c', t: 5, step: 3.6 },
    { n: '참깨 번 상단', s: '통참깨 토핑', sz: 350, c: '#e7a24c', t: 18, shrink: .26, sesame: true, step: 4.6 }
  ];
  // 목록
  const items = L.slice(1).map((l, i) => { const li = document.createElement('li'); li.innerHTML = `<b>0${i + 1}</b><span>${l.n}</span><small>${l.s}</small>`; listEl.appendChild(li); return li; });
  const dark = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
  // 레이어 빌드: 얇은 슬라이스를 쌓아 부피를 만든다
  const layers = L.map((l, i) => {
    const el = document.createElement('div'); el.className = 's074__layer';
    if (i === 0) { const sh = document.createElement('div'); sh.className = 's074__shadow'; el.appendChild(sh); }
    for (let k = 0; k <= l.t; k++) {
      const s = document.createElement('div'); s.className = 's074__sl';
      const top = k === l.t, f = l.shrink ? 1 - l.shrink * Math.pow(k / l.t, 2.2) : 1;
      const bright = .62 + .38 * (k / l.t);
      s.style.cssText = `--sz:${l.sz * f}px;--c:${dark(l.c, bright)};transform:translateZ(${k * 2.4}px)`;
      if (l.sq) { s.style.setProperty('--r', '10px'); s.style.transform += ' rotate(22deg)'; }
      if (l.clip) s.style.clipPath = l.clip;
      if (top) {
        if (i === 0) s.style.background = 'radial-gradient(#f6f2e8 58%,#e5dccb 59% 62%,#f6f2e8 63%)';
        if (i === 2) s.style.background = 'radial-gradient(circle at 35% 30%,#6a3b27 0 8%,transparent 9%),radial-gradient(circle at 65% 60%,#3a2015 0 9%,transparent 10%),radial-gradient(circle at 50% 80%,#5e3524 0 7%,transparent 8%),#4b2a1c';
        if (i === 4) s.style.background = 'repeating-radial-gradient(circle at 50% 50%,#8fd150 0 14px,#6aab34 14px 28px)';
        if (i === 5) s.style.background = 'radial-gradient(circle,#f06a55 0 22%,#e23a2c 23% 60%,#c92b1f 61%)';
        if (l.sesame) {
          s.style.background = 'radial-gradient(circle at 40% 30%,#f7bd6a,#e7a24c 55%,#c8802c)';
          for (let q = 0; q < 26; q++) { const a = q * 2.4, r = 20 + (q * 53 % 100) * .7; const d = document.createElement('i'); d.style.cssText = `position:absolute;left:${50 + Math.cos(a) * r / 3.4}%;top:${50 + Math.sin(a) * r / 3.4}%;width:12px;height:6px;border-radius:50%;background:#fff3d6;transform:rotate(${q * 37}deg)`; s.appendChild(d); }
        }
      }
      el.appendChild(s);
    }
    world.appendChild(el); return el;
  });
  gsap.from(layers, { opacity: 0, duration: 1, stagger: .12, ease: 'power2.out', scrollTrigger: { trigger: root, start: 'top 70%' } });
  const st = { spread: 0, focus: 1, fv: 1, mx: 0, my: 0, rx: 0, rz: 0 };
  gsap.to(st, { spread: 1, duration: 2.6, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 60%' } });
  let last = -1, nextAt = 0, idleTimer = 0, lastMouse = [0, 0];
  const off = ctx.tick((time, dt) => {
    const mx = ctx.mouse.nx - .5, my = ctx.mouse.ny - .5;
    const moved = Math.hypot(mx - lastMouse[0], my - lastMouse[1]) > .002; lastMouse = [mx, my];
    if (moved) idleTimer = time + 3;
    // 포커스 층: 마우스가 최근 움직였으면 y 위치로, 아니면 2.2초마다 자동 순회
    if (time < idleTimer) st.focus = 1 + Math.round(Math.max(0, Math.min(.999, ctx.mouse.ny)) * 5.99 - .5);
    else if (time > nextAt) { st.focus = st.focus % 6 + 1; nextAt = time + 2.2; }
    st.fv += (st.focus - st.fv) * .08;
    const reduce = ctx.reduced ? .3 : 1;
    const breathe = Math.sin(time * .9) * 6 * reduce;
    st.mx += (mx - st.mx) * .05; st.my += (my - st.my) * .05;
    const rz = -34 + st.mx * 46 + Math.sin(time * .35) * 6 * reduce, rx = 62 + st.my * -14;
    world.style.transform = `rotateX(${rx}deg) rotateZ(${rz}deg) translateZ(-60px)`;
    layers.forEach((el, i) => {
      const l = L[i];
      let z = i === 0 ? 0 : (30 + l.step * 52 * st.spread);
      if (i > 0) { const d = Math.abs(st.fv - i); z += Math.max(0, 1 - d * 1.15) * 110 * st.spread; if (i > st.fv) z += 28 * st.spread * Math.min(1, st.fv - Math.floor(st.fv) + .01) * 0; }
      z += i * breathe * .6;
      el.style.transform = `translateZ(${z}px)`;
    });
    const on = Math.round(st.focus) - 1;
    if (on !== last) { last = on; items.forEach((li, k) => li.classList.toggle('is-on', k === on)); }
  });
  return () => off();
}
