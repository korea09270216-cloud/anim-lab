// 이 섹션은 순수 CSS(shape() + sin() + @property + view timeline)가 구동한다. JS 는 화면 밖일 때 무한 드리프트를 멈추는 일만 한다.
export default function init(root, ctx) {
  const pin = root.querySelector('.s137__pin');
  const pizza = root.querySelector('.s137__pizza');
  const io = new IntersectionObserver(e => {
    const st = e[0].isIntersecting ? '' : 'paused';
    pin.style.animationPlayState = st;
    pizza.style.animationPlayState = st;
  }, { threshold: 0 });
  io.observe(root);
  return () => io.disconnect();
}
