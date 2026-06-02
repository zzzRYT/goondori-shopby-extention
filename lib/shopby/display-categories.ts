import type { DisplayCategoryEntry } from './api/types';
import { parseCategoryCode } from './category-code';
import type { Env } from '../display-id/types';

export type { DisplayCategoryEntry } from './api/types';

export type TopCategory = DisplayCategoryEntry & { order: number };

// 상위 카테고리를 env(c/ct) 코드 접두사로 필터하고 순번 오름차순 정렬한다.
// 코드 없는 상위(미분류)는 제외한다.
export function filterTopCategoriesByEnv(tree: DisplayCategoryEntry[], env: Env): TopCategory[] {
  const result: TopCategory[] = [];
  for (const entry of tree) {
    const code = parseCategoryCode(entry.managementCode);
    if (!code || code.env !== env) continue;
    result.push({ ...entry, order: code.order });
  }
  result.sort((a, b) => a.order - b.order);
  return result;
}

// 미분류(코드 없는) 상위 개수 — UI에 "제외 N건" 표기용.
export function countUnclassifiedTop(tree: DisplayCategoryEntry[]): number {
  return tree.filter((e) => parseCategoryCode(e.managementCode) === null).length;
}

// 리스트(브라우즈·점프)용 상태 필터.
// - displayed: 현재 env 코드(c_/ct_)가 박힌 상위. 코드 순번 오름차순(프리뷰와 동일 집합·순서).
// - unset:     현재 env 코드가 없는 상위(미분류 + 다른 env 코드). 원본(어드민) 순서 유지.
// - all:       displayed(코드순) 다음에 unset(원본순).
export type CategoryListFilter = 'displayed' | 'unset' | 'all';

export function selectTopCategoriesByStatus(
  tree: DisplayCategoryEntry[],
  env: Env,
  filter: CategoryListFilter,
): DisplayCategoryEntry[] {
  const displayed = filterTopCategoriesByEnv(tree, env);
  if (filter === 'displayed') return displayed;

  const displayedNos = new Set(displayed.map((c) => c.categoryNo));
  const unset = tree.filter((c) => !displayedNos.has(c.categoryNo));
  if (filter === 'unset') return unset;
  return [...displayed, ...unset];
}
