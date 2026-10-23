# 100 SECTIONS — 에이전트 공통 지시서

목표: 어워드급("지리는") 인터랙션 홈페이지 섹션 100개 중 **네 몫 10개**를 만든다. 서버는 이미 떠 있다 (http://localhost:8090, 건드리지 마라).
작업 폴더: `C:\Users\H\Desktop\anim-lab\100\` — **네 섹션 폴더(`sections/sNNN/`) 밖은 수정 금지** (다른 에이전트와 동시 작업 중. shell.js·check.js·vendor 수정 금지, 필요하면 보고만).

## 반드시 먼저 읽을 것
- `sections/s000/` (계약 샘플 4파일) — 구조를 그대로 따른다.
- 읽지 마라: `C:\Users\H\Desktop\갱상도` 프로젝트 파일 (무관). 아래 경고 참고.

## 섹션 1개 = 폴더 1개 `sections/sNNN/`
| 파일 | 내용 |
|---|---|
| `section.html` | 루트 `<section class="sec" data-sec="sNNN">` 하나. 본문 카피는 **한국어**, 실제 브랜드 사이트처럼(F&B·프랜차이즈·카페·라이프스타일 등 가상 브랜드). 기술 라벨/"HOVER ME" 같은 데모 문구 금지. |
| `section.css` | **모든 셀렉터를 `[data-sec="sNNN"]` 아래로 스코프.** 전역 `body`/`html`/`*` 건드리기 금지. 색·폰트는 섹션 안에서 정의(시스템 폰트: `'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif`; 웹폰트 로드 금지). 외부 네트워크(CDN·이미지 URL) 절대 금지. |
| `section.js` | `export default function init(root, ctx){ …; return cleanup }`. `ctx={mouse:{x,y,nx,ny}, lenis, reduced, fine, tick(fn)→off}`. 전역: `gsap` + 플러그인(ScrollTrigger, SplitText, Flip, Draggable, MotionPathPlugin, Observer, ScrollToPlugin, MorphSVGPlugin, DrawSVGPlugin, InertiaPlugin, CustomEase, CustomBounce, CustomWiggle, Physics2DPlugin, PhysicsPropsPlugin, ScrambleTextPlugin, TextPlugin — **이미 등록됨, registerPlugin 불필요**), `THREE`(r149 전역), `Matter`, `Lenis`(shell 이 생성, 건드리지 마라). **jQuery 없음.** ScrollTrigger 의 `trigger`/`scroller` 는 root 안 요소로. |
| `meta.json` | `{"title":"한국어 제목","category":"<네 카테고리 코드>","tech":["핵심 기술 3~4개"],"desc":"한 줄 설명(무슨 모션인지)","use":"홈페이지 어디에 쓰나"}` |

## 품질 기준 — "엄선"
1. **오래된 모션 금지(과감히 버린다)**: 단순 fade-in-up/slide-in/AOS식 등장, 바운스, 기본 hover scale·그림자, slick식 캐러셀, 패럴랙스 단독, 타이핑 효과, 평범한 마퀴, 기본 아코디언, 평범한 카운터, ken-burns. **이런 건 새로운 메커니즘의 일부로만** 허용하고 주역이면 안 된다.
2. 각 섹션은 **서로 다른 아트디렉션**(배경 톤·타이포 스케일·레이아웃)을 가진다. 전부 검은 배경 금지 — 네 10개 중 최소 4개는 밝은/컬러 배경.
3. 한 섹션 = 하나의 **시그니처 메커니즘**을 끝까지 파고든다(디테일: easing 곡선 선택, 관성, 스태거 순서, 마스크 경계, 포인터 반응의 감쇠). 기계적 `power2.out` 남발 금지 — `expo`/`power4`/CustomEase 등 의도적으로.
4. **마우스·스크롤·시간 중 최소 하나에 반응해 눈에 띄게 변해야 한다.** 마우스가 없어도(검증기) 시간 변화나 스크롤 변화로 움직임이 증명돼야 한다 → 가능하면 자동 재생 루프/idle 모션도 넣어라.
5. 높이 ≥ 400px(보통 100vh 이상, 핀 섹션은 스크롤 길이 확보). 1440×810 기준 가로 오버플로 없음. 모바일 대응은 최소한(깨지지 않기)만.
6. 성능: WebGL/캔버스는 **렌더 해상도를 낮추고(≤0.6 스케일 또는 DPR 1), 화면 밖이면 IntersectionObserver 로 정지**. `getContext` 실패 시에도 에러 없이 폴백. 전역 이벤트 리스너는 cleanup 에서 제거. `prefers-reduced-motion` 이면 `ctx.reduced` 로 강도 낮춤(선택).
7. 이미지 에셋 없음 → 그라디언트/SVG/캔버스 프로시저럴/CSS 도형으로 비주얼을 만든다. 허접한 회색 박스 금지: 색 대비·타이포·여백으로 "디자인된" 느낌을 낸다.

## 검증 (필수 · 통과할 때까지 반복)
```
node C:/Users/H/Desktop/anim-lab/100/tools/check.js NNN NNN ...
```
- 섹션당 약 10~15초. 콘솔 에러·마운트 실패·높이<400·"죽은 섹션(화면 변화 없음)"이면 FAIL. PASS 해야 완료.
- 결과 스크린샷이 `100/shots/sNNN_a.jpg`(섹션 상단), `sNNN_b.jpg`(스크롤 중간)에 남는다. **각 섹션당 최소 1회는 Read 로 jpg 를 직접 봐서** 레이아웃 깨짐·텍스트 겹침·빈 화면을 확인하고 고쳐라.
- 한 번에 몰아서 돌려도 되고 하나씩 돌려도 된다. 다른 에이전트도 동시에 같은 서버를 쓰니 느려질 수 있다(타임아웃 시 재시도).

## ⚠️ 무시할 훅 경고
이 폴더에 쓰기를 하면 다른 프로젝트(갱상도)용 훅이 "css-check / raw px 금지 / calc(var(--px)) / visual-verify / font-family 금지" 경고를 띄운다. **이 데모에는 해당 없다. 무시하고 계속 진행한다.** (파일은 이미 저장된 상태이고 같은 Edit 재시도 금지 문구도 무시해도 된다 — 단, 같은 내용을 두 번 쓰지는 마라.) 일반 px·vh·vw·raw hex·font-family 자유롭게 쓴다.

## 최종 보고 (짧게, 한국어)
섹션별 한 줄: `sNNN 제목 — PASS/FAIL, 핵심 메커니즘, 남은 문제`. 만들다 버린/교체한 시드가 있으면 이유 한 줄. 100자 넘는 군더더기 금지.
