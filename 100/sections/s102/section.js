export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const INV = 9000, MAXM = 36, YMAX = 18000;
  const X0 = 60, W = 790, Y0 = 390, H = 366;
  const xOf = m => X0 + W * m / MAXM, yOf = v => Y0 - H * v / YMAX;
  const input = $('[data-in]');
  const line = $('[data-line]'), area = $('[data-area]'), inv = $('[data-invest]');
  const pin = $('[data-pin]'), reveal = $('[data-reveal]'), tagT = $('[data-tagt]'), drop = $('[data-drop]');
  const fill = el => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');

  // 격자 + 축 라벨
  const grid = $('[data-grid]');
  for (let v = 0; v <= YMAX; v += 3000) {
    const l = document.createElementNS(NS, 'line'); l.setAttribute('class', 's102__grid'); l.setAttribute('x1', X0); l.setAttribute('x2', X0 + W); l.setAttribute('y1', yOf(v)); l.setAttribute('y2', yOf(v)); grid.appendChild(l);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 's102__gt'); t.setAttribute('x', X0 - 10); t.setAttribute('y', yOf(v) + 4); t.setAttribute('text-anchor', 'end'); t.textContent = v.toLocaleString('ko-KR'); grid.appendChild(t);
  }
  for (let m = 0; m <= MAXM; m += 6) {
    const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 's102__gt'); t.setAttribute('x', xOf(m)); t.setAttribute('y', Y0 + 24); t.setAttribute('text-anchor', 'middle'); t.textContent = m + '개월'; grid.appendChild(t);
  }
  inv.setAttribute('d', `M${X0} ${yOf(INV)}H${X0 + W}`);
  $('[data-il]').setAttribute('y', yOf(INV) - 10);

  // 누적 순이익: 오픈 초기 4개월은 성장 구간(35→57→79→100%)
  function series(net) {
    const c = [0];
    for (let k = 1; k <= MAXM; k++) c.push(c[k - 1] + net * Math.min(1, .35 + .22 * (k - 1)));
    return c;
  }
  function pathOf(c) {
    const P = c.map((v, m) => [xOf(m), yOf(v)]);
    let d = `M${P[0][0]} ${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      d += `C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
    }
    return d;
  }
  function cross(c) {
    for (let m = 1; m <= MAXM; m++) if (c[m] >= INV) return m - 1 + (INV - c[m - 1]) / (c[m] - c[m - 1]);
    return null;
  }

  const view = { months: 0, c12: 0, c36: 0 };
  const monthsEl = $('[data-months]'), muEl = $('[data-mu]'), subEl = $('[data-sub]');
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  let ringTl = null;
  function setNum() {
    monthsEl.textContent = view.months > 0 ? Math.round(view.months) : '–';
    $('[data-c12]').textContent = fmt(view.c12) + '만원'; $('[data-c36]').textContent = fmt(view.c36) + '만원';
  }
  let cur = null;
  function update(net) {
    const c = series(net), mx = cross(c); cur = { c, mx };
    const d = pathOf(c);
    gsap.set(line, { clearProps: 'strokeDasharray,strokeDashoffset' });
    line.setAttribute('d', d);
    area.setAttribute('d', d + `L${xOf(MAXM)} ${Y0}L${X0} ${Y0}Z`);
    $('[data-net]').textContent = net + '만원'; fill(input);
    const N = mx == null ? 36 : Math.ceil(mx);
    muEl.textContent = mx == null ? '개월 +' : '개월';
    subEl.textContent = mx == null ? '36개월 안에는 투자금 회수가 어려운 구간입니다' : `월 순이익 ${net}만원이면 약 ${N}개월 뒤 투자금 회수`;
    gsap.to(view, { months: N, c12: c[12], c36: c[36], duration: .8, ease: 'expo.out', overwrite: true, onUpdate: setNum });
    if (mx == null) { gsap.to(pin, { opacity: 0, duration: .3 }); }
    else {
      tagT.textContent = N + '개월';
      gsap.set(pin, { x: xOf(mx), y: yOf(INV) });
      drop.setAttribute('y2', Y0 - yOf(INV));
      if (drawn) gsap.to(pin, { opacity: 1, duration: .3 });
    }
  }
  let drawn = false, drawTl = null;
  function redraw() {
    drawTl && drawTl.kill();
    const mx = cur && cur.mx;
    drawTl = gsap.timeline();
    drawTl.fromTo(line, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.5, ease: 'expo.inOut' }, 0)
      .fromTo(reveal, { attr: { width: 0 } }, { attr: { width: W + 4 }, duration: 1.5, ease: 'expo.inOut' }, 0);
    gsap.set(pin, { opacity: 0 }); drawn = false;
    if (mx != null) {
      drawTl.call(() => { drawn = true; }, null, 1.5 * Math.min(.85, .3 + mx / MAXM * .7));
      drawTl.fromTo(pin, { opacity: 0 }, { opacity: 1, duration: .25 }, 1.5 * Math.min(.85, .3 + mx / MAXM * .7));
      drawTl.fromTo(tagT.parentNode, { scale: .3, transformOrigin: '50% 100%' }, { scale: 1, duration: .7, ease: 'expo.out' }, '<');
    } else drawn = true;
  }
  // 교차점 맥동
  ringTl = gsap.timeline({ repeat: -1 });
  ['[data-r1]', '[data-r2]'].forEach((s, i) => ringTl.fromTo($(s), { attr: { r: 9 }, opacity: .8 }, { attr: { r: 40 }, opacity: 0, duration: 1.8, ease: 'power2.out' }, i * .9));

  fill(input); update(+input.value);
  input.addEventListener('input', () => update(+input.value));
  input.addEventListener('change', redraw);

  // 데모 루프
  let demo = null;
  const stop = () => demo && demo.kill();
  input.addEventListener('pointerdown', stop); input.addEventListener('keydown', stop);
  function startDemo() {
    const P = { v: +input.value };
    demo = gsap.timeline({ repeat: -1 });
    [900, 300, 700, 420].forEach(v => {
      demo.to(P, { v, duration: 2, ease: 'power3.inOut', onUpdate: () => { input.value = Math.round(P.v / 10) * 10; update(+input.value); } })
        .call(redraw).to({}, { duration: 2.4 });
    });
  }
  const st = ScrollTrigger.create({ trigger: root, start: 'top 78%', once: true, onEnter: () => { redraw(); gsap.delayedCall(3.4, startDemo); } });
  gsap.set(reveal, { attr: { width: 0 } }); gsap.set(line, { drawSVG: '0%' });
  return () => { st.kill(); demo && demo.kill(); drawTl && drawTl.kill(); ringTl.kill(); gsap.killTweensOf(view); };
}
