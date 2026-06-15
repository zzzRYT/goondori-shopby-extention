import { evaluate, type Rule, type Violation } from './rules';
import type {
  CollectScreeningListResult,
  ScreeningChange,
  ScreeningPopupResult,
  ScreeningRow,
} from './types';

export type ScreeningResult = {
  productNo: string;
  productName: string;
  kind: 'register' | 'modify';
  status: 'ok' | 'failed';
  violations: Violation[]; // register 전용 (modify는 항상 [])
  changes: ScreeningChange[]; // modify 전용 (register는 항상 [])
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

// 상품별 팝업 탭을 동시에 여는 최대 개수. 4를 넘기면 크롬의 백그라운드 탭
// 스로틀링으로 렌더가 느려져 타임아웃 실패가 늘고, 어드민 서버 레이트리밋
// 위험도 커진다 — 속도 이득 대비 손해가 큰 구간이라 보수적으로 둔다.
export const SCAN_CONCURRENCY = 4;

// 순수 실행기: 브라우저 API는 ports로 주입받는다(테스트는 페이크 ports).
// 상품들을 SCAN_CONCURRENCY개씩 동시에 처리한다(워커 풀). 결과는 완료되는 대로
// 스트리밍되므로 목록 순서가 아니라 완료 순서로 쌓인다(표시는 위반 건수로 정렬).
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
  const rows = list.rows;
  const results: ScreeningResult[] = [];
  callbacks.onPhase?.('scanning');

  let cursor = 0;
  let done = 0;
  let sessionExpired = false; // 한 워커가 login-redirect를 감지하면 전 워커가 신규 투입을 멈춘다

  const worker = async (): Promise<void> => {
    for (;;) {
      // 다음 상품을 꺼내기 전에 멈춤 사유를 확인 — 진행 중인 건은 끝까지 두되 신규 투입만 차단.
      if (signal.cancelled || sessionExpired) return;
      const index = cursor;
      if (index >= rows.length) return;
      cursor += 1;
      const row = rows[index];

      const outcome = await scanOne(ports, row);

      // 처리 도중 다른 워커가 세션 만료를 감지했으면 이 결과는 버린다(만료 후 데이터 신뢰 불가).
      if (sessionExpired) return;
      if (outcome === 'login-redirect') {
        sessionExpired = true;
        return;
      }

      let result: ScreeningResult;
      if (outcome.status === 'not-rendered') {
        result = {
          productNo: row.productNo,
          productName: row.productName,
          kind: 'register',
          status: 'failed',
          violations: [],
          changes: [],
          failReason: '수집 실패(타임아웃)',
        };
      } else if (outcome.kind === 'register') {
        result = {
          productNo: row.productNo,
          productName: row.productName,
          kind: 'register',
          status: 'ok',
          violations: evaluate(outcome.product, rules),
          changes: [],
        };
      } else {
        result = {
          productNo: row.productNo,
          productName: row.productName,
          kind: 'modify',
          status: 'ok',
          violations: [],
          changes: outcome.changes,
        };
      }

      results.push(result);
      callbacks.onResult?.(result);
      done += 1;
      callbacks.onProgress?.(done, rows.length);
    }
  };

  const poolSize = Math.min(SCAN_CONCURRENCY, rows.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  if (sessionExpired) {
    callbacks.onPhase?.('session-expired');
    return { phase: 'session-expired', results, totalCount: list.totalCount, countMismatch };
  }
  if (signal.cancelled) {
    callbacks.onPhase?.('cancelled');
    return { phase: 'cancelled', results, totalCount: list.totalCount, countMismatch };
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
