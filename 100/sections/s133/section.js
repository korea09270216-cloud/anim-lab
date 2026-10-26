// 탭 인디케이터·툴팁 뒤집힘은 CSS anchor positioning. JS 는 데모 탭 순환만(사용자가 누르면 정지).
export default function init(root, ctx) {
  const radios = [...root.querySelectorAll('.s133__radio')];
  let i = 0;
  const id = setInterval(() => { i = (i + 1) % radios.length; radios[i].checked = true; }, 2600);
  const stop = () => clearInterval(id);
  root.addEventListener('pointerdown', stop, { once: true });
  return () => { clearInterval(id); root.removeEventListener('pointerdown', stop); };
}
