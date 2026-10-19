/* sorter.js가 선지를 제대로 가려내고, 다시 늘어놓아도 아무것도 잃지 않는지 검사한다.
 * 읽는 방식이나 배열을 고친 뒤에는 꼭 돌려 본다:
 *   node choice-order/test.js
 */
const X = require('./sorter.js');

let failed = 0;
const fails = [];

function check(name, cond, detail) {
  if (cond) return;
  failed++;
  fails.push(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
}

const show = s => JSON.stringify(s);
const lines = s => s.split('\n');
const bag = a => [...a].sort().join('\u0001');

/* ───────────── 검사에 쓸 글 ─────────────
   실제 시험지 선지가 아니라 이 검사를 위해 꾸며 낸 글이다 */
const CASES = [
  { name: '1행답항 (탭)', kind: 'circle', count: 5,
    text: '① 가\t② 나다\t③ 라마바\t④ 사아자차\t⑤ 카타파하거' },

  { name: '1행답항 (공백)', kind: 'circle', count: 5,
    text: '① 가 ② 나다 ③ 라마바 ④ 사아자차 ⑤ 카타파하거' },

  { name: '2행답항', kind: 'circle', count: 5,
    text: '① 가\t② 나다\t③ 라마바\n④ 사아자차\t⑤ 카타파하거' },

  { name: '3행답항', kind: 'circle', count: 5,
    text: '① 가\t② 나다\n③ 라마바\t④ 사아자차\n⑤ 카타파하거' },

  { name: '5행답항', kind: 'circle', count: 5,
    text: '① 가\n② 나다\n③ 라마바\n④ 사아자차\n⑤ 카타파하거' },

  { name: '여러 칸 띄운 2열', kind: 'circle', count: 5,
    text: '① 가-나-다-라            ② 가-다-라-나\n③ 가-라-다-나            ④ 나-다-라-가\n⑤ 다-라-가-나' },

  { name: '머리말이 붙은 선지', kind: 'circle', count: 5,
    text: '① (가) - 첫째 줄입니다.\n② (가) - 둘째 줄은 조금 더 깁니다.\n③ (나) - 셋째 줄입니다.\n④ (다) - 넷째 줄은 가장 긴 줄입니다 정말로.\n⑤ (다) - 다섯째.' },

  { name: 'ㄱㄴㄷ 보기', kind: 'kor', count: 4,
    text: 'ㄱ. 씨앗을 심는다.\nㄴ. 햇빛이 드는 곳에 둔다.\nㄷ. 흙이 마르지 않게 물을 준다.\nㄹ. 싹이 트면 넓은 화분으로 옮겨 심는다.' },

  { name: '(ㄱ)(ㄴ) 보기', kind: 'korP', count: 3,
    text: '(ㄱ) 가장 짧다.\n(ㄴ) 조금 더 길어진다.\n(ㄷ) 이것이 가장 긴 줄이다.' },

  { name: '(가)(나) 보기', kind: 'hangul', count: 3,
    text: '(가) 짧은 줄.\n(나) 중간 길이의 줄.\n(다) 가장 길고 늘어지는 줄이다.' },

  { name: '◦ 머리표', kind: 'bullet', count: 4,
    text: '◦ 소금은 물에 녹는다.\n◦ 모래는 물에 가라앉는다.\n◦ 기름은 물과 섞이지 않고 위로 뜬다.\n◦ 설탕물을 끓이면 물만 날아간다.' },

  { name: '(1)(2) 번호', kind: 'paren', count: 4,
    text: '(1) 하나.\n(2) 둘이다.\n(3) 셋이라고 한다.\n(4) 넷이며 가장 길다.' },

  { name: '1. 2. 번호', kind: 'num', count: 4,
    text: '1. 하나.\n2. 둘이다.\n3. 셋이라고 한다.\n4. 넷이며 가장 길다.' },

  { name: '번호 없는 줄', kind: 'line', count: 4,
    text: '세 변의 길이가 모두 같다.\n두 변의 길이가 같다.\n한 각이 직각이다.\n네 변의 길이가 모두 같고 네 각도 모두 같다.' },

  { name: '딸린 줄이 있는 선지', kind: 'circle', count: 5,
    text: '① 첫째입니다.\n② 둘째입니다.\n③ 셋째입니다.\n④ 넷째입니다.\n⑤ 배점은 [   ]로 적습니다.\n 예) 4점인 경우 ➛ [4.0점]\n 예) 3.7점인 경우 ➛ [3.7점]' },

  { name: '번호 뒤에 바로 붙은 본문', kind: 'bullet', count: 3,
    text: '◦근초고왕.\n◦진흥왕이며 조금 더 길다.\n◦장수왕이고 이 줄이 가장 길다.' },

  { name: '긴 본문에 마침표가 많은 선지', kind: 'circle', count: 3,
    text: '① 11p입니다. 안은 11p입니다. 선지도 11p입니다.\n② 13p, 진하게입니다.\n③ 자료의 위계가 같으면 “◦”로 적습니다.' },
];

const ORDERS = ['orig', 'len', 'lenDesc', 'abc', 'abcDesc', 'headLen', 'headLenDesc'];
const MARKS = ['keep', 'circle', 'kor', 'num', 'paren', 'hangul', 'bullet', 'none'];
const LAYOUTS = ['keep', '1', '2', '3', '4', '5'];
const SEPS = ['keep', 'sp1', 'tab', 'tab2', 'sp2', 'sp4'];

/* ───────────── 1. 유형을 제대로 가려내는가 ───────────── */
for (const c of CASES) {
  const r = X.rearrange(c.text, { order: 'orig' });
  check(`${c.name}: 읽어 낸다`, r.ok);
  if (!r.ok) continue;
  check(`${c.name}: 번호 유형`, r.kindId === c.kind, `${r.kindId} ≠ ${c.kind}`);
  check(`${c.name}: 선지 수`, r.items.length === c.count, `${r.items.length} ≠ ${c.count}`);
}

/* "① (가) - …"의 (가)는 번호가 아니라 본문이다 */
{
  const r = X.rearrange(CASES.find(c => c.name === '머리말이 붙은 선지').text, { order: 'orig' });
  check('① (가)에서 번호는 ①이다', r.markers.join('') === '①②③④⑤', r.markers.join(''));
  check('(가)는 본문에 남는다', r.items.every(s => s.startsWith('(')), show(r.items[0]));
}

/* ───────────── 1-2. 번호 토큰을 하나하나 ─────────────
   세 줄짜리 같은 글을 번호만 바꿔 가며 넣어, 그 유형으로 읽는지 본다 */
{
  const body = ['하나.', '둘이라네.', '셋이라고 한다.'];
  const withMarks = ms => ms.map((m, i) => `${m} ${body[i]}`).join('\n');
  const TOKENS = [
    ['circle',  ['①', '②', '③']],
    ['circleB', ['❶', '❷', '❸']],
    ['circleB', ['➀', '➁', '➂']],
    ['circleK', ['㉠', '㉡', '㉢']],
    ['circleK', ['㉮', '㉯', '㉰']],
    ['circleK', ['㈀', '㈁', '㈂']],
    ['circleL', ['Ⓐ', 'Ⓑ', 'Ⓒ']],
    ['circleL', ['ⓐ', 'ⓑ', 'ⓒ']],
    ['parenN',  ['⑴', '⑵', '⑶']],
    ['dotN',    ['⒈', '⒉', '⒊']],
    ['roman',   ['Ⅰ.', 'Ⅱ.', 'Ⅲ.']],
    ['korP',    ['(ㄱ)', '(ㄴ)', '(ㄷ)']],
    ['hangul',  ['(가)', '(나)', '(다)']],
    ['parenL',  ['(A)', '(B)', '(C)']],
    ['paren',   ['(1)', '(2)', '(3)']],
    ['kor',     ['ㄱ.', 'ㄴ.', 'ㄷ.']],
    ['kor',     ['ㄱ)', 'ㄴ)', 'ㄷ)']],
    ['num',     ['1.', '2.', '3.']],
    ['num',     ['1)', '2)', '3)']],
    ['latin',   ['A.', 'B.', 'C.']],
    ['latin',   ['a)', 'b)', 'c)']],
    ['hangulD', ['가.', '나.', '다.']],
    ['bullet',  ['◦', '◦', '◦']],
    ['bullet',  ['※', '※', '※']],
    ['dash',    ['-', '-', '-']],
    ['bareN',   ['1', '2', '3']],
    ['bareL',   ['A', 'B', 'C']],
    ['bareJ',   ['ㄱ', 'ㄴ', 'ㄷ']],
    ['bareH',   ['가', '나', '다']],
  ];
  for (const [kind, ms] of TOKENS) {
    const r = X.rearrange(withMarks(ms), { order: 'orig' });
    check(`토큰 ${ms.join(' ')}`, r.ok && r.kindId === kind,
      r.ok ? `${r.kindId} ≠ ${kind}` : '못 읽음');
    if (r.ok) {
      check(`토큰 ${ms.join(' ')}: 본문만 남는다`, r.items.join('|') === body.join('|'), show(r.items));
      check(`토큰 ${ms.join(' ')}: 번호가 그대로다`, r.markers.join('|') === ms.join('|'), r.markers.join('|'));
    }
  }

  // 한 줄에 늘어놓아도 가려낸다
  for (const [kind, ms] of TOKENS) {
    const one = ms.map((m, i) => `${m} ${body[i]}`).join('\t');
    const r = X.rearrange(one, { order: 'orig' });
    check(`토큰 ${ms.join(' ')}: 한 줄 답항`, r.ok && r.kindId === kind && r.items.length === 3,
      r.ok ? r.kindId : '못 읽음');
  }

  // 번호가 아닌 것을 번호로 보지 않는다
  const NOT = [
    ['그냥 문장들', '세 변의 길이가 모두 같다.\n두 변의 길이가 같다.\n한 각이 직각이다.'],
    ['…다.로 끝나는 문장', '물이 흐른다.\n바람이 분다.\n해가 진다.'],
    ['차례가 안 맞는 한 글자', '사 하나\n랑 둘이다\n해 셋이라네'],
    ['차례가 안 맞는 영문', 'Q 하나\nZ 둘이다\nM 셋이라네'],
    ['글자 둘뿐', 'A 가\nB 나'],
    ['연도가 적힌 글', '1945 해방이 되었다.\n1950 전쟁이 일어났다.'],
  ];
  for (const [name, text] of NOT) {
    const r = X.rearrange(text, { order: 'orig' });
    check(`${name}: 번호로 보지 않는다`, !r.ok || r.kindId === 'line',
      r.ok ? `${r.kindId}로 읽음` : '');
  }

  // 줄 맨 앞의 번호가 본문 속 토큰을 이긴다
  const mixed = X.rearrange('① (가) - 가 나 다 A B C 1 2 3\n② (나) - 라 마 바\n③ (다) - 사 아 자', { order: 'orig' });
  check('본문에 토큰이 많아도 줄 앞 번호를 쓴다', mixed.kindId === 'circle', mixed.kindId);

  // 차례가 이어지면 더 믿는다 (머리표보다 번호를 먼저 본다)
  const both = X.rearrange('- 1. 하나\n- 2. 둘이다\n- 3. 셋이라네', { order: 'orig' });
  check('차례가 이어지는 번호를 머리표보다 먼저 본다', both.kindId === 'dash' || both.kindId === 'num', both.kindId);
}

/* ───────────── 2. 손대지 않으면 글이 그대로 나온다 ───────────── */
for (const c of CASES) {
  const r = X.rearrange(c.text, { order: 'orig', mark: 'keep', layout: 'keep', sep: 'keep', trim: false });
  check(`${c.name}: 원본 그대로면 글자 하나 안 바뀐다`, r.out === c.text,
    `${show(r.out)} ≠ ${show(c.text)}`);
}

/* ───────────── 3. 어떻게 배열해도 선지를 잃지 않는다 ───────────── */
for (const c of CASES) {
  const base = X.rearrange(c.text, { order: 'orig' });
  if (!base.ok) continue;
  const want = bag(base.items);
  for (const order of ORDERS) {
    for (const layout of LAYOUTS) {
      for (const mark of MARKS) {
        const r = X.rearrange(c.text, { order, layout, mark, sep: 'tab' });
        check(`${c.name}: ${order}/${layout}행/${mark} — 선지가 그대로 있다`,
          bag(r.placed) === want, show(r.placed));
        check(`${c.name}: ${order}/${layout}행/${mark} — 선지 수`,
          r.placed.length === base.items.length);
        // 번호를 그대로 둘 때는 딸린 줄까지 글자 하나 사라지지 않는다
        // (번호를 바꾸면 번호 글자가 달라지는 것이 당연하므로 본문만 위에서 본다)
        if (mark === 'keep') {
          const kept = [...r.out.replace(/\s/g, '')].sort().join('');
          const orig = [...c.text.replace(/\s/g, '')].sort().join('');
          check(`${c.name}: ${order}/${layout}행 — 글자가 사라지지 않는다`, kept === orig);
        }
      }
    }
  }
}

/* ───────────── 4. 번호는 자리에 그대로 남는다 ───────────── */
for (const c of CASES) {
  const base = X.rearrange(c.text, { order: 'orig' });
  if (!base.ok) continue;
  for (const order of ORDERS) {
    const r = X.rearrange(c.text, { order, mark: 'keep' });
    check(`${c.name}: ${order} — 번호는 자리에 남는다`,
      r.markers.join('\u0001') === base.markers.join('\u0001'), r.markers.join(''));
  }
}

/* ───────────── 5. 번호를 바꾸면 그 모양으로 다시 매긴다 ───────────── */
{
  const t = CASES.find(c => c.name === '5행답항').text;
  const want = {
    circle: ['①', '②', '③', '④', '⑤'],
    kor: ['ㄱ.', 'ㄴ.', 'ㄷ.', 'ㄹ.', 'ㅁ.'],
    num: ['1.', '2.', '3.', '4.', '5.'],
    paren: ['(1)', '(2)', '(3)', '(4)', '(5)'],
    hangul: ['(가)', '(나)', '(다)', '(라)', '(마)'],
    bullet: ['◦', '◦', '◦', '◦', '◦'],
    none: ['', '', '', '', ''],
  };
  for (const [mark, m] of Object.entries(want)) {
    const r = X.rearrange(t, { mark });
    check(`번호 바꾸기: ${mark}`, r.markers.join('\u0001') === m.join('\u0001'), r.markers.join(' '));
  }
  // ㄱㄴㄷ 보기를 1. 2. 3.으로 바꿨다가 되돌려도 본문은 그대로다
  const kor = CASES.find(c => c.name === 'ㄱㄴㄷ 보기').text;
  const a = X.rearrange(kor, { order: 'orig', mark: 'num' });
  const b = X.rearrange(a.out, { order: 'orig', mark: 'kor' });
  check('ㄱㄴㄷ → 1.2.3. → ㄱㄴㄷ', b.out === X.rearrange(kor, { order: 'orig', mark: 'kor' }).out,
    show(b.out));
}

/* ───────────── 6. 배열 기준을 지킨다 ───────────── */
for (const c of CASES) {
  const asc = X.rearrange(c.text, { order: 'len' });
  const lens = asc.placed.map(s => X.lengthOf(s));
  check(`${c.name}: 길이순`, lens.every((v, i) => i === 0 || lens[i - 1] <= v), lens.join(','));

  const desc = X.rearrange(c.text, { order: 'lenDesc' });
  const dl = desc.placed.map(s => X.lengthOf(s));
  check(`${c.name}: 길이 역순`, dl.every((v, i) => i === 0 || dl[i - 1] >= v), dl.join(','));

  const abc = X.rearrange(c.text, { order: 'abc' });
  const coll = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
  check(`${c.name}: 사전순`,
    abc.placed.every((s, i) => i === 0 || coll.compare(abc.placed[i - 1], s) <= 0), show(abc.placed));

  const rev = X.rearrange(c.text, { order: 'abcDesc' });
  check(`${c.name}: 사전 역순`,
    rev.placed.every((s, i) => i === 0 || coll.compare(rev.placed[i - 1], s) >= 0), show(rev.placed));

  // 원본 순서는 붙여 넣은 차례 그대로다
  const orig = X.rearrange(c.text, { order: 'orig' });
  check(`${c.name}: 원본 순서`, orig.placed.join('\u0001') === orig.items.join('\u0001'));
}

/* ───────────── 7. 머리말 묶음 ───────────── */
{
  const t = CASES.find(c => c.name === '머리말이 붙은 선지').text;
  const info = X.headInfo(X.rearrange(t, { order: 'orig' }).items);
  check('머리말을 찾아낸다', info.ok && info.kinds.length === 3, info.kinds.join(','));

  const r = X.rearrange(t, { order: 'headLen' });
  const heads = r.placed.map(X.headOf);
  const coll = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
  check('머리말 묶음: 머리말이 사전순으로 묶인다',
    heads.every((h, i) => i === 0 || coll.compare(heads[i - 1], h) <= 0), heads.join(','));
  // 같은 머리말 안에서는 길이순이다
  for (let i = 1; i < r.placed.length; i++) {
    if (heads[i] !== heads[i - 1]) continue;
    const a = X.lengthOf(r.placed[i - 1].slice(heads[i - 1].length).trim());
    const b = X.lengthOf(r.placed[i].slice(heads[i].length).trim());
    check('머리말 묶음: 묶음 안은 길이순', a <= b, `${a} > ${b}`);
  }
  const d = X.rearrange(t, { order: 'headLenDesc' });
  const dh = d.placed.map(X.headOf);
  for (let i = 1; i < d.placed.length; i++) {
    if (dh[i] !== dh[i - 1]) continue;
    const a = X.lengthOf(d.placed[i - 1].slice(dh[i - 1].length).trim());
    const b = X.lengthOf(d.placed[i].slice(dh[i].length).trim());
    check('머리말 묶음: 묶음 안은 길이 역순', a >= b, `${a} < ${b}`);
  }
  // 머리말이 없는 글이면 길이순과 같다
  const plain = CASES.find(c => c.name === '번호 없는 줄').text;
  check('머리말이 없으면 길이순과 같다',
    X.rearrange(plain, { order: 'headLen' }).out === X.rearrange(plain, { order: 'len' }).out);
}

/* ───────────── 8. 다시 배치하기 ───────────── */
{
  const t = CASES.find(c => c.name === '1행답항 (탭)').text;
  const want = { 1: [5], 2: [3, 2], 3: [2, 2, 1], 4: [2, 1, 1, 1], 5: [1, 1, 1, 1, 1] };
  for (const [layout, counts] of Object.entries(want)) {
    const r = X.rearrange(t, { layout, sep: 'tab' });
    const got = lines(r.out).map(l => l.split('\t').length);
    check(`${layout}행답항: 줄마다 선지 수`, got.join(',') === counts.join(','), got.join(','));
    check(`${layout}행답항: 줄 수`, got.length === Number(layout), String(got.length));
  }
  // 선지보다 줄을 많이 달라고 해도 선지 수만큼만 만든다
  const few = X.rearrange('① 가\t② 나', { layout: '5' });
  check('선지가 적으면 줄 수를 줄인다', lines(few.out).length === 2, show(few.out));
}

/* ───────────── 9. 구분자 ───────────── */
{
  const t = '① 가 ② 나 ③ 다';
  const want = { sp1: ' ', tab: '\t', tab2: '\t\t', sp2: '  ', sp4: '    ' };
  for (const [sep, ch] of Object.entries(want)) {
    const r = X.rearrange(t, { order: 'orig', sep });
    check(`구분자 ${sep}`, r.out === `① 가${ch}② 나${ch}③ 다`, show(r.out));
  }
  // 원본 구분자는 붙여 넣은 것을 그대로 쓴다
  const tabbed = '① 가\t② 나\t③ 다';
  check('원본 구분자 (탭)',
    X.rearrange(tabbed, { order: 'orig', sep: 'keep' }).out === tabbed);
  check('원본 구분자 (공백)',
    X.rearrange(t, { order: 'orig', sep: 'keep' }).out === t);
  // 다시 배치할 때도 고른 구분자를 쓴다
  check('2행답항에서도 구분자를 쓴다',
    X.rearrange(t, { order: 'orig', layout: '2', sep: 'sp4' }).out === '① 가    ② 나\n③ 다');
}

/* ───────────── 10. 선지에 딸린 줄 ───────────── */
{
  const t = CASES.find(c => c.name === '딸린 줄이 있는 선지').text;
  const base = X.rearrange(t, { order: 'orig' });
  check('딸린 줄은 선지에 묶인다', base.items[4].split('\n').length === 3, show(base.items[4]));

  for (const layout of LAYOUTS) {
    for (const order of ORDERS) {
      const r = X.rearrange(t, { order, layout, sep: 'tab' });
      const out = lines(r.out);
      check(`딸린 줄: ${order}/${layout}행 — 두 줄 다 남는다`,
        out.filter(l => l.includes('[4.0점]')).length === 1
        && out.filter(l => l.includes('[3.7점]')).length === 1, show(r.out));
      // 딸린 줄은 제 선지 바로 아래에 온다
      const at = out.findIndex(l => l.includes('[   ]'));
      check(`딸린 줄: ${order}/${layout}행 — 제 선지 아래에 온다`,
        at >= 0 && out[at + 1] && out[at + 1].includes('[4.0점]')
        && out[at + 2] && out[at + 2].includes('[3.7점]'), show(r.out));
    }
  }
}

/* ───────────── 11. 다듬기와 길이 세기 ───────────── */
{
  // 번호 뒤 공백과 선지 뒤 구분자는 따로 들고 있으므로, 다듬기는 딸린 줄에서 드러난다
  const t = '① 가\n   예) 딸린 줄입니다.   \n② 나다';
  check('앞뒤 공백 다듬기',
    X.rearrange(t, { order: 'orig', trim: true }).placed[0] === '가\n   예) 딸린 줄입니다.',
    show(X.rearrange(t, { order: 'orig', trim: true }).placed[0]));
  check('다듬지 않기',
    X.rearrange(t, { order: 'orig', trim: false }).placed[0] === '가\n   예) 딸린 줄입니다.   ',
    show(X.rearrange(t, { order: 'orig', trim: false }).placed[0]));
  check('길이: 공백 포함', X.lengthOf('가 나 다', false) === 5);
  check('길이: 공백 빼기', X.lengthOf('가 나 다', true) === 3);
  // 공백을 뺀 길이로 세면 차례가 달라질 수 있다
  const s = '① 가 나 다 라\n② 가나다나';
  check('공백을 빼면 길이가 같아진다',
    X.rearrange(s, { order: 'len', noSpace: true }).placed.join('|') === '가 나 다 라|가나다나',
    X.rearrange(s, { order: 'len', noSpace: true }).placed.join('|'));
}

/* ───────────── 12. 쪼개진 선지 한 줄로 합치기 ───────────── */
{
  // 원안지에서 박스가 끼면 한 선지가 여러 줄로 쪼개져 들어온다
  const split = '① 첫째입니다.\n② 읽기 자료 중간에 박스가 있을 경우\n㉠\n,\n㉡\n순서로 사용합니다.\n③ 셋째입니다.';
  const on = X.rearrange(split, { order: 'orig', join: true });
  check('합치기: 쪼개진 선지가 한 줄이 된다', on.items.length === 3 && !on.items[1].includes('\n'),
    show(on.items[1]));
  check('합치기: 글자를 "" 로 잇는다', on.items[1] === '읽기 자료 중간에 박스가 있을 경우㉠,㉡순서로 사용합니다.',
    show(on.items[1]));
  check('합치기: 결과도 세 줄이다', lines(on.out).length === 3, show(on.out));

  const off = X.rearrange(split, { order: 'orig', join: false });
  check('합치기 끔: 줄이 그대로 쪼개져 있다', off.items[1].split('\n').length === 5, show(off.items[1]));

  // 문장으로 끝난 뒤의 덧붙임 줄은 합치지 않는다 (원안지에서 일부러 아래에 단 줄이다)
  const note = '① 첫째입니다.\n② 배점은 [   ]로 적습니다.\n 예) 4점인 경우 ➛ [4.0점]\n 예) 3.7점인 경우 ➛ [3.7점]';
  const r = X.rearrange(note, { order: 'orig', join: true });
  check('합치기: 문장이 끝났으면 합치지 않는다', r.items[1].split('\n').length === 3, show(r.items[1]));
  check('합치기: 예) 줄은 제자리에 남는다', lines(r.out).length === 4, show(r.out));

  // 끊어진 문장인지 가려내는 눈
  check('끊어진 문장: 마침표로 끝나면 아니다', X.isBroken('끝났습니다.', '다음 줄') === false);
  check('끊어진 문장: 물음표도 아니다', X.isBroken('그런가요?', '다음 줄') === false);
  check('끊어진 문장: 중간에 끊기면 맞다', X.isBroken('박스가 있을 경우', '㉠') === true);
  check('끊어진 문장: 예)로 시작하면 아니다', X.isBroken('보기는 이렇다', '예) 이런 식') === false);
  check('끊어진 문장: ※로 시작하면 아니다', X.isBroken('보기는 이렇다', '※ 덧붙임') === false);
}

/* ───────────── 13. 가장자리 ───────────── */
{
  check('빈 글', X.rearrange('', {}).ok === false);
  check('선지 한 개', X.rearrange('① 하나뿐이다.', {}).ok === false);
  check('공백뿐인 글', X.rearrange('   \n  \n', {}).ok === false);

  // 줄바꿈이 \r\n이어도 읽는다
  const crlf = X.rearrange('① 가\r\n② 나다\r\n③ 라마바', { order: 'len' });
  check('\\r\\n 줄바꿈', crlf.ok && crlf.items.length === 3, show(crlf.items));

  // 빈 줄은 자리에 그대로 남는다
  const withBlank = X.rearrange('① 가\n\n② 나다', { order: 'orig', sep: 'keep', trim: false });
  check('빈 줄이 남는다', withBlank.out === '① 가\n\n② 나다', show(withBlank.out));

  // <보기> 같은 머리글은 선지로 세지 않는다
  const box = X.rearrange('<보기>\nㄱ. 가\nㄴ. 나다\nㄷ. 라마바', { order: 'len', sep: 'keep' });
  check('머리글은 선지가 아니다', box.items.length === 3, show(box.items));
  check('머리글은 자리에 남는다', lines(box.out)[0] === '<보기>', show(box.out));

  // 선지가 20개를 넘어도 번호를 매긴다
  const many = Array.from({ length: 25 }, (_, i) => `${i + 1}. 선지 ${'가'.repeat(25 - i)}`).join('\n');
  const r = X.rearrange(many, { order: 'len', mark: 'circle' });
  check('선지 25개', r.ok && r.placed.length === 25, String(r.placed && r.placed.length));
  check('동그라미가 모자라면 (21)로 적는다', r.markers[20] === '(21)', r.markers[20]);
}

/* ───────────── 14. 화면 쪽 ───────────── */
{
  const fs = require('fs');
  const path = require('path');
  const page = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // 속셈은 sorter.js에 두고 화면은 그것을 불러 쓴다
  check('index.html이 sorter.js를 불러온다', page.includes('src="./sorter.js"'));

  // 글자 크기: text-base(1rem)보다 작은 글씨를 쓰지 않는다
  const small = page.match(/\btext-(xs|sm)\b/g) || [];
  check('text-base보다 작은 글자 클래스를 쓰지 않는다', small.length === 0, small.join(', '));
  for (const m of page.matchAll(/font-size:\s*([\d.]+)(rem|em|px)/g)) {
    const px = m[2] === 'px' ? +m[1] : +m[1] * 16;
    check(`font-size ${m[1]}${m[2]}가 1rem 이상이다`, px >= 16);
  }

  // 메뉴 단추의 값이 sorter.js가 아는 값인가
  const vals = bar => {
    const at = page.indexOf(`id="${bar}"`);
    const end = page.indexOf('</div>', at);
    return [...page.slice(at, end).matchAll(/data-val="([^"]+)"/g)].map(m => m[1]);
  };
  check('배열 단추', vals('orderBar').join(',') === ORDERS.join(','), vals('orderBar').join(','));
  check('번호 단추', vals('markBar').join(',') === MARKS.join(','), vals('markBar').join(','));
  check('배치 단추', vals('layoutBar').join(',') === LAYOUTS.join(','), vals('layoutBar').join(','));
  check('구분자 단추', vals('sepBar').join(',') === SEPS.join(','), vals('sepBar').join(','));

  // 메뉴마다 눌린 단추가 하나씩 있고, 그것이 sorter.js의 기본값과 같다
  const pressed = bar => {
    const at = page.indexOf(`id="${bar}"`);
    const end = page.indexOf('</div>', at);
    const part = page.slice(at, end);
    return [...part.matchAll(/data-val="([^"]+)" aria-pressed="true"/g)].map(m => m[1]);
  };
  for (const [bar, key] of [['orderBar', 'order'], ['markBar', 'mark'], ['layoutBar', 'layout'], ['sepBar', 'sep']]) {
    const on = pressed(bar);
    check(`${bar}: 눌린 단추가 하나다`, on.length === 1, on.join(','));
    check(`${bar}: 기본값이 sorter.js와 같다`, on[0] === X.DEFAULTS[key], `${on[0]} ≠ ${X.DEFAULTS[key]}`);
  }

  // 예시는 모두 읽히는가
  const m = page.match(/const SAMPLES = \[([\s\S]*?)\n\];/);
  check('예시 목록이 있다', !!m);
  if (m) {
    const samples = eval('[' + m[1] + ']');
    check('예시가 여럿이다', samples.length >= 3, String(samples.length));
    samples.forEach((s, i) => {
      const r = X.rearrange(s, { order: 'len' });
      check(`예시 ${i + 1}을 읽어 낸다`, r.ok && r.placed.length >= 2, show(s));
    });
  }
}

if (failed) {
  console.log(fails.join('\n'));
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('모두 통과');
