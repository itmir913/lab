/* 선지 배열기의 속셈. 화면과 떼어 두어 node로도 그대로 돌려 볼 수 있다.
 *   node choice-order/test.js
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChoiceOrder = api;
})(typeof self !== 'undefined' ? self : this, function () {

/* ───────────── 번호 유형 ─────────────
   앞선 유형이 먼저 뽑히므로, 다른 글과 헷갈릴 일이 적은 것을 위에 둔다.

   ord(마디) ─ 그 번호가 몇째인지 (ㄱ→0, 다→2, C→2, 3→2). 모르면 null.
   seq       ─ 번호가 차례대로 이어지는지 본다. 이어지면 번호로 더 믿는다.
   needsSeq  ─ 본문과 헷갈리기 쉬운 유형. 차례가 이어질 때만 번호로 인정한다.
               "가 나 다"처럼 표시가 없는 맨 토큰이나, 문장 끝의 "…다."와
               모양이 같은 "가."가 여기 든다 */
const JAMO_S   = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';
const GANADA_S = '가나다라마바사아자차카타파하';
const at = (str, ch) => { const i = str.indexOf(ch); return i < 0 ? null : i; };
const digit = t => { const n = parseInt(t.replace(/\D/g, ''), 10); return Number.isFinite(n) ? n - 1 : null; };
const inRange = (lo, hi) => t => { const c = t.codePointAt(0); return c >= lo && c <= hi ? c - lo : null; };
const letter = t => { const c = t.toUpperCase().codePointAt(0); return c >= 65 && c <= 90 ? c - 65 : null; };

const KINDS = [
  // 번호로 쓰라고 만든 글자들 ─ 본문에 섞일 일이 없다
  { id: 'circle',  name: '①②③ 번호',   src: '[\\u2460-\\u2473\\u3251-\\u325F\\u32B1-\\u32BF]',
    ord: t => circleOrd(t.codePointAt(0)) },
  { id: 'circleB', name: '❶➀ 번호',     src: '[\\u2776-\\u277F\\u2780-\\u2789]',
    ord: t => { const c = t.codePointAt(0); return c <= 0x277F ? (c - 0x2776) % 10 : (c - 0x2780) % 10; } },
  { id: 'circleK', name: '㉠㉮ 번호',    src: '[\\u3260-\\u327B\\u3200-\\u321E]',
    ord: t => { const c = t.codePointAt(0);
      if (c >= 0x3200) return c <= 0x320D ? c - 0x3200 : c - 0x320E;  // ㈀는 ㄱ, ㈎는 가
      return c <= 0x326D ? c - 0x3260 : c - 0x326E; } },              // ㉠는 ㄱ, ㉮는 가
  { id: 'circleL', name: 'Ⓐⓐ 번호',     src: '[\\u24B6-\\u24E9]',
    ord: t => { const c = t.codePointAt(0); return c <= 0x24CF ? c - 0x24B6 : c - 0x24D0; } },
  { id: 'parenN',  name: '⑴⑵ 번호',     src: '[\\u2474-\\u2487]', ord: inRange(0x2474, 0x2487) },
  { id: 'dotN',    name: '⒈⒉ 번호',     src: '[\\u2488-\\u249B]', ord: inRange(0x2488, 0x249B) },
  { id: 'roman',   name: 'Ⅰ Ⅱ 번호',    src: '[\\u2160-\\u216B\\u2170-\\u217B]\\s*[.)]?',
    ord: t => { const c = t.codePointAt(0); return c <= 0x216B ? c - 0x2160 : c - 0x2170; } },

  // 괄호로 묶은 번호 ─ 괄호가 있어 본문과 갈린다
  { id: 'korP',    name: '(ㄱ)(ㄴ) 번호', src: '\\(\\s*[\\u3131-\\u314E]\\s*\\)', ord: t => at(JAMO_S, t.replace(/[()\s]/g, '')) },
  { id: 'hangul',  name: '(가)(나) 번호', src: '\\(\\s*[가-힣]\\s*\\)',          ord: t => at(GANADA_S, t.replace(/[()\s]/g, '')) },
  { id: 'parenL',  name: '(A)(B) 번호',   src: '\\(\\s*[A-Za-z]{1,2}\\s*\\)',   ord: t => latinOrd(t.replace(/[()\s]/g, '')) },
  { id: 'paren',   name: '(1)(2) 번호',   src: '\\(\\s*\\d{1,2}\\s*\\)',         ord: digit },

  // 마침표나 닫는 괄호가 붙은 번호
  { id: 'kor',     name: 'ㄱㄴㄷ 번호',   src: '[\\u3131-\\u314E]\\s*[.)]',      ord: t => at(JAMO_S, t[0]) },
  { id: 'num',     name: '1. 2. 번호',    src: '\\d{1,2}\\s*[.)]',               ord: digit },
  { id: 'latin',   name: 'A. B. 번호',    src: '[A-Za-z]{1,2}\\s*[.)]',         ord: t => latinOrd(t.replace(/[.)\s]/g, '')), needsSeq: true },
  { id: 'hangulD', name: '가. 나. 번호',  src: '[가-힣]\\s*[.)]',                ord: t => at(GANADA_S, t[0]), needsSeq: true },

  // 머리표 ─ 차례가 없으니 모두 같은 것으로 본다
  { id: 'bullet',  name: '◦ 같은 머리표', src: '[\\u25E6\\u25CB\\u25CF\\u2022\\u00B7\\u2219\\u25AA\\u25AB\\u203B\\u25A0\\u25A1\\u2500]' },
  { id: 'dash',    name: '- 머리표',      src: '[-\\u2013\\u2014]' },

  // 표시가 없는 맨 토큰 ─ 본문과 가장 헷갈리므로 차례가 이어질 때만 번호로 본다
  { id: 'bareN',   name: '1 2 3 번호',    src: '\\d{1,2}(?=\\s|$)',              ord: digit,            needsSeq: true },
  { id: 'bareL',   name: 'A B C 번호',    src: '[A-Za-z]{1,2}(?=\\s|$)',        ord: t => latinOrd(t), needsSeq: true },
  { id: 'bareJ',   name: 'ㄱ ㄴ ㄷ 번호', src: '[\\u3131-\\u314E](?=\\s|$)',     ord: t => at(JAMO_S, t),   needsSeq: true },
  { id: 'bareH',   name: '가 나 다 번호', src: '[가-힣](?=\\s|$)',               ord: t => at(GANADA_S, t), needsSeq: true },
];

/* 번호가 1, 2, 3처럼 한 칸씩 이어지는가 (중간에서 시작해도 된다) */
function isSequence(kind, hits) {
  if (!kind.ord || hits.length < 2) return false;
  const ords = hits.map(h => kind.ord(h.text));
  return ords.every((v, i) => v !== null && (i === 0 || v === ords[i - 1] + 1));
}

/* 번호를 다시 매길 때 쓰는 글자.
   동그라미 숫자는 유니코드에 50까지 있다 (①~⑳ · ㉑~㉟ · ㊱~㊿).
   동그라미 자모(㉠~㉭)와 동그라미 가나다(㉮~㉻)는 각각 14개뿐이라 그 뒤는 괄호 숫자로 적는다.
   영문은 Z 다음을 엑셀 열처럼 AA, AB…로 이어 간다 */
const circleAt = i =>
  i < 20 ? String.fromCodePoint(0x2460 + i) :
  i < 35 ? String.fromCodePoint(0x3251 + i - 20) :
  i < 50 ? String.fromCodePoint(0x32B1 + i - 35) : null;
const circleOrd = c =>
  c >= 0x2460 && c <= 0x2473 ? c - 0x2460 :
  c >= 0x3251 && c <= 0x325F ? c - 0x3251 + 20 :
  c >= 0x32B1 && c <= 0x32BF ? c - 0x32B1 + 35 : null;
// 0→A … 25→Z, 26→AA, 27→AB
const latinAt = i => { let s = '', n = i; for (;;) { s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26) - 1; if (n < 0) return s; } };
const latinOrd = t => { let v = 0; for (const ch of t.toUpperCase()) { const d = ch.codePointAt(0) - 64; if (d < 1 || d > 26) return null; v = v * 26 + d; } return v - 1; };
const CIRCLE = [...'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'];
const JAMO   = [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'];
const GANADA = [...'가나다라마바사아자차카타파하'];

/* 선지 사이를 띄우는 글자 */
const SEP = { sp1: ' ', tab: '\t', tab2: '\t\t', sp2: '  ', sp4: '    ' };

function markerOf(style, i) {
  switch (style) {
    case 'circle': return circleAt(i) || '(' + (i + 1) + ')';
    case 'kor':    return (JAMO[i] || String(i + 1)) + '.';
    case 'num':    return (i + 1) + '.';
    case 'paren':  return '(' + (i + 1) + ')';
    case 'hangul': return '(' + (GANADA[i] || (i + 1)) + ')';
    case 'circleK': return i < 14 ? String.fromCodePoint(0x3260 + i) : '(' + (i + 1) + ')';
    case 'latin':  return latinAt(i) + '.';
    case 'parenL': return '(' + latinAt(i) + ')';
    case 'bullet': return '◦';
    case 'none':   return '';
  }
  return '';
}

/* ───────────── 붙여 넣은 글 읽기 ─────────────
   줄마다 번호를 찾아, 번호 / 번호 뒤 공백 / 본문 / 본문 뒤 구분자로 쪼갠다.
   구분자(탭, 여러 칸 띄우기)는 글자 그대로 들고 있다가 결과에 되돌려 놓는다 */
/* 끊어진 문장인가 ─ 원안지에서 박스나 그림이 끼면 한 선지가 여러 줄로 쪼개져 들어온다.
   앞줄이 문장으로 끝나지 않고, 뒷줄이 "예)"나 "※" 같은 덧붙임으로 시작하지 않으면
   한 선지가 쪼개진 것으로 보고 도로 한 줄로 잇는다 */
const SENT_END = /[.?!…。][”’"')\]]*$/;
const NOTE_START = /^\s*(예\s*[).:]|※|참고|주의|cf\.)/i;

function isBroken(prevLine, nextLine) {
  if (prevLine.trim() === '') return false;
  return !SENT_END.test(prevLine.trim()) && !NOTE_START.test(nextLine);
}

function parse(text, join) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');

  let best = null;
  for (const kind of KINDS) {
    // 줄 맨 앞이거나 공백 뒤에 있는 것만 번호로 본다 ("① (가) - …"의 (가)는 본문이다)
    const re = new RegExp('(?:^|(?<=\\s))(?:' + kind.src + ')', 'gu');
    const hits = [];
    let atLineStart = 0;
    lines.forEach((line, li) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        if (m[0] === '') { re.lastIndex++; continue; }
        const first = line.slice(0, m.index).trim() === '';
        if (first) atLineStart++;
        hits.push({ line: li, start: m.index, end: m.index + m[0].length, text: m[0] });
      }
    });
    if (hits.length < 2) continue;
    const seq = isSequence(kind, hits);
    // 본문과 헷갈리기 쉬운 유형은 번호가 차례대로 이어질 때만 번호로 본다
    // 셋은 모여야 번호다. 글자 두 개가 나란한 것은 우연일 수 있다
    if (kind.needsSeq && (!seq || hits.length < 3)) continue;
    // 줄 맨 앞에 놓인 번호가 많은 유형을 먼저 믿고, 차례가 이어지면 조금 더 믿는다
    const score = atLineStart * 1000 + (seq ? 500 : 0) + hits.length;
    if (!best || score > best.score) best = { kind, hits, score };
  }

  if (!best) return parseByLine(lines);

  const byLine = new Map();
  for (const h of best.hits) {
    if (!byLine.has(h.line)) byLine.set(h.line, []);
    byLine.get(h.line).push(h);
  }

  const rows = [];   // 줄마다: 글자 그대로 둘 것과 선지 칸
  const items = [];  // 선지 본문 (문서에 놓인 순서)
  lines.forEach((line, li) => {
    const hs = byLine.get(li);
    if (!hs) { rows.push({ raw: line }); return; }
    const cells = [];
    const prefix = line.slice(0, hs[0].start);
    hs.forEach((h, k) => {
      const next = k + 1 < hs.length ? hs[k + 1].start : line.length;
      const rest = line.slice(h.end, next);
      const gap = /^[ \t]*/.exec(rest)[0];        // 번호와 본문 사이
      const bodyRaw = rest.slice(gap.length);
      const sep = /[ \t]*$/.exec(bodyRaw)[0];     // 다음 번호까지의 구분자 (탭 등)
      const body = bodyRaw.slice(0, bodyRaw.length - sep.length);
      cells.push({ marker: h.text, gap, sep, slot: items.length });
      items.push(body);
    });
    rows.push({ prefix, cells });
  });

  // 번호 없는 줄이 선지 바로 뒤에 오면 그 선지에 딸린 줄로 본다.
  // 그래야 자리를 옮길 때 딸린 줄이 따라가고, 다시 배치할 때도 빠지지 않는다
  const merged = [];
  for (const row of rows) {
    const prev = merged[merged.length - 1];
    if (row.raw !== undefined && row.raw.trim() !== '' && prev && prev.cells) {
      const last = prev.cells[prev.cells.length - 1];
      const cur = items[last.slot];
      const curLast = cur.slice(cur.lastIndexOf('\n') + 1).replace(/[ \t]+$/, '');
      items[last.slot] += (join && isBroken(curLast, row.raw) ? '' : '\n') + row.raw;
      continue;
    }
    merged.push(row);
  }

  return { kindId: best.kind.id, kindName: best.kind.name, rows: merged, items, lineMode: false };
}

/* 번호가 없으면 줄 그대로를 선지 한 개로 본다 */
function parseByLine(lines) {
  const rows = [];
  const items = [];
  lines.forEach(line => {
    if (line.trim() === '') { rows.push({ raw: line }); return; }
    const prefix = /^[ \t]*/.exec(line)[0];
    const body = line.slice(prefix.length).replace(/[ \t]+$/, '');
    const sep = /[ \t]*$/.exec(line)[0];
    rows.push({ prefix, cells: [{ marker: '', gap: '', sep, slot: items.length }] });
    items.push(body);
  });
  if (items.length < 2) return null;
  return { kindId: 'line', kindName: '번호 없는 줄', rows, items, lineMode: true };
}

/* ───────────── 배열 ───────────── */
const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });

function lengthOf(s, noSpace) {
  const t = s.trim();
  return [...(noSpace ? t.replace(/\s+/g, '') : t)].length;
}

/* 선지 앞머리에 붙은 토큰: (가) [A] <ㄱ> ① A. 1) 같은 것.
   "(가)"는 보기의 한 가지일 뿐이므로 모양을 못박지 않고 앞머리 토큰을 통째로 본다 */
const HEAD_RE = /^\s*(?:[(\[<{][^)\]>}\n]{1,8}[)\]>}]|[①-⑳]|[ㄱ-ㅎ]\s*[.)]|[A-Za-z]\s*[.)]|\d{1,2}\s*[.)])/u;

function headOf(s) {
  const m = HEAD_RE.exec(s);
  return m ? m[0].trim() : '';
}

/* 머리말로 묶을 수 있는 글인지 본다 (머리말이 붙은 선지가 둘 이상이고, 머리말이 두 가지 이상) */
function headInfo(items) {
  const heads = items.map(headOf);
  const found = heads.filter(h => h !== '');
  const kinds = [...new Set(found)];
  return { heads, ok: found.length >= 2 && kinds.length >= 2, kinds };
}

function arrange(items, order, noSpace) {
  const idx = items.map((_, i) => i);
  if (order === 'orig') return idx;
  const len = items.map(s => lengthOf(s, noSpace));
  const byHead = order === 'headLen' || order === 'headLenDesc';
  // 머리말로 묶을 때는 머리말을 뺀 나머지로 길이를 잰다
  const heads = byHead ? headInfo(items).heads : null;
  const rest = byHead ? items.map((s, i) => s.slice(heads[i].length).trim()) : null;
  const restLen = byHead ? rest.map(s => lengthOf(s, noSpace)) : null;
  idx.sort((a, b) => {
    switch (order) {
      case 'len':     return len[a] - len[b] || collator.compare(items[a], items[b]) || a - b;
      case 'lenDesc': return len[b] - len[a] || collator.compare(items[a], items[b]) || a - b;
      case 'abc':     return collator.compare(items[a], items[b]) || a - b;
      case 'abcDesc': return collator.compare(items[b], items[a]) || a - b;
      case 'headLen':
        return collator.compare(heads[a], heads[b]) || restLen[a] - restLen[b] || collator.compare(rest[a], rest[b]) || a - b;
      case 'headLenDesc':
        return collator.compare(heads[a], heads[b]) || restLen[b] - restLen[a] || collator.compare(rest[a], rest[b]) || a - b;
    }
    return a - b;
  });
  return idx;
}

/* ───────────── 결과 만들기 ─────────────
   opts: order(orig|len|lenDesc|abc|abcDesc|headLen|headLenDesc)
         mark(keep|circle|kor|num|paren|hangul|bullet|none)
         layout(keep|1~5) sep(keep|sp1|tab|tab2|sp2|sp4) trim noSpace
         join: 쪼개져 들어온 선지를 한 줄로 도로 잇는다 */
const DEFAULTS = { order: 'len', mark: 'keep', layout: 'keep', sep: 'tab', trim: true, noSpace: false, join: true };

// 선지에 딸린 줄은 그 선지가 놓인 줄 바로 아래에 붙여 둔다
const headLine = whole => { const i = whole.indexOf('\n'); return i < 0 ? whole : whole.slice(0, i); };
const tailLines = whole => { const i = whole.indexOf('\n'); return i < 0 ? null : whole.slice(i + 1); };

function rearrange(text, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const parsed = parse(text, o.join);
  if (!parsed) return { ok: false, reason: 'no-items' };

  const items = parsed.items.map(s => o.trim ? s.trim() : s);
  const picked = arrange(items, o.order, o.noSpace);

  const slots = [];
  parsed.rows.forEach(row => { if (row.cells) row.cells.forEach(c => slots.push(c)); });

  // 자리마다 번호를 새로 붙이고 본문만 바꿔 끼운다
  const markerAt = cell => o.mark === 'keep' ? cell.marker : markerOf(o.mark, cell.slot);
  // 선지 사이를 무엇으로 띄울지. 원본 구분자면 붙여 넣은 글의 것을 그대로 쓴다
  const sepAfter = (cell, isLast) => o.sep === 'keep' || isLast ? cell.sep : SEP[o.sep];

  let out;
  if (o.layout === 'keep') {
    out = parsed.rows.map(row => {
      if (row.raw !== undefined) return row.raw;
      let line = row.prefix;
      const under = [];
      row.cells.forEach((cell, k) => {
        const whole = items[picked[cell.slot]];
        const marker = markerAt(cell);
        const gap = o.mark === 'keep' ? cell.gap : (marker === '' ? '' : (cell.gap || ' '));
        line += marker + gap + headLine(whole) + sepAfter(cell, k === row.cells.length - 1);
        if (tailLines(whole) !== null) under.push(tailLines(whole));
      });
      return under.length ? [line, ...under].join('\n') : line;
    }).join('\n');
  } else {
    // 1행답항~5행답항: 선지를 줄 수에 맞춰 다시 나눈다. 앞줄부터 고르게 채운다
    const rowCount = Math.min(Number(o.layout), slots.length);
    const lines = [];
    let at = 0;
    for (let r = 0; r < rowCount; r++) {
      const take = Math.ceil((slots.length - at) / (rowCount - r));
      const cells = [];
      const under = [];
      for (let k = 0; k < take; k++, at++) {
        const cell = slots[at];
        const whole = items[picked[cell.slot]];
        const marker = markerAt(cell);
        const gap = marker === '' ? '' : (o.mark === 'keep' ? (cell.gap || ' ') : ' ');
        cells.push(marker + gap + headLine(whole));
        if (tailLines(whole) !== null) under.push(tailLines(whole));
      }
      lines.push(cells.join(o.sep === 'keep' ? SEP.tab : SEP[o.sep]));
      lines.push(...under);
    }
    out = lines.join('\n');
  }

  return {
    ok: true,
    kindId: parsed.kindId,
    kindName: parsed.kindName,
    items, picked, slots, out,
    // 새 자리에 놓인 선지 (표와 줄 복사가 쓴다)
    placed: slots.map(cell => items[picked[cell.slot]]),
    markers: slots.map(cell => markerAt(cell)),
  };
}

return { KINDS, SEP, DEFAULTS, markerOf, parse, isBroken, lengthOf, headOf, headInfo, arrange, rearrange };
});
