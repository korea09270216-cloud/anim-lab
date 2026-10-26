# Animation Lab

어워드급 웹 애니메이션 쇼케이스. GSAP · Lenis · WebGL · CSS3D · SVG · Matter.js.

- `index.html` — 첫 데모 (12개 모션을 한 페이지에 이어 붙임)
- `100/` — **100 SECTIONS** 갤러리 (`100/index.html`, 🏪 창업·프랜차이즈 추천 탭 = `100/#franchise`, 분류 문서 = `100/FRANCHISE.md`, ✨ 클로드 추천 30선 = `100/#picks` — 에이전트 패널 토론 기록은 `100/research/debate/`) + 섹션 단독 뷰어 (`100/view.html?s=NNN`)
  - 카테고리: A 스크롤 시네마틱 · B 타이포 · C WebGL · D 커서/호버 · E 전환/레이아웃 · F SVG · G 브랜드 컴포지션 · H 3D/CSS · I 물리/캔버스 · J 인트로/UX
  - 섹션 1개 = `100/sections/sNNN/{section.html, section.css, section.js, meta.json}` (자기완결, 외부 네트워크 없음)
  - 계약·품질 기준: `100/BRIEF.md`, 계약 샘플: `100/sections/s000`

## 로컬 실행
```
docker compose up -d      # http://localhost:8090  (갤러리: /100/)
```
정적 사이트라 아무 정적 서버로도 된다. 모든 경로는 상대경로 (GitHub Pages 하위 경로 호환).

## 검증
```
node 100/tools/check.js 001 002 ...   # 마운트·콘솔 에러·높이·모션 유무 + 스크린샷(100/shots)
node 100/tools/build-manifest.js      # 갤러리 manifest.json 재생성
```
(`check.js` 는 playwright/sharp 경로가 하드코딩돼 있다 — 환경에 맞게 `R` 상수를 수정)
