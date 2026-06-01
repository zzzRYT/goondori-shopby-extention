import { useMemo, useState } from 'react';
import { fetchShowcaseBrands } from '../../../lib/shopby/api/brands-showcase';
import { parseBrandSlots, type BrandEnv } from '../../../lib/shopby/brand-extra-info';
import { useRemoteList } from '../hooks/useRemoteList';
import { BrandShowcaseCarousel } from './BrandShowcaseCarousel';
import { BrandShowcaseList } from './BrandShowcaseList';
import { EnvToggle } from './EnvToggle';
import { Loading } from './Loading';

const ENV_LABEL: Record<BrandEnv, string> = { prod: '운영(prod)', dev: '개발(dev)' };

// 브랜드 탭 컨테이너. 한 번 받은 ShowcaseBrand[]를 env 토글에 따라 즉시 재계산한다.
export function BrandShowcase() {
  const { items, status, error, reload } = useRemoteList(fetchShowcaseBrands);
  const [env, setEnv] = useState<BrandEnv>('prod');

  const assignments = useMemo(() => parseBrandSlots(items, env), [items, env]);

  return (
    <section className="brand-showcase" aria-label="브랜드 진열 미리보기">
      <header className="brand-showcase__header">
        <EnvToggle value={env} onChange={setEnv} />
        <button
          type="button"
          className="brand-showcase__reload"
          onClick={reload}
          disabled={status === 'loading'}
        >
          ↻ 새로고침
        </button>
      </header>

      {status === 'loading' && <Loading testId="brand-showcase-loading" />}

      {status === 'error' && (
        <div className="brand-showcase__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={reload}>
            다시 시도
          </button>
        </div>
      )}

      {status === 'ready' && assignments.length === 0 && (
        <p className="brand-showcase__empty">
          {ENV_LABEL[env]} 환경에 노출 설정된 브랜드가 없습니다. shopby 어드민의 브랜드 추가 설명에 c_1, c_2…(또는 ct_1, ct_2…) 를 입력해 주세요.
        </p>
      )}

      {status === 'ready' && assignments.length > 0 && (
        <>
          <p className="brand-showcase__count">
            {ENV_LABEL[env]} 환경에 노출 설정된 브랜드 ({assignments.length})
          </p>
          <BrandShowcaseCarousel assignments={assignments} env={env} />
          <BrandShowcaseList assignments={assignments} env={env} />
        </>
      )}
    </section>
  );
}
