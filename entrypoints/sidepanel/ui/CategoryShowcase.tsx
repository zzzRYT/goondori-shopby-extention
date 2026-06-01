import { useMemo, useState } from 'react';
import { sendMessage } from '../../../lib/messaging';
import { fetchDisplayCategories } from '../../../lib/shopby/api/categories';
import type { DisplayCategoryEntry } from '../../../lib/shopby/api/types';
import { filterTopCategoriesByEnv } from '../../../lib/shopby/display-categories';
import type { Env } from '../../../lib/display-id/types';
import { useRemoteList } from '../hooks/useRemoteList';
import { CategoryList } from './CategoryList';
import { CategoryPreview } from './CategoryPreview';
import { CategoryReorder } from './CategoryReorder';

const ENV_LABEL: Record<Env, string> = { c: '운영(c)', ct: '개발(ct)' };

// 전시카테고리 탭 컨테이너. 한 번 받은 트리를 env(c/ct) 토글로 즉시 재계산하고,
// row 클릭 시 현재 탭(콘텐츠 스크립트)으로 openCategoryEditor 메시지를 보낸다.
export function CategoryShowcase() {
  const { items, status, error, reload } = useRemoteList(fetchDisplayCategories);
  const [env, setEnv] = useState<Env>('c');
  const [selectedNo, setSelectedNo] = useState<number | null>(null);

  const tops = useMemo(() => filterTopCategoriesByEnv(items, env), [items, env]);

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

      {status === 'loading' && (
        <div className="category-showcase__skeleton" data-testid="category-showcase-skeleton" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="category-showcase__skeleton-row" />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="category-showcase__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={reload}>
            다시 시도
          </button>
        </div>
      )}

      {status === 'ready' && tops.length === 0 && (
        <p className="category-showcase__empty">
          {ENV_LABEL[env]} 환경에 코드 설정된 상위 카테고리가 없습니다. shopby 어드민 전시카테고리의 상위 관리코드에 c_1, c_2…(또는 ct_1, ct_2…) 를 입력해 주세요.
        </p>
      )}

      {status === 'ready' && tops.length > 0 && (
        <>
          <CategoryPreview
            tops={tops}
            selectedNo={selectedNo}
            onSelect={setSelectedNo}
            onOpen={handleOpen}
          />
          <CategoryReorder env={env} tops={tops} onApplied={reload} />
          <CategoryList tops={tops} onOpen={handleOpen} />
        </>
      )}
    </section>
  );
}
