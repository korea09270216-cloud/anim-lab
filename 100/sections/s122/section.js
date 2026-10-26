export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const spin = q('.s122__spin'), ptr = q('.s122__ptr'), btn = q('.s122__btn'), wheelbox = q('.s122__wheelbox');
  const rt = q('.s122__rt'), rd = q('.s122__rd'), cta = q('.s122__cta'), result = q('.s122__result');
  const PR = [
    ['가맹비', '30% 지원', '가맹비 30% 지원 · 계약 시 즉시 차감'],
    ['인테리어', '감리 무상', '인테리어 감리비 전액 무상 제공'],
    ['교육비', '면제', '본사 3주 교육 과정 교육비 면제'],
    ['오픈 마케팅', '200만 원', '오픈 첫 달 지역 마케팅비 지원'],
    ['초도 물품', '무상 공급', '오픈 초도 물품 1회 무상 공급'],
    ['로열티', '3개월 면제', '오픈 후 3개월 로열티 면제'],
    ['POS 설치', '무상', 'POS·주방 디스플레이 무상 설치'],
    ['신메뉴', '우선 공급', '시즌 신메뉴 우선 공급권 부여'],
  ];
  const N = PR.length, SL = 360 / N, R = 262;
  const pt = (r, a) => [(r * Math.sin(a * Math.PI / 180)).toFixed(2), (-r * Math.cos(a * Math.PI / 180)).toFixed(2)];
  const mk = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); par && par.appendChild(e); return e; };
  const COL = ['#fff3dc', '#ffd47a'];
  const slices = PR.map((p, i) => {
    const g = mk('g', {}, spin), a0 = i * SL - SL / 2, a1 = i * SL + SL / 2;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1);
    mk('path', { d: `M0 0 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`, fill: COL[i % 2], stroke: '#1f0d08', 'stroke-width': 3 }, g);
    const t = mk('g', { transform: `rotate(${i * SL})` }, g);
    const t1 = mk('text', { y: -R * .8, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 800, fill: '#7a1c08' }, t); t1.textContent = p[0];
    const t2 = mk('text', { y: -R * .8 + 34, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 900, fill: '#1f0d08', 'letter-spacing': '-1' }, t); t2.textContent = p[1];
    return g;
  });
  // 림 전구
  const bulbs = [];
  mk('circle', { r: R + 14, fill: 'none', stroke: '#1f0d08', 'stroke-width': 26 }, spin);
  for (let i = 0; i < 24; i++) { const [x, y] = pt(R + 14, i * 15); bulbs.push(mk('circle', { cx: x, cy: y, r: 6, fill: '#ffd47a' }, spin)); }

  let rot = 0, busy = false, user = false, vis = false, lastIdx = 0, shown = false;
  const norm = a => ((a % 360) + 360) % 360;
  const EZ = CustomEase.create('s122spin', 'M0,0 C0.28,0 0.08,1 1,1');
  const sparks = [];
  function burst() {
        for (let i = 0; i < 18; i++) {
      const s = document.createElement('i'); s.className = 's122__spark';
      s.style.background = ['#ffd47a', '#fff3dc', '#1f0d08'][i % 3];
      s.style.left = '50%'; s.style.top = '30px';
      result.appendChild(s);
      const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 170;
      gsap.fromTo(s, { scale: 0 }, { x: Math.cos(a) * r, y: Math.sin(a) * r * .8 - 40, scale: .7 + Math.random() * 1.1, rotate: 240, duration: 1.1, ease: 'expo.out' });
      gsap.to(s, { opacity: 0, duration: .5, delay: .8, onComplete: () => s.remove() });
    }
  }
  function land(i) {
    busy = false; btn.disabled = false;
    slices.forEach((g, k) => gsap.to(g, { opacity: k === i ? 1 : .55, duration: .5, ease: 'power2.out' }));
    gsap.fromTo(slices[i], { scale: 1 }, { scale: 1.045, duration: .9, ease: 'elastic.out(1,.4)', svgOrigin: '0 0' });
    rt.textContent = PR[i][0] + ' ' + PR[i][1]; rd.textContent = PR[i][2];
    gsap.fromTo(result, { scale: .86, y: 24 }, { scale: 1, y: 0, duration: 1.1, ease: 'elastic.out(1,.5)' });
    gsap.fromTo(rt, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .7, ease: 'expo.out' });
    cta.classList.add('on'); burst();
  }
  function go(i) {
    if (busy) return; busy = true; btn.disabled = true; cta.classList.remove('on');
    slices.forEach(g => gsap.to(g, { opacity: 1, scale: 1, duration: .3, svgOrigin: '0 0' }));
    rd.textContent = '돌아가는 중…';
    // 끝 각도: 당첨 슬라이스 중심이 포인터(위) 아래 오도록, 칸 안에서 ±0.3칸 지터
    const jit = (Math.random() - .5) * SL * .6;
    const finalMod = norm(-(i * SL) + jit);
    const to = rot + 360 * 5 + norm(finalMod - norm(rot));
    const o = { r: rot };
    lastIdx = Math.floor((rot + SL / 2) / SL);
    gsap.to(o, {
      r: to, duration: 5.4, ease: EZ,
      onUpdate() {
        rot = o.r; spin.setAttribute('transform', `rotate(${rot.toFixed(2)})`);
        const idx = Math.floor((-rot + SL / 2) / SL);
        if (idx !== lastIdx) { lastIdx = idx; gsap.fromTo(ptr, { rotation: -22 }, { rotation: 0, duration: .32, ease: 'elastic.out(1,.35)', overwrite: 'auto' }); }
      },
      onComplete() { rot = to; land(i); }
    });
  }
  const order = [2, 5, 0, 7, 3, 6, 1, 4];
  let oi = 0;
  const onBtn = () => { if (!user) { user = true; auto.kill(); } go(Math.floor(Math.random() * N)); };
  btn.addEventListener('click', onBtn);
  // 림 전구 점멸 (idle)
  const blink = gsap.to(bulbs, { opacity: .25, duration: .45, stagger: { each: .06, repeat: -1, yoyo: true, from: 'start' }, ease: 'steps(1)' });
  // 포인터 숨쉬기
  const breathe = gsap.to(ptr, { y: 5, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  // 자동 데모: 사용자가 만지기 전까지 주기적으로 스스로 돌린다
  const auto = gsap.timeline({ repeat: -1, paused: true });
  auto.to({}, { duration: 1.4 })
    .call(() => { if (!busy) go(order[oi++ % order.length]); })
    .to({}, { duration: 5.4 + 3.8 });
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; if (!user) auto.paused(!vis); blink.paused(!vis); breathe.paused(!vis); }, { threshold: .25 });
  io.observe(root);
  return () => { io.disconnect(); auto.kill(); blink.kill(); breathe.kill(); btn.removeEventListener('click', onBtn); gsap.killTweensOf([ptr, rt, result]); };
}
