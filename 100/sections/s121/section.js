export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const cv = q('.s121__cv'), g = cv.getContext('2d', { willReadFrequently: true });
  const W = cv.width, H = cv.height;
  const coin = q('.s121__coin'), card = q('.s121__card'), stage = q('.s121__stage');
  const bar = q('.s121__bar'), pct = q('.s121__pct'), cta = q('.s121__cta'), again = q('.s121__again');
  const big = q('.s121__big'), bigParts = [...big.children], small = q('.s121__prize small'), sub = q('.s121__prize p');
  let revealed = false, scratching = false, last = null, user = false, tl = null, vis = false, lastCheck = 0, ratio = 0;

  function paintCoat() {
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, W, H);
    [[0, '#bfc4c9'], [.22, '#eef0f2'], [.45, '#a9afb5'], [.7, '#e6e9eb'], [1, '#b2b8be']].forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 8;
    for (let x = -H; x < W + H; x += 38) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.4)' : 'rgba(60,70,80,.12)';
      g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
    }
    g.setLineDash([10, 8]); g.strokeStyle = 'rgba(70,78,86,.45)'; g.lineWidth = 3; g.strokeRect(18, 18, W - 36, H - 36); g.setLineDash([]);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(70,78,86,.6)'; g.font = '800 58px Pretendard, "Malgun Gothic", sans-serif';
    g.fillText('긁어보세요', W / 2, H / 2 - 12);
    g.font = '700 16px Pretendard, "Malgun Gothic", sans-serif';
    g.fillText('S C R A T C H   &   W I N', W / 2, H / 2 + 38);
  }
  function measure() {
    const d = g.getImageData(0, 0, W, H).data; let clear = 0, n = 0;
    for (let i = 3; i < d.length; i += 4 * 7) { n++; if (d[i] < 40) clear++; }
    ratio = clear / n;
    gsap.set(bar, { scaleX: Math.min(1, ratio / .6) });
    pct.textContent = Math.min(100, Math.round(ratio / .6 * 100)) + '%';
    if (ratio >= .6) reveal();
  }
  function stroke(x, y) {
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = g.lineJoin = 'round'; g.lineWidth = 50;
    g.beginPath();
    if (last) g.moveTo(last.x, last.y); else g.moveTo(x - .1, y);
    g.lineTo(x, y); g.stroke();
    last = { x, y };
    const now = performance.now();
    if (!revealed && now - lastCheck > 120) { lastCheck = now; measure(); }
  }
  function reveal() {
    if (revealed) return; revealed = true;
    gsap.to(cv, { opacity: 0, duration: .7, ease: 'power2.out' });
    cv.style.pointerEvents = 'none';
    bar.style.transform = 'scaleX(1)'; pct.textContent = '100%';
    gsap.fromTo(bigParts, { yPercent: 18, rotate: -3 }, { yPercent: 0, rotate: 0, duration: 1, stagger: .09, ease: 'expo.out', delay: .1 });
    gsap.fromTo(bigParts[2], { scale: .55 }, { scale: 1, duration: 1.2, ease: 'elastic.out(1,.45)', delay: .15 });
    gsap.fromTo([small, sub], { y: 10 }, { y: 0, duration: .8, stagger: .12, ease: 'power3.out', delay: .3 });
    cta.classList.add('on'); gsap.to(cta, { y: 0, duration: .8, ease: 'expo.out', delay: .45 });
    again.classList.add('on');
    const cx = card.offsetLeft + card.offsetWidth / 2, cy = card.offsetTop + card.offsetHeight / 2;
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('i'); s.className = 's121__spark';
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      s.style.background = ['#e4472a', '#f6a91b', '#2a1608'][i % 3];
      stage.appendChild(s);
      const a = Math.random() * Math.PI * 2, r = 160 + Math.random() * 220;
      gsap.fromTo(s, { scale: 0, rotate: 0 }, { x: Math.cos(a) * r, y: Math.sin(a) * r * .7, scale: .6 + Math.random() * 1.2, rotate: 200, duration: 1.1, ease: 'expo.out' });
      gsap.to(s, { opacity: 0, duration: .5, delay: .9, onComplete: () => s.remove() });
    }
  }
  function resetCard() {
    revealed = false; last = null; ratio = 0;
    paintCoat();
    gsap.killTweensOf([cv, cta, ...bigParts, small, sub]);
    gsap.set(cv, { opacity: 1 }); cv.style.pointerEvents = 'auto';
    gsap.set(bar, { scaleX: 0 }); pct.textContent = '0%';
    gsap.set([...bigParts, small, sub], { clearProps: 'all' });
    cta.classList.remove('on'); gsap.set(cta, { y: 8 }); again.classList.remove('on');
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  const down = e => {
    if (!user) { user = true; if (tl) tl.kill(); gsap.to(coin, { opacity: 0, duration: .3 }); }
    scratching = true; last = null;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    const p = pos(e); stroke(p.x, p.y);
  };
  const move = e => { if (!scratching) return; const p = pos(e); stroke(p.x, p.y); };
  const up = () => { scratching = false; last = null; };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const onAgain = () => { user = true; if (tl) tl.kill(); gsap.set(coin, { opacity: 0 }); resetCard(); };
  again.addEventListener('click', onAgain);

  // 자동 데모: 가상 포인터(동전)가 지그재그로 긁는다
  const rows = [34, 78, 122, 166, 210, 254, 298];
  const pts = []; rows.forEach((y, i) => { const a = i % 2 ? [W - 30, 30] : [30, W - 30]; pts.push([a[0], y], [a[1], y]); });
  const segs = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(L); total += L; }
  const at = t => {
    let d = t * total, i = 0;
    while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
    const k = Math.min(1, d / segs[i]);
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k + Math.sin(k * 9) * 5];
  };
  const cursor = { t: 0 };
  tl = gsap.timeline({ repeat: -1, paused: true });
  tl.call(() => { resetCard(); cursor.t = 0; })
    .set(coin, { opacity: 0 })
    .to({}, { duration: .4 })
    .call(() => { const [x, y] = at(0), s = card.offsetWidth / W; coin.style.transform = `translate(${x * s}px,${y * s}px)`; gsap.set(coin, { opacity: 1 }); })
    .to(cursor, {
      t: 1, duration: 5.2, ease: 'sine.inOut', onUpdate() {
        const [x, y] = at(cursor.t), s = card.offsetWidth / W;
        coin.style.transform = `translate(${x * s}px,${y * s}px) rotate(${Math.sin(cursor.t * 40) * 8}deg)`;
        if (!revealed) stroke(x, y);
      }
    })
    .call(() => { if (!revealed) reveal(); })
    .to(coin, { opacity: 0, duration: .4 })
    .to({}, { duration: 4 });
  resetCard();
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; if (!user) tl.paused(!vis); }, { threshold: .25 });
  io.observe(root);
  return () => {
    io.disconnect(); tl.kill();
    cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move);
    cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
    again.removeEventListener('click', onAgain);
  };
}
