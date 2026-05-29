import type { OpenCategoryEditorRequest, OpenCategoryEditorResult } from '../messaging';
import {
  DISPLAY_CATEGORY_CODE_INPUT_SELECTOR,
  DISPLAY_CATEGORY_NAME_INPUT_SELECTOR,
  DISPLAY_CATEGORY_NAME_WRAP_SELECTOR,
  DISPLAY_CATEGORY_TREE_SELECTOR,
} from './selectors';

// 트리 row에서 카테고리 이름이 일치하는 name-wrap 엘리먼트를 반환한다.
// 이름은 분기별 중복 가능 → 첫 매치 사용(하위는 부모 펼침 상태에서만 보임, best-effort).
export function findCategoryRow(
  doc: Document | Element,
  request: OpenCategoryEditorRequest,
): HTMLElement | null {
  const target = request.name.trim();
  if (!target) return null;

  const wraps = doc.querySelectorAll<HTMLElement>(DISPLAY_CATEGORY_NAME_WRAP_SELECTOR);
  for (const wrap of wraps) {
    if ((wrap.textContent?.trim() ?? '') === target) return wrap;
  }
  return null;
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
  const row = await findWithScroll(doc, request, opts);
  if (!row) {
    return { status: 'not-found', message: '관리자 트리에서 해당 카테고리를 찾지 못했어요' };
  }

  row.scrollIntoView?.({ block: 'center' });
  row.click();
  await focusFieldSoon(doc, request.depth, opts);
  return { status: 'opened' };
}
