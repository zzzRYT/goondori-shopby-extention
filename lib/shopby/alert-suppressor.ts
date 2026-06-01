// 저장 후 뜨는 네이티브 window.alert/confirm(회색 박스)을 자동 처리하기 위한 모듈.
//
// 어드민 편집 폼은 enterprise-remote iframe의 MAIN world에서 돌고, 콘텐츠 스크립트는
// isolated world라 네이티브 다이얼로그를 DOM으로 닫을 수 없다(게다가 네이티브 alert은
// JS 스레드를 막는다). 그래서 MAIN world에서 alert/confirm을 미리 래핑해 둔다.
//
// 두 월드는 JS 객체를 공유하지 않으므로, 제어/캡처는 공유 DOM(documentElement.dataset)
// 의 "문자열"로만 주고받는다. installAlertSuppressor()만 MAIN world에서 실행하고,
// set/read 헬퍼는 isolated world(실행 엔진)에서 호출한다.

const FLAG_ATTR = 'data-gnd-auto-confirm'; // 'on'이면 자동 처리 모드
const SEQ_ATTR = 'data-gnd-alert-seq'; // 캡처 횟수(새 메시지 감지용)
const MESSAGE_ATTR = 'data-gnd-alert-message'; // 마지막 캡처 메시지

function isSuppressing(doc: Document): boolean {
  return doc.documentElement.getAttribute(FLAG_ATTR) === 'on';
}

function capture(doc: Document, message: string): void {
  const root = doc.documentElement;
  const next = Number(root.getAttribute(SEQ_ATTR) ?? '0') + 1;
  root.setAttribute(SEQ_ATTR, String(next));
  root.setAttribute(MESSAGE_ATTR, message);
}

// MAIN world에서 1회 실행: alert/confirm을 래핑한다(멱등).
export function installAlertSuppressor(win: Window): void {
  const w = win as Window & { __gndAlertPatched?: boolean };
  if (w.__gndAlertPatched) return;
  w.__gndAlertPatched = true;

  const doc = win.document;
  const originalAlert = win.alert?.bind(win);
  const originalConfirm = win.confirm?.bind(win);

  win.alert = (message?: unknown): void => {
    if (isSuppressing(doc)) {
      capture(doc, String(message ?? ''));
      return;
    }
    originalAlert?.(message as string);
  };

  win.confirm = (message?: unknown): boolean => {
    if (isSuppressing(doc)) {
      capture(doc, String(message ?? ''));
      return true;
    }
    return originalConfirm ? originalConfirm(message as string) : false;
  };
}

// --- isolated world(실행 엔진)에서 쓰는 공유 DOM 헬퍼 ---

export function setAutoConfirm(doc: Document, on: boolean): void {
  if (on) doc.documentElement.setAttribute(FLAG_ATTR, 'on');
  else doc.documentElement.removeAttribute(FLAG_ATTR);
}

export function readAlertSeq(doc: Document): number {
  return Number(doc.documentElement.getAttribute(SEQ_ATTR) ?? '0');
}

export function readAlertMessage(doc: Document): string {
  return doc.documentElement.getAttribute(MESSAGE_ATTR) ?? '';
}
