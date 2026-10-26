const t = require('./tally.json'); // R1: id -> {v, b, rej}
const r1 = {}; t.forEach(x => r1[x.id] = x);
const R2 = {
  p2: [11,22,20,44,148,41,95,96,83,53,3,77,63,19,92,99,69],
  p1: [108,118,97,109,69,116,4,107,119,67,92,63,10,99,19,96,53],
  p5: [63,108,118,97,96,109,69,99,19,92,67,119,10,4,116,41,95],
  p4: [11,20,22,148,109,4,19,3,10,44,95,83,63,108,116,107,96],
  p3: [63,44,41,95,96,99,53,92,83,107,116,10,29,97,108,109,118],
};
const objections = { 25: 2, 145: 2, 61: 1, 93: 1, 2: 1, 117: 1 }; // R2 이의 건수(확정 13개 대상)
const locked = [39,117,61,65,2,101,68,25,145,10,38,93,64];
const rec = { 125: 1, 110: 1, 1: 1, 7: 1, 132: 1 }; // R2 추천
const r2 = {}; Object.values(R2).forEach(l => l.forEach(id => r2[id] = (r2[id] || 0) + 1));
const ids = new Set([...Object.keys(r1), ...Object.keys(r2), ...Object.keys(rec)].map(Number));
const rows = [...ids].map(id => {
  const v1 = r1[id] ? r1[id].v : 0, b = r1[id] ? r1[id].b : 0, rej = r1[id] ? r1[id].rej : 0;
  const isLocked = locked.includes(id) && id !== 10; // 010 은 쟁점이라 풀에서 경쟁
  const r2v = isLocked ? 5 - (objections[id] || 0) : (r2[id] || 0);
  const total = v1 + r2v + (rec[id] ? 0.5 : 0) - (isLocked ? 0 : 0);
  return { id, v1, r2v, locked: isLocked, rej, obj: objections[id] || 0, b, total };
}).sort((a, b) => b.total - a.total || b.b - a.b);
const pad = n => String(n).padStart(3, '0');
rows.slice(0, 40).forEach((r, i) => console.log(String(i + 1).padStart(2), pad(r.id), 'total', r.total, `R1:${r.v1} R2:${r.r2v}${r.locked ? '(L)' : ''}`, `rej1:${r.rej}`, `obj2:${r.obj}`, 'borda', r.b));
