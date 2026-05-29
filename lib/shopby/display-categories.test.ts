import { describe, expect, it } from 'vitest';
import { countUnclassifiedTop, filterTopCategoriesByEnv, type DisplayCategoryEntry } from './display-categories';

const tree: DisplayCategoryEntry[] = [
  { categoryNo: 1, name: '베스트', managementCode: 'c_1', depth: 1, children: [
    { categoryNo: 11, name: '카테고리1', managementCode: '', depth: 2, children: [] },
  ] },
  { categoryNo: 2, name: '오늘의딜', managementCode: 'ct_1', depth: 1, children: [] },
  { categoryNo: 3, name: '미분류', managementCode: '', depth: 1, children: [] },
];

describe('filterTopCategoriesByEnv', () => {
  it('운영(c) 환경은 c_ 접두 상위만, order 오름차순', () => {
    const result = filterTopCategoriesByEnv(tree, 'c');
    expect(result.map((c) => c.categoryNo)).toEqual([1]);
    expect(result[0].order).toBe(1);
  });

  it('개발(ct) 환경은 ct_ 접두 상위만', () => {
    const result = filterTopCategoriesByEnv(tree, 'ct');
    expect(result.map((c) => c.categoryNo)).toEqual([2]);
  });

  it('코드 없는 상위(미분류)는 제외', () => {
    expect(filterTopCategoriesByEnv(tree, 'c').some((c) => c.categoryNo === 3)).toBe(false);
  });
});

describe('countUnclassifiedTop', () => {
  it('코드 없는 상위 개수를 센다', () => {
    expect(countUnclassifiedTop(tree)).toBe(1);
  });
});
