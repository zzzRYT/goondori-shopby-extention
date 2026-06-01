import type { OpenCategoryEditorRequest, OpenCategoryEditorResult } from '../messaging';
import {
  DISPLAY_CATEGORY_CODE_INPUT_SELECTOR,
  DISPLAY_CATEGORY_ITEM_LABEL_SELECTOR,
  DISPLAY_CATEGORY_NAME_INPUT_SELECTOR,
  DISPLAY_CATEGORY_NAME_WRAP_SELECTOR,
  DISPLAY_CATEGORY_TREE_SELECTOR,
  DISPLAY_CATEGORY_TREE_TOOL_BUTTON_SELECTOR,
} from './selectors';

// name-wrap의 표시 이름. 실제 캡처에선 숨김 아이콘 SVG가 섞이므로 첫 <span> 텍스트를
// 우선 쓰고, span이 없으면 textContent로 폴백한다.
function wrapName(wrap: HTMLElement): string {
  const span = wrap.querySelector('span');
  return (span?.textContent ?? wrap.textContent ?? '').trim();
}

// 트리 row에서 카테고리 이름이 일치하는 name-wrap 엘리먼트를 반환한다.
// 이름은 분기별 중복 가능 → 첫 매치 사용. 관리코드 유일성 때문에 상위 식별엔 충분하고,
// 하위는 "전체 열기"로 펼친 뒤 탐색한다.
export function findCategoryRow(
  doc: Document | Element,
  request: OpenCategoryEditorRequest,
): HTMLElement | null {
  const target = request.name.trim();
  if (!target) return null;

  const wraps = doc.querySelectorAll<HTMLElement>(DISPLAY_CATEGORY_NAME_WRAP_SELECTOR);
  for (const wrap of wraps) {
    if (wrapName(wrap) === target) return wrap;
  }
  return null;
}

// 트리 상단 "전체 열기" 버튼을 찾아 클릭한다(중첩 하위까지 모두 보이게).
// 버튼이 없으면(평면/이미 펼침) 조용히 패스 — 실패로 중단하지 않는다.
function clickExpandAll(doc: Document): void {
  const buttons = doc.querySelectorAll<HTMLElement>(DISPLAY_CATEGORY_TREE_TOOL_BUTTON_SELECTOR);
  for (const button of buttons) {
    if ((button.textContent ?? '').includes('전체 열기')) {
      button.click();
      return;
    }
  }
}

type OpenOptions = { maxScrollSteps?: number; scrollStepPx?: number; waitMs?: number; hostname?: string };
const DEFAULTS: Omit<Required<OpenOptions>, 'hostname'> = { maxScrollSteps: 30, scrollStepPx: 240, waitMs: 50 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isShopbyAdminHost = (h: string) => h.endsWith('.shopby.co.kr') || h.endsWith('.e-ncp.com');

async function findWithScroll(doc: Document, request: OpenCategoryEditorRequest, opts: typeof DEFAULTS) {
  const immediate = findCategoryRow(doc, request);
  if (immediate) return immediate;

  const container = doc.querySelector<HTMLElement>(DISPLAY_CATEGORY_TREE_SELECTOR);
  if (!container) return null;

  container.scrollTop = 0;
  for (let step = 0; step < opts.maxScrollSteps; step += 1) {
    const hit = findCategoryRow(doc, request);
    if (hit) return hit;
    const before = container.scrollTop;
    container.scrollTop = before + opts.scrollStepPx;
    if (container.scrollTop === before) break;
    await sleep(opts.waitMs);
  }
  return findCategoryRow(doc, request);
}

// 클릭 후 등장하는 편집 폼 입력란을 focus. 상위는 코드 입력란, 하위는 이름 입력란 우선.
async function focusFieldSoon(doc: Document, depth: number, opts: typeof DEFAULTS) {
  const selector = depth <= 1 ? DISPLAY_CATEGORY_CODE_INPUT_SELECTOR : DISPLAY_CATEGORY_NAME_INPUT_SELECTOR;
  for (let step = 0; step < opts.maxScrollSteps; step += 1) {
    const el = doc.querySelector<HTMLInputElement>(selector);
    if (el) {
      el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
      return;
    }
    await sleep(opts.waitMs);
  }
}

export async function openCategoryEditor(
  doc: Document,
  request: OpenCategoryEditorRequest,
  options: OpenOptions = {},
): Promise<OpenCategoryEditorResult> {
  const hostname = options.hostname ?? doc.location.hostname;
  if (!isShopbyAdminHost(hostname)) {
    return { status: 'wrong-host', message: '어드민 페이지에서 열어주세요' };
  }

  const opts = { ...DEFAULTS, ...options };
  // 중첩 하위까지 보이도록 먼저 전체 펼침(있으면). 펼침 반영 시간 확보.
  clickExpandAll(doc);
  await sleep(opts.waitMs);

  const row = await findWithScroll(doc, request, opts);
  if (!row) {
    return { status: 'not-found', message: '관리자 트리에서 해당 카테고리를 찾지 못했어요' };
  }

  // 클릭 타깃은 name-wrap이 아니라 TreeV2 item-label(선택 핸들러가 붙는 곳).
  const label = row.closest<HTMLElement>(DISPLAY_CATEGORY_ITEM_LABEL_SELECTOR) ?? row;
  label.scrollIntoView?.({ block: 'center' });
  label.click();
  await focusFieldSoon(doc, request.depth, opts);
  return { status: 'opened' };
}
