import { useCallback, useState } from 'react';
import { sendMessage, type OpenBrandEditorResult } from '../../../lib/messaging';
import type { BrandEnv, BrandRow } from '../../../lib/shopby/brand-extra-info';

type BrandShowcaseListProps = {
  rows: BrandRow[];
  env: BrandEnv;
};

type RowFeedback = {
  key: string;
  status: OpenBrandEditorResult['status'];
  message?: string;
};

// 카루셀(preview) 아래 리스트. 전시중(슬롯 지정) 브랜드뿐 아니라 미설정 브랜드도
// 받을 수 있어 slot이 null일 수 있다. row 클릭 시 관리자 탭의 브랜드 트리에서 해당
// 브랜드를 자동 선택해 extraInfo 편집 필드로 바로 이동시킨다.
export function BrandShowcaseList({ rows, env }: BrandShowcaseListProps) {
  const tokenPrefix = env === 'prod' ? 'c' : 'ct';

  // 충돌(동일 슬롯 다중 지정)은 슬롯이 있는 행끼리만 집계한다.
  const slotCount = new Map<number, number>();
  for (const row of rows) {
    if (row.slot !== null) slotCount.set(row.slot, (slotCount.get(row.slot) ?? 0) + 1);
  }

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<RowFeedback | null>(null);

  const handleOpen = useCallback(async (rowKey: string, brand: BrandRow['brand']) => {
    setPendingKey(rowKey);
    setFeedback(null);
    try {
      const result = await sendMessage('openBrandEditor', { name: brand.name, brandNo: brand.brandNo });
      setFeedback({ key: rowKey, status: result.status, message: result.message });
    } catch (error) {
      setFeedback({
        key: rowKey,
        status: 'wrong-host',
        message: error instanceof Error ? error.message : '관리자 탭과 통신할 수 없어요',
      });
    } finally {
      setPendingKey(null);
    }
  }, []);

  return (
    <ol className="brand-list" aria-label="브랜드 리스트">
      {rows.map((row, index) => {
        const { slot, brand } = row;
        const conflict = slot !== null && (slotCount.get(slot) ?? 0) > 1;
        const slotLabel = slot === null ? '미설정' : `${tokenPrefix}_${slot}`;
        const rowKey = `${slot ?? 'x'}-${brand.brandNo}-${index}`;
        const isPending = pendingKey === rowKey;
        const rowFeedback = feedback?.key === rowKey ? feedback : null;
        const failed = rowFeedback?.status === 'not-found' || rowFeedback?.status === 'wrong-host';

        return (
          <li key={rowKey} className="brand-list__row-wrap">
            <button
              type="button"
              className="brand-list__row"
              data-testid="brand-list-row"
              data-conflict={conflict ? 'true' : undefined}
              data-pending={isPending ? 'true' : undefined}
              data-failed={failed ? 'true' : undefined}
              onClick={() => handleOpen(rowKey, brand)}
              disabled={isPending}
              aria-label={`${brand.name} 편집 페이지로 이동`}
            >
              <span
                className="brand-list__slot"
                data-unset={slot === null ? 'true' : undefined}
                aria-label={slot === null ? '슬롯 미설정' : `노출 슬롯 ${slot}`}
              >
                {slotLabel}
              </span>
              <span className="brand-list__thumb">
                {brand.imageUrl ? (
                  <img src={brand.imageUrl} alt="" width={32} height={32} loading="lazy" />
                ) : (
                  <span className="brand-list__thumb-placeholder" aria-hidden="true" />
                )}
              </span>
              <span className="brand-list__name" title={brand.name}>
                {brand.name}
              </span>
              <span className="brand-list__no" aria-label={`브랜드 번호 ${brand.brandNo}`}>
                #{brand.brandNo}
              </span>
              {conflict && (
                <span
                  className="brand-list__conflict"
                  aria-label="동일 슬롯 충돌"
                  title="동일 슬롯에 여러 브랜드가 지정됨"
                >
                  ⚠
                </span>
              )}
            </button>
            {failed && rowFeedback?.message && (
              <p className="brand-list__hint" role="status">
                {rowFeedback.message}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
