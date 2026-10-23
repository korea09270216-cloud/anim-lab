export default function init(root, ctx) {
  const can = root.querySelector('.s076__can'), stage = root.querySelector('.s076__stage'), shadow = root.querySelector('.s076__shadow');
  const N = 36, R = 110, H = 290, CIRC = 2 * Math.PI * R, SW = CIRC / N, LW = Math.ceil(SW) * N;
  // 라벨 SVG (원통 둘레 한 바퀴 = LW px). 정면 패널은 x=LW/2 중심
  const cx = LW / 2;
  const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${LW}" height="${H}" viewBox="0 0 ${LW} ${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a2e"/><stop offset="1" stop-color="#ff8f3a"/></linearGradient></defs><rect width="${LW}" height="${H}" fill="url(#g)"/><rect y="0" width="${LW}" height="22" fill="#2a1208"/><rect y="${H - 22}" width="${LW}" height="22" fill="#2a1208"/>
  <g transform="translate(${cx} 0)"><circle cx="0" cy="118" r="78" fill="#fff0dc"/><g fill="none" stroke="#2a1208" stroke-width="9" stroke-linecap="round"><path d="M-44 104q14-16 28 0t28 0 28 0"/><path d="M-44 130q14-16 28 0t28 0 28 0"/></g>
  <text x="0" y="40" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="30" fill="#fff0dc" letter-spacing="5">COLD BREW</text>
  <text x="0" y="238" text-anchor="middle" font-family="Malgun Gothic,Apple SD Gothic Neo,sans-serif" font-weight="900" font-size="38" fill="#2a1208">콜드브루</text>
  <text x="0" y="262" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="13" fill="#2a1208" letter-spacing="6">LATTE 355ML</text></g>
  ${[0, LW].map(x => `<g transform="translate(${x} 0)"><rect x="-70" y="60" width="140" height="150" fill="#fff0dc"/><g fill="#2a1208">${Array.from({ length: 22 }, (_, i) => `<rect x="${-60 + i * 5.4}" y="150" width="${i % 3 ? 2 : 4}" height="50"/>`).join('')}</g><text x="0" y="104" text-anchor="middle" font-family="Malgun Gothic,sans-serif" font-weight="800" font-size="16" fill="#2a1208">영양정보</text><text x="0" y="132" text-anchor="middle" font-family="Malgun Gothic,sans-serif" font-size="12" fill="#2a1208">1캔 355ml · 95kcal</text></g>`).join('')}
  ${[.25, .75].map(k => `<text x="${LW * k}" y="150" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="64" fill="#2a1208" opacity=".18" letter-spacing="2">36H</text>`).join('')}
  <g fill="#fff0dc" opacity=".55">${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 97) % LW}" cy="${40 + (i * 53) % 210}" r="${2 + i % 3}"/>`).join('')}</g></svg>`;
  const img = `url("data:image/svg+xml,${encodeURIComponent(label)}")`;
  const strips = [];
  for (let i = 0; i < N; i++) {
    const s = document.createElement('div'); s.className = 's076__st';
    s.style.cssText = `width:${Math.ceil(SW) + 1}px;height:${H}px;left:${-SW / 2}px;top:${-H / 2}px;background:${img};background-size:${LW}px ${H}px;background-position:${-(i * Math.ceil(SW)) }px 0;transform:rotateY(${i * 360 / N}deg) translateZ(${R}px)`;
    // 정면(i=0)이 라벨 중심 cx 가 되도록 오프셋: 스트립 i 의 라벨 위치 = cx + (i<N/2 ? i : i-N)*Ceil(SW)
    const idx = i < N / 2 ? i : i - N;
    s.style.backgroundPosition = `${-(cx + idx * Math.ceil(SW) - SW / 2)}px 0`;
    can.appendChild(s); strips.push(s);
  }
  const mk = (y, rx) => { const c = document.createElement('div'); c.className = 's076__cap'; c.style.cssText = `width:${R * 2}px;height:${R * 2}px;left:${-R}px;top:${-R}px;transform:translateY(${y}px) rotateX(${rx}deg)`; can.appendChild(c); return c; };
  const topCap = mk(-H / 2, 90); topCap.innerHTML = '<i></i>'; mk(H / 2, -90);
  const st = { ry: -20, rx: -16, vy: 0, vx: 0, drag: false, lx: 0, ly: 0, burst: 0, dy: 220 };
  const down = e => { st.drag = true; st.lx = e.clientX; st.ly = e.clientY; st.vy = 0; };
  const move = e => { if (!st.drag) return; const dx = e.clientX - st.lx, dy = e.clientY - st.ly; st.lx = e.clientX; st.ly = e.clientY; st.ry += dx * .5; st.rx = Math.max(-40, Math.min(25, st.rx + dy * .2)); st.vy = st.vy * .4 + dx * .5 * .6; };
  const up = () => { st.drag = false; };
  stage.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  gsap.from(can, { opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 70%' } });
  gsap.fromTo(st, { dy: 220 }, { dy: 0, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 70%' } });
  gsap.fromTo(st, { ry: -300 }, { ry: -20, duration: 2.4, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 70%' } });
  const off = ctx.tick((t) => {
    if (!st.drag) { st.ry += st.vy; st.vy *= .95; st.ry += (ctx.reduced ? .1 : .35) * (1 - Math.min(1, Math.abs(st.vy) / 1.2)); st.rx += (-14 + (ctx.mouse.ny - .5) * -12 - st.rx) * .02; }
    const bob = Math.sin(t * 1.2) * 10;
    can.style.transform = `translateY(${bob + st.dy}px) rotateX(${st.rx}deg) rotateY(${st.ry}deg) rotateZ(${Math.sin(t * .8) * 2}deg)`;
    shadow.style.transform = `scale(${1 - bob / 160})`; shadow.style.opacity = String(.9 - bob / 60);
    strips.forEach((s, i) => {
      const a = ((i * 360 / N + st.ry) % 360 + 540) % 360 - 180;       // 0=정면
      const lit = Math.cos((a + 38) * Math.PI / 180);                  // 광원 = 왼쪽 앞
      s.style.setProperty('--k', Math.max(0, Math.min(.72, .5 - lit * .5 + (Math.abs(a) > 90 ? 1 : 0))).toFixed(2));
    });
  });
  return () => { off(); stage.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
}
