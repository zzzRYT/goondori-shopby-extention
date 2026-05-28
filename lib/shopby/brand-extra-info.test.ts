import { describe, expect, it } from 'vitest';
import type { ShowcaseBrand } from './api/types';
import { parseBrandSlots } from './brand-extra-info';

function brand(brandNo: number, extraInfo: string): ShowcaseBrand {
  return { brandNo, name: `브랜드${brandNo}`, extraInfo, imageUrl: '' };
}

describe('parseBrandSlots', () => {
  it('prod 토글이면 c_<n>만 추출하고 슬롯 ASC로 정렬한다', () => {
    const result = parseBrandSlots(
      [brand(1, 'c_3'), brand(2, 'c_1'), brand(3, 'ct_2'), brand(4, 'c_2')],
      'prod',
    );

    expect(result.map((r) => ({ slot: r.slot, brandNo: r.brand.brandNo }))).toEqual([
      { slot: 1, brandNo: 2 },
      { slot: 2, brandNo: 4 },
      { slot: 3, brandNo: 1 },
    ]);
  });

  it('dev 토글이면 ct_<n>만 추출한다', () => {
    const result = parseBrandSlots([brand(1, 'c_1'), brand(2, 'ct_1 ct_3'), brand(3, 'ct_2')], 'dev');

    expect(result.map((r) => ({ slot: r.slot, brandNo: r.brand.brandNo }))).toEqual([
      { slot: 1, brandNo: 2 },
      { slot: 2, brandNo: 3 },
      { slot: 3, brandNo: 2 },
    ]);
  });

  it('단어 경계 — c_1은 c_10·accounting_c_1과 분리된다', () => {
    const result = parseBrandSlots([brand(1, 'accounting_c_1, c_10'), brand(2, 'c_1')], 'prod');

    expect(result.map((r) => ({ slot: r.slot, brandNo: r.brand.brandNo }))).toEqual([
      { slot: 1, brandNo: 2 },
      { slot: 10, brandNo: 1 },
    ]);
  });

  it('한 브랜드 같은 토큰 중복은 한 번만 등장한다', () => {
    const result = parseBrandSlots([brand(1, 'c_1, c_1')], 'prod');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ slot: 1, brand: { brandNo: 1 } });
  });

  it('다른 브랜드의 동일 슬롯은 둘 다 등장한다(충돌)', () => {
    const result = parseBrandSlots([brand(1, 'c_1'), brand(2, 'c_1')], 'prod');

    expect(result.map((r) => r.brand.brandNo)).toEqual([1, 2]);
    expect(result.every((r) => r.slot === 1)).toBe(true);
  });

  it('n ≤ 0이거나 토큰 매칭 0건이면 결과에서 제외한다', () => {
    const result = parseBrandSlots(
      [brand(1, 'c_0'), brand(2, 'c_-1'), brand(3, ''), brand(4, 'random text'), brand(5, 'c_2')],
      'prod',
    );

    expect(result.map((r) => r.brand.brandNo)).toEqual([5]);
  });
});
