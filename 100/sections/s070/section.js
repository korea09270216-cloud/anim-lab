const TEAM = [
  { n: '김하늘', r: 'Head Roaster', y: '로스터 14년', q: '"같은 원두도 날씨 따라 1도씩 다르게 볶아요. 그 1도가 한 잔의 단맛을 결정합니다."', bg: '#ffb347', ink: '#3a1d00', skin: '#f2b88f', hair: '#2a1608', shirt: '#3a1d00', hs: 0 },
  { n: '박지우', r: 'Barista Trainer', y: '교육 9년', q: '"레시피는 가르칠 수 있지만 손님의 하루를 읽는 눈은 같이 서 있어야 배워요."', bg: '#ff7aa8', ink: '#3b0620', skin: '#f6c7a4', hair: '#3b0620', shirt: '#fff0e8', hs: 1 },
  { n: '이도윤', r: 'Green Bean Buyer', y: '농가 직거래 11년', q: '"해마다 에티오피아로 갑니다. 농부의 손을 잡고 컵 테스트를 해야 가격을 정할 수 있어요."', bg: '#8fd694', ink: '#0d2b12', skin: '#c68d62', hair: '#1a1008', shirt: '#0d2b12', hs: 2 },
  { n: '최서연', r: 'Store Supervisor', y: '운영 지원 7년', q: '"점주님 전화가 오면 3분 안에 받는다는 게 우리의 첫 번째 약속입니다."', bg: '#7fc8ff', ink: '#06233d', skin: '#f0b68f', hair: '#2e1c10', shirt: '#06233d', hs: 3 },
  { n: '정민호', r: 'Menu Developer', y: '개발 6년', q: '"시즌 메뉴 한 개에 시제품 40번. 안 팔려도 좋으니 다음 계절에 또 만들고 싶은 맛을 찾아요."', bg: '#c3a6ff', ink: '#1e0a47', skin: '#e9ac84', hair: '#140a2e', shirt: '#fff0e8', hs: 0 },
  { n: '한소라', r: 'Franchise Owner · 성수', y: '점주 8년', q: '"6평에서 시작해 지금은 직원 7명. 본사가 있어서 혼자라는 느낌이 들지 않았어요."', bg: '#ffe066', ink: '#3d3000', skin: '#f3c09a', hair: '#4a2b12', shirt: '#3d3000', hs: 1 },
];
const hair = (t, c) => [
  `<path d="M60 70 Q60 22 100 22 Q140 22 140 70 Q130 46 100 46 Q70 46 60 70Z" fill="${c}"/>`,
  `<path d="M56 100 Q50 18 100 18 Q150 18 144 100 Q140 54 100 50 Q60 54 56 100Z" fill="${c}"/>`,
  `<path d="M58 70 Q60 28 100 26 Q140 28 142 70 Q120 40 100 40 Q80 40 58 70Z" fill="${c}"/><circle cx="100" cy="22" r="16" fill="${c}"/>`,
  `<path d="M60 74 Q56 20 100 20 Q144 20 140 74 Q126 38 100 40 Q74 38 60 74Z" fill="${c}"/>`,
][t];
const avatar = m => `<svg viewBox="0 0 200 220"><path d="M20 220 Q30 150 100 146 Q170 150 180 220Z" fill="${m.shirt}"/><rect x="88" y="120" width="24" height="34" rx="10" fill="${m.skin}"/><ellipse cx="100" cy="86" rx="40" ry="46" fill="${m.skin}"/>${hair(m.hs, m.hair)}<circle cx="86" cy="90" r="3.4" fill="${m.ink}"/><circle cx="114" cy="90" r="3.4" fill="${m.ink}"/><path d="M90 108 Q100 116 110 108" fill="none" stroke="${m.ink}" stroke-width="3.2" stroke-linecap="round"/></svg>`;

export default function init(root, ctx) {
  const fan = root.querySelector('[data-fan]'), stage = root.querySelector('[data-stage]');
  fan.innerHTML = TEAM.map(m => `<article class="s070__card" style="background:${m.bg};color:${m.ink}"><span class="s070__yr">${m.y}</span><div class="s070__av">${avatar(m)}</div><div class="s070__info"><div class="s070__role">${m.r}</div><h3 class="s070__name">${m.n}</h3><p class="s070__q">${m.q}</p></div></article>`).join('');
  const cards = [...fan.children]; const N = cards.length;
  const S = cards.map((el, i) => ({ el, i, a: 0, y: 0, s: 1, x: 0 }));
  let spread = 0.05, spreadT = .05, focus = (N - 1) / 2, focusT = focus, hover = false, vis = false;

  // 스크롤: 섹션이 들어올수록 부채가 펼쳐진다 (스택 → 펼침)
  const st = ScrollTrigger.create({ trigger: root, start: 'top 85%', end: 'top 15%', scrub: true, onUpdate: self => { spreadT = .05 + self.progress * .95; } });

  const onMove = e => {
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    focusT = Math.max(0, Math.min(N - 1, (px - .22) / .56 * (N - 1)));
    hover = true;
  };
  const onLeave = () => { hover = false; };
  stage.addEventListener('pointermove', onMove); stage.addEventListener('pointerleave', onLeave);
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { threshold: 0 }); io.observe(root);

  const ANG = 11, t0 = performance.now();
  const off = ctx.tick(() => {
    if (!vis) return;
    const T = (performance.now() - t0) / 1000;
    if (!hover) focusT = (N - 1) / 2 + Math.sin(T * .7) * (N - 1) * .46; // idle: 포커스가 파도처럼
    spread += (spreadT - spread) * .08;
    focus += (focusT - focus) * (hover ? .14 : .05);
    let top = -1, best = 99;
    S.forEach(c => {
      const t = c.i - (N - 1) / 2, d = c.i - focus, g = Math.exp(-d * d / 1.1), g2 = Math.exp(-d * d / 3.2);
      const a = t * ANG * spread + Math.sign(d) * (1 - Math.exp(-Math.abs(d))) * 5.5 * g2 * spread + Math.sin(T * 1.1 + c.i) * .5 * spread;
      const y = -g * 70 * spread - Math.cos(T * .9 + c.i * 1.3) * 3;
      const s = 1 + g * .22 * spread;
      c.a += (a - c.a) * .2; c.y += (y - c.y) * .2; c.s += (s - c.s) * .2;
      c.el.style.transform = `rotate(${c.a.toFixed(2)}deg) translateY(${c.y.toFixed(1)}px) scale(${c.s.toFixed(3)})`;
      if (Math.abs(d) < best) { best = Math.abs(d); top = c.i; }
    });
    S.forEach(c => { c.el.style.zIndex = c.i === top ? 20 : 10 - Math.abs(c.i - top); });
  });

  return () => { off(); st.kill(); io.disconnect(); stage.removeEventListener('pointermove', onMove); stage.removeEventListener('pointerleave', onLeave); };
}
