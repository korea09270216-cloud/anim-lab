export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = $('.s058__svg'), planetsG = $('.s058__planets'), trailsG = $('.s058__trails');
  const cn = $('.s058__cn'), cv = $('.s058__cv'), legend = $('.s058__legend');
  const D = [
    { n: '단백질', v: '32g', c: '#5ef2d5', r: 140, s: 24, w: .34, a: 0 },
    { n: '탄수화물', v: '58g', c: '#ffc34d', r: 140, s: 31, w: .34, a: Math.PI },
    { n: '지방', v: '18g', c: '#ff6f91', r: 220, s: 18, w: -.22, a: 1.1 },
    { n: '식이섬유', v: '12g', c: '#a7ff6b', r: 220, s: 15, w: -.22, a: 4.3 },
    { n: '비타민 B', v: '100%', c: '#8aa6ff', r: 300, s: 16, w: .14, a: 2.2 },
    { n: '오메가3', v: '1.2g', c: '#ff9d6b', r: 300, s: 12, w: .14, a: 5.3 }
  ];
  D.forEach((d, i) => {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<circle class="halo" r="${d.s * 2.3}" fill="${d.c}" opacity=".16"/><circle class="body" r="${d.s}" fill="${d.c}"/>
      <text y="${d.s + 20}" text-anchor="middle" font-size="15" font-weight="700" fill="#e8edff" opacity=".85" font-family="Pretendard,Apple SD Gothic Neo,Malgun Gothic,sans-serif">${d.n}</text>`;
    planetsG.appendChild(g);
    const t = document.createElementNS(NS, 'path'); t.setAttribute('stroke', d.c); t.setAttribute('stroke-opacity', '.55'); trailsG.appendChild(t);
    Object.assign(d, { g, t, ox: 0, oy: 0, slow: 1, sc: 1, x: 0, y: 0 });
    legend.insertAdjacentHTML('beforeend', `<li style="--c:${d.c}"><i></i>${d.n}<em>${d.v}</em></li>`);
  });
  const lis = [...legend.children];

  let act = -1, lastHover = -1e9, lastCycle = performance.now(), inside = false;
  function setAct(i) {
    if (i === act) return; act = i;
    lis.forEach((l, k) => l.classList.toggle('is-on', k === i));
    cn.textContent = D[i].n; cv.textContent = D[i].v; cv.setAttribute('fill', D[i].c);
    gsap.fromTo([cn, cv], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .6, ease: 'expo.out', stagger: .06, overwrite: 'auto' });
  }
  setAct(0);
  const offs = lis.map((l, i) => { const f = () => { lastHover = performance.now(); setAct(i); }; l.addEventListener('pointerenter', f); return () => l.removeEventListener('pointerenter', f); });

  // 3D 틸트(커서) + 스크롤 진입 스케일
  const qx = gsap.quickTo(svg, 'rotationY', { duration: 1.1, ease: 'power3.out' });
  const qy = gsap.quickTo(svg, 'rotationX', { duration: 1.1, ease: 'power3.out' });
  const enter = gsap.fromTo(svg, { scale: .72, opacity: .2 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: root, start: 'top 90%', end: 'top 35%', scrub: .6 } });
  const ringsSpin = gsap.to($('.s058__rings'), { rotation: 360, svgOrigin: '400 400', duration: 120, ease: 'none', repeat: -1 });

  let tt = performance.now();
  const off = ctx.tick(() => {
    const now = performance.now(), dt = Math.min(.05, (now - tt) / 1000); tt = now;
    const r = svg.getBoundingClientRect(); if (!r.width) return;
    const m = ctx.mouse;
    const px = (m.x - r.left) / r.width * 800, py = (m.y - r.top) / r.height * 800;
    inside = px > -80 && px < 880 && py > -80 && py < 880;
    if (inside) { qx((m.nx - .5) * 18); qy(-(m.ny - .5) * 14); } else { qx(0); qy(0); }
    let hov = -1, best = 1e9;
    D.forEach((d, i) => {
      const target = inside && Math.hypot(px - d.x, py - d.y) < d.s * 1.9 + 24 ? 1 : 0;
      const dist = Math.hypot(px - d.x, py - d.y);
      if (target && dist < best) { best = dist; hov = i; }
    });
    D.forEach((d, i) => {
      // 속도: 호버/활성이면 거의 멈춘다 (관성으로 감속)
      const wantSlow = (i === hov || (hov < 0 && false)) ? .06 : 1;
      d.slow += (wantSlow - d.slow) * .08;
      d.a += d.w * dt * d.slow;
      // 중력: 커서 쪽으로 살짝 끌려간다
      const bx = 400 + Math.cos(d.a) * d.r, by = 400 + Math.sin(d.a) * d.r;
      let tx = 0, ty = 0;
      if (inside) { const dx = px - bx, dy = py - by, dist = Math.hypot(dx, dy) || 1; if (dist < 280) { const f = (1 - dist / 280) * 34; tx = dx / dist * f; ty = dy / dist * f; } }
      d.ox += (tx - d.ox) * .09; d.oy += (ty - d.oy) * .09;
      d.x = bx + d.ox; d.y = by + d.oy;
      const sc = (i === act ? 1.4 : 1) * (i === hov ? 1.1 : 1);
      d.sc += (sc - d.sc) * .12;
      d.g.setAttribute('transform', `translate(${d.x.toFixed(1)} ${d.y.toFixed(1)}) scale(${d.sc.toFixed(3)})`);
      // 혜성 꼬리
      const a0 = d.a - Math.sign(d.w) * .75, x0 = 400 + Math.cos(a0) * d.r, y0 = 400 + Math.sin(a0) * d.r;
      d.t.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)} A${d.r} ${d.r} 0 0 ${d.w > 0 ? 1 : 0} ${bx.toFixed(1)} ${by.toFixed(1)}`);
      d.t.setAttribute('stroke-width', i === act ? 6 : 3);
    });
    if (hov >= 0) { lastHover = now; setAct(hov); }
    else if (now - lastHover > 2500 && now - lastCycle > 2600) { lastCycle = now; setAct((act + 1) % D.length); }
  });

  return () => { off(); offs.forEach(f => f()); enter.scrollTrigger && enter.scrollTrigger.kill(); enter.kill(); ringsSpin.kill(); };
}
