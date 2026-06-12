import { screeningPopupUrl } from '../../../lib/shopby/screening/popup-url';
import { useScreeningRules } from '../hooks/useScreeningRules';
import { useScreeningScan } from '../hooks/useScreeningScan';
import { RuleSettings } from './RuleSettings';
import { ScreeningResults } from './ScreeningResults';

const PHASE_LABELS: Record<string, string> = {
  collecting: '목록 수집 중…',
  scanning: '상품 정보 수집 중…',
  done: '완료',
  cancelled: '중단됨',
  'session-expired': '세션 만료 — 어드민 재로그인 후 다시 시도해주세요',
  'collect-failed': '목록 수집 실패',
};

export function ScreeningWorkspace() {
  const { rules, save } = useScreeningRules();
  const { state, start, cancel } = useScreeningScan();
  const running = state.phase === 'collecting' || state.phase === 'scanning';

  return (
    <section className="screening" aria-label="상품심사 스캔">
      <details className="screening__settings">
        <summary>규칙 설정</summary>
        {rules ? <RuleSettings rules={rules} onChange={save} /> : <p>규칙 불러오는 중…</p>}
      </details>

      <div className="screening__controls">
        {!running ? (
          <button
            type="button"
            className="screening__start"
            disabled={!rules}
            onClick={() => rules && void start(rules)}
          >
            ▶ 스캔 시작
          </button>
        ) : (
          <button type="button" className="screening__cancel" onClick={cancel}>
            ⏸ 중단
          </button>
        )}

        {state.phase !== 'idle' && (
          <p className="screening__status" role="status">
            {PHASE_LABELS[state.phase] ?? state.phase}
            {state.total > 0 && ` · ${state.done} / ${state.total}`}
          </p>
        )}
        {state.error && <p className="screening__error">{state.error}</p>}
        {state.countMismatch && (
          <p className="screening__warning">
            수집 건수가 목록 총 건수와 달라요 — 일부 상품이 빠졌을 수 있어요. 재스캔을 권장합니다.
          </p>
        )}
      </div>

      <ScreeningResults
        results={state.results}
        onOpen={(productNo) =>
          void browser.tabs.create({ url: screeningPopupUrl(productNo), active: true })
        }
      />
    </section>
  );
}
