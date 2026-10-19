/* solver.js가 내놓은 해가 조건을 모두 지키는지 검사한다.
 * 탐색 방식을 고친 뒤에는 꼭 돌려 본다:
 *   node exam-points/test.js
 */
const X = require('./solver.js');
const precalc = require('./precalc.json');

let failed = 0;
const fails = [];

function check(name, cond, detail) {
  if (cond) return;
  failed++;
  fails.push(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
}

// 배점은 소수라 정수(간격 단위)로 바꿔 비교한다
const unit = (v, step) => Math.round(v / step);

/* 해 하나가 지켜야 할 것들 */
function checkSolution(label, o, s) {
  const step = o.step;
  const rows = s.rows;
  check(`${label}: 빈 해가 아니다`, rows.length > 0);
  if (!rows.length) return;

  const count = rows.reduce((a, r) => a + r.count, 0);
  const total = rows.reduce((a, r) => a + unit(r.value, step) * r.count, 0);
  check(`${label}: 문항 수 합`, count === o.count, `${count} ≠ ${o.count}`);
  check(`${label}: 총점 합`, total === unit(o.total, step), `${total} ≠ ${unit(o.total, step)}`);
  check(`${label}: 배점이 높은 순`, rows.every((r, i) => i === 0 || r.value < rows[i - 1].value));
  check(`${label}: 배점마다 문항이 1개 이상`, rows.every(r => r.count >= 1));
  check(`${label}: 배점 가지수`, s.kinds === rows.length);

  // 배점 범위 (완화된 조건으로 풀렸을 수 있으므로 그 조건으로 본다)
  check(`${label}: 배점 범위`,
    rows.every(r => unit(r.value, step) >= unit(o.min, step) - 1e-9 && unit(r.value, step) <= unit(o.max, step)),
    `${s.min}~${s.max} ⊄ ${o.min}~${o.max}`);
  // 한 배점당 최대 문항 수
  check(`${label}: 한 배점당 최대 문항 수`, s.maxCount <= o.maxPer, `${s.maxCount} > ${o.maxPer}`);
  // 건너뛴 칸: 쓸 수 있는 배점 중 쓰지 않은 것이 연달아 maxSkip개를 넘지 않는다.
  // 제외한 배점은 애초에 쓸 수 없으니 건너뛴 칸으로 세지 않는다
  const ex = new Set((o.exclude || []).map(x => unit(x, step)));
  for (const [v, c] of o.locks || []) if (c === 0) ex.add(unit(v, step));
  const usable = [];
  for (let u = unit(o.max, step); u >= unit(o.min, step); u--) if (!ex.has(u)) usable.push(u);
  const used = rows.map(r => unit(r.value, step));
  const worstSkip = Math.max(0, ...used.map((u, i) =>
    i === 0 ? 0 : usable.filter(x => x < used[i - 1] && x > u).length));
  check(`${label}: 배점 건너뛰기`, worstSkip <= o.maxSkip, `${worstSkip} > ${o.maxSkip}`);
  // 제외할 배점은 쓰지 않는다
  for (const x of o.exclude || []) {
    check(`${label}: ${x}점 제외`, !rows.some(r => unit(r.value, step) === unit(x, step)));
  }
  // 고정한 배점은 고정한 문항 수 그대로 (0은 그 배점을 안 쓴다는 뜻)
  for (const [v, c] of o.locks || []) {
    const row = rows.find(r => unit(r.value, step) === unit(v, step));
    check(`${label}: ${v}점 ${c}문항 고정`, c === 0 ? !row : !!row && row.count === c,
      row ? `${row.count}문항` : '안 씀');
  }
  // 같은 배점은 상·중·하 경계를 넘지 않는다 (난이도는 배점이 높은 쪽부터 상·중·하 순)
  let at = 0;
  const bounds = [o.tiers[0], o.tiers[0] + o.tiers[1]];
  for (const r of rows) {
    check(`${label}: ${r.value}점이 난이도 경계를 넘지 않는다`,
      !bounds.some(b => at < b && at + r.count > b));
    at += r.count;
  }
  // 난이도별 문항 수 합이 요청한 비율과 같다
  const tierCount = s.tierStats.reduce((a, t) => a + t.count, 0);
  check(`${label}: 난이도별 문항 수 합`, tierCount === o.count, `${tierCount} ≠ ${o.count}`);
}

/* 1. 여러 조건을 실제로 풀어 본다 */
const cases = [
  { total: 100, count: 23, step: 0.1 },
  { total: 100, count: 25, step: 0.5 },
  { total: 100, count: 30, step: 0.1 },
  { total: 100, count: 20, step: 0.05 },
  { total: 100, count: 23, step: 0.25 },
  { total: 50, count: 20, step: 0.1 },
  { total: 100, count: 40, step: 0.1 },
  { total: 200, count: 50, step: 0.5 },
  { total: 100, count: 10, step: 1 },
];
for (const c of cases) {
  const base = X.defaultsFor(c.total, c.count, c.step);
  const r = X.solveAuto({ ...base, kinds: 0 }, { perKinds: true });
  const label = `${c.total}점/${c.count}문항/간격${c.step}`;
  check(`${label}: 해를 찾는다`, !r.error, r.error);
  if (r.error) continue;
  // 완화됐으면 완화된 조건으로 검사한다
  const o = r.options;
  for (const k of r.byKinds) {
    checkSolution(`${label} (${k.kinds}가지)`, o, k.solution);
    check(`${label} (${k.kinds}가지): 가지수가 맞다`, k.solution.kinds === k.kinds);
  }
  check(`${label}: 가지수가 겹치지 않는다`,
    new Set(r.byKinds.map(k => k.kinds)).size === r.byKinds.length);
}

/* 2. 세부 조건 (제외·고정·건너뛰기·난이도 비율) */
const tuned = [
  { ...X.defaultsFor(100, 23, 0.1), exclude: [4.0, 4.5], kinds: 0 },
  { ...X.defaultsFor(100, 23, 0.1), maxSkip: 0, kinds: 0 },
  { ...X.defaultsFor(100, 23, 0.1), locks: [[4.9, 2]], kinds: 0 },
  { ...X.defaultsFor(100, 23, 0.1), locks: [[4.0, 0]], kinds: 0 },
  { ...X.defaultsFor(100, 23, 0.1), tiers: X.splitByRatio(23, [1, 1, 1]), kinds: 0 },
  { ...X.defaultsFor(100, 23, 0.1), kinds: 8 },
  { ...X.defaultsFor(100, 30, 0.1), maxPer: 4, kinds: 0 },
];
for (const o of tuned) {
  const r = X.solveAuto(o, { perKinds: true });
  const label = `세부조건 ${JSON.stringify({ exclude: o.exclude, maxSkip: o.maxSkip, locks: o.locks, kinds: o.kinds, maxPer: o.maxPer })}`;
  check(`${label}: 해를 찾는다`, !r.error, r.error);
  if (r.error) continue;
  // 가지수를 정해 풀면 그 가지수의 해 목록(solutions)이, 정하지 않으면 가지수별 해(byKinds)가 온다
  const found = r.byKinds || r.solutions.map(s => ({ kinds: s.kinds, solution: s }));
  for (const k of found) checkSolution(`${label} (${k.kinds}가지)`, r.options, k.solution);
  if (o.kinds) check(`${label}: 요청한 가지수`, found.every(k => k.kinds === o.kinds));
}

/* 3. 잘못된 입력은 설명과 함께 막는다 */
const bad = [
  [{ ...X.defaultsFor(100, 23, 0.1), total: 100.05 }, '총점이 간격의 배수가 아님'],
  [{ ...X.defaultsFor(100, 23, 0.1), count: 0 }, '문항 수 0'],
  [{ ...X.defaultsFor(100, 23, 0.1), min: 6, max: 3 }, '최소 > 최대'],
  [{ ...X.defaultsFor(100, 23, 0.1), kinds: 30 }, '가지수 > 문항 수'],
  [{ ...X.defaultsFor(100, 23, 0.1), locks: [[4.9, 30]] }, '고정 문항 수가 너무 많음'],
  [{ ...X.defaultsFor(100, 23, 0.1), tiers: [1, 1, 1] }, '난이도 합 ≠ 문항 수'],
];
for (const [o, why] of bad) {
  const r = X.solveAuto(o, { perKinds: true });
  check(`막아야 할 입력 (${why})`, !!r.error && typeof r.error === 'string' && r.error.length > 5,
    r.error ? '' : '해가 나왔다');
}

/* 4. 미리 계산해 둔 결과(precalc.json)가 지금 solver와 맞는지 */
for (const e of precalc) {
  const o = X.defaultsFor(e.total, e.count, e.step);
  const label = `precalc ${e.total}점/${e.count}문항/간격${e.step}`;
  check(`${label}: 조건 키가 같다`, X.keyOf(o) === e.key);
  for (const k of e.byKinds) {
    const s = X.expand(e.solved, k.groups);
    check(`${label} (${k.kinds}가지): 풀어 쓸 수 있다`, !!s);
    if (s) checkSolution(`${label} (${k.kinds}가지)`, e.solved, s);
  }
}

/* 5. 난이도 비율 나누기 */
check('비율 3:4:3 → 23문항', X.splitByRatio(23, [3, 4, 3]).reduce((a, b) => a + b, 0) === 23);
check('비율 1:0:1 → 중간이 0', X.splitByRatio(10, [1, 0, 1])[1] === 0);
check('비율 0:1:0 → 전부 중', X.splitByRatio(10, [0, 1, 0])[1] === 10);

if (failed) {
  console.log(fails.join('\n'));
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('모두 통과');
