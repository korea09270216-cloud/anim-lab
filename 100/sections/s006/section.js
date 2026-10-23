export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const world = $('.s006__world'), wl = $('.s006__wl'), wr = $('.s006__wr'), floor = $('.s006__floor');
  const zoneEm = $('.s006__zone em'), zoneName = $('.s006__zone strong'), zoneEn = $('.s006__zone span'), meter = $('.s006__meter i');
  const art = [
    'radial-gradient(circle at 50% 38%,#e8553d 0 24%,transparent 25%),linear-gradient(#f4e3c4,#f4e3c4)',
    'linear-gradient(135deg,#7d8f6b 0 50%,#f0e1c4 50%)',
    'radial-gradient(circle at 30% 70%,#2b241c 0 18%,transparent 19%),radial-gradient(circle at 70% 35%,#c46a4a 0 26%,transparent 27%),#e9d8b8',
    'repeating-linear-gradient(0deg,#2b241c 0 6px,#f0e1c4 6px 22px)',
    'conic-gradient(from 90deg at 50% 100%,#e8b84a,#c46a4a,#7d8f6b,#e8b84a)',
    'radial-gradient(circle at 50% 100%,#7d8f6b 0 55%,transparent 56%),radial-gradient(circle at 50% 100%,#2f4a3a 0 38%,transparent 39%),#f4e3c4',
  ];
  const mkPoster = (parent, left, top, w, h, i, label) => {
    const p = document.createElement('div'); p.className = 's006__poster';
    p.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
    p.innerHTML = `<i style="background:${art[i % art.length]}"></i><span>${label}</span>`;
    parent.appendChild(p);
  };
  // 좌측 벽: 로컬 x = 400 - zWorld, 우측 벽: 로컬 x = zWorld + 3800
  const L = z => 400 - z, R = z => z + 3800;
  mkPoster(wl, L(-250) - 130, 70, 260, 340, 0, '01 · 아침의 빛');
  mkPoster(wl, L(-900) - 100, 90, 200, 270, 1, '02 · 반반');
  mkPoster(wl, L(-1250) - 170, 40, 340, 400, 2, '03 · 정물');
  mkPoster(wl, L(-1700) - 100, 100, 200, 260, 3, '04 · 줄무늬');
  mkPoster(wl, L(-2100) - 130, 60, 260, 340, 4, '05 · 노을');
  mkPoster(wl, L(-2600) - 110, 80, 220, 300, 5, '06 · 숲');
  mkPoster(wr, R(-450) - 110, 80, 220, 300, 5, '07 · 숲 II');
  mkPoster(wr, R(-800) - 110, 80, 220, 300, 4, '08 · 노을 II');
  const shelf = (z, w, items) => {
    const s = document.createElement('div'); s.className = 's006__shelf';
    s.style.cssText = `left:${R(z)}px;top:${230 - Math.max(...items.map(i => i[1]))}px;width:${w}px;height:${Math.max(...items.map(i => i[1])) + 12}px`;
    items.forEach(([c, h, ww]) => { const b = document.createElement('i'); b.style.cssText = `background:${c};height:${h}px;width:${ww}px`; s.appendChild(b); });
    wr.appendChild(s);
  };
  shelf(-1300, 420, [['#7d8f6b', 120, 60], ['#e8b84a', 80, 70], ['#2b241c', 150, 50], ['#c46a4a', 100, 80], ['#f4e3c4', 130, 56], ['#4f8f86', 90, 70]]);
  const sh2 = [['#c46a4a', 150, 70], ['#f4e3c4', 90, 90], ['#7d8f6b', 120, 60], ['#e8b84a', 70, 80], ['#2b241c', 140, 52]];
  shelf(-1760, 420, sh2);

  // 3D 박스 가구
  const box = (x, z, w, h, d, top, side, label) => {
    const c = document.createElement('div'); c.className = 's006__bx';
    c.style.transform = `translate3d(${x}px,${280 - h / 2}px,${z}px)`;
    const f = (cls, ww, hh, tf, bg, txt) => { const b = document.createElement('b'); b.style.cssText = `width:${ww}px;height:${hh}px;left:${-ww / 2}px;top:${-hh / 2}px;transform:${tf};background:${bg}`; if (txt) { b.style.cssText += ';display:grid;place-items:center;font-weight:900;font-size:22px;color:#fff6e6;letter-spacing:.2em'; b.textContent = txt; } c.appendChild(b); };
    f('f', w, h, `translateZ(${d / 2}px)`, side, label);
    f('b', w, h, `rotateY(180deg) translateZ(${d / 2}px)`, side);
    f('r', d, h, `rotateY(90deg) translateZ(${w / 2}px)`, `linear-gradient(90deg,${side},rgba(0,0,0,.18)),${side}`);
    f('l', d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, `linear-gradient(90deg,rgba(0,0,0,.18),${side}),${side}`);
    f('t', w, d, `rotateX(90deg) translateZ(${h / 2}px)`, top);
    world.appendChild(c);
  };
  box(430, -2250, 340, 200, 700, '#e8dcc4', '#c46a4a', '');
  box(-460, -1500, 190, 90, 190, '#e8dcc4', '#7d8f6b', '');
  box(-470, -2150, 200, 150, 200, '#e8dcc4', '#2f4a3a', '');
  box(-430, -2750, 260, 70, 260, '#f4e3c4', '#e8b84a', '');
  box(380, -700, 120, 120, 120, '#4f8f86', '#2f6f69', '');
  // 펜던트 램프
  [[-120, -1100], [160, -1700], [-80, -2300], [140, -2900]].forEach(([x, z]) => {
    const l = document.createElement('div'); l.className = 's006__lamp';
    l.style.cssText = `width:70px;height:70px;left:${x - 35}px;top:-200px;transform:translateZ(${z}px)`;
    world.appendChild(l);
  });

  // 카메라 경로
  const cam = { x: 0, y: 0, z: 250, yaw: 0, pitch: 0 };
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'sine.inOut' } });
  tl.to(cam, { z: -1250, duration: 2.2, ease: 'power1.inOut' })
    .to(cam, { yaw: -42, x: -190, z: -1500, duration: 1.3, ease: 'power3.inOut' })
    .to(cam, { yaw: 42, x: 210, z: -2250, duration: 1.7, ease: 'power2.inOut' })
    .to(cam, { yaw: 0, x: 0, z: -2900, y: -20, duration: 1.3, ease: 'power3.inOut' })
    .to(cam, { z: -3150, y: 0, pitch: 3, duration: 1, ease: 'power2.out' });
  const dur = tl.duration();
  const zones = [[0, '01', '현관', 'ENTRANCE'], [.3, '02', '갤러리', 'GALLERY'], [.52, '03', '라운지', 'LOUNGE'], [.86, '04', '창가 자리', 'WINDOW']];
  let zi = -1;
  let target = 0, cur = 0;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; } });
  const t0 = performance.now();
  const off = ctx.tick(() => {
    cur += (target - cur) * .09;
    tl.time(cur * dur);
    const t = (performance.now() - t0) / 1000;
    const sway = ctx.reduced ? 0 : 1;
    const yaw = cam.yaw + Math.sin(t * .7) * .5 * sway, y = cam.y + Math.sin(t * 1.1) * 3 * sway;
    world.style.transform = `rotateX(${cam.pitch + Math.sin(t * .9) * .25 * sway}deg) rotateY(${-yaw}deg) translate3d(${-cam.x}px,${-y}px,${-cam.z}px)`;
    let k = 0; zones.forEach((z, i) => { if (cur >= z[0]) k = i; });
    if (k !== zi) { zi = k; zoneEm.textContent = zones[k][1]; zoneName.textContent = zones[k][2]; zoneEn.textContent = zones[k][3]; gsap.fromTo($('.s006__zone'), { y: 12, opacity: .3 }, { y: 0, opacity: 1, duration: .6, ease: 'expo.out' }); }
    meter.style.top = `calc(${cur * 100}% - 5px)`;
  });
  return () => { off(); st.kill(); tl.kill(); };
}
