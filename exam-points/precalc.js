/* 자주 쓰는 설정의 배점 후보를 미리 계산해 precalc.json으로 쓴다.
 *
 * 100점 만점, 배점 간격 0.1·0.5점, 10~40문항을 기본 조건(solver.js의 defaultsFor)으로 풀어
 * 배점 종류 수마다 가장 좋은 해를 담는다. 화면은 입력이 이 조건과 같으면 탐색 없이 이 결과를 쓴다.
 * solver.js의 탐색 방식이나 기본 조건을 바꾸면 다시 만들어 커밋한다:
 *   node exam-points/precalc.js
 */
const fs = require('fs');
const path = require('path');
const X = require('./solver.js');

const TOTAL = 100;
const STEPS = [0.1, 0.5];
const COUNTS = [10, 40];

const entries = [];
for (const step of STEPS) {
  for (let n = COUNTS[0]; n <= COUNTS[1]; n++) {
    const opts = X.defaultsFor(TOTAL, n, step);
    const r = X.solveAuto(opts, { perKinds: true, nodeBudget: Infinity });
    if (r.error) throw new Error(`${step}/${n}: ${r.error}`);
    entries.push({
      key: X.keyOf(opts),
      total: TOTAL, step, count: n,
      solved: r.options,
      relaxed: r.relaxed || [],
      // 배점 종류 수마다 가장 좋은 해: [배점(간격 단위 정수), 문항 수] 목록
      byKinds: r.byKinds.map(k => ({
        kinds: k.kinds, found: k.found, score: k.score,
        groups: k.solution.rows.map(row => [Math.round(row.value / step), row.count]),
      })),
    });
  }
}

const out = path.join(__dirname, 'precalc.json');
// 종류 수 하나를 한 줄에 써서 diff를 읽기 쉽게 한다
const body = entries.map(e => {
  const { byKinds, ...head } = e;
  const rows = byKinds.map(k => '      ' + JSON.stringify(k)).join(',\n');
  return '  ' + JSON.stringify(head).slice(0, -1) + ',"byKinds":[\n' + rows + '\n  ]}';
}).join(',\n');
fs.writeFileSync(out, '[\n' + body + '\n]\n');
console.log(`${entries.length} entries -> ${path.basename(out)}`);
