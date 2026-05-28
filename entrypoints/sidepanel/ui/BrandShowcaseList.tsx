import { useCallback, useState } from 'react';
import { sendMessage, type OpenBrandEditorResult } from '../../../lib/messaging';
import type { BrandEnv, SlotAssignment } from '../../../lib/shopby/brand-extra-info';

type BrandShowcaseListProps = {
  assignments: SlotAssignment[];
  env: BrandEnv;
};

type RowFeedback = {
  key: string;
  status: OpenBrandEditorResult['status'];
  message?: string;
};

// 카루셀(preview) 아래 노출 순서를 확정적으로 보여주는 리스트.
// row 클릭 시 관리자 탭의 브랜드 트리에서 해당 브랜드를 자동 선택해
// extraInfo 편집 필드로 바로 이동시킨다.
export function BrandShowcaseList({ assignments, env }: BrandShowcaseListProps) {
  const tokenPrefix = env === 'prod' ? 'c' : 'ct';

  const slotCount = new Map<number, number>();
  for (const a of assignments) slotCount.set(a.slot, (slotCount.get(a.slot) ?? 0) + 1);

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<RowFeedback | null>(null);

  const handleOpen = useCallback(async (rowKey: string, brand: SlotAssignment['brand']) => {
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
    <ol className="brand-list" aria-label="노출 순서 리스트">
      {assignments.map((assignment, index) => {
        const { slot, brand } = assignment;
        const conflict = (slotCount.get(slot) ?? 0) > 1;
        const slotLabel = `${tokenPrefix}_${slot}`;
        const rowKey = `${slot}-${brand.brandNo}-${index}`;
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
              <span className="brand-list__slot" aria-label={`노출 슬롯 ${slot}`}>
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
