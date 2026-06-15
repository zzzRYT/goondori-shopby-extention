import { useMemo, useState } from 'react';
import type { ScreeningResult } from '../../../lib/shopby/screening/run-scan';

type Props = { results: ScreeningResult[]; onOpen: (productNo: string) => void };
type Segment = 'all' | 'register' | 'modify';

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'register', label: '등록' },
  { value: 'modify', label: '수정' },
];

export function ScreeningResults({ results, onOpen }: Props) {
  const [violationsOnly, setViolationsOnly] = useState(true);
  const [segment, setSegment] = useState<Segment>('all');

  const visible = useMemo(() => {
    let filtered = results;
    if (segment !== 'all') filtered = filtered.filter((r) => r.kind === segment);
    if (violationsOnly) {
      // 등록은 실패/위반만, 수정은 무조건 노출(이미 검증된 상품의 변경이라 항상 검수 대상)
      filtered = filtered.filter(
        (r) => r.kind === 'modify' || r.status === 'failed' || r.violations.length > 0,
      );
    }
    return [...filtered].sort(compareResults);
  }, [results, segment, violationsOnly]);

  if (results.length === 0) return null;

  const violationCount = results.filter((r) => r.kind === 'register' && r.violations.length > 0).length;
  const modifyCount = results.filter((r) => r.kind === 'modify').length;

  return (
    <div className="screening-results">
      <div className="screening-results__header">
        <p>
          등록 위반 <b>{violationCount}</b> · 수정 <b>{modifyCount}</b> · 전체 {results.length}건
        </p>
        <label>
          <input
            type="checkbox"
            checked={violationsOnly}
            onChange={(event) => setViolationsOnly(event.target.checked)}
          />
          위반만 보기
        </label>
      </div>

      <div className="screening-results__segments" role="radiogroup" aria-label="심사 종류">
        {SEGMENTS.map((s) => (
          <label key={s.value}>
            <input
              type="radio"
              name="screening-segment"
              checked={segment === s.value}
              onChange={() => setSegment(s.value)}
            />
            {s.label}
          </label>
        ))}
      </div>

      <ul className="screening-results__list">
        {visible.map((result) => (
          <li key={result.productNo}>
            <button
              type="button"
              className="screening-results__card"
              data-status={cardStatus(result)}
              onClick={() => onOpen(result.productNo)}
            >
              <span className="screening-results__title">
                {statusIcon(result)} {result.productNo} {result.productName}
                {result.kind === 'modify' && ` · 변경 ${result.changes.length}건`}
              </span>
              {result.status === 'failed' && (
                <span className="screening-results__fail">{result.failReason}</span>
              )}
              {result.violations.map((violation) => (
                <span key={violation.ruleId} className="screening-results__violation">
                  · {violation.label}: {violation.message}
                  {violation.actual && ` (현재: ${violation.actual})`}
                </span>
              ))}
              {result.changes.map((change) => (
                <span key={`${change.section}-${change.label}`} className="screening-results__change">
                  · {change.section} · {change.label}: {change.before} → {change.after}
                </span>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 전체 보기에선 수정을 위로(검증된 상품의 변경을 먼저 띄움), 같은 종류면 건수 내림차순.
function compareResults(a: ScreeningResult, b: ScreeningResult): number {
  if (a.kind !== b.kind) return a.kind === 'modify' ? -1 : 1;
  const weight = (r: ScreeningResult) => (r.kind === 'modify' ? r.changes.length : r.violations.length);
  return weight(b) - weight(a);
}

function cardStatus(result: ScreeningResult): 'failed' | 'modify' | 'violation' | 'clean' {
  if (result.status === 'failed') return 'failed';
  if (result.kind === 'modify') return 'modify';
  return result.violations.length > 0 ? 'violation' : 'clean';
}

function statusIcon(result: ScreeningResult): string {
  if (result.status === 'failed') return '✖';
  if (result.kind === 'modify') return '✎';
  return result.violations.length > 0 ? '⚠' : '✅';
}
