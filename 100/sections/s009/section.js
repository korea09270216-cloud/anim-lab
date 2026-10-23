export default function init(root, ctx) {
  const pile = root.querySelector('.s009__pile');
  const cnt = root.querySelector('.s009__cnt b');
  const N = 12;
  const scenes = [
    'radial-gradient(circle at 50% 62%,#ffe08a 0 11%,#ff9a4d 12% 20%,transparent 21%),linear-gradient(#f9b5a0,#f06a6a 48%,#3d4f7a 49%,#243257)',
    'repeating-linear-gradient(115deg,rgba(255,255,255,.35) 0 6px,transparent 6px 22px),linear-gradient(#37b4e6,#0a6cc4)',
    'radial-gradient(120% 70% at 20% 100%,#7fae6a 0 55%,transparent 56%),radial-gradient(120% 80% at 90% 100%,#4f8e5a 0 55%,transparent 56%),linear-gradient(#ffd0d8,#f7a3c0)',
    'radial-gradient(circle at 22% 38%,#ffe7a3 0 4%,transparent 5%),radial-gradient(circle at 54% 30%,#ffe7a3 0 4%,transparent 5%),radial-gradient(circle at 82% 42%,#ffe7a3 0 4%,transparent 5%),linear-gradient(#152046,#3a2f63 70%,#1a1a2e 71%)',
    'conic-gradient(from 0deg at 50% 100%,#e4363f 0 25%,#fff 25% 26%,#e4363f 26% 50%,#fff 50% 51%,#e4363f 51% 75%,#fff 75% 76%,#e4363f 76%)',
    'radial-gradient(circle at 30% 40%,#1c5c3a 0 24%,transparent 25%),radial-gradient(circle at 68% 60%,#2f8a54 0 30%,transparent 31%),linear-gradient(#e6f2c8,#b9dc8c)',
  ];
  const labels = ['속초 해변 · 7월 14일', '제주 협재 · 수영장 말고 바다', '남해 다랭이마을', '새벽 두 시 편의점 앞', '수박은 이 정도는 되어야', '비 온 뒤 초록', '고속버스 창가', '민박집 마당', '해 지기 직전', '아이스크림 녹기 전에', '마지막 날 아침', '필름 한 롤 끝'];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const eo3 = gsap.parseEase('power3.out'), ei2 = gsap.parseEase('power2.in'), eo4 = gsap.parseEase('expo.out');
  const win = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const cards = [];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div'); el.className = 's009__ph';
    el.innerHTML = `<small>'24 ${String(7 + (i % 3)).padStart(2, '0')} ${String(3 + i * 2).padStart(2, '0')}</small><i style="background:${scenes[i % scenes.length]}"></i><span>${labels[i]}</span>`;
    pile.appendChild(el);
    const side = i % 3, dir = side === 0 ? -1 : side === 1 ? 1 : 0;
    cards.push({
      el, a: .03 + i * (.9 / N), len: .1,
      x0: dir ? dir * (innerWidth * .8 + rnd() * 200) : (rnd() - .5) * 600, y0: dir ? (rnd() - .5) * 500 - 120 : -innerHeight * .95,
      r0: (rnd() < .5 ? -1 : 1) * (60 + rnd() * 90),
      x1: (rnd() - .5) * 120 + (i % 2 ? 10 : -10), y1: (rnd() - .5) * 70, r1: (rnd() - .5) * 26,
    });
  }
  let target = 0, cur = 0, cntV = -1, tx = 0, ty = 0;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; } });
  const t0 = performance.now();
  const off = ctx.tick(() => {
    cur += (target - cur) * .12;
    const t = (performance.now() - t0) / 1000;
    tx += ((ctx.mouse.nx - .5) - tx) * .06; ty += ((ctx.mouse.ny - .5) - ty) * .06;
    pile.style.transform = `rotateX(${(-ty * 10).toFixed(2)}deg) rotateY(${(tx * 14).toFixed(2)}deg)`;
    let landed = 0;
    cards.forEach((c, i) => {
      const q = win(cur, c.a, c.a + c.len);
      if (q >= 1) landed++;
      const nx_ = cards[i + 1], cov_ = nx_ ? win(cur, nx_.a, nx_.a + nx_.len) : 0;
      const key = q.toFixed(3) + '|' + cov_.toFixed(2);
      if (key === c.key) return;
      c.key = key;
      const fx = eo3(q), fy = ei2(q), fr = eo4(q);
      const x = c.x0 + (c.x1 - c.x0) * fx;
      const y = c.y0 + (c.y1 - c.y0) * (q < 1 ? fy * .55 + eo3(q) * .45 : 1);
      const rot = c.r0 + (c.r1 - c.r0) * fr + Math.sin(q * Math.PI * 2) * 9 * (1 - q);
      const sc = 1 + .5 * (1 - ei2(q)) * (q < 1 ? 1 : 0) + (q > .88 && q < 1 ? Math.sin((q - .88) / .12 * Math.PI) * .035 : 0);
      const hgt = (sc - 1) * 2 + (q > 0 && q < 1 ? .15 : 0);
      c.el.style.opacity = q <= 0 ? 0 : Math.min(1, q * 8);
      c.el.style.transform = `translate3d(${x}px,${y}px,${(sc - 1) * 160}px) rotate(${rot}deg) scale(${sc})`;
      c.el.style.boxShadow = `0 ${4 + hgt * 60}px ${10 + hgt * 70}px rgba(40,24,8,${.32 - hgt * .12}),0 1px 2px rgba(40,24,8,.4)`;
      const next = cards[i + 1];
      const covered = next ? win(cur, next.a, next.a + next.len) : 0;
      c.el.style.filter = `brightness(${1 - .1 * covered})`;
    });
    if (landed !== cntV) {
      cntV = landed; cnt.textContent = String(landed).padStart(2, '0');
      gsap.fromTo(cnt, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .5, ease: 'expo.out' });
    }
  });
  return () => { off(); st.kill(); gsap.killTweensOf(cnt); };
}
