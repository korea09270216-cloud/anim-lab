// 모션은 전부 CSS(named view-timeline + timeline-scope). JS 는 지원 여부 표시만.
export default function (root) {
  root.dataset.sdt = CSS.supports('animation-timeline', 'view()') && CSS.supports('timeline-scope', '--a') ? 'on' : 'off';
  return () => { delete root.dataset.sdt; };
}
