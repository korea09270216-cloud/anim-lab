const P = {
  p1: [101,102,110,108,106,65,111,112,113,116,117,123,115,69,103,109,61,68,64,67,119,118,104,105,4,120,97,39,107,93],
  p2: [2,7,11,22,8,20,77,13,25,44,91,95,79,70,57,145,14,3,58,148,46,41,89,83,76,29,53,72,65,61],
  p3: [63,10,21,39,29,51,36,33,23,25,41,44,48,38,53,61,64,65,68,92,93,95,96,99,101,107,116,117,132,83],
  p4: [2,11,148,20,146,125,39,24,22,139,3,140,4,12,145,75,59,117,19,109,147,30,77,137,38,144,26,10,25,37],
  p5: [2,1,94,118,97,117,63,68,66,93,61,87,96,99,47,101,108,38,39,67,145,119,69,65,10,92,19,64,142,49],
};
const R = {
  p1: [45,144,27,28,82,85,88,89,90,24], p2: [45,94,10,143,144,80,54,9,141,117],
  p3: [26,27,5,3,84,146,147,77,55,149], p4: [85,82,90,150,67,119,124,111,135,131],
  p5: [27,26,28,29,88,85,146,5,6,40],
};
const s = {};
for (const [p, l] of Object.entries(P)) l.forEach((id, i) => { const o = s[id] ||= { id, v: 0, b: 0, rej: 0, by: [] }; o.v++; o.b += 30 - i; o.by.push(p.slice(1)); });
for (const l of Object.values(R)) l.forEach(id => { const o = s[id] ||= { id, v: 0, b: 0, rej: 0, by: [] }; o.rej++; });
const all = Object.values(s).sort((a, b) => b.v - a.v || b.b - a.b);
const pad = n => String(n).padStart(3, '0');
console.log('득표≥3:'); all.filter(x => x.v >= 3).forEach(x => console.log(pad(x.id), 'v' + x.v, 'borda' + x.b, 'rej' + x.rej, x.by.join('')));
console.log('득표2:'); console.log(all.filter(x => x.v === 2).map(x => `${pad(x.id)}(b${x.b}${x.rej ? ',r' + x.rej : ''})`).join(' '));
console.log('득표1:', all.filter(x => x.v === 1).length, ' / 반대 있는데 득표≥1:', all.filter(x => x.v >= 1 && x.rej).map(x => `${pad(x.id)}(v${x.v}/r${x.rej})`).join(' '));
require('fs').writeFileSync('tally.json', JSON.stringify(all, null, 1));
