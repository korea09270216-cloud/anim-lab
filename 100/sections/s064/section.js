// 같은 장면 함수를 팔레트만 바꿔 두 번 그린다 (전/후)
function scene(p) {
  const lamps = p.lit ? [180, 450, 720, 990].map(x => `<g><line x1="${x}" y1="0" x2="${x}" y2="${140}" stroke="${p.line}" stroke-width="3"/><path d="M${x - 44} 190 Q${x} 110 ${x + 44} 190Z" fill="${p.lamp}"/><ellipse cx="${x}" cy="196" rx="86" ry="22" fill="${p.glow}" opacity=".55"/></g>`).join('') : [300, 800].map(x => `<g><line x1="${x}" y1="0" x2="${x}" y2="110" stroke="${p.line}" stroke-width="3"/><path d="M${x - 30} 150 L${x + 30} 150 L${x + 18} 110 L${x - 18} 110Z" fill="${p.lamp}"/></g>`).join('');
  const plants = p.lit ? `<g><path d="M80 560 q-40 -90 -10 -180 q40 60 10 180z" fill="#2f7a52"/><path d="M80 560 q20 -110 70 -150 q10 80 -70 150z" fill="#3f9a68"/><path d="M80 560 q-70 -60 -70 -140 q60 30 70 140z" fill="#257045"/><rect x="50" y="550" width="60" height="80" rx="10" fill="#e8dcc4"/></g><g><path d="M1130 560 q-30 -100 0 -190 q40 70 0 190z" fill="#2f7a52"/><path d="M1130 560 q60 -90 50 -170 q-60 60 -50 170z" fill="#3f9a68"/><rect x="1100" y="550" width="60" height="80" rx="10" fill="#e8dcc4"/></g>` : `<g><rect x="1090" y="520" width="90" height="110" fill="${p.clutter}"/><rect x="1100" y="480" width="70" height="50" fill="${p.clutter2}"/><rect x="60" y="540" width="70" height="90" fill="${p.clutter}"/></g>`;
  const chairs = [250, 560, 870].map((x, i) => `<g><rect x="${x - 60}" y="470" width="120" height="14" rx="4" fill="${p.table}"/><rect x="${x - 6}" y="484" width="12" height="120" fill="${p.leg}"/><rect x="${x - 78}" y="520" width="38" height="12" rx="4" fill="${p.chair}"/><rect x="${x - 74}" y="532" width="8" height="72" fill="${p.leg}"/><rect x="${x + 40}" y="520" width="38" height="12" rx="4" fill="${p.chair}"/><rect x="${x + 66}" y="532" width="8" height="72" fill="${p.leg}"/>${p.lit ? `<ellipse cx="${x - 20}" cy="462" rx="16" ry="6" fill="#fff"/><path d="M${x + 14} 462 q0 -22 22 -22 v22z" fill="#d94a2b"/>` : ''}</g>`).join('');
  return `<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
    <rect width="1200" height="800" fill="${p.wall}"/>
    <rect y="600" width="1200" height="200" fill="${p.floor}"/>
    ${p.lit ? '<g fill="#fff" opacity=".12">' + Array.from({ length: 10 }, (_, i) => `<rect x="${i * 130}" y="600" width="64" height="200"/>`).join('') + '</g>' : '<g stroke="#00000022" stroke-width="2" fill="none"><path d="M120 260 l30 60 -20 40 40 50"/><path d="M980 120 l-20 70 30 40"/></g>'}
    <rect x="${p.lit ? 140 : 180}" y="${p.lit ? 230 : 250}" width="${p.lit ? 920 : 840}" height="${p.lit ? 230 : 210}" rx="${p.lit ? 14 : 4}" fill="${p.win}" opacity="${p.lit ? .9 : .75}"/>
    <rect x="${p.lit ? 140 : 180}" y="${p.lit ? 230 : 250}" width="${p.lit ? 920 : 840}" height="${p.lit ? 230 : 210}" rx="${p.lit ? 14 : 4}" fill="none" stroke="${p.frame}" stroke-width="10"/>
    <g stroke="${p.frame}" stroke-width="6"><line x1="${p.lit ? 600 : 600}" y1="${p.lit ? 230 : 250}" x2="600" y2="${p.lit ? 460 : 460}"/></g>
    ${lamps}
    <rect x="${p.lit ? 330 : 380}" y="${p.lit ? 70 : 100}" width="${p.lit ? 540 : 440}" height="${p.lit ? 100 : 76}" rx="${p.lit ? 50 : 6}" fill="${p.sign}"/>
    <text x="600" y="${p.lit ? 136 : 150}" text-anchor="middle" font-size="${p.lit ? 56 : 40}" font-weight="900" letter-spacing="${p.lit ? 4 : 1}" fill="${p.signText}" font-family="Pretendard,'Malgun Gothic',sans-serif">${p.lit ? 'MORNING BREW' : '카페 모닝'}</text>
    ${p.lit ? '' : '<rect x="330" y="90" width="80" height="40" fill="#8a8a82" opacity=".6"/><g stroke="#8a8a82" stroke-width="3"><line x1="860" y1="200" x2="1000" y2="215"/><line x1="880" y1="228" x2="1040" y2="236"/></g><rect x="935" y="190" width="120" height="90" fill="#c9c35a" transform="rotate(-6 995 235)"/><text x="995" y="245" text-anchor="middle" font-size="18" font-weight="700" fill="#555" transform="rotate(-6 995 235)">임대문의</text>'}
    ${plants}${chairs}
    ${p.lit ? `<rect x="470" y="560" width="260" height="40" rx="8" fill="#14201a"/><text x="600" y="588" text-anchor="middle" font-size="20" font-weight="800" fill="#c9f26b" font-family="Pretendard,sans-serif">ORDER · PICK UP</text>` : ''}
  </svg>`;
}
const BEFORE = { wall: '#aaa89e', floor: '#7b796f', win: '#6d7a78', frame: '#5b5a52', sign: '#7d7b72', signText: '#c3c0b2', lamp: '#59574f', line: '#59574f', table: '#8a6b44', leg: '#4d4a43', chair: '#6b5a40', clutter: '#6b6a60', clutter2: '#8f8c7f', lit: false };
const AFTER = { wall: '#f6ead0', floor: '#d99e5c', win: '#fff6cf', frame: '#14201a', sign: '#14201a', signText: '#ffd35a', lamp: '#ffd35a', glow: '#ffe99a', line: '#14201a', table: '#14201a', leg: '#14201a', chair: '#e4572b', lit: true };

export default function init(root, ctx) {
  const frame = root.querySelector('[data-frame]');
  const after = root.querySelector('[data-after]');
  root.querySelector('[data-before]').innerHTML = scene(BEFORE);
  after.innerHTML = scene(AFTER);
  const handle = root.querySelector('[data-handle]');
  const nums = { sales: [168, 241], ticket: [7800, 11200], turn: [3.1, 5.4] };
  const el = {}; Object.keys(nums).forEach(k => { el[k] = root.querySelector(`[data-k="${k}"]`); el[k + 'd'] = root.querySelector(`[data-d="${k}"]`); });

  let W = frame.clientWidth;
  const st = { pos: .5 };            // 실제 표시 위치 0~1
  const set = v => {                 // v: 0~1
    st.pos = Math.max(0, Math.min(1, v));
    after.style.clipPath = `inset(0 0 0 ${st.pos * 100}%)`;
    handle.style.transform = `translateX(${st.pos * W}px)`;
    const t = 1 - st.pos;            // 오른쪽(AFTER) 이 보일수록 1
    Object.keys(nums).forEach(k => {
      const [a, b] = nums[k]; const v = a + (b - a) * t;
      el[k].textContent = k === 'turn' ? v.toFixed(1) : Math.round(v).toLocaleString();
      const pc = Math.round((v / a - 1) * 100);
      el[k + 'd'].textContent = (pc >= 0 ? '+' : '') + pc + '%';
    });
  };
  set(.5);
  const follow = gsap.quickTo(st, 'pos', { duration: .55, ease: 'power3.out', onUpdate: () => set(st.pos) });

  let auto = true, down = false, idleAt = 0;
  const posFromEvent = e => { const r = frame.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  const onDown = e => { down = true; auto = false; frame.setPointerCapture && frame.setPointerCapture(e.pointerId); follow(posFromEvent(e)); };
  const onMove = e => { if (down) follow(posFromEvent(e)); };
  const onUp = () => { down = false; idleAt = performance.now(); };
  frame.addEventListener('pointerdown', onDown); frame.addEventListener('pointermove', onMove); frame.addEventListener('pointerup', onUp); frame.addEventListener('pointercancel', onUp);
  const onResize = () => { W = frame.clientWidth; set(st.pos); };
  addEventListener('resize', onResize);

  // 자동 스윕: 방치하면 천천히 사인파로 쓸고 간다(터치 후 4초 뒤 재개)
  let vis = false; const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { threshold: .2 }); io.observe(root);
  const t0 = performance.now();
  const off = ctx.tick(() => {
    if (!vis) return;
    if (!auto && !down && performance.now() - idleAt > 4000) auto = true;
    if (auto) { const t = (performance.now() - t0) / 1000; const v = .5 + Math.sin(t * .75) * .42; follow(v); }
  });
  // 입장: 전체 마스크가 왼쪽에서 열림
  gsap.from(frame, { clipPath: 'inset(0 100% 0 0 round 26px)', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 65%', once: true } });

  return () => { off(); io.disconnect(); frame.removeEventListener('pointerdown', onDown); frame.removeEventListener('pointermove', onMove); frame.removeEventListener('pointerup', onUp); frame.removeEventListener('pointercancel', onUp); removeEventListener('resize', onResize); gsap.killTweensOf(st); };
}
