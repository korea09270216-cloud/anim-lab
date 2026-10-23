const P = (lon, lat) => [(lon - 125.9) * 100, (38.75 - lat) * 105];
const OUTLINE = [[126.62, 37.95], [127.1, 38.2], [127.7, 38.3], [128.37, 38.6], [128.6, 38.2], [128.85, 37.78], [129.02, 37.3], [129.35, 36.9], [129.45, 36.4], [129.45, 35.95], [129.36, 35.5], [129.22, 35.2], [129.06, 35.02], [128.7, 35.0], [128.35, 34.8], [127.9, 34.7], [127.45, 34.55], [127.2, 34.5], [126.65, 34.35], [126.3, 34.45], [126.3, 34.8], [126.45, 35.15], [126.5, 35.55], [126.7, 35.95], [126.55, 36.2], [126.2, 36.55], [126.2, 36.95], [126.7, 37.05], [126.65, 37.35], [126.4, 37.55], [126.35, 37.8], [126.62, 37.95]];
const CITIES = [
  ['서울', 126.98, 37.57, 312], ['인천·경기', 127.0, 37.2, 214], ['강원', 128.5, 37.75, 24], ['충청', 127.4, 36.4, 109], ['대구·경북', 128.6, 35.9, 117],
  ['부산·울산', 129.1, 35.3, 170], ['전북', 127.1, 35.8, 37], ['광주·전남', 126.85, 35.0, 63], ['제주', 126.55, 33.5, 70],
  ['경남', 128.2, 35.4, 68], ['포항', 129.37, 36.05, 29], ['세종', 127.28, 36.5, 11],
];
function smooth(pts) { // Catmull-Rom -> cubic
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = .17;
    d += `C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const d = smooth(OUTLINE.map(([a, b]) => P(a, b)));
  $('[data-land]').setAttribute('d', d); $('[data-edge]').setAttribute('d', d);
  const [jx, jy] = P(126.55, 33.38);
  const j = $('[data-jedge]'); j.setAttribute('cx', jx); j.setAttribute('cy', jy); j.setAttribute('rx', 30); j.setAttribute('ry', 14);
  $('[data-jeju]').setAttribute('d', `M${jx - 30} ${jy}a30 14 0 1 0 60 0a30 14 0 1 0 -60 0Z`);

  const NS = 'http://www.w3.org/2000/svg';
  const pinsG = $('[data-pins]');
  const list = $('[data-list]'), tip = $('[data-tip]'), box = $('.s068__mapbox');
  CustomBounce.create('s068b', { strength: .62, squash: 1.6, squashID: 's068b-sq' });
  const pins = CITIES.map(([name, lon, lat, n], i) => {
    const [x, y] = P(lon, lat); const s = .7 + Math.sqrt(n / 312) * .9;
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 's068__pin');
    g.innerHTML = `<circle class="s068__ring" cx="${x}" cy="${y}" r="4"/><ellipse class="sh" cx="${x}" cy="${y}" rx="${7 * s}" ry="${2.6 * s}" fill="rgba(0,0,0,.45)"/><g transform="translate(${x} ${y}) scale(${s})"><g class="drop"><path class="body" d="M0 0C-9 -12 -11 -17 -11 -22A11 11 0 1 1 11 -22C11 -17 9 -12 0 0Z"/><circle class="eye" cx="0" cy="-22" r="4.2"/></g></g>`;
    pinsG.appendChild(g);
    const li = document.createElement('li'); li.innerHTML = `<span>${name}</span><b>${n}</b>`; list.appendChild(li);
    return { g, li, x, y, name, n, drop: g.querySelector('.drop'), sh: g.querySelector('.sh'), rings: g.querySelectorAll('.s068__ring') };
  });
  gsap.set(pins.map(p => p.drop), { y: -520 });
  gsap.set(pins.map(p => p.sh), { scale: 0, transformOrigin: '50% 50%' });
  gsap.set(pins.flatMap(p => [...p.rings]), { opacity: 0, transformOrigin: '50% 50%' });

  const total = CITIES.reduce((a, c) => a + c[3], 0);
  const tot = $('[data-total]');
  const cnt = { v: 0 };
  let ripples = [];

  const play = () => {
    ripples.forEach(r => r.kill()); ripples = [];
    gsap.set(pins.map(p => p.drop), { y: -520 }); gsap.set(pins.map(p => p.sh), { scale: 0 });
    const tl = gsap.timeline();
    tl.fromTo($('[data-edge]'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.6, ease: 'power2.inOut' }, 0)
      .from($('[data-land]'), { opacity: 0, duration: 1.2 }, .6)
      .fromTo($('[data-jedge]'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1, ease: 'power2.inOut' }, .5);
    pins.forEach((p, i) => {
      const at = 1.0 + i * .16;
      tl.to(p.drop, { y: 0, duration: 1.15, ease: 's068b' }, at)
        .to(p.sh, { scale: 1, duration: .5, ease: 'power2.out' }, at + .3)
        .add(() => {
          p.rings.forEach((r, k) => ripples.push(gsap.fromTo(r, { attr: { r: 4 }, opacity: .9 }, { attr: { r: 26 + p.n / 25 }, opacity: 0, duration: 2.4, repeat: -1, delay: k * 1.2, ease: 'power2.out' })));
        }, at + .5);
    });
    tl.to(cnt, { v: total, duration: 2.2, ease: 'expo.out', onUpdate: () => { tot.textContent = Math.round(cnt.v).toLocaleString(); } }, 1.0);
    return tl;
  };
  let tl = null, started = false;
  const st = ScrollTrigger.create({ trigger: root, start: 'top 60%', once: true, onEnter: () => { started = true; tl = play(); } });

  // 툴팁/하이라이트
  let cur = -1, hover = false, vis = false;
  const show = i => {
    if (cur > -1) { pins[cur].g.classList.remove('is-on'); pins[cur].li.classList.remove('is-on'); }
    cur = i; const p = pins[i]; p.g.classList.add('is-on'); p.li.classList.add('is-on');
    tip.querySelector('b').textContent = p.name; tip.querySelector('span').textContent = `매장 ${p.n}개 · 신규 오픈 ${Math.max(1, Math.round(p.n / 40))}곳`;
    const b = p.drop.getBoundingClientRect(), r = box.getBoundingClientRect();
    gsap.to(tip, { left: b.left - r.left + b.width / 2, top: b.top - r.top - 8, opacity: 1, duration: .6, ease: 'expo.out', overwrite: true });
    gsap.fromTo(p.drop, { y: 0 }, { y: -12, duration: .22, yoyo: true, repeat: 1, ease: 'power2.out' });
  };
  const hs = pins.map((p, i) => {
    const en = () => { hover = true; show(i); }, lv = () => { hover = false; };
    p.g.addEventListener('pointerenter', en); p.g.addEventListener('pointerleave', lv);
    p.li.addEventListener('pointerenter', en); p.li.addEventListener('pointerleave', lv);
    return () => { p.g.removeEventListener('pointerenter', en); p.g.removeEventListener('pointerleave', lv); p.li.removeEventListener('pointerenter', en); p.li.removeEventListener('pointerleave', lv); };
  });
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { threshold: .3 }); io.observe(root);
  const iv = setInterval(() => { if (started && vis && !hover) show((cur + 1) % pins.length); }, 2400);
  // 가끔 전체 재드롭
  const iv2 = setInterval(() => { if (started && vis && !hover) { tl && tl.kill(); tl = play(); } }, 24000);

  return () => { clearInterval(iv); clearInterval(iv2); io.disconnect(); st.kill(); hs.forEach(f => f()); tl && tl.kill(); ripples.forEach(r => r.kill()); gsap.killTweensOf(tip); };
}
