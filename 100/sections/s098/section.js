export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const stack = q('.s098__stack'), yes = q('.s098__yes');
  const dishes = [
    ['KOREAN SET', '김치찌개 정식', '묵은지로 끓인 칼칼한 찌개에 계란말이, 반찬 다섯 가지.', '9,000원', ['#f2a65a', '#c8442b', '#fff1dc', '#7cc15a']],
    ['PASTA', '트러플 크림 파스타', '생크림과 트러플 오일, 바삭한 베이컨칩을 올렸어요.', '14,500원', ['#e9d9b8', '#b98b4a', '#fffaf0', '#6a4a2a']],
    ['DONBURI', '숯불 닭갈비 덮밥', '불향 가득한 닭갈비와 반숙 계란, 양배추 샐러드.', '11,000원', ['#e56a4d', '#8a2a1c', '#fff0e0', '#ffd24a']],
    ['POKE', '연어 포케 볼', '노르웨이산 연어와 아보카도, 유자 소스로 가볍게.', '13,500원', ['#7fc8b8', '#2f7f72', '#fffaf0', '#ff8a6a']],
    ['SPICY', '매콤 쭈꾸미 볶음', '직화로 볶아 쫄깃함을 살린 쭈꾸미와 콩나물밥.', '12,500원', ['#d84a3a', '#7a1a12', '#ffe9d6', '#ffb24a']],
    ['DESSERT', '말차 크림 빙수', '진한 우지 말차 크림과 쌀 튀밥, 팥 한 스푼.', '8,500원', ['#a9d08a', '#4f7f35', '#f6f9ea', '#ffffff']]
  ];
  const N = dishes.length;
  const cards = dishes.map((d, i) => {
    const c = document.createElement('div'); c.className = 's098__card';
    c.style.cssText = `--c1:${d[4][0]};--c2:${d[4][1]};--c3:${d[4][2]};--c4:${d[4][3]}`;
    c.innerHTML = `<div class="s098__in"><div class="s098__art"><i class="p"></i><i class="t1"></i><i class="t2"></i><i class="t3"></i></div>
      <div class="s098__info"><p class="s098__tag">${d[0]}</p><h3 class="s098__nm">${d[1]}</h3><p class="s098__ds">${d[2]}</p><p class="s098__pr">${d[3]}</p></div>
      <span class="s098__st s098__st--y">먹을래!</span><span class="s098__st s098__st--n">다음에</span></div>`;
    stack.appendChild(c);
    c._in = c.firstChild; c._sy = c.querySelector('.s098__st--y'); c._sn = c.querySelector('.s098__st--n'); c._art = c.querySelector('.s098__art');
    return c;
  });
  let order = [...cards], score = 0, last = performance.now(), dragging = false, flying = false;

  const layout = (animate, skip) => order.forEach((c, i) => {
    if (c === skip) return;
    gsap.to(c, { scale: 1 - i * .06, y: i * 20, rotate: i ? (i % 2 ? 1 : -1) * (1.6 + i * .5) : 0, opacity: i > 3 ? 0 : 1, zIndex: N - i, duration: animate ? .8 : 0, ease: 'expo.out', overwrite: 'auto' });
    c._drag[i === 0 ? 'enable' : 'disable']();
  });
  const stamps = (c, x) => { const k = Math.min(1, Math.abs(x) / 130); gsap.set(c._sy, { opacity: x > 0 ? k : 0, scale: .9 + k * .15 }); gsap.set(c._sn, { opacity: x < 0 ? k : 0, scale: .9 + k * .15 }); };

  // 던지기: 속도·방향을 이어받아 날아가고, 뒤 카드가 즉시 올라온다
  const fling = (c, dir, vy = 0) => {
    if (flying) return; flying = true; last = performance.now();
    order.shift(); layout(true, c);
    if (dir > 0) { score++; yes.textContent = score; gsap.fromTo(yes, { scale: 1.5 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.5)' }); }
    gsap.to(c._in, { x: dir * innerWidth * .75, y: '+=' + (vy * .25 - 40), rotation: dir * 32, duration: 1, ease: 'expo.out' });
    gsap.to(c, { opacity: 0, duration: .5, delay: .35, ease: 'power1.in', onComplete: () => {
      gsap.set(c._in, { x: 0, y: 0, rotation: 0 }); stamps(c, 0);
      order.push(c); gsap.set(c, { scale: .76, y: (N - 1) * 20 + 10, opacity: 0, zIndex: 0 });
      layout(true); flying = false;
    } });
  };

  cards.forEach(c => {
    const d = Draggable.create(c._in, {
      type: 'x,y', zIndexBoost: false,
      onPress() { last = performance.now(); dragging = true; gsap.killTweensOf(c._in); },
      onDrag() { gsap.set(c._in, { rotation: this.x * .07 }); stamps(c, this.x); last = performance.now(); },
      onRelease() {
        dragging = false; last = performance.now();
        const vx = InertiaPlugin.getVelocity(c._in, 'x'), vy = InertiaPlugin.getVelocity(c._in, 'y');
        if (Math.abs(this.x) > 120 || Math.abs(vx) > 900) fling(c, (Math.abs(vx) > 900 ? vx : this.x) > 0 ? 1 : -1, vy);
        else { gsap.to(c._in, { x: 0, y: 0, rotation: 0, duration: 1, ease: 'elastic.out(1,.5)' }); stamps(c, 0); }
      }
    })[0];
    c._drag = d;
  });
  layout(false);
  gsap.from(cards, { y: 80, opacity: 0, stagger: .08, duration: 1.2, ease: 'expo.out', delay: .2, clearProps: 'none', onComplete: () => layout(false) });

  const tap = dir => { if (!flying && order[0]) { last = performance.now(); gsap.to(order[0]._in, { x: dir * 120, rotation: dir * 8, duration: .25, ease: 'power2.out', onUpdate: () => stamps(order[0], dir * 130), onComplete: () => fling(order[0], dir) }); } };
  const bn = q('.s098__b--n'), by = q('.s098__b--y');
  const fn = () => tap(-1), fy = () => tap(1);
  bn.addEventListener('click', fn); by.addEventListener('click', fy);

  // 자동 데모: 입력이 2.5초 멈추면 스스로 살짝 끌었다가 던진다 (오른쪽/왼쪽 교대, 먹을래 비중 높게)
  let n = 0;
  const demo = setInterval(() => {
    if (dragging || flying || performance.now() - last < 2500) return;
    const r = root.getBoundingClientRect();
    if (r.top > innerHeight * .8 || r.bottom < innerHeight * .2) return;
    tap([1, -1, 1, 1, -1][n++ % 5]);
    last = performance.now() - 1000;
  }, 900);
  return () => { clearInterval(demo); cards.forEach(c => c._drag.kill()); bn.removeEventListener('click', fn); by.removeEventListener('click', fy); };
}
