import type { ValidationIssue } from './validators';

type ValidationToastProps = {
  issues: readonly ValidationIssue[];
  onClose: () => void;
};

const HIGHLIGHT_MS = 1800;

// 클릭한 항목의 focusTarget을 해석해 스크롤·포커스·강조를 수행.
// 어드민 SPA가 재렌더해 노드가 사라졌을 가능성을 isConnected로 방어.
function locate(target: HTMLElement | null) {
  if (!target || !target.isConnected) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // smooth scroll과 충돌하지 않도록 preventScroll로 포커스만.
  if (typeof target.focus === 'function') {
    target.focus({ preventScroll: true });
  }

  // 시각 강조: 1.8초 후 원복. 인라인 스타일 임시 토글로 어드민 CSS와 부딪히지 않게.
  const previousOutline = target.style.outline;
  const previousOffset = target.style.outlineOffset;
  target.style.outline = '3px solid #f04438';
  target.style.outlineOffset = '2px';
  setTimeout(() => {
    target.style.outline = previousOutline;
    target.style.outlineOffset = previousOffset;
  }, HIGHLIGHT_MS);
}

// 검증 버튼 클릭 후 화면 상단에 잠시 뜨는 결과 토스트.
// 통과(pass) / 실패(fail) 두 상태. 실패 항목은 클릭하면 해당 필드로 점프한다.
export function ValidationToast({ issues, onClose }: ValidationToastProps) {
  const passed = issues.length === 0;

  return (
    <div className="validation-toast" data-state={passed ? 'pass' : 'fail'} role={passed ? 'status' : 'alert'}>
      <header className="validation-toast__header">
        <span className="validation-toast__title">
          {passed ? '✅ 검증 통과 — 문제 없음' : `⚠️ 검증 결과 — ${issues.length}개 항목`}
        </span>
        <button type="button" className="validation-toast__close" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </header>
      {!passed && (
        <ul className="validation-toast__list">
          {issues.map((issue, index) => (
            <li key={index} className="validation-toast__row">
              <button
                type="button"
                className="validation-toast__item"
                onClick={() => locate(issue.focusTarget?.() ?? null)}
                title="클릭하면 해당 필드로 이동합니다"
              >
                <span className="validation-toast__body">
                  <strong className="validation-toast__field">{issue.field}:</strong>{' '}
                  <span className="validation-toast__reason">{issue.reason}</span>
                </span>
                <span className="validation-toast__locate" aria-hidden="true">
                  ↗
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!passed && (
        <p className="validation-toast__footer">항목을 클릭하면 해당 필드로 이동합니다.</p>
      )}
    </div>
  );
}
