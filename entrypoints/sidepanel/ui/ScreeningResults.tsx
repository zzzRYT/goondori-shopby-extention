import { useMemo, useState } from 'react';
import type { ScreeningResult } from '../../../lib/shopby/screening/run-scan';

type Props = { results: ScreeningResult[]; onOpen: (productNo: string) => void };

export function ScreeningResults({ results, onOpen }: Props) {
  const [violationsOnly, setViolationsOnly] = useState(true);

  const visible = useMemo(() => {
    const filtered = violationsOnly
      ? results.filter((result) => result.status === 'failed' || result.violations.length > 0)
      : results;
    return [...filtered].sort((a, b) => b.violations.length - a.violations.length);
  }, [results, violationsOnly]);

  if (results.length === 0) return null;

  const violationCount = results.filter((result) => result.violations.length > 0).length;

  return (
    <div className="screening-results">
      <div className="screening-results__header">
        <p>
          위반 <b>{violationCount}</b>건 / 전체 {results.length}건
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
              </span>
              {result.status === 'failed' && (
                <span className="screening-results__fail">{result.failReason}</span>
              )}
              {result.violations.map((violation, index) => (
                <span key={index} className="screening-results__violation">
                  · {violation.label}: {violation.message}
                  {violation.actual && ` (현재: ${violation.actual})`}
                </span>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cardStatus(result: ScreeningResult): 'failed' | 'violation' | 'clean' {
  if (result.status === 'failed') return 'failed';
  return result.violations.length > 0 ? 'violation' : 'clean';
}

function statusIcon(result: ScreeningResult): string {
  if (result.status === 'failed') return '✖';
  return result.violations.length > 0 ? '⚠' : '✅';
}
