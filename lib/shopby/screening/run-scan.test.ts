import { describe, expect, it, vi } from 'vitest';
import { runScan, type ScanPorts, type ScreeningResult } from './run-scan';
import type {
  CollectScreeningListResult,
  ParsedScreeningProduct,
  ScreeningPopupResult,
} from './types';
import type { Rule } from './rules';

const PRODUCT: ParsedScreeningProduct = {
  fields: { 기본정보: { 제조사명: '' }, 판매정보: {}, 배송정보: {} },
  images: { main: [], list: [], detail: [] },
};

const RULES: Rule[] = [
  { id: 'r1', type: 'required', section: '기본정보', field: '제조사명', enabled: true },
];

function list(rows: string[], status: CollectScreeningListResult['status'] = 'ok'): CollectScreeningListResult {
  return {
    status,
    rows: rows.map((productNo) => ({ productNo, productName: `상품${productNo}` })),
    totalCount: rows.length,
    pagesVisited: 1,
  };
}

function makePorts(overrides: Partial<ScanPorts> = {}): ScanPorts & { closed: number[] } {
  const closed: number[] = [];
  let nextTabId = 100;
  return {
    closed,
    collectList: vi.fn(async () => list(['1', '2'])),
    openPopup: vi.fn(async () => nextTabId++),
    parsePopup: vi.fn(async (): Promise<ScreeningPopupResult> => ({ status: 'ok', product: PRODUCT })),
    closePopup: vi.fn(async (tabId: number) => {
      closed.push(tabId);
    }),
    ...overrides,
  };
}

describe('runScan', () => {
  it('수집 → 상품별 파싱 → 규칙 평가 결과를 스트리밍한다', async () => {
    const ports = makePorts();
    const streamed: ScreeningResult[] = [];
    const progress: Array<[number, number]> = [];

    const summary = await runScan(ports, RULES, {
      onResult: (result) => streamed.push(result),
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(summary.phase).toBe('done');
    expect(summary.results).toHaveLength(2);
    expect(summary.results[0].violations).toHaveLength(1); // 제조사명 공란
    expect(streamed).toHaveLength(2);
    expect(progress).toEqual([[1, 2], [2, 2]]);
    expect(ports.closed).toHaveLength(2); // 열었던 탭은 항상 닫는다
  });

  it('파싱 실패는 1회 재시도 후 "수집 실패" 결과로 남긴다 (침묵 누락 금지)', async () => {
    const parsePopup = vi.fn(async (): Promise<ScreeningPopupResult> => ({ status: 'not-rendered' }));
    const ports = makePorts({ collectList: vi.fn(async () => list(['1'])), parsePopup });

    const summary = await runScan(ports, RULES);

    expect(parsePopup).toHaveBeenCalledTimes(2); // 1회 + 재시도 1회
    expect(summary.results[0].status).toBe('failed');
    expect(ports.closed).toHaveLength(2); // 시도마다 탭을 닫는다
  });

  it('login-redirect면 즉시 전체 중단(session-expired) — 연속 실패 방지', async () => {
    const ports = makePorts({
      collectList: vi.fn(async () => list(['1', '2', '3'])),
      parsePopup: vi.fn(async (): Promise<ScreeningPopupResult> => ({ status: 'login-redirect' })),
    });

    const summary = await runScan(ports, RULES);

    expect(summary.phase).toBe('session-expired');
    expect(summary.results).toHaveLength(0);
    expect(ports.openPopup).toHaveBeenCalledTimes(1); // 2·3번 상품은 시도하지 않음
  });

  it('취소 시그널이 켜지면 남은 큐를 버리고 수집된 결과는 유지한다', async () => {
    const signal = { cancelled: false };
    const ports = makePorts({
      collectList: vi.fn(async () => list(['1', '2', '3'])),
      parsePopup: vi.fn(async (): Promise<ScreeningPopupResult> => {
        signal.cancelled = true; // 첫 상품 처리 직후 취소
        return { status: 'ok', product: PRODUCT };
      }),
    });

    const summary = await runScan(ports, RULES, {}, signal);

    expect(summary.phase).toBe('cancelled');
    expect(summary.results).toHaveLength(1);
  });

  it('그리드를 못 찾으면 collect-failed', async () => {
    const ports = makePorts({
      collectList: vi.fn(async () => ({ status: 'no-grid' as const, rows: [], totalCount: null, pagesVisited: 0 })),
    });

    const summary = await runScan(ports, RULES);

    expect(summary.phase).toBe('collect-failed');
  });

  it('collectList가 거부돼도 예외 대신 collect-failed로 끝난다', async () => {
    const ports = makePorts({
      collectList: vi.fn(async () => {
        throw new Error('메시징 실패');
      }),
    });

    const summary = await runScan(ports, RULES);

    expect(summary.phase).toBe('collect-failed');
    expect(summary.results).toEqual([]);
  });

  it('count-mismatch는 요약에 전파된다', async () => {
    const ports = makePorts({ collectList: vi.fn(async () => list(['1'], 'count-mismatch')) });

    const summary = await runScan(ports, RULES);

    expect(summary.countMismatch).toBe(true);
  });
});
