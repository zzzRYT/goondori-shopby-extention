import { findNextPageControl, readSelectedPage } from '../brand-editor-open';
import { setFieldValue } from '../fill';
import { BRAND_PAGINATION_SELECTOR } from '../selectors';
import {
  findPageSizeSelect,
  findScreeningGrid,
  harvestVisibleRows,
  readTotalCount,
} from './list-harvest';
import type { CollectScreeningListResult, ScreeningRow } from './types';

export type CollectOptions = {
  waitMs?: number; // 폴링 간격
  settleTicks?: number; // 행 구성이 몇 틱 연속 동일하면 안정으로 볼지
  timeoutMs?: number; // 리로드/페이지 전환 대기 한도
  maxScrollSteps?: number; // 가상 스크롤 순회 상한
  maxPages?: number; // 페이지네이션 무한루프 방지 상한
};

const DEFAULTS: Required<CollectOptions> = {
  waitMs: 200,
  settleTicks: 3,
  timeoutMs: 10_000,
  maxScrollSteps: 60,
  maxPages: 50,
};

export async function collectScreeningList(
  doc: Document,
  options: CollectOptions = {},
): Promise<CollectScreeningListResult> {
  const opts = { ...DEFAULTS, ...options };

  if (!findScreeningGrid(doc)) {
    return { status: 'no-grid', rows: [], totalCount: null, pagesVisited: 0 };
  }

  await switchPageSizeTo200(doc, opts);
  const totalCount = readTotalCount(doc);

  const collected = new Map<string, ScreeningRow>();
  let pagesVisited = 0;

  for (let page = 0; page < opts.maxPages; page += 1) {
    await waitForRowsSettled(doc, opts);
    await scrollHarvest(doc, collected, opts);
    pagesVisited += 1;

    const pager = doc.querySelector(BRAND_PAGINATION_SELECTOR);
    const next = pager ? findNextPageControl(pager, readSelectedPage(pager)) : null;
    if (!next) break; // 마지막 페이지(next가 disabled span이면 null)

    const before = pager ? readSelectedPage(pager) : null;
    next.click();
    const moved = await waitForPageChange(doc, before, opts);
    if (!moved) break; // 클릭해도 페이지가 안 바뀜 — 같은 페이지 재수집 루프 방지(미달분은 count-mismatch로 표면화)
  }

  const rows = [...collected.values()];
  const status = totalCount != null && rows.length !== totalCount ? 'count-mismatch' : 'ok';
  return { status, rows, totalCount, pagesVisited };
}

async function switchPageSizeTo200(doc: Document, opts: Required<CollectOptions>) {
  const select = findPageSizeSelect(doc);
  if (!select || select.value === '200') return;

  setFieldValue(select, '200'); // React select라 native setter + change 이벤트 필요
  await sleep(opts.waitMs); // 리로드 시작 여유 — 이후 waitForRowsSettled가 안정화를 기다린다
}

// 행 구성(상품번호 시그니처)이 settleTicks 연속 동일해질 때까지 폴링.
// 리로드 중이면 시그니처가 계속 바뀌어 안정 카운트가 리셋된다.
async function waitForRowsSettled(doc: Document, opts: Required<CollectOptions>) {
  const deadline = Date.now() + opts.timeoutMs;
  let lastSignature = '';
  let stable = 0;

  while (Date.now() < deadline) {
    const signature = harvestVisibleRows(doc)
      .map((row) => row.productNo)
      .join(',');

    if (signature && signature === lastSignature) {
      stable += 1;
      if (stable >= opts.settleTicks) return;
    } else {
      stable = 0;
      lastSignature = signature;
    }
    await sleep(opts.waitMs);
  }
}

// 가상 스크롤 순회: lside 바디를 한 화면씩 내리며 보이는 행을 합친다.
// jsdom에는 스크롤 클램핑이 없어 scrollTop이 무한히 커지므로 maxScrollSteps가 상한.
async function scrollHarvest(
  doc: Document,
  collected: Map<string, ScreeningRow>,
  opts: Required<CollectOptions>,
) {
  const harvest = () => {
    for (const row of harvestVisibleRows(doc)) collected.set(row.productNo, row);
  };
  harvest();

  const container = doc.querySelector<HTMLElement>('.tui-grid-lside-area .tui-grid-body-area');
  if (!container) return;

  container.scrollTop = 0;
  const step = container.clientHeight || 400;

  for (let i = 0; i < opts.maxScrollSteps; i += 1) {
    const before = container.scrollTop;
    container.scrollTop = before + step;
    if (container.scrollTop === before) break; // 실제 브라우저: 끝까지 내려가면 클램핑
    await sleep(opts.waitMs);
    harvest();
  }
}

async function waitForPageChange(
  doc: Document,
  before: number | null,
  opts: Required<CollectOptions>,
): Promise<boolean> {
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const pager = doc.querySelector(BRAND_PAGINATION_SELECTOR);
    if (pager && readSelectedPage(pager) !== before) return true;
    await sleep(opts.waitMs);
  }
  return false; // 타임아웃 — 페이지 미전환
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
