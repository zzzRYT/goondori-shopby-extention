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
