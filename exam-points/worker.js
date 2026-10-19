/* 배점 탐색을 화면과 다른 스레드에서 돌린다. 계산이 길어도 입력·스크롤이 멈추지 않는다.
 * 받는 메시지: { id, opts, cfg }  →  보내는 메시지: { id, result } (solveAuto의 반환값) */
importScripts('./solver.js');

self.onmessage = e => {
  const { id, opts, cfg } = e.data;
  let result;
  try {
    result = self.ExamPoints.solveAuto(opts, cfg);
  } catch (err) {
    result = { error: '계산 중 오류가 났습니다: ' + err.message };
  }
  self.postMessage({ id, result });
};
