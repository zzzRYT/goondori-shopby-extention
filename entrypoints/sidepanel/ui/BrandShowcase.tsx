import { useMemo, useState } from 'react';
import { fetchShowcaseBrands } from '../../../lib/shopby/api/brands-showcase';
import {
  parseBrandSlots,
  selectBrandRowsByStatus,
  type BrandEnv,
  type BrandListFilter,
} from '../../../lib/shopby/brand-extra-info';
import { useRemoteList } from '../hooks/useRemoteList';
import { BrandShowcaseCarousel } from './BrandShowcaseCarousel';
import { BrandShowcaseList } from './BrandShowcaseList';
import { EnvToggle } from './EnvToggle';
import { Loading } from './Loading';

const ENV_LABEL: Record<BrandEnv, string> = { prod: '운영(prod)', dev: '개발(dev)' };

// 브랜드 탭 컨테이너. 한 번 받은 ShowcaseBrand[]를 env 토글에 따라 즉시 재계산한다.
// 카루셀은 전시중(슬롯 지정) 브랜드만, 아래 리스트는 상태 필터로 미설정·전체까지
// 확장해 어드민 스크롤 없이 기존 브랜드로 바로 점프하게 한다. 브랜드 수가 많아
// 리스트엔 이름 검색을 둔다.
export function BrandShowcase() {
  const { items, status, error, reload } = useRemoteList(fetchShowcaseBrands);
  const [env, setEnv] = useState<BrandEnv>('prod');
  const [listFilter, setListFilter] = useState<BrandListFilter>('displayed');
  const [query, setQuery] = useState('');

  const assignments = useMemo(() => parseBrandSlots(items, env), [items, env]);
  const displayedRows = useMemo(
    () => selectBrandRowsByStatus(items, env, 'displayed'),
    [items, env],
  );
  const unsetRows = useMemo(() => selectBrandRowsByStatus(items, env, 'unset'), [items, env]);

  const baseRows =
    listFilter === 'displayed'
      ? displayedRows
      : listFilter === 'unset'
        ? unsetRows
        : [...displayedRows, ...unsetRows];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter((row) => row.brand.name.toLowerCase().includes(q));
  }, [baseRows, query]);

  const displayedCount = displayedRows.length;
  const unsetCount = unsetRows.length;
  const totalCount = displayedCount + unsetCount;

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

      {status === 'ready' && (
        <>
          {assignments.length > 0 && (
            <>
              <p className="brand-showcase__count">
                {ENV_LABEL[env]} 환경에 노출 설정된 브랜드 ({assignments.length})
              </p>
              <BrandShowcaseCarousel assignments={assignments} env={env} />
            </>
          )}

          <div
            className="segmented segmented--three brand-showcase__filter"
            role="group"
            aria-label="브랜드 상태 필터"
          >
            <button
              type="button"
              className="segmented__button"
              data-active={listFilter === 'displayed'}
              onClick={() => setListFilter('displayed')}
            >
              전시중 {displayedCount}
            </button>
            <button
              type="button"
              className="segmented__button"
              data-active={listFilter === 'unset'}
              onClick={() => setListFilter('unset')}
            >
              미설정 {unsetCount}
            </button>
            <button
              type="button"
              className="segmented__button"
              data-active={listFilter === 'all'}
              onClick={() => setListFilter('all')}
            >
              전체 {totalCount}
            </button>
          </div>

          <input
            type="search"
            className="brand-showcase__search"
            placeholder="브랜드명 검색"
            aria-label="브랜드명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {rows.length > 0 ? (
            <BrandShowcaseList rows={rows} env={env} />
          ) : listFilter === 'displayed' && !query.trim() ? (
            <p className="brand-showcase__empty">
              {ENV_LABEL[env]} 환경에 노출 설정된 브랜드가 없습니다. shopby 어드민의 브랜드 추가 설명에 c_1, c_2…(또는 ct_1, ct_2…) 를 입력해 주세요. "전체"로 전환하면 코드 없는 브랜드도 골라 바로 이동할 수 있어요.
            </p>
          ) : (
            <p className="brand-showcase__empty">검색·필터에 맞는 브랜드가 없습니다.</p>
          )}
        </>
      )}
    </section>
  );
}
