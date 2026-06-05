import type {
  OpenBrandEditorRequest,
  OpenBrandEditorResult,
} from '../messaging';
import {
  BRAND_PAGE_BTN_SELECTOR,
  BRAND_PAGE_FIRST_SELECTOR,
  BRAND_PAGE_NEXT_SELECTOR,
  BRAND_PAGE_SELECTED_SELECTOR,
  BRAND_PAGINATION_SELECTOR,
  BRAND_TREE_CONTAINER_SELECTOR,
  BRAND_TREE_CONTENT_SELECTOR,
  BRAND_TREE_ITEM_LABEL_SELECTOR,
  EXTRA_INFO_INPUT_SELECTOR,
} from './selectors';

// 이름 없는 브랜드는 사이드바에서 "브랜드 #{brandNo}" 로 보이지만
// 관리자 트리에선 brandNo만 텍스트로 노출되는 경우가 있다. 두 후보를 모두 시도.
export function nameCandidates(request: OpenBrandEditorRequest): string[] {
  const name = request.name.trim();
  const fallback = String(request.brandNo);
  const candidates = new Set<string>();
  if (name) candidates.add(name);

  const numeric = name.match(/^브랜드\s*#?(\d+)$/);
  if (numeric) candidates.add(numeric[1]);

  candidates.add(fallback);
  return [...candidates];
}

function normalizeLabel(text: string): string {
  return text
    .replace(/[​‌‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findBrandRow(
  doc: Document | Element,
  request: OpenBrandEditorRequest,
): HTMLElement | null {
  const candidates = nameCandidates(request).map(normalizeLabel);
  const contents = doc.querySelectorAll<HTMLElement>(
    BRAND_TREE_CONTENT_SELECTOR,
  );

  for (const content of contents) {
    const text = normalizeLabel(content.textContent ?? '');
    if (!text || !candidates.includes(text)) continue;

    const label = content.closest<HTMLElement>(BRAND_TREE_ITEM_LABEL_SELECTOR);
    if (label) return label;
  }

  return null;
}

type OpenOptions = {
  maxScrollSteps?: number;
  scrollStepPx?: number;
  waitMs?: number;
  // 페이지네이션을 끝까지 넘기다 무한루프가 되지 않도록 방문 페이지 상한.
  maxPages?: number;
  // 호스트 판별을 테스트에서 주입할 수 있게 분리.
  // 기본은 doc.location.hostname 기반 isShopbyAdminHost.
  hostname?: string;
};

const DEFAULT_OPTIONS: Omit<Required<OpenOptions>, 'hostname'> = {
  maxScrollSteps: 30,
  scrollStepPx: 240,
  waitMs: 50,
  maxPages: 50,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isShopbyAdminHost(hostname: string): boolean {
  return hostname.endsWith('.shopby.co.kr') || hostname.endsWith('.e-ncp.com');
}

// 트리가 가상스크롤일 가능성에 대비해 컨테이너를 단계적으로 스크롤하며 재탐색.
async function findWithScroll(
  doc: Document,
  request: OpenBrandEditorRequest,
  opts: typeof DEFAULT_OPTIONS,
): Promise<HTMLElement | null> {
  const immediate = findBrandRow(doc, request);
  if (immediate) return immediate;

  const container = doc.querySelector<HTMLElement>(
    BRAND_TREE_CONTAINER_SELECTOR,
  );
  if (!container) return null;

  container.scrollTop = 0;
  for (let step = 0; step < opts.maxScrollSteps; step += 1) {
    const hit = findBrandRow(doc, request);
    if (hit) return hit;

    const before = container.scrollTop;
    container.scrollTop = before + opts.scrollStepPx;
    if (container.scrollTop === before) break;
    await sleep(opts.waitMs);
  }

  return findBrandRow(doc, request);
}

// tui-pagination에서 현재 선택된 페이지 번호를 읽는다. 숫자가 아니면 null.
export function readSelectedPage(pager: Element): number | null {
  const selected = pager.querySelector(BRAND_PAGE_SELECTED_SELECTOR);
  const value = Number(selected?.textContent?.trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}

// 다음 페이지로 이동할 버튼을 고른다.
// 1순위: "현재+1" 숫자 버튼 — 정확히 한 페이지씩 이동해 그룹 점프로 페이지를 건너뛸 위험이 없다.
// 2순위: tui-next 버튼 — 숫자 윈도우에 다음 페이지가 안 보일 때 사용. 마지막 페이지면
//        next가 <span ... tui-is-disabled>라 a 셀렉터에서 빠지므로 자연히 null이 된다.
export function findNextPageControl(
  pager: Element,
  current: number | null,
): HTMLElement | null {
  if (current != null) {
    const numbered = [
      ...pager.querySelectorAll<HTMLElement>(BRAND_PAGE_BTN_SELECTOR),
    ].find((btn) => Number(btn.textContent?.trim()) === current + 1);
    if (numbered) return numbered;
  }

  const next = pager.querySelector<HTMLElement>(BRAND_PAGE_NEXT_SELECTOR);
  if (next && !next.classList.contains('tui-is-disabled')) return next;

  return null;
}

// 페이지 전환은 비동기 재렌더라 클릭 직후엔 이전 페이지가 보인다.
// 선택된 페이지 번호가 바뀔 때까지 짧게 폴링한다.
async function waitForPageChange(
  doc: Document,
  prevPage: number | null,
  opts: typeof DEFAULT_OPTIONS,
): Promise<boolean> {
  for (let step = 0; step < opts.maxScrollSteps; step += 1) {
    await sleep(opts.waitMs);
    const pager = doc.querySelector(BRAND_PAGINATION_SELECTOR);
    if (!pager) continue;
    const now = readSelectedPage(pager);
    if (now != null && now !== prevPage) return true;
  }
  return false;
}

// 이미 첫 페이지가 아니면 첫 페이지로 되돌려 1→2→3 순서로 빠짐없이 스캔할 수 있게 한다.
// 첫 페이지면 first 컨트롤이 비활성(span)이라 셀렉터에서 빠져 no-op.
async function gotoFirstPage(
  doc: Document,
  opts: typeof DEFAULT_OPTIONS,
): Promise<void> {
  const pager = doc.querySelector(BRAND_PAGINATION_SELECTOR);
  if (!pager) return;

  const first = pager.querySelector<HTMLElement>(BRAND_PAGE_FIRST_SELECTOR);
  if (!first || first.classList.contains('tui-is-disabled')) return;

  const prev = readSelectedPage(pager);
  first.click();
  await waitForPageChange(doc, prev, opts);
}

// 페이지네이션을 1페이지부터 끝까지 넘기며 각 페이지에서 브랜드 row를 탐색한다.
// 페이저가 없으면(브랜드가 적어 한 페이지) 단일 페이지 탐색과 동일하게 동작한다.
async function findAcrossPages(
  doc: Document,
  request: OpenBrandEditorRequest,
  opts: typeof DEFAULT_OPTIONS,
): Promise<HTMLElement | null> {
  await gotoFirstPage(doc, opts);

  for (let visited = 0; visited < opts.maxPages; visited += 1) {
    const hit = await findWithScroll(doc, request, opts);
    if (hit) return hit;

    const pager = doc.querySelector(BRAND_PAGINATION_SELECTOR);
    if (!pager) return null;

    const current = readSelectedPage(pager);
    const control = findNextPageControl(pager, current);
    if (!control) return null;

    control.click();
    const moved = await waitForPageChange(doc, current, opts);
    if (!moved) return null;
  }

  return null;
}

// extraInfo input이 나타날 때까지 짧게 대기 후, 편집 섹션("브랜드 기본 설정")이
// 화면에 보이도록 input을 뷰포트 중앙으로 스크롤하고 focus한다.
// 좌측 트리(브랜드 목록)는 건드리지 않는다 — 목록이 멋대로 움직이면 안 되므로
// label.scrollIntoView는 호출하지 않고, 우측 입력 영역만 스크롤한다.
// scrollIntoView 후 focus가 다시 스크롤을 유발하지 않도록 preventScroll을 준다.
async function focusExtraInfoSoon(
  doc: Document,
  opts: typeof DEFAULT_OPTIONS,
): Promise<void> {
  for (let step = 0; step < opts.maxScrollSteps; step += 1) {
    const input = doc.querySelector<HTMLInputElement>(
      EXTRA_INFO_INPUT_SELECTOR,
    );
    if (input) {
      input.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      input.focus({ preventScroll: true });
      return;
    }
    await sleep(opts.waitMs);
  }
}

// 사이드바 row 클릭 핸들러의 본체. 관리자 페이지 내부에서:
// 1) 트리에서 일치하는 row 찾기 (필요하면 컨테이너 스크롤로 탐색)
// 2) 라벨 클릭 → SPA가 편집 폼으로 전환
// 3) 새 input 등장하면 편집 섹션을 화면에 보이도록 스크롤 + focus
export async function openBrandEditor(
  doc: Document,
  request: OpenBrandEditorRequest,
  options: OpenOptions = {},
): Promise<OpenBrandEditorResult> {
  const hostname = options.hostname ?? doc.location.hostname;
  if (!isShopbyAdminHost(hostname)) {
    return { status: 'wrong-host', message: '어드민 페이지에서 열어주세요' };
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const label = await findAcrossPages(doc, request, opts);
  if (!label) {
    return {
      status: 'not-found',
      message: '',
    };
  }

  label.click();
  await focusExtraInfoSoon(doc, opts);

  return { status: 'opened' };
}
