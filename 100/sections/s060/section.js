export default function init(root, ctx) {
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#3a1d2b';
  const chars = [...root.querySelectorAll('.s060__char')];
  const SMILE = 'M-15 0 Q0 13 15 0', OPEN = 'M-10 -4 Q0 -10 10 -4 Q11 15 0 15 Q-11 15 -10 -4 Z';

  // 얼굴 조립: 눈 2개(흰자+눈동자+하이라이트) + 입
  const C = chars.map(el => {
    const svg = el.querySelector('svg'), face = el.querySelector('.face');
    const eyes = el.dataset.eyes.split(';').map(s => s.split(',').map(Number));
    const [mx, my] = el.dataset.mouth.split(',').map(Number);
    const eyeEls = eyes.map(([x, y]) => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${x} ${y})`);
      g.innerHTML = `<g class="lid"><circle r="21" fill="#fff" stroke="${INK}" stroke-width="5"/><g class="pu"><circle r="10" fill="${INK}"/><circle cx="3.4" cy="-3.6" r="3.2" fill="#fff"/></g></g>`;
      face.appendChild(g);
      return { x, y, lid: g.querySelector('.lid'), pu: g.querySelector('.pu'), px: 0, py: 0 };
    });
    const cheeks = [[-1, 1], [1, 1]].map(([s]) => { const c = document.createElementNS(NS, 'ellipse'); c.setAttribute('cx', mx + s * 50); c.setAttribute('cy', my - 4); c.setAttribute('rx', 12); c.setAttribute('ry', 7); c.setAttribute('fill', '#ff6f9d'); c.setAttribute('opacity', '.45'); face.appendChild(c); return c; });
    const mouth = document.createElementNS(NS, 'path');
    mouth.setAttribute('d', SMILE); mouth.setAttribute('fill', INK); mouth.setAttribute('fill-opacity', '0');
    mouth.setAttribute('stroke', INK); mouth.setAttribute('stroke-width', '5'); mouth.setAttribute('stroke-linecap', 'round'); mouth.setAttribute('stroke-linejoin', 'round');
    mouth.setAttribute('transform', `translate(${mx} ${my})`);
    face.appendChild(mouth);
    return { el, svg, body: el.querySelector('.body'), sh: el.querySelector('.sh'), eyes: eyeEls, mouth, cheeks, open: false, lidEls: eyeEls.map(e => e.lid) };
  });

  // 인트로: 윤곽선이 그려지고 색이 채워진다
  const ols = C.map(c => [...c.el.querySelectorAll('.ol')]);
  ols.forEach(list => list.forEach(o => { o._fill = o.getAttribute('fill'); gsap.set(o, { drawSVG: '0%', fillOpacity: 0 }); }));
  C.forEach(c => { const e = c.eyes; gsap.set(c.el.querySelector('.face'), { opacity: 0, scale: .6, svgOrigin: `${(e[0].x + e[1].x) / 2} ${e[0].y + 20}` }); });
  const intro = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 80%', once: true } });
  C.forEach((c, i) => {
    intro.to(ols[i], { drawSVG: '100%', duration: 1.5, ease: 'power3.inOut', stagger: .08 }, i * .25)
      .to(ols[i], { fillOpacity: 1, duration: .7, ease: 'power2.out' }, i * .25 + 1.1)
      .to(c.el.querySelector('.face'), { opacity: 1, scale: 1, duration: .9, ease: 'expo.out' }, i * .25 + 1.3);
  });

  // 숨쉬기(idle) + 랜덤 깜빡임
  const bob = C.map((c, i) => gsap.to(c.body, { y: -7, scaleY: 1.015, transformOrigin: '50% 100%', duration: 1.6 + i * .17, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * .3 }));
  const blinks = C.map(c => {
    const d = gsap.delayedCall(1.5 + Math.random() * 3, function blink() {
      gsap.timeline().to(c.lidEls, { scaleY: .08, duration: .07, ease: 'power2.in' }).to(c.lidEls, { scaleY: 1, duration: .16, ease: 'power2.out' });
      d.delay(1.8 + Math.random() * 3.5); d.restart(true);
    });
    return d;
  });
  gsap.set(C.flatMap(c => c.lidEls), { transformOrigin: '50% 50%' });

  // 입 상태(가까이 오면 놀란 입)
  const setOpen = (c, v) => {
    if (c.open === v) return; c.open = v;
    gsap.to(c.mouth, { morphSVG: v ? OPEN : SMILE, fillOpacity: v ? 1 : 0, duration: .5, ease: 'expo.out', overwrite: 'auto' });
    c.cheeks.forEach(e => gsap.to(e, { opacity: v ? .8 : .45, duration: .4 }));
  };

  // 시선 추적: 마우스가 멈춰 있으면 가상 커서가 리사주 곡선으로 두리번거린다
  let lastMove = -1e9, vx = innerWidth / 2, vy = innerHeight / 2, t0 = performance.now();
  const onMove = () => { lastMove = performance.now(); };
  addEventListener('pointermove', onMove, { passive: true });
  const off = ctx.tick(() => {
    const now = performance.now(), t = (now - t0) / 1000;
    const idle = now - lastMove > 1800;
    const tx = idle ? innerWidth * (.5 + Math.sin(t * .8) * .42) : ctx.mouse.x;
    const ty = idle ? innerHeight * (.5 + Math.sin(t * 1.3 + 1) * .3) : ctx.mouse.y;
    vx += (tx - vx) * .1; vy += (ty - vy) * .1;
    C.forEach(c => {
      const r = c.svg.getBoundingClientRect(); if (!r.width) return;
      const k = r.width / 300;
      c.eyes.forEach(e => {
        const ex = r.left + e.x * k, ey = r.top + e.y * k;
        const dx = vx - ex, dy = vy - ey, d = Math.hypot(dx, dy) || 1;
        const m = 10 * Math.min(1, d / (r.width * .9));
        e.px += (dx / d * m - e.px) * .3; e.py += (dy / d * m - e.py) * .3;
        e.pu.setAttribute('transform', `translate(${e.px.toFixed(2)} ${e.py.toFixed(2)})`);
      });
      const cx = r.left + r.width / 2, cy = r.top + r.height * .6;
      const near = Math.hypot(vx - cx, vy - cy) < r.width * .7;
      setOpen(c, near);
      // 몸이 커서 쪽으로 살짝 기운다
      c.svg.style.transform = `rotate(${Math.max(-1, Math.min(1, (vx - cx) / innerWidth * 2.2)) * 3.5}deg)`;
    });
  });

  return () => { off(); removeEventListener('pointermove', onMove); intro.scrollTrigger && intro.scrollTrigger.kill(); intro.kill(); bob.forEach(b => b.kill()); blinks.forEach(b => b.kill()); };
}
