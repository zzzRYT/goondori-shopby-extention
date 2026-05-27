import type { FillResult } from '../../../lib/messaging';

type FillReportProps = {
  result: FillResult | null;
};

export function FillReport({ result }: FillReportProps) {
  if (!result) return null;

  return (
    <section className="fill-report" aria-label="채우기 결과">
      <strong>
        채움 {result.filled.length} · 실패 {result.failed.length}
      </strong>
      {result.failed.length > 0 && (
        <ul>
          {result.failed.map((item) => (
            <li key={`${item.key}-${item.reason}`}>
              {item.key}: {item.reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
