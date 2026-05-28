import type { ShowcaseBrand } from './api/types';

export type BrandEnv = 'prod' | 'dev';

export type SlotAssignment = {
  slot: number;
  brand: ShowcaseBrand;
};

// 단어 경계 기반 토큰 추출. c_1과 c_10, accounting_c_1을 정확히 분리한다.
// 콤마·공백·세미콜론을 구분자로 허용.
const TOKEN_RE = /(?:^|[\s,;])(c|ct)_(\d+)(?=$|[\s,;])/g;

// extraInfo에서 환경별 슬롯 번호 집합을 추출한다. n ≤ 0은 무시.
function extractSlots(extraInfo: string, env: BrandEnv): number[] {
  if (!extraInfo) return [];
  const prefix = env === 'prod' ? 'c' : 'ct';
  const slots = new Set<number>();

  for (const match of extraInfo.matchAll(TOKEN_RE)) {
    if (match[1] !== prefix) continue;
    const slot = Number(match[2]);
    if (Number.isFinite(slot) && slot >= 1) slots.add(slot);
  }

  return [...slots];
}

// 브랜드 목록에서 현재 환경의 슬롯 할당을 추려 ASC 정렬한다.
// 동일 슬롯에 여러 브랜드가 있으면 모두 유지(충돌 표시는 UI에서 처리).
export function parseBrandSlots(brands: ShowcaseBrand[], env: BrandEnv): SlotAssignment[] {
  const assignments: SlotAssignment[] = [];

  for (const brand of brands) {
    for (const slot of extractSlots(brand.extraInfo, env)) {
      assignments.push({ slot, brand });
    }
  }

  assignments.sort((a, b) => a.slot - b.slot);
  return assignments;
}
