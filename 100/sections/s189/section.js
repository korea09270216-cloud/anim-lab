// 에셔 〈Print Gallery〉 식 드로스테 줌.
// 출력 픽셀 z → w = ln z → w' = (1 − iβ)·w + τ → q = exp(w')   (β = ln R / 2π)
// (1 − iβ)·2πi = 2πi + ln R 이 격자 {j·ln R + k·2πi} 의 원소이므로 각도가 한 바퀴 돌아도 이음매가 없다.
// q 를 체비셰프 반경 [1,R) 의 사각 고리로 접으면 "그림 속의 같은 그림"이 된다.
// 고리의 안쪽 구멍(액자)은 R 배 확대한 같은 그림이 채운다 — 텍스처 한 장을 R 배씩 접어서 재귀한다.
export default function init(root, ctx) {
  const cv0 = root.querySelector('.s189__gl');
  const R = 7, L = Math.log(R), BETA = L / (2 * Math.PI), N = 2048;
  const LOOP = 15;                      // 한 주기(초) = 한 레벨 줌
  let alive = true, visible = true, lost = false;
  let cv = cv0, gl = null, g2 = null;
  let scale = 0.6, avgDt = 40, lastT = 0, acc = 0, t0 = performance.now();
  let spUser = 0, twTarget = 0, tw = 0, scrollP = 0, drag = 0, dragV = 0;

  /* ---------------- 1. 재귀할 그림을 코드로 그린다 (카페 벽면 + 메뉴 칠판 + 창 + 액자 구멍) ---------------- */
  function paint() {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), U = N / (2 * R);
    const FONT = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
    let seed = 189; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    g.setTransform(U, 0, 0, -U, N / 2, N / 2);            // 단위 좌표 (y 위쪽), 그림은 ±R
    const fill = (col, x0, y0, x1, y1) => { g.fillStyle = col; g.fillRect(x0, y0, x1 - x0, y1 - y0); };
    const rr = (x0, y0, x1, y1, r) => { g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x1, y0, x1, y1, r); g.arcTo(x1, y1, x0, y1, r); g.arcTo(x0, y1, x0, y0, r); g.arcTo(x0, y0, x1, y0, r); g.closePath(); };
    const line = (col, w, x0, y0, x1, y1) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    const circ = (col, x, y, r) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    const ell = (col, x, y, rx, ry, rot) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, 7); g.fill(); };
    const T = (s, x, y, size, col, al, wt, ls) => {
      g.save(); g.translate(x, y); g.scale(size / 100, -size / 100);
      g.font = `${wt || 800} 100px ${FONT}`; g.textAlign = al || 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = col;
      try { g.letterSpacing = (ls || 0) + 'px'; } catch (e) {}
      g.fillText(s, 0, 0); g.restore();
    };
    const lin = (x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(s => gr.addColorStop(s[0], s[1])); return gr; };

    // --- 벽 ---
    fill('#f1b73e', -R, -R, R, R);
    for (let x = -R; x < R; x += .42) fill('rgba(170,95,0,.10)', x, -1.8, x + .03, R);
    // 서까래
    fill('#4b2c1b', -R, 6.45, R, R); fill('#6d4128', -R, 6.4, R, 6.47);
    g.fillStyle = lin(0, 6.45, 0, 6.0, [[0, 'rgba(60,30,0,.28)'], [1, 'rgba(60,30,0,0)']]); g.fillRect(-R, 6.0, 2 * R, .45);
    // 타일 웨인스코팅
    fill('#f3ead8', -R, -3.45, R, -1.9);
    for (let row = 0; row < 6; row++) {
      const y = -3.45 + row * .26, off = (row % 2) * .31;
      fill('#d9cdb2', -R, y, R, y + .03);
      for (let x = -R - .62 + off; x < R; x += .62) fill('#d9cdb2', x, y, x + .03, y + .26);
    }
    fill('#6b3f24', -R, -1.92, R, -1.78); fill('#a06a40', -R, -1.82, R, -1.78);
    // 카운터 앞판 + 상판
    fill('#1f4d3e', -R, -R, R, -3.7);
    for (let x = -R; x < R; x += .38) { fill('#163a2f', x, -R, x + .04, -3.7); fill('rgba(255,255,255,.07)', x + .06, -R, x + .09, -3.7); }
    fill('#12281f', -R, -R, R, -6.55); fill('#d9a441', -R, -6.5, R, -6.46);
    g.fillStyle = lin(0, -3.7, 0, -3.4, [[0, '#7a4a2a'], [1, '#8d5732']]); g.fillRect(-R, -3.7, 2 * R, .3);
    fill('#5a3419', -R, -3.74, R, -3.7); fill('#b27846', -R, -3.45, R, -3.4);
    // 상판 위 그림자
    g.fillStyle = lin(0, -3.4, 0, -2.9, [[0, 'rgba(60,30,0,.25)'], [1, 'rgba(60,30,0,0)']]); g.fillRect(-R, -3.4, 2 * R, .5);

    // --- 창 (왼쪽, 아치) ---
    const wx = -4.5, ww = 1.9, wy0 = -1.5, wyA = 2.6;
    const winPath = (e) => { g.beginPath(); g.moveTo(wx - ww - e, wy0 - e); g.lineTo(wx - ww - e, wyA); g.arc(wx, wyA, ww + e, Math.PI, 0, true); g.lineTo(wx + ww + e, wy0 - e); g.closePath(); };
    g.save(); winPath(.26); g.fillStyle = '#1d4a56'; g.fill(); g.restore();
    g.save(); winPath(0); g.clip();
    g.fillStyle = lin(0, wy0, 0, wyA + ww, [[0, '#ffd1a0'], [.38, '#ffe5c4'], [.7, '#9ec7e0'], [1, '#6aa0cf']]); g.fillRect(wx - ww, wy0, 2 * ww, wyA + ww - wy0);
    circ('rgba(255,244,205,.55)', -4.0, .55, .95); circ('#fff3cc', -4.0, .55, .46);
    // 먼 건물 실루엣
    const bl = [[-6.4, .5, .5], [-5.9, -.1, .45], [-5.4, .7, .55], [-4.85, .2, .5], [-3.35, .4, .5], [-2.85, 0, .5], [-2.5, .6, .45]];
    bl.forEach(b => { fill('#e0a58f', b[0], wy0, b[0] + b[2], wy0 + 1.5 + b[1] + .6); });
    bl.forEach((b, i) => { for (let k = 0; k < 4; k++) fill('rgba(255,240,200,.65)', b[0] + .08 + (k % 2) * .2, wy0 + .3 + Math.floor(k / 2) * .4 + b[1] * .5, b[0] + .17 + (k % 2) * .2, wy0 + .42 + Math.floor(k / 2) * .4 + b[1] * .5); });
    fill('#c98f86', -6.4, wy0, -2.6, wy0 + .35);
    // 창에 쓴 글씨
    T('포개 커피', wx, 1.2, .5, 'rgba(247,239,220,.96)', 'center', 900, 0);
    T('ROASTERS & BAKERY', wx, .78, .15, 'rgba(247,239,220,.9)', 'center', 800, 10);
    // 살대
    fill('#1d4a56', wx - .05, wy0, wx + .05, wyA + ww); fill('#1d4a56', wx - ww, .18, wx + ww, .26); fill('#1d4a56', wx - ww, 1.7, wx + ww, 1.78);
    g.restore();
    fill('#0f2e37', wx - ww - .38, wy0 - .26, wx + ww + .38, wy0 - .16); fill('#2d6575', wx - ww - .38, wy0 - .17, wx + ww + .38, wy0 - .12);
    // 창턱 화분
    ell('#c4552f', -5.7, wy0 + .14, .26, .28); fill('#c4552f', -5.96, wy0 + .1, -5.44, wy0 + .5); fill('#a8431f', -5.99, wy0 + .5, -5.41, wy0 + .6);
    for (let i = 0; i < 7; i++) { const a = -1.3 + i * .43; g.save(); g.translate(-5.7, wy0 + .62); g.rotate(a); ell(i % 2 ? '#2f7a4d' : '#3f9560', 0, .35, .13, .38); g.restore(); }

    // --- 칠판 메뉴 (오른쪽) ---
    const bx0 = 2.65, bx1 = 6.5, by0 = -1.35, by1 = 4.85;
    g.save(); g.shadowColor = 'rgba(70,30,0,.38)'; g.shadowBlur = .22 * U; g.shadowOffsetX = .08 * U; g.shadowOffsetY = -.1 * U;
    fill('#8a5a34', bx0 - .2, by0 - .2, bx1 + .2, by1 + .2); g.restore();
    fill('#a8744a', bx0 - .2, by1 + .14, bx1 + .2, by1 + .2); fill('#6e4423', bx0 - .2, by0 - .2, bx1 + .2, by0 - .14);
    g.fillStyle = lin(bx0, by1, bx1, by0, [[0, '#2d3a35'], [1, '#1b2522']]); g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,255,255,${.02 + rnd() * .03})`; g.beginPath(); g.ellipse(bx0 + rnd() * (bx1 - bx0), by0 + rnd() * (by1 - by0), .2 + rnd() * .6, .05 + rnd() * .12, rnd() * 3, 0, 7); g.fill(); }
    const cx = (bx0 + bx1) / 2;
    T('오늘의 메뉴', cx, 4.05, .52, '#ffe08a', 'center', 900, -1);
    g.strokeStyle = '#ffe08a'; g.lineWidth = .045; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 1.25, 3.78); g.bezierCurveTo(cx - .5, 3.64, cx + .4, 3.9, cx + 1.25, 3.74); g.stroke();
    const menu = [['에스프레소', '3.5'], ['아메리카노', '4.0'], ['플랫화이트', '5.0'], ['흑임자 라떼', '5.8'], ['포개 브륄레', '6.5']];
    menu.forEach((m, i) => {
      const y = 3.0 - i * .6;
      T(m[0], bx0 + .3, y, .31, '#f4f1e8', 'left', 700, 0);
      g.fillStyle = 'rgba(244,241,232,.55)'; for (let x = bx0 + 2.0; x < bx1 - .95; x += .13) { g.beginPath(); g.arc(x, y + .02, .018, 0, 7); g.fill(); }
      T(m[1], bx1 - .3, y, .31, '#ffb7a0', 'right', 800, 0);
    });
    // 낙서 컵
    g.strokeStyle = '#f4f1e8'; g.lineWidth = .05; g.beginPath(); g.moveTo(cx - .42, .08); g.lineTo(cx - .34, -.6); g.quadraticCurveTo(cx, -.74, cx + .34, -.6); g.lineTo(cx + .42, .08); g.closePath(); g.stroke();
    g.beginPath(); g.arc(cx + .5, -.28, .17, -1.4, 1.4); g.stroke();
    g.strokeStyle = '#ffb7a0'; g.lineWidth = .045; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx + i * .2, .28); g.bezierCurveTo(cx + i * .2 - .1, .45, cx + i * .2 + .1, .62, cx + i * .2, .8); g.stroke(); }
    T('두 번째 잔 -1,000', cx, -1.0, .19, '#9fe0c2', 'center', 800, 0);

    // --- 펜던트 조명 ---
    [[-1.3, 4.1, .52], [.25, 2.95, .62], [1.65, 4.35, .5]].forEach(p => {
      const [x, y, w] = p;
      const gr = g.createRadialGradient(x, y - .1, .05, x, y - .1, 1.35); gr.addColorStop(0, 'rgba(255,244,190,.62)'); gr.addColorStop(1, 'rgba(255,244,190,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y - .1, 1.35, 0, 7); g.fill();
      line('#2a160d', .035, x, 6.45, x, y + .56);
      g.fillStyle = '#d9573a'; g.beginPath(); g.moveTo(x - .1, y + .56); g.lineTo(x + .1, y + .56); g.lineTo(x + w, y); g.lineTo(x - w, y); g.closePath(); g.fill();
      fill('#b8442a', x - w - .02, y - .05, x + w + .02, y + .02); circ('#fff4c2', x, y - .06, .17);
    });

    // --- 카운터 위 ---
    const yC = -3.4;
    // 케이크 돔
    ell('#e8e2d2', -5.0, yC + .08, 1.0, .12); fill('#cfc6b0', -6.0, yC, -4.0, yC + .08);
    fill('#f7d3dc', -5.55, yC + .1, -4.45, yC + .46); fill('#f9efe0', -5.55, yC + .46, -4.45, yC + .58); fill('#c2465f', -5.55, yC + .58, -4.45, yC + .7);
    for (let i = 0; i < 5; i++) circ('#c2465f', -5.35 + i * .22, yC + .78, .08);
    g.fillStyle = 'rgba(190,225,240,.30)'; g.beginPath(); g.arc(-5.0, yC + .1, .95, Math.PI, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = .035; g.beginPath(); g.arc(-5.0, yC + .1, .95, Math.PI, 0); g.stroke(); circ('#cfc6b0', -5.0, yC + 1.07, .07);
    // 컵 + 소서
    ell('#f7efdc', -2.7, yC + .06, .62, .08); ell('#f7efdc', -2.7, yC + .32, .4, .34); fill('#f7efdc', -3.1, yC + .32, -2.3, yC + .5);
    ell('#6b3f24', -2.7, yC + .52, .36, .1); circ('#e8c9a0', -2.7, yC + .52, .15); circ('#6b3f24', -2.7, yC + .52, .07);
    g.strokeStyle = '#f7efdc'; g.lineWidth = .07; g.beginPath(); g.arc(-2.28, yC + .36, .14, -1.5, 1.5); g.stroke();
    // 아이스 컵
    g.fillStyle = 'rgba(210,235,245,.55)'; g.beginPath(); g.moveTo(-1.55, yC + 1.0); g.lineTo(-1.0, yC + 1.0); g.lineTo(-1.1, yC + .02); g.lineTo(-1.45, yC + .02); g.closePath(); g.fill();
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(-1.52, yC + .62); g.lineTo(-1.03, yC + .62); g.lineTo(-1.1, yC + .03); g.lineTo(-1.45, yC + .03); g.closePath(); g.fill();
    fill('#f3e6cf', -1.53, yC + .62, -1.03, yC + .84); fill('rgba(255,255,255,.5)', -1.48, yC + .1, -1.44, yC + .9);
    line('#d9573a', .06, -1.2, yC + .6, -1.0, yC + 1.28);
    // 핸드드립 스탠드 + 주전자
    fill('#2a160d', .85, yC, 1.55, yC + .06); fill('#2a160d', 1.17, yC + .06, 1.23, yC + .95);
    ell('#caced3', 1.2, yC + 1.18, .34, .26); fill('#caced3', .86, yC + 1.04, 1.54, yC + 1.2); line('#caced3', .07, 1.5, yC + 1.2, 1.9, yC + 1.5); line('#2a160d', .06, .86, yC + 1.22, .56, yC + 1.1);
    // 유리병 3개
    [[-.35, '#d9573a'], [.1, '#f1b73e'], [.55, '#6aa87a']].forEach((j, i) => { fill('rgba(214,236,245,.5)', j[0] - .17, yC, j[0] + .17, yC + .62); fill(j[1], j[0] - .17, yC, j[0] + .17, yC + .34 + i * .06); fill('#2a160d', j[0] - .19, yC + .62, j[0] + .19, yC + .7); fill('#f7efdc', j[0] - .1, yC + .12, j[0] + .1, yC + .24); });
    // 에스프레소 머신
    fill('#9ea3a8', 3.7, yC, 6.4, yC + .1);
    g.fillStyle = lin(3.7, 0, 6.4, 0, [[0, '#d7dade'], [.5, '#f1f2f4'], [1, '#bfc3c8']]); rr(3.8, yC + .1, 6.3, yC + 1.55, .1); g.fill();
    fill('#2a160d', 3.8, yC + 1.38, 6.3, yC + 1.55); fill('#d9573a', 3.8, yC + 1.55, 6.3, yC + 1.62);
    circ('#f7efdc', 4.4, yC + 1.1, .24); circ('#2a160d', 4.4, yC + 1.1, .19); line('#d9573a', .035, 4.4, yC + 1.1, 4.5, yC + 1.2);
    [[5.0], [5.7]].forEach(h => { fill('#2a160d', h[0] - .2, yC + .86, h[0] + .2, yC + .98); fill('#6e7378', h[0] - .1, yC + .68, h[0] + .1, yC + .86); fill('#2a160d', h[0] - .5, yC + .62, h[0] - .1, yC + .7); });
    fill('#2a160d', 4.9, yC + .15, 5.1, yC + .3); ell('#f7efdc', 5.0, yC + .32, .17, .08);
    g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = .03; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(5.0 + (i - 1) * .13, yC + .5); g.bezierCurveTo(5.0 + (i - 1) * .13 - .07, yC + .65, 5.0 + (i - 1) * .13 + .07, yC + .78, 5.0 + (i - 1) * .13, yC + .92); g.stroke(); }

    // --- 액자 구멍: 이 안은 R 배 확대한 같은 그림이 채운다 ---
    g.save(); g.shadowColor = 'rgba(70,30,0,.5)'; g.shadowBlur = .26 * U; g.shadowOffsetX = .1 * U; g.shadowOffsetY = -.14 * U;
    fill('#5a3420', -1.32, -1.32, 1.32, 1.32); g.restore();
    // 목재 프레임 (사각 고리)
    g.fillStyle = '#5a3420'; g.fillRect(-1.32, -1.32, 2.64, 2.64);
    g.fillStyle = lin(-1.32, 1.32, 1.32, -1.32, [[0, '#7e4d2e'], [1, '#4a2a19']]);
    g.beginPath(); g.moveTo(-1.32, 1.32); g.lineTo(1.32, 1.32); g.lineTo(1.0, 1.0); g.lineTo(-1.0, 1.0); g.closePath(); g.fill();
    g.fillStyle = lin(-1.32, 1.32, 1.32, -1.32, [[0, '#6b4027'], [1, '#3c2112']]);
    g.beginPath(); g.moveTo(-1.32, -1.32); g.lineTo(1.32, -1.32); g.lineTo(1.0, -1.0); g.lineTo(-1.0, -1.0); g.closePath(); g.fill();
    g.fillStyle = '#5a3420';
    g.beginPath(); g.moveTo(-1.32, 1.32); g.lineTo(-1.0, 1.0); g.lineTo(-1.0, -1.0); g.lineTo(-1.32, -1.32); g.closePath(); g.fill();
    g.fillStyle = '#4d2b19';
    g.beginPath(); g.moveTo(1.32, 1.32); g.lineTo(1.0, 1.0); g.lineTo(1.0, -1.0); g.lineTo(1.32, -1.32); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,215,160,.28)'; g.lineWidth = .02; g.strokeRect(-1.27, -1.27, 2.54, 2.54);
    g.strokeStyle = '#d9a441'; g.lineWidth = .07; g.strokeRect(-1.035, -1.035, 2.07, 2.07);
    g.strokeStyle = '#a77a22'; g.lineWidth = .016; g.strokeRect(-1.0, -1.0, 2.0, 2.0);
    // 구멍 속 (원본에서는 안 쓰인다 — 밉맵 번짐 방지로 프레임색)
    g.fillStyle = '#5a3420'; g.fillRect(-.97, -.97, 1.94, 1.94);
    return c;
  }

  /* ---------------- 2. WebGL2 드로스테 셰이더 ---------------- */
  const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;
  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec2 uTau; uniform vec2 uCen; uniform float uL, uBeta, uR, uView, uTexN, uTime;
uniform sampler2D uTex;
out vec4 oc;
vec3 tap(vec2 q, float lod){ return textureLod(uTex, q/(2.0*uR)+0.5, lod).rgb; }
void main(){
  vec2 p = (gl_FragCoord.xy - uCen*uRes) / (0.5*uRes.y) * uView;
  float pxz = uView*2.0/uRes.y;
  float r = length(p);
  vec2 w = vec2(log(r), atan(p.y, p.x));
  vec2 wp = vec2(w.x + uBeta*w.y, w.y - uBeta*w.x) + uTau;      // (1 - i beta) * w + tau
  vec2 q = exp(wp.x) * vec2(cos(wp.y), sin(wp.y));
  float ch = max(abs(q.x), abs(q.y));
  float lc = log(ch)/uL;
  float k = floor(lc);
  float fr = lc - k;
  q *= exp(-k*uL);                                              // 체비셰프 반경 [1,R) 로 접는다
  float mag = sqrt(1.0+uBeta*uBeta);
  float fq = mag*length(q)/r*pxz;                               // 화소 하나가 덮는 그림 좌표 길이
  float lod = clamp(log2(max(fq*uTexN/(2.0*uR), 1.0)), 0.0, 11.0);
  vec3 c = tap(q, lod);
  float d = min(fr, 1.0-fr);                                    // 격자 이음선까지의 거리(레벨 단위)
  float fp = mag*pxz/(r*uL);
  if(d < fp){
    vec3 o = fr < 0.5 ? tap(q*uR, lod) : tap(q/uR, lod);
    c = mix(c, o, 0.5*(1.0 - d/fp));
  }
  // 아주 가까운 중심은 평균색으로 부드럽게 (화소가 무한 반복을 못 풀어낸다)
  float fade = smoothstep(0.0, 0.012, r/uView);
  c = mix(vec3(0.55,0.36,0.2), c, fade);
  vec2 uv = gl_FragCoord.xy/uRes;
  c *= 0.9 + 0.1*pow(16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.35);
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))+uTime)*43758.5453)-0.5)*0.02;
  oc = vec4(c, 1.0);
}`;

  function sh(g, type, src) { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; }
  const pic = paint();
  let prog, U = {}, tex;
  function startGL() {
    gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return false;
    try {
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl, gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      ['uRes', 'uTau', 'uCen', 'uL', 'uBeta', 'uR', 'uView', 'uTexN', 'uTime', 'uTex'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pic);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(U.uTex, 0); gl.uniform1f(U.uL, L); gl.uniform1f(U.uBeta, BETA); gl.uniform1f(U.uR, R); gl.uniform1f(U.uTexN, N);
      return true;
    } catch (e) { gl = null; return false; }
  }

  /* ---------------- 3. 폴백 (Canvas2D): 같은 그림을 R 배씩 겹쳐 그린 평범한 드로스테 ---------------- */
  function startFallback() {
    if (cv.parentNode) { const n = cv.cloneNode(false); cv.parentNode.replaceChild(n, cv); cv = n; }
    g2 = cv.getContext('2d');
  }
  function drawFallback(u) {
    const W = cv.width, H = cv.height; if (!g2) return;
    const s0 = Math.max(W, H) * 1.05;                             // 그림 한 장이 화면을 덮는 크기
    g2.fillStyle = '#5a3420'; g2.fillRect(0, 0, W, H);
    for (let j = -1; j < 7; j++) {
      const s = s0 / Math.pow(R, j - u + 1) * 1; if (s < 4) break;
      g2.drawImage(pic, W / 2 - s / 2, H / 2 - s / 2, s, s);
    }
  }

  /* ---------------- 4. 구동 ---------------- */
  function size() {
    const w = Math.max(2, Math.round(cv.clientWidth * scale)), h = Math.max(2, Math.round(cv.clientHeight * scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; if (gl) gl.viewport(0, 0, w, h); }
  }
  const ok = startGL();
  if (!ok) startFallback();
  size();

  const onLost = e => { e.preventDefault(); lost = true; if (gl) { gl = null; startFallback(); } };
  cv.addEventListener('webglcontextlost', onLost);

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { if (document.hidden) visible = false; };
  document.addEventListener('visibilitychange', onVis);

  // 입력: 포인터 → 비틀림, 드래그 → 줌, 스크롤 → 줌 오프셋
  const onMove = () => { if (ctx.fine) twTarget = (ctx.mouse.nx - .5) * 1.6; };
  addEventListener('pointermove', onMove);
  let dragging = false, lastX = 0;
  const onDown = e => { if (e.target.closest && e.target.closest('a')) return; dragging = true; lastX = e.clientX; };
  const onUp = () => { dragging = false; };
  const onDrag = e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; dragV = dx / innerWidth * -L * 1.4; };
  root.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); addEventListener('pointermove', onDrag);

  const st = ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'bottom top', scrub: .6, onUpdate: s => { scrollP = s.progress; } });

  const ease = u => u - (.34 / (2 * Math.PI)) * Math.sin(2 * Math.PI * u);   // 주기 끝에서 정확히 1 → 이음매 없음
  let phase = 0;
  const off = ctx.tick(() => {
    if (!alive || !visible) return;
    const now = performance.now();
    if (now - lastT < 1000 / 24) return;
    const dt = Math.min(now - lastT, 120) / 1000; lastT = now;
    // 적응 해상도 (소프트웨어 렌더에서 프레임이 늘어지면 낮춘다)
    avgDt += (dt * 1000 - avgDt) * .12;
    if (avgDt > 70 && scale > .3) { scale = Math.max(.3, scale - .06); avgDt = 40; }
    phase = (phase + dt / LOOP * (ctx.reduced ? .25 : 1)) % 1;
    dragV *= Math.pow(.02, dt); spUser += dragV * dt * 4;
    tw += (twTarget - tw) * Math.min(1, dt * 3.2);
    const tt = (now - t0) / 1000;
    const idleTw = .55 * Math.sin(tt * .42) * (ctx.fine ? .6 : 1);
    const s = -L * (ease(phase) + spUser + scrollP * 1.0);
    const rho = idleTw + tw + scrollP * 1.4;
    size();
    if (gl && !lost) {
      gl.uniform2f(U.uRes, cv.width, cv.height);
      gl.uniform2f(U.uTau, s, rho);
      gl.uniform2f(U.uCen, cv.width > cv.height * 1.2 ? .64 : .5, cv.width > cv.height * 1.2 ? .5 : .62);
      gl.uniform1f(U.uView, cv.width > cv.height * 1.2 ? 1.9 : 1.5);
      gl.uniform1f(U.uTime, tt % 7);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else drawFallback(((phase + spUser / 1 + scrollP) % 1 + 1) % 1);
  });

  root.__s189 = { get scale() { return scale; }, get avgDt() { return avgDt; }, gl: !!gl };
  return () => {
    alive = false; off(); io.disconnect(); st.kill();
    document.removeEventListener('visibilitychange', onVis);
    removeEventListener('pointermove', onMove); removeEventListener('pointermove', onDrag); removeEventListener('pointerup', onUp);
    root.removeEventListener('pointerdown', onDown); cv.removeEventListener('webglcontextlost', onLost);
    if (gl) { const e = gl.getExtension('WEBGL_lose_context'); e && e.loseContext(); }
  };
}
