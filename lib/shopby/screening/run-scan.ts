import { evaluate, type Rule, type Violation } from './rules';
import type {
  CollectScreeningListResult,
  ScreeningPopupResult,
  ScreeningRow,
} from './types';

export type ScreeningResult = {
  productNo: string;
  productName: string;
  status: 'ok' | 'failed';
  violations: Violation[];
  failReason?: string;
};

export type ScanPhase =
  | 'collecting'
  | 'scanning'
  | 'done'
  | 'cancelled'
  | 'session-expired'
  | 'collect-failed';

export type ScanPorts = {
  collectList(): Promise<CollectScreeningListResult>;
  openPopup(productNo: string): Promise<number>; // 생성한 탭 ID
  parsePopup(tabId: number): Promise<ScreeningPopupResult>;
  closePopup(tabId: number): Promise<void>;
};

export type ScanCallbacks = {
  onPhase?(phase: ScanPhase): void;
  onProgress?(done: number, total: number): void;
  onResult?(result: ScreeningResult): void;
};

export type ScanSummary = {
  phase: Extract<ScanPhase, 'done' | 'cancelled' | 'session-expired' | 'collect-failed'>;
  results: ScreeningResult[];
  totalCount: number | null;
  countMismatch: boolean;
};

// 순수 실행기: 브라우저 API는 ports로 주입받는다(테스트는 페이크 ports).
export async function runScan(
  ports: ScanPorts,
  rules: Rule[],
  callbacks: ScanCallbacks = {},
  signal: { cancelled: boolean } = { cancelled: false },
): Promise<ScanSummary> {
  callbacks.onPhase?.('collecting');
  // 수집 실패(메시징 거부 포함)는 예외 전파 대신 terminal phase로 일관되게 알린다 — scanOne과 같은 원칙.
  const list = await ports.collectList().catch(() => null);

  if (list == null || list.status === 'no-grid') {
    callbacks.onPhase?.('collect-failed');
    return { phase: 'collect-failed', results: [], totalCount: null, countMismatch: false };
  }

  const countMismatch = list.status === 'count-mismatch';
  const results: ScreeningResult[] = [];
  callbacks.onPhase?.('scanning');

  for (const [index, row] of list.rows.entries()) {
    if (signal.cancelled) {
      callbacks.onPhase?.('cancelled');
      return { phase: 'cancelled', results, totalCount: list.totalCount, countMismatch };
    }

    const outcome = await scanOne(ports, row);
    if (outcome === 'login-redirect') {
      callbacks.onPhase?.('session-expired');
      return { phase: 'session-expired', results, totalCount: list.totalCount, countMismatch };
    }

    const result: ScreeningResult =
      outcome.status === 'ok'
        ? {
            productNo: row.productNo,
            productName: row.productName,
            status: 'ok',
            violations: evaluate(outcome.product, rules),
          }
        : {
            productNo: row.productNo,
            productName: row.productName,
            status: 'failed',
            violations: [],
            failReason: '수집 실패(타임아웃)',
          };

    results.push(result);
    callbacks.onResult?.(result);
    callbacks.onProgress?.(index + 1, list.rows.length);
  }

  callbacks.onPhase?.('done');
  return { phase: 'done', results, totalCount: list.totalCount, countMismatch };
}

// 1회 재시도. login-redirect는 재시도하지 않고 즉시 전파(전체 중단 사유).
// 어떤 경로든 열었던 탭은 닫는다.
async function scanOne(
  ports: ScanPorts,
  row: ScreeningRow,
): Promise<Extract<ScreeningPopupResult, { status: 'ok' }> | { status: 'not-rendered' } | 'login-redirect'> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let tabId: number | null = null;
    try {
      tabId = await ports.openPopup(row.productNo);
      const parsed = await ports.parsePopup(tabId);
      if (parsed.status === 'login-redirect') return 'login-redirect';
      if (parsed.status === 'ok') return parsed;
      // not-rendered → 재시도 루프
    } catch {
      // 탭 생성/메시지 실패 → 재시도 루프
    } finally {
      if (tabId != null) {
        await ports.closePopup(tabId).catch(() => {});
      }
    }
  }
  return { status: 'not-rendered' };
}
