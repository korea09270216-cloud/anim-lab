export default function init(root, ctx) {
  const book = root.querySelector('.s073__book'), wrap = root.querySelector('.s073__book-wrap');
  const pgEl = root.querySelector('.s073__pg b');
  const rec = [
    ['소금빵', '버터 60g이 반죽 속에서 녹아 바닥에 고이는 빵. 겉은 바삭, 속은 촉촉하게.', [['강력분', '300g'], ['발효버터', '60g'], ['게랑드 소금', '4g']], '<path d="M30 130c10-60 60-90 90-90s80 30 90 90c-30 14-60 14-90 14s-60 0-90-14z" fill="#d79a4a"/><path d="M60 120c10-30 40-50 60-50M100 125c8-26 30-44 50-48" stroke="#a86a26" stroke-width="5" fill="none" stroke-linecap="round"/>'],
    ['깜빠뉴', '르방 72시간 숙성. 호밀의 산미와 밀의 단맛이 같이 오는 시골빵.', [['르방', '120g'], ['통밀', '80g'], ['물', '280g']], '<ellipse cx="120" cy="90" rx="90" ry="62" fill="#c98a4a"/><path d="M60 70l30 40M100 60l30 54M140 62l24 46" stroke="#f3dfb7" stroke-width="9" stroke-linecap="round"/>'],
    ['크루아상', '81겹의 결. 접고 쉬게 하고 다시 접는 사흘의 시간을 한 입에.', [['버터 시트', '250g'], ['우유', '120g'], ['설탕', '40g']], '<path d="M20 120Q40 40 120 40T220 120Q170 90 120 90T20 120z" fill="#e0a350"/><path d="M60 62l-6 40M96 48l-2 44M132 48l2 44M168 62l6 40" stroke="#a86a26" stroke-width="5" stroke-linecap="round"/>'],
    ['단팥 소보로', '국산 팥을 세 시간 졸여 만든 앙금, 위엔 고소한 땅콩 소보로.', [['팥앙금', '70g'], ['땅콩가루', '30g'], ['계란', '1개']], '<circle cx="120" cy="92" r="66" fill="#d9a15a"/><g fill="#efc88a">' + Array.from({ length: 22 }, (_, i) => `<circle cx="${70 + ((i * 37) % 100)}" cy="${60 + ((i * 23) % 60)}" r="${5 + i % 3 * 2}"/>`).join('') + '</g>']
  ];
  const sp = (c, cls = '') => `<div class="s073__pgf ${cls}">${c}</div>`;
  const text = (i) => { const r = rec[i]; return `<span class="s073__no">0${i + 1}</span><h4>${r[0]}</h4><p>${r[1]}</p><ul>${r[2].map(x => `<li><span>${x[0]}</span><span>${x[1]}</span></li>`).join('')}</ul><span class="s073__fol">${2 * i + 3}</span>`; };
  const illu = (i) => `<div class="s073__illu"><svg viewBox="0 0 240 170">${rec[i][3]}<ellipse cx="120" cy="158" rx="80" ry="6" fill="#2b1d1018"/></svg></div><span class="s073__fol">${2 * i + 2}</span>`;
  const frontHtml = [
    sp(`<small>NOTE NO.12</small><h3>BREAD<br>DIARY</h3><svg viewBox="0 0 120 80"><path d="M10 60c6-30 28-46 50-46s44 16 50 46z" fill="none" stroke="#f0dfb8" stroke-width="3"/><path d="M30 50l8-18M52 46l4-22M74 46l-2-22M92 50l-6-18" stroke="#f0dfb8" stroke-width="3"/></svg><small>BAKER Seo · Yeonnam</small>`, 's073__cover'),
    ...[0, 1, 2, 3].map(i => sp(text(i)))
  ];
  const backHtml = [
    sp(`<span class="s073__no" style="font-size:calc(var(--w)*.2)">INDEX</span><h4>오늘의 빵 4종</h4><p>새벽 다섯 시 반죽부터 오후 두 시 마지막 판까지. 한 권으로 묶은 이번 계절의 노트입니다.</p><ul><li><span>01 소금빵</span><span>03</span></li><li><span>02 깜빠뉴</span><span>05</span></li><li><span>03 크루아상</span><span>07</span></li><li><span>04 단팥 소보로</span><span>09</span></li></ul>`, 'is-b'),
    ...[1, 2, 3, 0].map(i => sp(illu(i), "is-b"))
  ];
  const N = frontHtml.length;
  const leaves = [];
  for (let i = 0; i < N; i++) {
    const l = document.createElement('div'); l.className = 's073__leaf';
    l.innerHTML = frontHtml[i] + backHtml[i]; book.appendChild(l); leaves.push(l);
  }
  const base = document.createElement('div'); base.className = 's073__base';
  base.innerHTML = sp(`<span class="s073__no">끝</span><h4>다음 반죽은 내일 새벽</h4><p>연남동 · 매일 07:30 – 소진 시 마감</p><span class="s073__fol">10</span>`);
  book.insertBefore(base, book.firstChild);
  const shades = leaves.map(l => [...l.querySelectorAll('.s073__pgf')]);
  const st = { p: 0 };
  const smooth = (x) => x * x * (3 - 2 * x);
  const render = () => {
    const p = st.p, w = leaves[0].offsetWidth;
    const open = Math.min(1, p);
    book.style.translate = `${(open - 1) * .5 * w}px 0`;       // 표지만 있을 땐 오른쪽 반쪽을 화면 중앙으로
    leaves.forEach((l, i) => {
      const f = Math.min(1, Math.max(0, p - i));
      const mid = Math.sin(Math.PI * f);
      l.style.transform = `rotateY(${-180 * smooth(f)}deg) translateZ(${mid * 22}px)`;
      l.style.zIndex = f > .5 ? i : (N - i) + (f > 0 ? N : 0);
      shades[i].forEach(s => s.style.setProperty('--sh', (mid * .9).toFixed(3)));
    });
    pgEl.textContent = String(Math.max(0, Math.min(4, Math.round(p)))).padStart(2, '0');
  };
  render();
  let busy = false, tw, loop;
  const go = (to, dur = 1.5) => { tw?.kill(); tw = gsap.to(st, { p: to, duration: dur, ease: 'power3.inOut', onUpdate: render }); };
  const step = () => { if (busy) return; const r = Math.round(st.p); r >= N ? go(0, 2.6) : go(r + 1); };
  const startLoop = (delay = 1.2) => { loop?.kill(); loop = gsap.delayedCall(delay, function again() { step(); loop = gsap.delayedCall(2.6, again); }); };
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !busy) startLoop(.8); else loop?.kill(); }, { threshold: .25 });
  io.observe(root);
  // 드래그: 손을 따라 p 변화, 놓으면 속도 방향으로 스냅
  let dragging = false, lx = 0, lv = 0;
  const down = (e) => { dragging = true; busy = true; lx = e.clientX; lv = 0; tw?.kill(); loop?.kill(); };
  const move = (e) => { if (!dragging) return; const dx = e.clientX - lx; lx = e.clientX; lv = lv * .5 + dx * .5; st.p = Math.max(0, Math.min(N, st.p - dx / leaves[0].offsetWidth * 1.1)); render(); };
  const up = () => { if (!dragging) return; dragging = false; go(Math.max(0, Math.min(N, Math.round(st.p - lv / 14))), 1.0); busy = false; startLoop(4); };
  wrap.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  const off = ctx.tick((t) => { book.style.transform = `rotateX(${14 + Math.sin(t * .6) * 2}deg) rotateY(${Math.sin(t * .4) * 4 + (ctx.mouse.nx - .5) * 8}deg)`; });
  gsap.from(book, { opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 70%' } });
  return () => { off(); loop?.kill(); tw?.kill(); io.disconnect(); wrap.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
}
