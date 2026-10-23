const DRINKS = [
  { bg: '#1f2437', fg: '#f4ead6', top: '#c88a55', bot: '#5a2f1d', cream: '#f3e3c8', garnish: 'none', word: 'COLD BREW', desc: '12시간 찬물로 천천히 내린 콜드브루에 국산 무항생제 우유를 층층이. 쓴맛은 낮추고 바디감은 높였습니다.', tags: ['시즌 인기 1위', '카페인 160mg'] },
  { bg: '#ff9db1', fg: '#4a1424', top: '#ffd3dc', bot: '#ff5f87', cream: '#fff0f3', garnish: 'berry', word: 'STRAWBERRY', desc: '논산 설향 딸기를 매장에서 직접 으깨 넣은 생과일 우유. 시즌 한정 3월~5월.', tags: ['생과일 120g', '시즌 한정'] },
  { bg: '#b9d37b', fg: '#1d2f10', top: '#e9f3c9', bot: '#6f9a2f', cream: '#fffbe8', garnish: 'powder', word: 'MATCHA', desc: '제주 서귀포 유기농 말차를 석구에 갈아 사용. 진한 말차 위에 바닐라 크림을 올렸습니다.', tags: ['제주 유기농', '바닐라 크림'] },
  { bg: '#ffc02e', fg: '#40250a', top: '#ffe28a', bot: '#ff8a1f', cream: null, garnish: 'citrus', word: 'MANGO PASSION', desc: '태국산 망고 퓨레와 패션프루트를 탄산수와 함께. 얼음을 넉넉히 넣어 한여름 매출 1위 에이드.', tags: ['탄산 ZERO 옵션', '여름 베스트'] },
  { bg: '#6c5ce7', fg: '#f3efff', top: '#c9c0ff', bot: '#3b2ea8', cream: '#ffffff', garnish: 'berry2', word: 'BLUEBERRY', desc: '그릭요거트 40%에 냉동 블루베리를 통째로 갈아 넣은 걸쭉한 스무디. 한 끼 대용으로도 좋아요.', tags: ['단백질 14g', '설탕 -30%'] },
  { bg: '#ff7a3d', fg: '#fff4e6', top: '#ffd7a8', bot: '#c9421a', cream: null, garnish: 'citrus', word: 'GRAPEFRUIT', desc: '루비 자몽 과육과 아카시아 꿀, 우바 블랙티의 조합. 상큼하게 시작해 달콤하게 끝나는 티 음료.', tags: ['논카페인 변경 가능', '꿀 100%'] },
];

const cup = (d, i) => `<svg viewBox="0 0 400 600"><defs>
  <clipPath id="s066c${i}"><path d="M70 150 L330 150 L296 560 Q294 578 276 578 L124 578 Q106 578 104 560Z"/></clipPath>
  <linearGradient id="s066g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${d.top}"/><stop offset="1" stop-color="${d.bot}"/></linearGradient></defs>
  <g clip-path="url(#s066c${i})">
    <rect x="0" y="150" width="400" height="440" fill="rgba(255,255,255,.25)"/>
    <g class="s066__liq"><rect x="0" y="230" width="400" height="360" fill="url(#s066g${i})"/>
      <path class="s066__wave" d="M-400 232 q50 -26 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 v40 h-800z" fill="${d.top}"/></g>
    <g class="s066__ice" fill="rgba(255,255,255,.55)"><rect x="110" y="260" width="64" height="64" rx="12" transform="rotate(14 142 292)"/><rect x="200" y="300" width="70" height="70" rx="12" transform="rotate(-10 235 335)"/><rect x="140" y="380" width="58" height="58" rx="12" transform="rotate(24 169 409)"/><rect x="220" y="450" width="60" height="60" rx="12" transform="rotate(-22 250 480)"/></g>
    <rect x="86" y="150" width="34" height="440" fill="rgba(255,255,255,.28)" transform="skewX(-4)"/>
  </g>
  <path d="M70 150 L330 150 L296 560 Q294 578 276 578 L124 578 Q106 578 104 560Z" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="5"/>
  ${d.cream ? `<path d="M64 150 Q70 72 200 66 Q330 72 336 150Z" fill="${d.cream}"/><ellipse cx="200" cy="150" rx="140" ry="12" fill="${d.cream}"/>` : `<ellipse cx="200" cy="150" rx="132" ry="10" fill="rgba(255,255,255,.35)"/>`}
  ${d.garnish === 'berry' ? '<g><circle cx="200" cy="64" r="34" fill="#e8344f"/><path d="M178 44 l22 -18 22 18" fill="none" stroke="#2f9e44" stroke-width="9" stroke-linecap="round"/></g>' : ''}
  ${d.garnish === 'berry2' ? '<g fill="#2b2a8a"><circle cx="170" cy="62" r="20"/><circle cx="214" cy="52" r="22"/><circle cx="196" cy="86" r="18"/></g>' : ''}
  ${d.garnish === 'powder' ? '<g fill="#6f9a2f"><circle cx="150" cy="96" r="3"/><circle cx="180" cy="80" r="3"/><circle cx="210" cy="92" r="4"/><circle cx="244" cy="82" r="3"/><circle cx="196" cy="104" r="3"/></g>' : ''}
  ${d.garnish === 'citrus' ? `<g><circle cx="300" cy="150" r="46" fill="${d.top}"/><circle cx="300" cy="150" r="38" fill="${d.bot}"/><g stroke="${d.top}" stroke-width="3"><line x1="300" y1="112" x2="300" y2="188"/><line x1="262" y1="150" x2="338" y2="150"/><line x1="273" y1="123" x2="327" y2="177"/><line x1="327" y1="123" x2="273" y2="177"/></g></g>` : ''}
  <rect x="244" y="-6" width="14" height="330" rx="7" fill="#fff" transform="rotate(10 251 160)" opacity=".95"/>
  <g stroke="${d.bot}" stroke-width="5" opacity=".6" transform="rotate(10 251 160)"><line x1="244" y1="30" x2="258" y2="42"/><line x1="244" y1="56" x2="258" y2="68"/><line x1="244" y1="82" x2="258" y2="94"/></g>
</svg>`;

export default function init(root, ctx) {
  const bgsEl = root.querySelector('[data-bgs]'), cupsEl = root.querySelector('[data-cups]'), infosEl = root.querySelector('[data-infos]');
  const items = [...root.querySelectorAll('[data-menu] li')], word = root.querySelector('[data-bigword]');
  bgsEl.innerHTML = DRINKS.map(d => `<div class="s066__bg" style="background:${d.bg}"></div>`).join('');
  cupsEl.innerHTML = DRINKS.map((d, i) => `<div class="s066__cup">${cup(d, i)}</div>`).join('');
  infosEl.innerHTML = DRINKS.map(d => `<div class="s066__info"><p>${d.desc}</p><ul>${d.tags.map(t => `<li>${t}</li>`).join('')}</ul></div>`).join('');
  const bgs = [...bgsEl.children], cups = [...cupsEl.children], infos = [...infosEl.children];
  gsap.set(bgs, { clipPath: 'circle(0px at 50% 50%)' }); gsap.set(cups, { autoAlpha: 0 }); gsap.set(infos, { autoAlpha: 0 });
  // 액체 물결 + 얼음 둥둥 — 현재 컵에만 건다(렌더 비용 절감)
  let idle = [];
  const startIdle = i => {
    idle.forEach(t => t.kill());
    idle = [
      gsap.to(cups[i].querySelector('.s066__wave'), { x: -200, duration: 2.6, repeat: -1, ease: 'none' }),
      gsap.to(cups[i].querySelectorAll('.s066__ice rect'), { y: 'random(-9,9)', rotation: 'random(-8,8)', transformOrigin: '50% 50%', duration: 'random(1.6,2.6)', repeat: -1, yoyo: true, ease: 'sine.inOut' })
    ];
  };
  let cur = -1, z = 1, hover = false, userAt = -1e9, vis = false;
  const go = (i, ox, oy) => {
    if (i === cur) return;
    const prev = cur; cur = i; const d = DRINKS[i]; startIdle(i);
    const r = root.getBoundingClientRect();
    const x = ox == null ? r.width * .3 : ox - r.left, y = oy == null ? r.height * .5 : oy - r.top;
    const R = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) + 20;
    gsap.killTweensOf(bgs[i]);
    gsap.fromTo(bgs[i], { clipPath: `circle(0px at ${x}px ${y}px)`, zIndex: ++z }, { clipPath: `circle(${R}px at ${x}px ${y}px)`, duration: 1.15, ease: 'expo.out' });
    gsap.to(root, { '--fg': d.fg, duration: .6, ease: 'power2.out' });
    items.forEach((li, k) => li.classList.toggle('is-on', k === i));
    // 컵 교체: 이전은 아래로 빠지고 새 컵은 위에서 기울어 내려와 착지
    if (prev > -1) gsap.to(cups[prev], { autoAlpha: 0, y: 80, rotation: 10, duration: .5, ease: 'power3.in', overwrite: true });
    gsap.fromTo(cups[i], { autoAlpha: 0, y: -140, rotation: -14, scale: .92 }, { autoAlpha: 1, y: 0, rotation: 0, scale: 1, duration: 1.2, ease: 'elastic.out(1,.62)', delay: .12, overwrite: true });
    if (prev > -1) gsap.to(infos[prev], { autoAlpha: 0, yPercent: -30, duration: .4, overwrite: true });
    gsap.fromTo(infos[i], { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: .9, ease: 'expo.out', delay: .3, overwrite: true });
    gsap.fromTo(word, { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1, ease: 'expo.out', onStart: () => { word.textContent = d.word; } });
  };
  const hs = items.map((li, i) => {
    const enter = e => { hover = true; userAt = performance.now(); go(i, e.clientX, e.clientY); };
    const leave = () => { hover = false; userAt = performance.now(); };
    li.addEventListener('pointerenter', enter); li.addEventListener('pointerleave', leave);
    return () => { li.removeEventListener('pointerenter', enter); li.removeEventListener('pointerleave', leave); };
  });
  go(0);
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { threshold: .3 }); io.observe(root);
  const iv = setInterval(() => {
    if (!vis || hover || performance.now() - userAt < 4500) return;
    const li = items[(cur + 1) % items.length]; const b = li.getBoundingClientRect();
    go((cur + 1) % items.length, b.left + b.width * .3, b.top + b.height / 2);
  }, 3200);
  // 컵 포인터 시차
  const q = { x: gsap.quickTo(cupsEl, 'x', { duration: 1, ease: 'power3' }), y: gsap.quickTo(cupsEl, 'y', { duration: 1, ease: 'power3' }) };
  const off = ctx.tick(() => { q.x((ctx.mouse.nx - .5) * 24); q.y((ctx.mouse.ny - .5) * 16); });
  return () => { clearInterval(iv); io.disconnect(); hs.forEach(f => f()); idle.forEach(t => t.kill()); off(); gsap.killTweensOf([...bgs, ...cups, ...infos, root, word]); };
}
