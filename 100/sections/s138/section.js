// 경로(offset-path)·주행·카운터·정차 핀 점등은 전부 CSS view timeline 이 구동한다.
// JS 는 정차 핀을 경로 위 정확한 호 길이 지점에 배치하는 일만 한다(SVG getPointAtLength).
export default function init(root) {
  const road = root.querySelector('.s138__road');
  const len = road.getTotalLength();
  root.querySelectorAll('.s138__stop').forEach(el => {
    const p = road.getPointAtLength(len * parseFloat(el.dataset.f));
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  });
}
