/* ───────────── 예제 데모 데이터 ─────────────
   실제 PDF·엑셀 없이 대조 화면을 둘러보기 위한 모의 데이터.
   파일을 내려주는 대신 이 자리에서 레코드를 만들어 메모리에만 올리고,
   판독 결과(records·neis)를 실제 compare()에 그대로 넣어 결과를 얻는다.
   신고서 원본 패널은 pdf.js 문서 대신 같은 모양(getPage·getViewport·render)의
   가짜 문서를 끼워 캔버스에 모의 신고서를 그린다. */
(() => {
  const SURNAME = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍'];
  const GIVEN = ['민준', '서연', '지후', '하윤', '도윤', '서윤', '시우', '지우', '예준', '하은', '주원', '수아', '지호', '지유', '건우', '다은', '현우', '유나', '우진', '채원', '선우', '소율', '연우', '예린', '유준', '시은'];
  const SLOTS = ['조회', '1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시', '종례'];
  // memo는 학생이 쓴 사유, confirm은 담임 확인 내용. NEIS 사유에는 실제와 같이 confirm을 넣는다
  const REASONS = [
    { reason: '질병', memo: '감기 증상으로 인한 가정 요양', confirm: '보호자 통화 및 진료확인서 확인' },
    { reason: '질병', memo: '복통으로 병원 진료', confirm: '진료확인서 확인' },
    { reason: '질병', memo: '치과 진료', confirm: '진료확인서 확인' },
    { reason: '인정', memo: '조부 상으로 경조사 참석', confirm: '경조사 증빙 확인' },
    { reason: '인정', memo: '교외 체험학습 참가', confirm: '체험학습 신청서 확인' },
    { reason: '기타', memo: '가사 사정', confirm: '보호자 통화 확인' },
  ];
  const OTHER_CONFIRM = ['보호자 통화만 확인, 증빙 미제출', '사유 변경 확인 필요', '증빙자료 추후 제출 예정'];

  const rint = (rnd, n) => Math.floor(rnd() * n);
  const pick = (rnd, a) => a[rint(rnd, a.length)];
  function mulberry32(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const shuffle = (rnd, a) => {
    for (let i = a.length - 1; i > 0; i--) { const j = rint(rnd, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  // 출결 구분에 맞는 교시 범위 (결석은 하루 전체)
  function slotRange(rnd, kind) {
    if (kind === '결석') return SLOTS.slice();
    const i = 2 + rint(rnd, 5); // 2교시~6교시 사이에서 끊음
    if (kind === '지각') return SLOTS.slice(0, i);
    if (kind === '조퇴') return SLOTS.slice(i);
    return [SLOTS[i]]; // 결과: 한 교시
  }
  const catOf = (reason, kind) => (reason === '인정' ? '출석인정' : reason) + kind;
  const sigOf = (start, end, slots) =>
    [...new Set([start, end])].map(d => d.slice(5)).join('~') + ` (${slots[0]}~${slots[slots.length - 1]})`;

  function buildDemo() {
    const rnd = mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    // 학생 28명: 번호는 학번 뒤 2자리 (parseRiroPage와 같은 규칙)
    const used = new Set();
    const students = [];
    for (let i = 1; i <= 28; i++) {
      let name;
      do { name = pick(rnd, SURNAME) + pick(rnd, GIVEN); } while (used.has(name));
      used.add(name);
      students.push({ num: i, name, sid: `20${String(i).padStart(2, '0')}` });
    }
    // 대조 대상 월: 지난달. 평일만 추려 학생·일자가 겹치지 않게 나눠 쓴다
    const now = new Date();
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const Y = base.getUTCFullYear(), M = base.getUTCMonth() + 1;
    const weekdays = [];
    for (let d = 1; d <= 31; d++) {
      const dt = new Date(Date.UTC(Y, M - 1, d));
      if (dt.getUTCMonth() !== M - 1) break;
      if (dt.getUTCDay() % 6) weekdays.push(dt.toISOString().slice(0, 10));
    }
    const nextMonth = new Date(Date.UTC(Y, M, 1));

    const taken = new Set(); // `num|date` 중복 방지
    function slot(days = 1) {
      for (let t = 0; t < 400; t++) {
        const st = students[rint(rnd, students.length)];
        const i = rint(rnd, weekdays.length - days + 1);
        const span = weekdays.slice(i, i + days);
        // 여러 날이면 연속한 평일만 (주말을 건너뛴 구간은 compare가 수업일로 세므로 그대로 두어도 되지만, 데모는 단순하게)
        if (span.some(d => taken.has(`${st.num}|${d}`))) continue;
        span.forEach(d => taken.add(`${st.num}|${d}`));
        return { st, span };
      }
      return null;
    }

    const neis = [], records = [], errors = [];
    const addNeis = (st, date, kind, reason, slots, memo) => neis.push({
      date, num: st.num, name: st.name, cat: catOf(reason, kind), kind, reason,
      periods: slots.join(','), memo,
    });
    const addRec = (st, span, kind, reason, slots, memo, confirm, extra = {}) => {
      const start = span[0], end = span[span.length - 1];
      records.push({
        name: st.name, sid: st.sid, num: st.num, kind, reason, start, end,
        approved: true, reqDiffers: false, reqSig: '', apSig: sigOf(start, end, slots),
        slotFrom: slots[0], slotTo: slots[slots.length - 1], statedDays: span.length,
        confirm, memo, ...extra,
      });
    };

    // 사례 목록: 결과 종류가 한쪽으로 쏠리지 않게 건수를 정해 두고 섞어서 만든다
    const plan = [];
    const add = (type, n) => { for (let i = 0; i < n; i++) plan.push(type); };
    add('ok', 32); add('ok3', 3); add('diff', 6); add('slot', 5); add('memo', 5);
    add('noPdf', 6); add('noNeis', 3); add('noNeisOut', 2);
    add('unapproved', 2); add('exemptUnrec', 3); add('exemptTrip', 3);
    add('flagName', 2); add('flagReq', 3); add('flagDays', 3); add('dup', 1);
    shuffle(rnd, plan);

    for (const type of plan) {
      const days = type === 'ok3' ? 3 : 1;
      const got = slot(days);
      if (!got) continue;
      const { st, span } = got;
      const date = span[0];
      const kind = type === 'ok3' ? '결석' : pick(rnd, ['결석', '결석', '지각', '조퇴', '결과']);
      const slots = slotRange(rnd, kind);
      const r = pick(rnd, REASONS);

      switch (type) {
        case 'ok': case 'ok3':
          span.forEach(d => addNeis(st, d, kind, r.reason, slots, r.confirm));
          addRec(st, span, kind, r.reason, slots, r.memo, r.confirm);
          break;
        case 'diff': { // 같은 일자에 구분이 다름 (예: 신고서 질병조퇴 ↔ NEIS 질병결석)
          const other = kind === '결석' ? '조퇴' : '결석';
          const nSlots = slotRange(rnd, other);
          addNeis(st, date, other, r.reason, nSlots, r.confirm);
          addRec(st, span, kind, r.reason, slots, r.memo, r.confirm);
          break;
        }
        case 'slot': { // 구분은 같고 승인 교시 범위만 다름
          // 범위 끝을 한 교시 옮긴다 (한 교시짜리 결과는 다음 교시로)
          const i = SLOTS.indexOf(slots[0]);
          const nSlots = slots.length > 1 ? slots.slice(1) : [SLOTS[i + 1 < SLOTS.length - 1 ? i + 1 : i - 1]];
          addNeis(st, date, kind, r.reason, nSlots, r.confirm);
          addRec(st, span, kind, r.reason, slots, r.memo, r.confirm);
          break;
        }
        case 'memo': // 구분·교시는 같고 담임 확인 내용과 NEIS 사유가 다름
          addNeis(st, date, kind, r.reason, slots, r.confirm);
          addRec(st, span, kind, r.reason, slots, r.memo, pick(rnd, OTHER_CONFIRM));
          break;
        case 'noPdf': // NEIS에만 기록이 있음
          addNeis(st, date, kind, r.reason, slots, r.confirm);
          break;
        case 'noNeis': // 신고서만 있고 NEIS 미입력
          addRec(st, span, kind, r.reason, slots, r.memo, r.confirm);
          break;
        case 'noNeisOut': { // 엑셀 범위 외 월의 신고서
          const d = new Date(nextMonth);
          d.setUTCDate(d.getUTCDate() + rint(rnd, 20));
          if (!(d.getUTCDay() % 6)) d.setUTCDate(d.getUTCDate() + 2);
          const iso = d.toISOString().slice(0, 10);
          addRec(st, [iso], kind, r.reason, slots, r.memo, r.confirm);
          break;
        }
        case 'unapproved': // 승인 기간 미기재 → 신청 기간으로 대조
          span.forEach(d => addNeis(st, d, kind, r.reason, slots, r.confirm));
          addRec(st, span, kind, r.reason, slots, r.memo, r.confirm, { approved: false });
          break;
        case 'exemptUnrec': // 미인정 출결 → 대조 제외
          addNeis(st, date, kind, '미인정', slots, '무단');
          break;
        case 'exemptTrip': // 체험학습 → 대조 제외
          addNeis(st, date, '결석', '인정', SLOTS.slice(), '교외 체험학습 (가족 동반 현장체험)');
          break;
        case 'flagName': { // 번호·일자는 같고 성명이 다름
          addNeis(st, date, kind, r.reason, slots, r.confirm);
          const wrong = pick(rnd, SURNAME) + st.name.slice(1);
          addRec({ ...st, name: wrong === st.name ? '유' + st.name.slice(1) : wrong }, span, kind, r.reason, slots, r.memo, r.confirm);
          break;
        }
        case 'flagReq': { // 학생 신청 기간 ≠ 교사 승인 기간
          addNeis(st, date, kind, r.reason, slots, r.confirm);
          const wider = kind === '결석' ? SLOTS.slice() : SLOTS.slice(0, slots.length + 2);
          addRec(st, span, kind, r.reason, slots, r.memo, r.confirm, {
            reqDiffers: true, reqSig: sigOf(span[0], weekdays[weekdays.indexOf(date) + 1] || date, wider),
          });
          break;
        }
        case 'flagDays': // 기재 일수가 실제 수업일수와 다름
          addNeis(st, date, kind, r.reason, slots, r.confirm);
          addRec(st, span, kind, r.reason, slots, r.memo, r.confirm, { statedDays: span.length + 1 });
          break;
        case 'dup': // 같은 일자에 신고서가 2장
          addNeis(st, date, kind, r.reason, slots, r.confirm);
          addRec(st, span, kind, r.reason, slots, r.memo, r.confirm);
          addRec(st, span, kind, r.reason, slots, r.memo, r.confirm);
          break;
      }
    }

    // 쪽 번호: 신고서 순서대로 1쪽부터, 뒤이어 판독 실패 쪽 2장
    records.forEach((rec, i) => { rec.page = i + 1; });
    errors.push({ page: records.length + 1, why: '기간 판독 실패' },
                { page: records.length + 2, why: '이름/학번 판독 실패' });
    neis.sort((a, b) => a.date.localeCompare(b.date) || a.num - b.num);
    return { neis, records, errors, month: `${Y}년 ${M}월` };
  }

  /* ── 가짜 PDF 문서: pdf.js 문서와 같은 모양으로 모의 신고서를 캔버스에 그린다 ── */
  const A4 = { w: 595, h: 842 };
  function fakeDoc(records, errors) {
    const byPage = new Map(records.map(r => [r.page, r]));
    const failPages = new Set(errors.map(e => e.page));
    return {
      numPages: records.length + errors.length,
      destroy() {},
      getPage(n) {
        return Promise.resolve({
          getViewport({ scale = 1 } = {}) { return { width: A4.w * scale, height: A4.h * scale, scale }; },
          render({ canvasContext, viewport }) {
            let cancelled = false;
            const promise = new Promise(res => {
              requestAnimationFrame(() => {
                if (!cancelled) drawPage(canvasContext, viewport, byPage.get(n), n, failPages.has(n));
                res();
              });
            });
            return { promise, cancel() { cancelled = true; } };
          },
        });
      },
    };
  }

  const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
  function drawPage(ctx, vp, rec, page, failed) {
    const s = vp.width / A4.w;
    ctx.save();
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, A4.w, A4.h);
    ctx.strokeStyle = '#1D2B3A';
    ctx.fillStyle = '#1D2B3A';
    ctx.lineWidth = 0.7;
    ctx.textBaseline = 'middle';

    const L = 56, R = A4.w - 56, LW = 96;
    ctx.font = `bold 19px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(failed ? '출결 신고서' : '결석·지각·조퇴·결과 신고서', A4.w / 2, 86);
    ctx.textAlign = 'left';
    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = '#5E6B73';
    ctx.fillText('예제 데모 데이터 — 실제 신고서가 아닙니다', L, 112);
    ctx.fillStyle = '#1D2B3A';

    // 항목 표: 왼쪽 항목명 칸 + 오른쪽 값 칸
    let y = 136;
    const line = (label, value, h = 26) => {
      ctx.strokeRect(L, y, R - L, h);
      ctx.beginPath(); ctx.moveTo(L + LW, y); ctx.lineTo(L + LW, y + h); ctx.stroke();
      ctx.fillStyle = '#F4F5F7'; ctx.fillRect(L + 0.4, y + 0.4, LW - 0.8, h - 0.8);
      ctx.fillStyle = '#2C3E52'; ctx.font = `bold 11px ${FONT}`;
      ctx.fillText(label, L + 10, y + h / 2);
      ctx.fillStyle = '#1D2B3A'; ctx.font = `11px ${FONT}`;
      for (const [i, t] of (Array.isArray(value) ? value : [value]).entries()) {
        ctx.fillText(t, L + LW + 10, y + h / 2 + (i - ((Array.isArray(value) ? value.length : 1) - 1) / 2) * 14);
      }
      y += h;
    };

    if (failed) {
      // 판독 실패 쪽: 표 격자가 깨져 항목을 읽을 수 없는 상태를 흉내 낸다
      ctx.strokeRect(L, y, R - L, 120);
      ctx.font = `11px ${FONT}`;
      ctx.fillStyle = '#5E6B73';
      ctx.fillText('(이 쪽은 양식이 달라 자동 판독에 실패한 예입니다)', L + 12, y + 40);
      ctx.fillText('항목명과 값의 칸 구분이 없어 기간·이름을 찾을 수 없습니다.', L + 12, y + 62);
      ctx.fillText('원본을 직접 확인해 주세요.', L + 12, y + 84);
    } else if (rec) {
      const per = (a, b, slots) => `${a}${b !== a ? ` ~ ${b}` : ''}  (${slots[0]}부터 ${slots[1]}까지)`;
      line('이름/학번', `${rec.name} / ${rec.sid}`);
      line('신청기간', rec.reqDiffers ? `${rec.reqSig}  (학생 신청)` : per(rec.start, rec.end, [rec.slotFrom, rec.slotTo]));
      line('승인기간', rec.approved ? per(rec.start, rec.end, [rec.slotFrom, rec.slotTo]) : '(미기재)');
      line('누적결석일수', `${rec.statedDays}일간`);
      line('출결종류', `${rec.kind} / ${rec.reason === '인정' ? '출석인정' : rec.reason}`);
      line('사유', rec.memo, 40);
      line('증빙자료', '첨부 1건');
      line('확인방법', '보호자 통화');
      line('확인내용', rec.confirm, 40);
    }

    y += 32;
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = '#5E6B73';
    ctx.fillText(`${page}쪽`, L, y);
    ctx.textAlign = 'right';
    ctx.fillText('담임교사 확인', R - 56, y);
    ctx.textAlign = 'left';
    // 결재 인주 도장
    ctx.strokeStyle = '#C2352B'; ctx.fillStyle = '#C2352B'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(R - 22, y, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('확인', R - 22, y + 1);

    // 실제 서류와 섞이지 않도록 대각선 워터마크
    ctx.translate(A4.w / 2, A4.h * 0.62);
    ctx.rotate(-Math.PI / 9);
    ctx.font = `bold 46px ${FONT}`;
    ctx.fillStyle = 'rgba(194, 53, 43, .10)';
    ctx.fillText('예제 데모 데이터', 0, 0);
    ctx.restore();
  }

  /* ── 버튼: 모의 데이터를 만들어 실제 compare()·화면 그리기에 그대로 넣는다 ── */
  $('demoBtn').addEventListener('click', () => {
    if (state.running) return;
    const { neis, records, errors, month } = buildDemo();
    if (state.doc) state.doc.destroy();
    const doc = fakeDoc(records, errors);
    Object.assign(state, { doc, neis, records, filter: 'todo', selKey: null, checked: new Set(), demo: true });
    state.pdfLabel = `예제 신고서 ${records.length}장 (${month})`;
    state.xlsxLabel = `예제 NEIS ${neis.length}건 (${month})`;
    $('status').textContent = `예제 데모 — 실제 파일이 아닌 모의 데이터입니다. NEIS ${neis.length}건, 신고서 ${records.length}장 / ${doc.numPages}쪽`;
    clearDetail();
    renderWarnings(errors);
    recompute();
    $('resultSec').classList.remove('hidden');
    $('exportBtn').disabled = false;
    showInputs(false);
  });
})();
