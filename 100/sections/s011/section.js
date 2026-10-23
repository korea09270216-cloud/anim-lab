export default function init(root, ctx) {
  const lines = [...root.querySelectorAll('[data-split]')];
  const chars = [];
  lines.forEach(l => {
    const t = l.textContent; l.textContent = '';
    [...t].forEach(c => { const s = document.createElement('span'); s.className = 's011__ch'; s.textContent = c; l.appendChild(s); chars.push({ el: s, k: 0, sk: 0 }); });
  });
  const base = [29, 20, 16], hot = [255, 74, 28];
  let ptr = { x: ctx.mouse.x, y: ctx.mouse.y }, lx = ctx.mouse.x, ly = ctx.mouse.y, last = performance.now();
  let visible = true;
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  const off = ctx.tick((time) => {
    if (!visible) return;
    const now = performance.now();
    if (ctx.mouse.x !== lx || ctx.mouse.y !== ly) { lx = ctx.mouse.x; ly = ctx.mouse.y; last = now; }
    const rr = root.getBoundingClientRect();
    let tx, ty;
    if (now - last > 1600) { // idle: 유령 커서가 글자 위를 가로지른다
      const t = time * .55;
      tx = rr.left + rr.width * (.5 + .42 * Math.sin(t)); ty = rr.top + rr.height * (.5 + .12 * Math.sin(t * 1.7 + 1));
    } else { tx = ctx.mouse.x; ty = ctx.mouse.y; }
    ptr.x += (tx - ptr.x) * .12; ptr.y += (ty - ptr.y) * .12;
    const R = Math.max(220, rr.width * .17);
    chars.forEach(c => {
      const el = c.el;
      const cx = rr.left + el.parentElement.offsetLeft + el.offsetLeft + el.offsetWidth / 2;
      const cy = rr.top + el.parentElement.offsetTop + el.offsetTop + el.offsetHeight / 2;
      const dx = ptr.x - cx, dy = ptr.y - cy;
      const kt = Math.exp(-(dx * dx + dy * dy) / (R * R));
      c.k += (kt - c.k) * (kt > c.k ? .22 : .08); // 올라올 땐 빠르게, 풀릴 땐 느리게
      c.sk += (Math.max(-1, Math.min(1, -dx / R)) * c.k - c.sk) * .15;
      const k = c.k, fs = el.offsetHeight;
      el.style.transform = `skewX(${(c.sk * 22).toFixed(2)}deg) scaleY(${(.78 + k * .62).toFixed(3)}) scaleX(${(1 - k * .06).toFixed(3)})`;
      el.style.webkitTextStrokeWidth = (k * fs * .055).toFixed(2) + 'px';
      const m = Math.min(1, k * 1.25);
      el.style.color = `rgb(${base.map((b, i) => Math.round(b + (hot[i] - b) * m)).join(',')})`;
    });
  });
  return () => { off(); io.disconnect(); };
}
