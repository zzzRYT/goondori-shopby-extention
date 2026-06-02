import { useMemo, useState } from 'react';
import { sendMessage } from '../../../lib/messaging';
import { fetchDisplayCategories } from '../../../lib/shopby/api/categories';
import type { DisplayCategoryEntry } from '../../../lib/shopby/api/types';
import {
  filterTopCategoriesByEnv,
  selectTopCategoriesByStatus,
  type CategoryListFilter,
} from '../../../lib/shopby/display-categories';
import type { Env } from '../../../lib/display-id/types';
import { useRemoteList } from '../hooks/useRemoteList';
import { CategoryGuide } from './CategoryGuide';
import { CategoryList } from './CategoryList';
import { CategoryPreview } from './CategoryPreview';
import { Loading } from './Loading';

const ENV_LABEL: Record<Env, string> = { c: '운영(c)', ct: '개발(ct)' };

// 전시카테고리 탭 컨테이너. 한 번 받은 트리를 env(c/ct) 토글로 즉시 재계산하고,
// row 클릭 시 현재 탭(콘텐츠 스크립트)으로 openCategoryEditor 메시지를 보낸다.
// 프리뷰는 코드 박힌(전시중) 상위만 보여주고, 아래 리스트는 상태 필터로
// 미설정·전체까지 확장해 어드민 스크롤 없이 기존 카테고리로 바로 점프하게 한다.
export function CategoryShowcase() {
  const { items, status, error, reload } = useRemoteList(fetchDisplayCategories);
  const [env, setEnv] = useState<Env>('c');
  const [listFilter, setListFilter] = useState<CategoryListFilter>('displayed');
  const [selectedNo, setSelectedNo] = useState<number | null>(null);

  // 프리뷰·"전시중" 집합. 코드 순번 정렬.
  const tops = useMemo(() => filterTopCategoriesByEnv(items, env), [items, env]);
  // 리스트 소스. 상태 필터에 따라 미설정·전체까지 포함.
  const listItems = useMemo(
    () => selectTopCategoriesByStatus(items, env, listFilter),
    [items, env, listFilter],
  );

  const displayedCount = tops.length;
  const totalCount = items.length;
  const unsetCount = totalCount - displayedCount;

  function handleOpen(entry: DisplayCategoryEntry) {
    void sendMessage('openCategoryEditor', {
      name: entry.name,
      categoryNo: entry.categoryNo,
      depth: entry.depth,
    });
  }

  return (
    <section className="category-showcase" aria-label="전시카테고리 미리보기">
      <header className="category-showcase__header">
        <div className="segmented" role="group" aria-label="전시카테고리 노출 환경">
          <button
            type="button"
            className="segmented__button"
            data-active={env === 'c'}
            onClick={() => setEnv('c')}
          >
            운영 c
          </button>
          <button
            type="button"
            className="segmented__button"
            data-active={env === 'ct'}
            onClick={() => setEnv('ct')}
          >
            테스트 ct
          </button>
        </div>
        <button
          type="button"
          className="category-showcase__reload"
          onClick={reload}
          disabled={status === 'loading'}
        >
          ↻ 새로고침
        </button>
      </header>

      <CategoryGuide />

      {status === 'loading' && <Loading testId="category-showcase-loading" />}

      {status === 'error' && (
        <div className="category-showcase__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={reload}>
            다시 시도
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {displayedCount > 0 && (
            <CategoryPreview
              tops={tops}
              selectedNo={selectedNo}
              onSelect={setSelectedNo}
              onOpen={handleOpen}
            />
          )}

          <div
            className="segmented segmented--three category-showcase__filter"
            role="group"
            aria-label="카테고리 상태 필터"
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

          {listItems.length > 0 ? (
            <CategoryList tops={listItems} onOpen={handleOpen} />
          ) : listFilter === 'displayed' ? (
            <p className="category-showcase__empty">
              {ENV_LABEL[env]} 환경에 코드 설정된 상위 카테고리가 없습니다. shopby 어드민 전시카테고리의 상위 관리코드에 c_1, c_2…(또는 ct_1, ct_2…) 를 입력해 주세요. "전체"로 전환하면 코드 없는 카테고리도 골라 바로 이동할 수 있어요.
            </p>
          ) : (
            <p className="category-showcase__empty">해당 상태의 카테고리가 없습니다.</p>
          )}
        </>
      )}
    </section>
  );
}
