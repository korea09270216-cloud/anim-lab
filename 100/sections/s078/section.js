export default function init(root, ctx) {
  const world = root.querySelector('.s078__world'), kmEl = root.querySelector('.s078__km');
  const DEPTH = 8200;
  const defs = [
    { z: -500, x: 0, y: 0, cls: 's078__word', html: '서울', sx: 1 },
    { z: -1100, x: -520, y: -120, cls: 's078__word is-o', html: 'JEJU' },
    { z: -1500, x: 520, y: 160, cls: 's078__ring', w: 520 },
    { z: -2000, x: 380, y: -180, cls: 's078__card', html: '<b>제주</b>편도 39,000원~<br>매일 14편 운항' },
    { z: -2700, x: -300, y: 140, cls: 's078__word', html: 'OSAKA' },
    { z: -3000, x: 460, y: -60, cls: 's078__planet', w: 360, bg: 'radial-gradient(circle at 32% 28%,#ffd9a0,#ff7a5c 55%,#5b2a86)' },
    { z: -3600, x: 0, y: 0, cls: 's078__ring', w: 900 },
    { z: -3900, x: -420, y: -150, cls: 's078__card', html: '<b>오사카</b>1시간 50분<br>간사이 공항 직항' },
    { z: -4500, x: 80, y: 80, cls: 's078__word is-o', html: 'TAIPEI' },
    { z: -5000, x: -560, y: 120, cls: 's078__planet', w: 280, bg: 'radial-gradient(circle at 36% 30%,#bfeaff,#4aa3ff 55%,#1b2a74)' },
    { z: -5500, x: 420, y: -130, cls: 's078__card', html: '<b>타이베이</b>2시간 35분<br>야시장 비행' },
    { z: -6000, x: -80, y: -40, cls: 's078__word', html: 'DA NANG' },
    { z: -6500, x: 520, y: 150, cls: 's078__ring', w: 640 },
    { z: -6900, x: -620, y: 230, cls: 's078__word is-o', html: 'BKK' },
    { z: -8200, x: 0, y: 0, cls: 's078__end', html: '<h2>지금, 떠나요</h2><p>첫 구매 30% 오로라 쿠폰</p><a href="#">항공권 찾기</a>' }
  ];
  const items = defs.map(d => {
    const el = document.createElement('div'); el.className = 's078__it';
    const inner = document.createElement('div'); inner.className = d.cls;
    if (d.html) inner.innerHTML = d.html;
    if (d.w) { inner.style.width = inner.style.height = d.w + 'px'; }
    if (d.bg) inner.style.background = d.bg;
    inner.style.transform = 'translate(-50%,-50%)';
    if (d.cls.includes('s078__word')) inner.style.fontSize = (d.html.length > 5 ? 220 : 300) + 'px';
    el.appendChild(inner); world.appendChild(el); return { el, d };
  });
  // 별: 먼 곳에 흩뿌리고 카메라가 지나가면 뒤쪽으로 재배치
  const SN = 70, stars = [];
  for (let i = 0; i < SN; i++) {
    const s = document.createElement('div'); s.className = 's078__star';
    const o = { el: s, x: (Math.random() - .5) * 3200, y: (Math.random() - .5) * 1900, z: -Math.random() * (DEPTH + 1500) };
    world.appendChild(s); stars.push(o);
  }
  const st = { p: 0, cp: 0, last: 0, v: 0 };
  const stt = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { st.p = s.progress; } });
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let drift = 0, ox = 0, oy = 0;
  const off = ctx.tick((t, dt) => {
    st.cp += (st.p - st.cp) * .07;
    drift += (ctx.reduced ? 5 : 22) * (dt / 1000 || .016) * (1 - st.cp);   // 스크롤 안 해도 천천히 전진
    const T = st.cp * DEPTH + Math.min(drift, 380);
    ox += ((ctx.mouse.nx - .5) * -160 - ox) * .05; oy += ((ctx.mouse.ny - .5) * -100 - oy) * .05;
    world.style.transform = `translate3d(${ox}px,${oy}px,${T}px) rotateZ(${(ctx.mouse.nx - .5) * 2}deg)`;
    items.forEach(({ el, d }) => {
      const rz = d.z + T;                       // 카메라 기준 상대 깊이 (-:앞쪽 멀리, +:카메라에 접근)
      let o = sm(-2800, -1300, rz);
      if (!d.cls.includes('end')) o *= 1 - sm(-150, 420, rz);
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o < .01 ? 'hidden' : 'visible';
      el.style.transform = `translate3d(${d.x}px,${d.y}px,${d.z}px)`;
    });
    stars.forEach(s => {
      if (s.z + T > 800) s.z -= DEPTH + 1500;       // 카메라 뒤로 넘어가면 먼 곳으로 재배치
      const rz = s.z + T;
      s.el.style.opacity = (sm(-4200, -2200, rz) * (1 - sm(300, 780, rz))).toFixed(2);
      s.el.style.transform = `translate3d(${s.x}px,${s.y}px,${s.z}px)`;
    });
    kmEl.textContent = Math.round(st.cp * 1840 + 300 * Math.min(1, drift / 380) * (1 - st.cp)).toLocaleString('ko-KR');
  });
  return () => { off(); stt.kill(); };
}
