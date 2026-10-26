export default function init(root, ctx) {
  const NS = 'http://www.w3.org/2000/svg';
  const S = [
    { name: '김서연 점주', ago: '성수점 · 2시간 전', c1: '#ffb199', c2: '#ff5f7e', glow: '#fff1c1', px: 215, profit: 1240, pay: 14, q: '“오픈 14개월 만에 투자금을 회수했어요. 본사 물류가 안정적이라 운영이 정말 편합니다.”' },
    { name: '박도현 점주', ago: '광주 상무점 · 어제', c1: '#8fd3f4', c2: '#4a5fe0', glow: '#e2f6ff', px: 105, profit: 980, pay: 17, q: '“직장 다니면서 시작했는데, 교육 4주만에 혼자 매장을 열 수 있었어요.”' },
    { name: '이나래 점주', ago: '대구 동성로점 · 3일 전', c1: '#f8c0ec', c2: '#8f7ad8', glow: '#fff0fb', px: 190, profit: 1105, pay: 15, q: '“1년차인데 단골이 벌써 절반이에요. 슈퍼바이저가 상권 분석까지 해줬어요.”' },
    { name: '정민수 점주', ago: '수원 광교점 · 1주 전', c1: '#ffd86f', c2: '#f4524d', glow: '#fff6d0', px: 130, profit: 1480, pay: 11, q: '“4년째 운영 중이고 2호점 준비 중입니다. 숫자가 말해주니 고민할 게 없었어요.”' }
  ];
  const DUR = 4.2, N = S.length;
  const q = s => root.querySelector(s);
  const screen = q('.s113__screen'), scenesBox = q('.s113__scenes');
  const barsB = [...root.querySelectorAll('.s113__bars b')];
  const who = [...root.querySelectorAll('.s113__who button')];
  const whoU = who.map(b => b.querySelector('u'));
  const nameEl = q('.s113__name'), agoEl = q('.s113__ago'), quoteEl = q('.s113__quote');
  const profitEl = q('.s113__profit'), payEl = q('.s113__pay');
  const chips = [...root.querySelectorAll('.s113__chip')];
  const fmt = n => Math.round(n).toLocaleString('ko-KR');

  const idle = [];
  function build(s, k) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 320 568'); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const px = s.px;
    svg.innerHTML = `
      <defs>
        <linearGradient id="s113g${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c1}"/><stop offset="1" stop-color="${s.c2}"/></linearGradient>
        <radialGradient id="s113r${k}"><stop offset="0" stop-color="${s.glow}" stop-opacity=".95"/><stop offset="1" stop-color="${s.glow}" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="320" height="568" fill="url(#s113g${k})"/>
      <circle class="glow" cx="${320 - px + 40}" cy="190" r="170" fill="url(#s113r${k})"/>
      <g opacity=".5"><rect x="26" y="240" width="130" height="6" rx="3" fill="#fff"/><rect x="170" y="240" width="126" height="6" rx="3" fill="#fff"/>
        <rect x="38" y="214" width="16" height="26" rx="4" fill="#fff"/><rect x="62" y="222" width="14" height="18" rx="4" fill="#fff"/><rect x="190" y="212" width="18" height="28" rx="4" fill="#fff"/><rect x="216" y="224" width="14" height="16" rx="4" fill="#fff"/><rect x="250" y="218" width="16" height="22" rx="4" fill="#fff"/></g>
      ${[70, 160, 250].map(x => `<g class="lamp" data-x="${x}"><line x1="${x}" y1="0" x2="${x}" y2="92" stroke="#fff" stroke-opacity=".6" stroke-width="2"/><path d="M${x - 24} 118 A24 24 0 0 1 ${x + 24} 118 Z" fill="#fff" fill-opacity=".92"/><circle cx="${x}" cy="122" r="7" fill="${s.glow}"/></g>`).join('')}
      <g class="person"><circle cx="${px}" cy="296" r="27" fill="#2c1d3a" fill-opacity=".85"/><path d="M${px - 54} 410 Q${px - 54} 334 ${px} 330 Q${px + 54} 334 ${px + 54} 410 Z" fill="#2c1d3a" fill-opacity=".85"/><rect x="${px - 30}" y="338" width="60" height="30" rx="10" fill="#fff" fill-opacity=".9"/></g>
      <rect x="0" y="400" width="320" height="168" fill="#1f1530" fill-opacity=".72"/>
      <rect x="0" y="396" width="320" height="8" fill="#fff" fill-opacity=".55"/>
      ${[28, 78, 270].map(x => `<path d="M${x} 370 L${x + 34} 370 L${x + 29} 396 L${x + 5} 396 Z" fill="#fff" fill-opacity=".95"/>`).join('')}
      <path class="steam" d="M45 360 q-8 -12 0 -22 t0 -22" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path class="steam" d="M95 360 q8 -12 0 -22 t0 -22" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path class="steam" d="M287 360 q-8 -12 0 -22 t0 -22" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    scenesBox.appendChild(svg);
    idle.push(gsap.to(svg.querySelector('.glow'), { scale: 1.12, transformOrigin: '50% 50%', duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    svg.querySelectorAll('.lamp').forEach((l, i) => {
      gsap.set(l, { svgOrigin: l.dataset.x + ' 0' });
      idle.push(gsap.to(l, { rotation: 3.5, duration: 2.2 + i * .4, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    });
    idle.push(gsap.to(svg.querySelector('.person'), { y: -5, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    svg.querySelectorAll('.steam').forEach((s2, i) => {
      idle.push(gsap.fromTo(s2, { y: 0, opacity: .9 }, { y: -26, opacity: 0, duration: 2 + i * .3, ease: 'sine.out', repeat: -1, delay: i * .5 }));
    });
    return svg;
  }
  const scenes = S.map(build);
  gsap.set(scenes, { visibility: 'hidden' });
  gsap.set(scenes[0], { visibility: 'visible' });

  let cur = 0, seg = null, down = null, started = false;
  const pr = { p: 0, y: 0 };

  function setText(i) {
    nameEl.textContent = S[i].name; agoEl.textContent = S[i].ago; quoteEl.textContent = S[i].q;
  }
  function showChips(i, delay) {
    const o = { a: 0, b: 0 };
    gsap.killTweensOf(o);
    gsap.fromTo(chips, { yPercent: 160, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .9, ease: 'expo.out', stagger: .12, delay });
    const a = { v: 0 };
    gsap.to(a, { v: 1, duration: 1.3, delay, ease: 'expo.out', onUpdate: () => {
      profitEl.textContent = fmt(S[i].profit * a.v) + '만원';
      payEl.textContent = Math.round(S[i].pay * a.v) + '개월';
    } });
    gsap.fromTo([nameEl, agoEl, quoteEl], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .8, ease: 'expo.out', stagger: .06, delay });
  }
  function run(i) {
    if (seg) seg.kill();
    barsB.forEach((b, k) => { if (k !== i) gsap.set(b, { scaleX: k < i ? 1 : 0 }); });
    whoU.forEach(u => gsap.set(u, { scaleX: 0 }));
    gsap.set(barsB[i], { scaleX: 0 });
    seg = gsap.to(barsB[i], { scaleX: 1, duration: DUR, ease: 'none',
      onUpdate: () => { gsap.set(whoU[i], { scaleX: seg.progress() }); },
      onComplete: () => go((i + 1) % N, 1) });
  }
  function go(i, dir) {
    if (i === cur && started) { run(i); showChips(i, .1); return; }
    const old = scenes[cur], nu = scenes[i], prev = cur;
    cur = i;
    who.forEach((b, k) => b.classList.toggle('is-on', k === i));
    gsap.set(nu, { visibility: 'visible', zIndex: 2 }); gsap.set(old, { zIndex: 1 });
    gsap.fromTo(nu, { clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'expo.inOut', clearProps: 'clipPath' });
    gsap.to(old, { xPercent: -14 * dir, duration: 1, ease: 'expo.inOut', onComplete: () => { gsap.set(old, { visibility: 'hidden', xPercent: 0 }); } });
    gsap.to(chips, { yPercent: -160, opacity: 0, duration: .45, ease: 'power3.in', stagger: .05, overwrite: true });
    gsap.delayedCall(.5, () => { setText(i); showChips(i, 0); });
    run(i);
  }

  // 초기 상태(스크롤 진입 전)
  setText(0);
  gsap.set(chips, { opacity: 0 });
  const st = ScrollTrigger.create({ trigger: root, start: 'top 75%', once: true, onEnter: () => { started = true; showChips(0, .2); run(0); } });

  // 탭 / 홀드
  const onDown = e => { down = { t: performance.now() }; if (seg) seg.pause(); };
  const onUp = e => {
    if (!down) return;
    const quick = performance.now() - down.t < 260; down = null;
    if (!quick) { if (seg) seg.resume(); return; }
    const r = screen.getBoundingClientRect(), left = (e.clientX - r.left) / r.width < .35;
    if (!started) { started = true; }
    if (left) go((cur + N - 1) % N, -1); else go((cur + 1) % N, 1);
  };
  const onCancel = () => { if (down) { down = null; if (seg) seg.resume(); } };
  screen.addEventListener('pointerdown', onDown); screen.addEventListener('pointerup', onUp); screen.addEventListener('pointerleave', onCancel);
  const picks = who.map((b, k) => {
    const f = () => { started = true; if (k !== cur) go(k, k > cur ? 1 : -1); else go(k, 1); };
    b.addEventListener('click', f); return () => b.removeEventListener('click', f);
  });

  return () => {
    st.kill(); if (seg) seg.kill(); idle.forEach(t => t.kill());
    screen.removeEventListener('pointerdown', onDown); screen.removeEventListener('pointerup', onUp); screen.removeEventListener('pointerleave', onCancel);
    picks.forEach(f => f()); gsap.killTweensOf([...chips, ...scenes, nameEl, agoEl, quoteEl]);
  };
}
