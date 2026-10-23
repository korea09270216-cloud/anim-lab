export default function init(root, ctx) {
  const grid = root.querySelector('.s075__grid');
  const COLS = 10, ROWS = 5;
  const svgA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a5c"/><stop offset="1" stop-color="#ffcf6b"/></linearGradient></defs><rect width="1000" height="500" fill="url(#a)"/><circle cx="500" cy="250" r="190" fill="#fff4dc"/><g fill="none" stroke="#d6452b" stroke-width="26" stroke-linecap="round"><path d="M360 230q35-40 70 0t70 0 70 0 70 0"/><path d="M360 280q35-40 70 0t70 0 70 0 70 0"/><path d="M360 330q35-40 70 0t70 0 70 0 70 0"/></g><path d="M300 420h400a200 130 0 0 1-400 0z" fill="#1d1240"/><path d="M0 500V420q120-60 250 0T500 440t250-30 250 20v70z" fill="#ff6b3d" opacity=".0"/><g fill="#1d1240"><circle cx="110" cy="110" r="46"/><circle cx="890" cy="120" r="30"/><circle cx="880" cy="400" r="58"/><circle cx="120" cy="400" r="34"/></g></svg>`;
  const svgB = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"><rect width="1000" height="500" fill="#1d1240"/><g fill="#ff6b3d"><circle cx="70" cy="70" r="26"/><circle cx="930" cy="430" r="26"/></g><text x="500" y="262" text-anchor="middle" font-family="Malgun Gothic,Apple SD Gothic Neo,sans-serif" font-weight="900" font-size="250" fill="#ffd0e8" letter-spacing="-10">면의 날</text><text x="500" y="392" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="92" fill="#ff6b3d" letter-spacing="14">EVERY WEDNESDAY</text><rect x="120" y="420" width="760" height="6" fill="#ffd0e8"/></svg>`;
  const uri = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  const A = uri(svgA), B = uri(svgB);
  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const c = document.createElement('div'); c.className = 's075__c';
    c.innerHTML = '<div class="s075__f"></div><div class="s075__b"></div>';
    c.firstChild.style.backgroundImage = A; c.lastChild.style.backgroundImage = B;
    grid.appendChild(c); cells.push(c);
  }
  const layout = () => {
    const W = grid.clientWidth, H = grid.clientHeight;
    cells.forEach(c => {
      const f = c.firstChild, b = c.lastChild, x = -c.offsetLeft, y = -c.offsetTop;
      [f, b].forEach(e => { e.style.backgroundSize = `${W}px ${H}px`; e.style.backgroundPosition = `${x}px ${y}px`; });
    });
  };
  layout();
  const ro = new ResizeObserver(layout); ro.observe(grid);
  gsap.set(cells, { transformPerspective: 900 });
  let state = 0, busy = false, tl, auto;
  const wave = (from) => {
    if (busy) return; busy = true; state = 1 - state;
    const each = .045, grd = [ROWS, COLS];
    tl = gsap.timeline({ onComplete: () => { busy = false; } });
    tl.to(cells, { rotationY: state * 180, duration: 1.15, ease: 'power3.inOut', stagger: { each, grid: grd, from } }, 0)
      .to(cells, { z: 70, duration: .5, ease: 'sine.out', yoyo: true, repeat: 1, stagger: { each, grid: grd, from } }, 0)
      .fromTo(cells, { rotationX: 0 }, { rotationX: -14, duration: .5, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: { each, grid: grd, from } }, 0);
  };
  const handlers = cells.map((c, i) => { const h = () => { if (!busy) { wave(i); restart(5); } }; c.addEventListener('pointerenter', h); return h; });
  const restart = (d) => { auto?.kill(); auto = gsap.delayedCall(d, function loop() { wave(Math.floor(Math.random() * cells.length)); auto = gsap.delayedCall(4.2, loop); }); };
  let armed = false;
  const st = ScrollTrigger.create({ trigger: root, start: 'top 60%', end: 'bottom 20%', onToggle: s => { if (s.isActive) { if (!armed) { armed = true; restart(1.4); } else restart(2); } else auto?.kill(); } });
  return () => { ro.disconnect(); st.kill(); auto?.kill(); tl?.kill(); cells.forEach((c, i) => c.removeEventListener('pointerenter', handlers[i])); };
}
