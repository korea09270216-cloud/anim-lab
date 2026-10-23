export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const route = $('.s056__base'), reveal = $('.s056__reveal'), truck = $('.s056__truck');
  const blocksG = $('.s056__blocks'), pinsG = $('.s056__pins');
  const list = $('.s056__list'), nowB = $('.s056__now b');
  const STOPS = [
    { n: '망원시장', t: '11:00' }, { n: '연남동 골목', t: '12:30' }, { n: '서촌 한옥길', t: '14:00' },
    { n: '광장시장', t: '15:30' }, { n: '성수 연무장길', t: '17:00' }, { n: '잠실 호수공원', t: '18:30' }
  ];
  const len = route.getTotalLength();

  // 도시 블록: 시드 고정 난수로 격자 위에 지터를 줘서 골목 느낌
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let html = '';
  for (let gx = 0; gx < 21; gx++) for (let gy = 0; gy < 12; gy++) {
    const w = 52 + rnd() * 22, h = 46 + rnd() * 22, x = gx * 80 + 8 + rnd() * 6, y = gy * 78 + 8 + rnd() * 6;
    html += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="6" fill="${rnd() > .82 ? '#e6d8bd' : '#ebe1cb'}"/>`;
  }
  blocksG.innerHTML = html;

  // 핀 + 라벨
  const pins = STOPS.map((s, i) => {
    const p = i / (STOPS.length - 1), pt = route.getPointAtLength(len * p);
    const g = document.createElementNS(NS, 'g');
    const left = i % 2 === 0;
    g.innerHTML = `<circle class="rip" r="10" fill="none" stroke="#ec4a2e" stroke-width="3"/>
      <g class="in"><path d="M0 0 C-4 -12 -20 -24 -20 -42 a20 20 0 1 1 40 0 C20 -24 4 -12 0 0 Z" fill="#ec4a2e" stroke="#1d2a2f" stroke-width="4" stroke-linejoin="round"/>
      <circle cy="-42" r="9" fill="#fff"/></g>
      <text class="lb" x="${left ? 30 : -30}" y="-36" text-anchor="${left ? 'start' : 'end'}" font-size="26" font-weight="800" fill="#1d2a2f" stroke="#f4ecda" stroke-width="7" paint-order="stroke" font-family="Pretendard,Apple SD Gothic Neo,Malgun Gothic,sans-serif">${s.n}</text>`;
    pinsG.appendChild(g);
    gsap.set(g, { x: pt.x, y: pt.y });
    gsap.set(g.querySelector('.in'), { y: -140, opacity: 0 });
    gsap.set(g.querySelector('.lb'), { opacity: 0, y: 8 });
    gsap.set(g.querySelector('.rip'), { opacity: 0 });
    list.insertAdjacentHTML('beforeend', `<li><i>${i + 1}</i>${s.n}<em>${s.t}</em></li>`);
    return { g, p };
  });
  const lis = [...list.children];

  gsap.set(reveal, { drawSVG: '0%' });
  let idx = -1;
  let ripTw = null;
  function activate(i) {
    idx = i;
    lis.forEach((li, k) => { li.classList.toggle('is-on', k === i); li.classList.toggle('is-done', k < i); });
    nowB.textContent = STOPS[i].n;
    ripTw && ripTw.kill(); pins.forEach(o => gsap.set(o.g.querySelector('.rip'), { opacity: 0 }));
    ripTw = gsap.fromTo(pins[i].g.querySelector('.rip'), { scale: .4, opacity: .9 }, { scale: 4.5, opacity: 0, duration: 1.6, ease: 'expo.out', repeat: -1, repeatDelay: .25 });
    gsap.fromTo(nowB, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .8, ease: 'expo.out' });
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root, start: 'top top', end: 'bottom bottom', scrub: .9,
      onUpdate(self) {
        let k = 0; pins.forEach((o, i) => { if (self.progress >= o.p - .02) k = i; });
        if (k !== idx) activate(k);
      }
    }
  });
  tl.to(reveal, { drawSVG: '100%', duration: 1, ease: 'none' }, 0);
  tl.fromTo(truck, { x: 0 }, { motionPath: { path: route, align: route, alignOrigin: [.5, .5] }, duration: 1, ease: 'none' }, 0);
  pins.forEach((o, i) => {
    const at = Math.max(0, o.p - .07);
    tl.to(o.g.querySelector('.in'), { y: 0, opacity: 1, duration: .07, ease: 'expo.out' }, at);
    tl.to(o.g.querySelector('.lb'), { opacity: 1, y: 0, duration: .06, ease: 'power2.out' }, at + .03);
  });
  activate(0);

  return () => { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); ripTw && ripTw.kill(); };
}
