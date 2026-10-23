export default function init(root, ctx) {
  const N = 12, W = 240, R = Math.round((W / 2) / Math.tan(Math.PI / N)) + 70;
  const ring = root.querySelector('.s072__ring'), scene = root.querySelector('.s072__scene');
  const nameEl = root.querySelector('.s072__name'), noEl = root.querySelector('.s072__no');
  const names = ['성수동 오후 네 시','한강 노을 직전','전포 골목 간판','종로 새벽 시장','제주 협재 바람','을지로 인쇄소','연남 담벼락','부산 영도 다리','경주 대릉원 길','양양 서핑 비치','한남 빈 테라스','서촌 옥상 빨래'];
  const pal = [[28,60],[200,55],[345,60],[150,45],[45,70],[260,45],[10,65],[185,50],[95,45],[320,50],[215,60],[60,55]];
  const motif = (i, h, s) => {
    const a = `hsl(${h} ${s}% 62%)`, b = `hsl(${(h + 40) % 360} ${s}% 34%)`, c = `hsl(${(h + 180) % 360} ${s + 10}% 82%)`;
    const bg = `<defs><linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="220" height="282" fill="url(#g${i})"/>`;
    const m = [
      `<circle cx="110" cy="110" r="46" fill="${c}"/><path d="M0 220Q60 160 120 215T220 190V282H0z" fill="${b}"/>`,
      `<path d="M40 282V130a70 70 0 0 1 140 0v152z" fill="${c}"/><path d="M70 282V140a40 40 0 0 1 80 0v142z" fill="${b}"/>`,
      `<circle cx="80" cy="120" r="60" fill="${c}" opacity=".85"/><circle cx="140" cy="150" r="60" fill="${b}" opacity=".7"/><rect x="0" y="230" width="220" height="52" fill="${b}"/>`,
      `<g fill="${c}">${[0,1,2,3,4,5].map(k => `<rect x="${k * 38 - 6}" y="${40 + (k % 3) * 24}" width="22" height="${240 - (k % 3) * 24}"/>`).join('')}</g>`
    ][i % 4];
    return `<svg viewBox="0 0 220 282" preserveAspectRatio="xMidYMid slice">${bg}${m}<rect width="220" height="282" fill="#ffffff" opacity=".06"/></svg>`;
  };
  const cards = [];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 's072__card';
    el.style.transform = `rotateY(${i * 360 / N}deg) translateZ(${R}px)`;
    el.innerHTML = motif(i, pal[i][0], pal[i][1]) + `<small><span>${String(i + 1).padStart(2, '0')}</span><span>HARU ${35 + (i % 3) * 5}mm</span></small>`;
    ring.appendChild(el); cards.push(el);
  }
  gsap.from(cards, { opacity: 0, scale: .6, duration: 1.4, ease: 'expo.out', stagger: { each: .07, from: 'center' }, scrollTrigger: { trigger: root, start: 'top 70%' } });
  let rot = 0, vel = 0, drag = false, lx = 0, shown = -1;
  const down = (e) => { drag = true; lx = e.clientX; vel = 0; scene.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (!drag) return; const dx = e.clientX - lx; lx = e.clientX; rot += dx * .26; vel = vel * .5 + dx * .26 * .5; };
  const up = () => { drag = false; };
  scene.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  const auto = ctx.reduced ? .02 : .12;
  const off = ctx.tick(() => {
    if (!drag) { rot += vel; vel *= .94; const lv = ctx.lenis ? ctx.lenis.velocity || 0 : 0; rot += lv * .05; rot += auto * (1 - Math.min(1, Math.abs(vel) / .6)); }
    const tx = -8 + (ctx.mouse.ny - .5) * -6, ty = (ctx.mouse.nx - .5) * 0;
    ring.style.transform = `translateZ(${-R}px) rotateX(${tx}deg) rotateY(${rot}deg)`;
    let best = 0, bd = 999;
    cards.forEach((c, i) => {
      let a = ((i * 360 / N + rot) % 360 + 540) % 360 - 180;      // -180~180, 0=정면
      const ad = Math.abs(a);
      c.style.setProperty('--d', Math.min(.82, Math.max(0, (ad - 25) / 160)).toFixed(3));
      if (ad < bd) { bd = ad; best = i; }
    });
    if (best !== shown) { shown = best; noEl.textContent = String(best + 1).padStart(2, '0'); nameEl.textContent = names[best]; }
  });
  return () => { off(); scene.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
}
