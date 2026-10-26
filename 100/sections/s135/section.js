// 높이/폭 auto 전환은 CSS(interpolate-size, calc-size). JS 는 데모용 FAQ 순환만(사용자가 누르면 정지).
export default function init(root, ctx) {
  const items = [...root.querySelectorAll('details')];
  let i = 0;
  const id = setInterval(() => { i = (i + 1) % items.length; items[i].open = true; }, 2800);
  const stop = () => clearInterval(id);
  root.addEventListener('pointerdown', stop, { once: true });
  return () => { clearInterval(id); root.removeEventListener('pointerdown', stop); };
}
