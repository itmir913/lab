/* 자주 쓰는 설정의 배점 후보를 미리 계산해 precalc.json으로 쓴다.
 *
 * 100점 만점, 배점 간격 0.1·0.5점, 10~40문항을 기본 조건(solver.js의 defaultsFor)으로 푼다.
 * 화면은 입력이 이 조건과 같으면 탐색 없이 이 결과를 바로 보여 주고, "문항 수별 추천표"에도 쓴다.
 * solver.js의 탐색 방식이나 기본 조건을 바꾸면 다시 만들어 커밋한다:
 *   node exam-points/precalc.js
 */
const fs = require('fs');
const path = require('path');
const X = require('./solver.js');

const TOTAL = 100;
const STEPS = [0.1, 0.5];
const COUNTS = [10, 40];
const LIMIT = 10;

const entries = [];
for (const step of STEPS) {
  for (let n = COUNTS[0]; n <= COUNTS[1]; n++) {
    const opts = X.defaultsFor(TOTAL, n, step);
    const r = X.solveAuto(opts, { limit: LIMIT, nodeBudget: Infinity });
    if (r.error) throw new Error(`${step}/${n}: ${r.error}`);
    entries.push({
      key: X.keyOf(opts),
      total: TOTAL, step, count: n,
      solved: r.options,
      relaxed: r.relaxed || [],
      // 각 해는 [배점(간격 단위 정수), 문항 수] 목록
      solutions: r.solutions.map(s => s.rows.map(row => [Math.round(row.value / step), row.count])),
    });
  }
}

const out = path.join(__dirname, 'precalc.json');
// 해 하나를 한 줄에 써서 diff를 읽기 쉽게 한다
const body = entries.map(e => {
  const { solutions, ...head } = e;
  const sols = solutions.map(s => '      ' + JSON.stringify(s)).join(',\n');
  return '  ' + JSON.stringify(head).slice(0, -1) + ',"solutions":[\n' + sols + '\n  ]}';
}).join(',\n');
fs.writeFileSync(out, '[\n' + body + '\n]\n');
console.log(`${entries.length} entries -> ${path.basename(out)}`);
