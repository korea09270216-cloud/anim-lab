export default function init(root, ctx) {
  const svg = root.querySelector('.s013__svg');
  const ids = ['s013p0', 's013p1', 's013p2'];
  const paths = ids.map(i => root.querySelector('#' + i));
  const tps = [...root.querySelectorAll('textPath')];
  const units = ['FRESH FROM THE SEA ✦ 오늘 잡은 바다 ✦ ', '해풍수산 ✦ SINCE 1987 ✦ 자갈치 새벽 경매 ✦ ', 'LIVE · 활어 · 선어 · 건어 · 제철 · '];
  tps.forEach((tp, i) => { tp.textContent = units[i].repeat(14); });
  const ulen = [0, 0, 0];
  const measure = () => tps.forEach((tp, i) => { ulen[i] = tp.getComputedTextLength() / 14; });
  requestAnimationFrame(measure); setTimeout(measure, 300);
  // 각 리본의 기준선: y 기준, 진폭, 위상 속도, 파장
  const cfg = [{ y: 250, a: 120, s: .55, w: 1.5 }, { y: 430, a: 150, s: -.4, w: 1.1 }, { y: 640, a: 100, s: .7, w: 1.9 }];
  const N = 10, X0 = -220, X1 = 1660;
  const ctrl = (pts) => { // Catmull-Rom -> cubic Bezier
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      d += `C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  let prog = 0, vel = 0, drift = [0, 0, 0], mx = 720, my = 405, sv = 0;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { prog = s.progress; vel = s.getVelocity(); } });
  let visible = true;
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  let lastT = 0;
  const off = ctx.tick((time) => {
    if (!visible) return;
    const dt = Math.min(.05, time - lastT); lastT = time;
    const rr = svg.getBoundingClientRect();
    const sc = Math.max(rr.width / 1440, rr.height / 810);
    const ox = (rr.width - 1440 * sc) / 2, oy = (rr.height - 810 * sc) / 2;
    const tx = (ctx.mouse.x - rr.left - ox) / sc, ty = (ctx.mouse.y - rr.top - oy) / sc;
    mx += (tx - mx) * .08; my += (ty - my) * .08;
    sv += (Math.max(-3000, Math.min(3000, vel)) - sv) * .08; vel *= .9;
    cfg.forEach((c, k) => {
      const pts = [];
      for (let i = 0; i < N; i++) {
        const x = X0 + (X1 - X0) * i / (N - 1);
        let y = c.y + c.a * Math.sin(time * c.s + i * c.w + prog * 5 * (k + 1) * .6);
        // 커서가 리본을 눌러 밀어낸다
        const dx = x - mx, dy = y - my, g = Math.exp(-(dx * dx) / 90000) * Math.exp(-(dy * dy) / 60000);
        y += (dy >= 0 ? 1 : -1) * g * 90;
        pts.push([x, y]);
      }
      paths[k].setAttribute('d', ctrl(pts));
      const dir = k === 1 ? -1 : 1;
      drift[k] += dt * (46 + k * 20) * dir + sv * dt * .12 * dir;
      const u = ulen[k] || 600;
      const o = -((((drift[k] + prog * 2200 * dir) % u) + u) % u) - u;
      tps[k].setAttribute('startOffset', o.toFixed(1));
    });
  });
  return () => { off(); st.kill(); io.disconnect(); };
}
