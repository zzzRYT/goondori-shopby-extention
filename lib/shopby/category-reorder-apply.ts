import type { ApplyCategoryReorderRequest, ApplyCategoryReorderResult } from '../messaging';
import { openCategoryEditor } from './category-editor-open';
import { readAlertMessage, readAlertSeq, setAutoConfirm } from './alert-suppressor';
import { setFieldValue } from './fill';
import {
  DISPLAY_CATEGORY_CODE_INPUT_SELECTOR,
  DISPLAY_CATEGORY_SAVE_BUTTON_SELECTOR,
} from './selectors';

type ApplyOptions = {
  hostname?: string;
  waitMs?: number;
  alertTimeoutMs?: number;
  // 캡처한 alert 메시지가 "실패/중복"인지 판별. 기본은 키워드 매칭(실제 문구 미확보 → 보수적).
  isErrorMessage?: (message: string) => boolean;
};

const DEFAULTS = { waitMs: 50, alertTimeoutMs: 4000 };

// 운영 어드민 실제 문구 미확보 상태의 잠정 기본값. 최종 수동 검증 항목.
// 중복확인("이미 사용 중", "중복") / 저장 실패("실패","오류") 양쪽을 함께 잡는다.
const ERROR_KEYWORDS = ['실패', '오류', '에러', '중복', '이미 사용', '불가', '확인해'];
const defaultIsErrorMessage = (message: string): boolean =>
  ERROR_KEYWORDS.some((kw) => message.includes(kw));

// 코드 입력 옆 "중복확인" 버튼을 찾는다. 안정 클래스가 없어 텍스트로 식별하되,
// 우선 코드 입력의 행(tr/td) 안에서 찾고 없으면 문서 전역에서 폴백.
function findDupCheckButton(doc: Document, codeInput: HTMLElement): HTMLElement | null {
  const scope = codeInput.closest('tr') ?? codeInput.closest('td') ?? doc;
  const inScope = matchButtonByText(scope, '중복확인');
  return inScope ?? matchButtonByText(doc, '중복확인');
}

function matchButtonByText(root: ParentNode, text: string): HTMLElement | null {
  for (const button of root.querySelectorAll<HTMLElement>('button')) {
    if ((button.textContent ?? '').replace(/\s/g, '').includes(text)) return button;
  }
  return null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isShopbyAdminHost = (h: string) => h.endsWith('.shopby.co.kr') || h.endsWith('.e-ncp.com');

// 저장 클릭 후 새 alert/confirm 캡처(seq 증가)를 기다린다. 타임아웃이면 null.
async function waitForAlert(
  doc: Document,
  seqBefore: number,
  waitMs: number,
  timeoutMs: number,
): Promise<string | null> {
  const steps = Math.max(1, Math.ceil(timeoutMs / waitMs));
  for (let i = 0; i < steps; i += 1) {
    if (readAlertSeq(doc) > seqBefore) return readAlertMessage(doc);
    await sleep(waitMs);
  }
  return null;
}

// 코드 입력란이 나타날 때까지 짧게 폴링.
async function pollCodeInput(doc: Document, waitMs: number): Promise<HTMLInputElement | null> {
  for (let i = 0; i < 30; i += 1) {
    const el = doc.querySelector<HTMLInputElement>(DISPLAY_CATEGORY_CODE_INPUT_SELECTOR);
    if (el) return el;
    await sleep(waitMs);
  }
  return null;
}

// 순서 변경 시퀀스를 어드민 폼에 단계별로 적용한다.
// 각 단계: 카테고리 편집 열기 → 코드 입력 → 저장 클릭 → alert 자동통과·결과 판별.
// 실패 시 즉시 중단하고 어디까지 적용됐는지 보고한다(롤백 없음; 시퀀스는 중간 지점도
// 코드 중복 없는 일관 상태를 보장한다).
export async function applyCategoryReorder(
  doc: Document,
  request: ApplyCategoryReorderRequest,
  options: ApplyOptions = {},
): Promise<ApplyCategoryReorderResult> {
  const hostname = options.hostname ?? doc.location.hostname;
  if (!isShopbyAdminHost(hostname)) {
    return { status: 'wrong-host', applied: 0 };
  }

  const waitMs = options.waitMs ?? DEFAULTS.waitMs;
  const alertTimeoutMs = options.alertTimeoutMs ?? DEFAULTS.alertTimeoutMs;
  const isErrorMessage = options.isErrorMessage ?? defaultIsErrorMessage;

  let applied = 0;
  setAutoConfirm(doc, true);
  try {
    for (let index = 0; index < request.steps.length; index += 1) {
      const step = request.steps[index];
      const abort = (reason: string): ApplyCategoryReorderResult => ({
        status: applied > 0 ? 'partial' : 'aborted',
        applied,
        failedAt: { index, name: step.name, reason },
      });

      // 순서 변경 대상은 상위(depth 1)만.
      const open = await openCategoryEditor(
        doc,
        { name: step.name, categoryNo: step.categoryNo, depth: 1 },
        { hostname, waitMs },
      );
      if (open.status === 'wrong-host') return { status: 'wrong-host', applied };
      if (open.status !== 'opened') return abort(open.message ?? '카테고리를 찾지 못했어요');

      const codeInput = await pollCodeInput(doc, waitMs);
      if (!codeInput) return abort('코드 입력란을 찾지 못했어요');
      setFieldValue(codeInput, step.newCode);

      // 중복확인이 저장의 필수 게이트다. 코드를 넣은 뒤 눌러 alert로 결과를 확인하고,
      // "중복" 등 에러면 저장하지 않고 중단(임시코드 로직상 정상이면 거의 발생 안 함).
      const dupButton = findDupCheckButton(doc, codeInput);
      if (dupButton) {
        const seqDup = readAlertSeq(doc);
        dupButton.click();
        const dupMessage = await waitForAlert(doc, seqDup, waitMs, alertTimeoutMs);
        if (dupMessage !== null && isErrorMessage(dupMessage)) {
          return abort(`중복확인 실패: ${dupMessage}`);
        }
      }

      const saveButton = doc.querySelector<HTMLElement>(DISPLAY_CATEGORY_SAVE_BUTTON_SELECTOR);
      if (!saveButton) return abort('저장 버튼을 찾지 못했어요');

      const seqBefore = readAlertSeq(doc);
      saveButton.click();
      const message = await waitForAlert(doc, seqBefore, waitMs, alertTimeoutMs);
      if (message !== null && isErrorMessage(message)) return abort(message);

      applied += 1;
    }
    return { status: 'done', applied };
  } finally {
    setAutoConfirm(doc, false);
  }
}
