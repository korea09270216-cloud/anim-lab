export default function init(root, ctx) {
  const slogans = ['갓지은아침', '바삭한점심', '따끈한저녁', '든든한야식'];
  const subs = ['냄비째 식지 않게. 새벽에 지은 밥과 갓 무친 나물을 가장 가까운 매장에서.', '점심엔 튀김과 전이 가장 바삭할 때. 11시 30분에 한 번 더 튀겨 냅니다.', '퇴근길 저녁 국과 찌개는 육수부터 직접. 팔팔 끓는 채로 포장합니다.', '밤 10시에도 불은 켜져 있습니다. 야식은 적게, 속은 든든하게.'];
  const N = 4, L = Math.max(...slogans.map(s => [...s].length));
  const el = root.querySelector('.s012__slogan'), idx = root.querySelector('[data-idx]'), sub = root.querySelector('[data-sub]'), bar = root.querySelector('.s012__bar i'), stage = root.querySelector('.s012__stage');
  const cells = [];
  for (let i = 0; i < L; i++) {
    const cell = document.createElement('span'); cell.className = 's012__cell';
    const chs = slogans.map(s => [...s][i] || ' ');
    chs.forEach((c, j) => {
      const f = document.createElement('span'); f.className = 's012__face'; f.textContent = c === ' ' ? '\u00a0' : c;
      f.style.transform = `rotateX(${-90 * j}deg) translateZ(var(--zd,60px))`;
      if (j % 2) f.style.color = '#d8ff3e';
      cell.appendChild(f);
    });
    el.appendChild(cell); cells.push(cell);
  }
  let zd = 60;
  const measure = () => {
    const h = cells[0].offsetHeight; zd = h / 2;
    root.style.setProperty('--zd', zd + 'px');
    cells.forEach((c, i) => gsap.set(c, { z: -zd, transformOrigin: `50% 50% ${0}px` }));
    cells.forEach(c => c.querySelectorAll('.s012__face').forEach(f => { f.style.transform = f.style.transform.replace(/translateZ\([^)]*\)/, `translateZ(${zd}px)`); }));
  };
  measure();
  const ro = new ResizeObserver(measure); ro.observe(root);
  let step = 0, busy = false;
  const go = () => {
    step++; const j = step % N;
    gsap.to(cells, { rotateX: step * 90, duration: 1.15, ease: 'expo.inOut', stagger: { each: .07, from: step % 2 ? 'start' : 'end' }, overwrite: true });
    gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 2.6, ease: 'none', overwrite: true });
    idx.textContent = String(j + 1).padStart(2, '0') + ' / 04';
    gsap.fromTo(sub, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .9, ease: 'power4.out', delay: .5 });
    sub.textContent = subs[j];
  };
  gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 2.6, ease: 'none' });
  const timer = setInterval(go, 2800);
  const onClick = () => { clearInterval(timer); go(); };
  stage.addEventListener('click', onClick);
  // 포인터에 따라 원근 소실점과 기울기가 따라온다
  const off = ctx.tick(() => {
    const rr = stage.getBoundingClientRect();
    const px = ((ctx.mouse.x - rr.left) / rr.width) * 100, py = ((ctx.mouse.y - rr.top) / rr.height) * 100;
    const cx = parseFloat(stage.dataset.px || 50), cy = parseFloat(stage.dataset.py || 50);
    const nx = cx + (Math.max(0, Math.min(100, px)) - cx) * .06, ny = cy + (Math.max(0, Math.min(100, py)) - cy) * .06;
    stage.dataset.px = nx; stage.dataset.py = ny;
    stage.style.perspectiveOrigin = `${nx}% ${ny}%`;
    el.style.transform = `rotateY(${(nx - 50) * -.18}deg) rotateX(${(ny - 50) * .12}deg)`;
  });
  return () => { clearInterval(timer); stage.removeEventListener('click', onClick); ro.disconnect(); off(); gsap.killTweensOf([...cells, bar, sub]); };
}
