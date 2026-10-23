export default function init(root, ctx) {
  const world = root.querySelector('.s005__world');
  const cam = root.querySelector('.s005__cam');
  const items = [
    ['불꽃 닭꼬치', '숯불에 즉석 훈제, 매운 마늘 소스', '#ff3d8b', '#2a0016', '#ff3d8b99'],
    ['연꽃 빙수', '우유 얼음과 국산 팥, 연꽃 젤리', '#2de2ff', '#00232b', '#2de2ff99'],
    ['트러플 감자탑', '나선으로 썰어 튀긴 한 줄 감자', '#ffe44d', '#2b2300', '#ffe44d99'],
    ['도깨비 호떡', '흑설탕과 견과류가 흐르는 한 판', '#ff8a3d', '#2b1100', '#ff8a3d99'],
    ['바질 에이드', '생바질 한 줄기와 탄산 얼음', '#6dff9c', '#002b10', '#6dff9c99'],
    ['고구마 라떼', '군고구마를 통째로 갈아 넣은 한 잔', '#b78bff', '#17002b', '#b78bff99'],
    ['한우 육전', '얇게 부친 한우 위에 파채 한 줌', '#ff5a5a', '#2b0000', '#ff5a5a99'],
  ];
  const N = 14, GAP = 520, LOOP = N * GAP;
  const cards = [];
  for (let i = 0; i < N; i++) {
    const t = root.querySelector('.s005__tpl').content.firstElementChild.cloneNode(true);
    const d = items[i % items.length];
    t.querySelector('em').textContent = 'N°' + String(i + 1).padStart(2, '0');
    t.querySelector('h3').textContent = d[0]; t.querySelector('p').textContent = d[1];
    t.style.cssText = `--c:${d[2]};--t:${d[3]};--g:${d[4]}`;
    const ang = i * 2.4, R = 360 + (i % 3) * 70;
    const x = Math.cos(ang) * R * 1.3, y = Math.sin(ang) * R * .8;
    world.appendChild(t);
    cards.push({ el: t, x, y, z: -i * GAP, ry: -x / R * 14, rz: ((i % 5) - 2) * 3 });
  }
  const stars = [];
  for (let i = 0; i < 24; i++) {
    const s = document.createElement('i'); s.className = 's005__star'; world.appendChild(s);
    const a = Math.random() * 6.283, r = 200 + Math.random() * 900;
    stars.push({ el: s, x: Math.cos(a) * r, y: Math.sin(a) * r * .7, z: -Math.random() * LOOP });
  }
  let target = 0, cur = 0, camZ = 0, prev = 0, vel = 0, mx = 0, my = 0;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; } });
  const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const off = ctx.tick(() => {
    cur += (target - cur) * .08;
    vel += (Math.abs(cur - prev) * 700 - vel) * .1; prev = cur;
    camZ = cur * LOOP * 1.7 + performance.now() * .05 * (ctx.reduced ? 0 : 1);
    mx += ((ctx.mouse.nx - .5) - mx) * .05; my += ((ctx.mouse.ny - .5) - my) * .05;
    cam.style.perspectiveOrigin = `${50 + mx * 26}% ${50 + my * 22}%`;
    world.style.transform = `rotateY(${mx * 7}deg) rotateX(${-my * 5}deg) rotateZ(${Math.sin(cur * 9) * 3}deg)`;
    const place = z => ((z + camZ) % LOOP + LOOP) % LOOP - LOOP + 700;
    cards.forEach(c => {
      const z = place(c.z);
      c.el.style.opacity = smooth(-LOOP + 700, -LOOP + 2400, z) * (1 - smooth(120, 520, z));
      c.el.style.transform = `translate3d(${c.x}px,${c.y}px,${z}px) rotateY(${c.ry}deg) rotateZ(${c.rz}deg)`;
    });
    const L = 1 + Math.min(60, vel * 6);
    stars.forEach(s => {
      const z = place(s.z);
      s.el.style.opacity = smooth(-LOOP + 700, -LOOP + 2000, z) * (1 - smooth(300, 650, z)) * .9;
      s.el.style.transform = `translate3d(${s.x}px,${s.y}px,${z}px) scale(1.4,${L})`;
    });
  });
  return () => { off(); st.kill(); };
}
