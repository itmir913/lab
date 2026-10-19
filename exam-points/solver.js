/* 배점 탐색기. 브라우저(<script>)와 Node(require) 양쪽에서 쓴다.
 *
 * 문제: 총점 T, 문항 수 n, 배점 간격 g일 때
 *   서로 다른 배점 v₁ > v₂ > … > v_k 와 각 문항 수 c_i ≥ 1 을 골라
 *   Σc_i = n, Σc_i·v_i = T 를 맞춘다.
 * 모든 값은 g를 1로 보는 정수 단위로 바꿔 계산한다 (소수 오차 없음).
 *
 * 목표(클수록 좋음, 가산식):
 *   + 배점 종류 수        - 종류가 많을수록 다른 문항을 틀린 학생끼리 동점이 줄어든다
 *   − 한 배점에 몰린 정도  - Σc²
 *   − 건너뛴 배점         - 4.1 다음이 3.9이면 1칸
 *   − 평균에서 먼 정도     - 배점이 평균 근처에 모이도록
 * 가산식이라 동적계획법으로 "남은 상태에서 얻을 수 있는 최댓값"을 정확히 구할 수 있고,
 * 이 값을 상한으로 쓰는 깊이우선탐색(분기한정)으로 상위 N개 해를 빠짐없이 찾는다.
 */
(function (root) {
  'use strict';

  const WEIGHT = { kind: 1000, crowd: 1, skip: 4, spread: 1 };
  // 배점 범위의 기본값: 평균 ±12.5%
  const AUTO_SPREAD = 0.125;
  const AUTO_TIER_RATIO = [2, 5, 3];
  // 동적계획법 표 크기 한도 (Float64 기준 약 32MB)
  const MAX_STATES = 4e6;

  function decimalsOf(x) {
    const s = String(x);
    if (/e-/i.test(s)) return +s.split(/e-/i)[1];
    const i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }

  function toUnits(x, step) {
    const u = x / step;
    const r = Math.round(u);
    return Math.abs(u - r) < 1e-6 ? r : null;
  }

  // 비율을 정수 문항 수로 나눈다 (최대 나머지 방식)
  function splitByRatio(n, ratio) {
    const sum = ratio.reduce((a, b) => a + b, 0);
    const raw = ratio.map(r => n * r / sum);
    const out = raw.map(Math.floor);
    let left = n - out.reduce((a, b) => a + b, 0);
    raw.map((x, i) => [x - Math.floor(x), i])
      .sort((a, b) => b[0] - a[0] || a[1] - b[1])
      .slice(0, left)
      .forEach(([, i]) => { out[i]++; });
    return out;
  }

  function autoRange(total, count, step) {
    const mean = total / count;
    const d = decimalsOf(step);
    return {
      min: +(Math.floor(mean * (1 - AUTO_SPREAD) / step + 1e-9) * step).toFixed(d),
      max: +(Math.ceil(mean * (1 + AUTO_SPREAD) / step - 1e-9) * step).toFixed(d),
    };
  }

  // 미리 계산한 결과를 찾을 때 쓰는 열쇠 - 결과에 영향을 주는 입력만 담는다
  function keyOf(o) {
    return JSON.stringify([+o.total, +o.count, +o.step, +o.min, +o.max, (o.tiers || []).map(Number),
      +o.kinds || 0, +o.maxPer, +o.maxSkip || 0, (o.exclude || []).map(Number).sort((a, b) => a - b)]);
  }

  // 화면과 미리 계산(precalc)이 함께 쓰는 기본 설정
  function defaultsFor(total, count, step) {
    const { min, max } = autoRange(total, count, step);
    const values = Math.round((max - min) / step) + 1;
    return {
      total, count, step, min, max,
      tiers: splitByRatio(count, AUTO_TIER_RATIO),
      kinds: 0,        // 0 = 가능한 한 많이
      // 보통 3, 문항이 많아 범위 안의 배점을 다 써도 모자라면 그만큼 늘린다
      maxPer: Math.max(3, Math.ceil(count / values) + 1),
      maxSkip: 1,
      exclude: [],
    };
  }

  function prepare(o) {
    const fail = msg => ({ error: msg });
    // 조건을 풀면 해결될 수 있는 실패 (solveAuto가 완화를 시도한다)
    const tight = msg => ({ error: msg, infeasible: true });
    const step = +o.step;
    if (!(step > 0)) return fail('배점 간격은 0보다 커야 합니다.');
    const n = +o.count;
    if (!Number.isInteger(n) || n < 1) return fail('문항 수는 1 이상의 정수여야 합니다.');
    if (n > 200) return fail('문항 수는 200 이하로 입력하세요.');
    const T = toUnits(+o.total, step);
    if (T == null || T < 1) return fail('총점이 배점 간격으로 나누어떨어지지 않습니다.');

    const tiers = (o.tiers || [0, n, 0]).map(x => +x);
    if (tiers.length !== 3 || tiers.some(x => !Number.isInteger(x) || x < 0)) return fail('난이도별 문항 수가 올바르지 않습니다.');
    if (tiers[0] + tiers[1] + tiers[2] !== n) return fail(`난이도별 문항 수의 합(${tiers[0] + tiers[1] + tiers[2]})이 문항 수(${n})와 다릅니다.`);

    const lo = Math.max(1, Math.ceil(+o.min / step - 1e-6));
    const hi = Math.floor(+o.max / step + 1e-6);
    if (!(hi >= lo)) return fail('최대 배점이 최소 배점보다 작습니다.');
    const ex = new Set();
    for (const x of o.exclude || []) {
      const u = toUnits(+x, step);
      if (u != null) ex.add(u);
    }
    const vals = [];
    for (let v = hi; v >= lo; v--) if (!ex.has(v)) vals.push(v);
    const m = vals.length;
    if (!m) return fail('사용할 수 있는 배점이 없습니다.');
    const fmt = u => +(u * step).toFixed(decimalsOf(step));
    if (n * vals[m - 1] > T || n * vals[0] < T) {
      return tight(`이 배점 범위로는 총점을 맞출 수 없습니다. ${n}문항이면 ${fmt(n * vals[m - 1])}~${fmt(n * vals[0])}점만 가능합니다.`);
    }

    const maxPer = Math.min(n, Math.max(1, Math.floor(+o.maxPer || n)));
    const maxSkip = Math.max(0, Math.floor(+o.maxSkip || 0));
    const kinds = Math.max(0, Math.floor(+o.kinds || 0));
    if (kinds > m) return tight(`배점 범위 안의 배점은 ${m}가지뿐이라 ${kinds}가지를 만들 수 없습니다.`);
    if (kinds > n) return fail(`문항이 ${n}개라 배점을 ${kinds}가지로 나눌 수 없습니다.`);
    if (kinds && kinds * maxPer < n) return tight(`${kinds}가지 배점으로 ${n}문항을 나누려면 한 배점당 최대 문항 수를 ${Math.ceil(n / kinds)} 이상으로 늘리세요.`);

    return { step, n, T, vals, tiers, maxPer, maxSkip, kinds, fmt, mean: T / n };
  }

  function solve(opts, { limit = 10, nodeBudget = 2e6 } = {}) {
    const t0 = Date.now();
    const P = prepare(opts);
    if (P.error) return P;
    const { n, T, vals, tiers, maxPer, maxSkip, kinds, mean } = P;
    const m = vals.length;
    const base = vals[m - 1];
    const E0 = T - n * base;               // 최저 배점을 넘는 몫의 합
    const d = vals.map(v => v - base);
    const S = maxSkip + 2;                 // 0 = 아직 시작 전, 1+s = 직전에 s칸 건너뜀
    const KD = kinds ? kinds + 1 : 1;      // 종류 수를 고정할 때만 남은 종류 수를 상태로 둔다
    const size = (m + 1) * (n + 1) * (E0 + 1) * S * KD;
    if (size > MAX_STATES) return { error: '탐색 범위가 너무 넓습니다. 최소·최대 배점을 좁히거나 배점 간격을 늘리세요.' };

    const bounds = [tiers[0], tiers[0] + tiers[1]].filter(b => b > 0 && b < n);
    // 위에서부터 p번째 문항부터 c개를 같은 배점으로 묶을 때 난이도 경계를 가로지르는가
    const crosses = (p, c) => bounds.some(b => p < b && b < p + c);
    const unit = mean * AUTO_SPREAD;
    const gain = (i, c, s) => {
      const z = (vals[i] - mean) / unit;
      return WEIGHT.kind - WEIGHT.crowd * c * c - WEIGHT.spread * c * z * z - (s > 1 ? WEIGHT.skip * (s - 1) : 0);
    };

    const R = n + 1, EE = E0 + 1;
    const idx = (i, r, e, s, q) => ((((i * R + r) * EE + e) * S + s) * KD + q);
    const f = new Float64Array(size).fill(-Infinity);

    // f(i, r, e, s, q): i번째 배점부터 고려할 때, 남은 문항 r개·남은 몫 e로 얻을 수 있는 최대 점수
    for (let i = m; i >= 0; i--) {
      for (let r = 0; r <= n; r++) {
        for (let e = 0; e <= E0; e++) {
          for (let s = 0; s < S; s++) {
            for (let q = 0; q < KD; q++) {
              let best = -Infinity;
              if (r === 0) {
                if (e === 0 && q === 0) best = 0;
              } else if (i < m) {
                if (s === 0) best = f[idx(i + 1, r, e, 0, q)];
                else if (s <= maxSkip) best = f[idx(i + 1, r, e, s + 1, q)];
                if (KD === 1 || q > 0) {
                  const p = n - r;
                  const nq = KD === 1 ? 0 : q - 1;
                  for (let c = 1; c <= maxPer && c <= r; c++) {
                    if (c * d[i] > e || crosses(p, c)) break;
                    const rest = f[idx(i + 1, r - c, e - c * d[i], 1, nq)];
                    if (rest === -Infinity) continue;
                    const val = gain(i, c, s) + rest;
                    if (val > best) best = val;
                  }
                }
              }
              f[idx(i, r, e, s, q)] = best;
            }
          }
        }
      }
    }

    const start = idx(0, n, E0, 0, KD === 1 ? 0 : kinds);
    if (f[start] === -Infinity) {
      return { infeasible: true, error: '조건을 모두 만족하는 배점이 없습니다. 배점 범위를 넓히거나, 한 배점당 최대 문항 수·건너뛰기 허용을 늘리거나, 난이도별 문항 수를 바꿔 보세요.' };
    }

    // 분기한정: 지금까지 얻은 점수 + f(남은 상태)가 상위 limit개의 마지막보다 낮으면 버린다
    const top = [];
    const floor = () => (top.length < limit ? -Infinity : top[top.length - 1].score);
    const picked = [];
    let nodes = 0, cut = false;

    function record(score) {
      const sol = { score, groups: picked.slice() };
      let at = top.length;
      while (at > 0 && top[at - 1].score < score - 1e-9) at--;
      top.splice(at, 0, sol);
      if (top.length > limit) top.pop();
    }

    function dfs(i, r, e, s, q, acc) {
      if (r === 0) { record(acc); return; }
      if (i === m || cut) return;
      if (acc + f[idx(i, r, e, s, q)] <= floor() + 1e-9) return;
      if (++nodes > nodeBudget) { cut = true; return; }

      const moves = [];
      if (s === 0) moves.push([0, f[idx(i + 1, r, e, 0, q)], 0]);
      else if (s <= maxSkip) moves.push([0, f[idx(i + 1, r, e, s + 1, q)], 0]);
      if (KD === 1 || q > 0) {
        const p = n - r;
        const nq = KD === 1 ? 0 : q - 1;
        for (let c = 1; c <= maxPer && c <= r; c++) {
          if (c * d[i] > e || crosses(p, c)) break;
          const g = gain(i, c, s);
          moves.push([c, g + f[idx(i + 1, r - c, e - c * d[i], 1, nq)], g]);
        }
      }
      moves.sort((a, b) => b[1] - a[1]);
      for (const [c, , g] of moves) {
        if (c === 0) {
          dfs(i + 1, r, e, s === 0 ? 0 : s + 1, q, acc);
        } else {
          picked.push({ unit: vals[i], count: c });
          dfs(i + 1, r - c, e - c * d[i], 1, KD === 1 ? 0 : q - 1, acc + g);
          picked.pop();
        }
      }
    }
    dfs(0, n, E0, 0, KD === 1 ? 0 : kinds, 0);

    return {
      solutions: top.map((t, k) => describe(P, t.groups, k + 1, t.score)),
      options: opts,
      complete: !cut,
      nodes,
      ms: Date.now() - t0,
      units: vals.length,
    };
  }

  // 해가 없으면 조건을 조금씩 풀어 가며 다시 찾는다.
  // 한 배점당 최대 문항 수는 지킨 채 범위를 평균의 5%씩 넓혀 보고 (배점 종류가 늘어 변별에 유리),
  // 그래도 없으면 그 제한을 풀고 같은 순서로 다시 넓힌다.
  function solveAuto(opts, cfg) {
    const first = solve(opts, cfg);
    if (!first.infeasible) return first;
    const step = +opts.step, n = +opts.count;
    const mean = opts.total / n;
    const dec = decimalsOf(step);
    const inc = Math.max(1, Math.round(mean * 0.05 / step));
    const maxWiden = Math.ceil(mean * 0.5 / step);
    for (const maxPer of [opts.maxPer, n]) {
      for (let w = 0; w <= maxWiden; w += inc) {
        const min = +Math.max(step, opts.min - w * step).toFixed(dec);
        const max = +(+opts.max + w * step).toFixed(dec);
        if (w === 0 && maxPer === opts.maxPer) continue;
        const o = { ...opts, min, max, maxPer };
        const r = solve(o, cfg);
        if (r.error && !r.infeasible) return r;
        if (r.error) continue;
        r.relaxed = [];
        if (w) r.relaxed.push(`배점 범위를 ${min}~${max}점으로 넓혔습니다.`);
        if (maxPer !== opts.maxPer) r.relaxed.push('한 배점당 최대 문항 수 제한을 풀었습니다.');
        r.options = o;
        return r;
      }
    }
    return first;
  }

  // 미리 계산해 둔 해(배점 단위·문항 수 목록)를 화면용으로 풀어 쓴다
  function expand(opts, list) {
    const P = prepare(opts);
    if (P.error) return [];
    return list.map((groups, k) => describe(P, groups.map(([unit, count]) => ({ unit, count })), k + 1, null));
  }

  // 해 하나를 표와 지표로 풀어 쓴다
  function describe(P, groups, rank, score) {
    const { n, T, tiers, step, fmt, vals } = P;
    const TIER = ['상', '중', '하'];
    const tierOf = p => (p < tiers[0] ? 0 : p < tiers[0] + tiers[1] ? 1 : 2);
    let p = 0;
    const rows = groups.map((g, i) => {
      const next = groups[i + 1];
      const row = {
        value: fmt(g.unit),
        count: g.count,
        subtotal: fmt(g.unit * g.count),
        gap: next ? fmt(g.unit - next.unit) : null,
        tier: TIER[tierOf(p)],
        from: p + 1,
        to: p + g.count,
      };
      p += g.count;
      return row;
    });

    // 2문항 오답 시 나올 수 있는 서로 다른 감점 수
    const pair = new Set();
    groups.forEach((a, i) => groups.forEach((b, j) => {
      if (j > i || (j === i && a.count > 1)) pair.add(a.unit + b.unit);
    }));
    const pos = new Map(vals.map((v, i) => [v, i]));
    let skipped = 0;
    for (let i = 1; i < groups.length; i++) skipped += pos.get(groups[i].unit) - pos.get(groups[i - 1].unit) - 1;

    const tierStats = TIER.map((name, t) => {
      const rs = rows.filter(r => r.tier === name);
      const cnt = rs.reduce((a, r) => a + r.count, 0);
      const pts = rs.reduce((a, r) => a + r.count * Math.round(r.value / step), 0);
      return { name, count: cnt, points: fmt(pts), kinds: rs.length };
    });

    return {
      rank, score, rows, tierStats,
      kinds: groups.length,
      maxCount: Math.max(...groups.map(g => g.count)),
      max: rows[0].value,
      min: rows[rows.length - 1].value,
      skipped,
      oneMiss: groups.length,
      twoMiss: pair.size,
      total: fmt(T),
      count: n,
    };
  }

  const api = { solve, solveAuto, expand, keyOf, prepare, defaultsFor, autoRange, splitByRatio, decimalsOf, WEIGHT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExamPoints = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
