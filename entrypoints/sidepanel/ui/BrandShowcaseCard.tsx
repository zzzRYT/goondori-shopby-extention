import type { ShowcaseBrand } from '../../../lib/shopby/api/types';
import type { BrandEnv } from '../../../lib/shopby/brand-extra-info';

type BrandShowcaseCardProps = {
  slot: number;
  brand: ShowcaseBrand;
  env: BrandEnv;
  conflict: boolean;
};

// 브랜드 진열 카루셀의 단일 카드. read-only.
// imageUrl이 비거나 로드 실패 시 mock과 같은 회색 placeholder로 대체한다.
export function BrandShowcaseCard({ slot, brand, env, conflict }: BrandShowcaseCardProps) {
  const tokenPrefix = env === 'prod' ? 'c' : 'ct';
  const slotLabel = `${tokenPrefix}_${slot}`;

  return (
    <article className="brand-card" role="listitem">
      <div className="brand-card__thumb">
        {brand.imageUrl ? (
          <img src={brand.imageUrl} alt={brand.name} width={80} height={80} loading="lazy" />
        ) : (
          <div className="brand-card__placeholder" data-testid="brand-card-placeholder" aria-hidden="true" />
        )}
        {conflict && (
          <span className="brand-card__conflict" aria-label="동일 슬롯 충돌" title="동일 슬롯에 여러 브랜드가 지정됨">
            ⚠
          </span>
        )}
      </div>
      <p className="brand-card__name" title={brand.name}>
        {brand.name}
      </p>
      <span className="brand-card__slot" aria-label={`노출 슬롯 ${slot}`}>
        {slotLabel}
      </span>
    </article>
  );
}
