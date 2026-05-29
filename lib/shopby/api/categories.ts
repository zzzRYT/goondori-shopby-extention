import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';
import type { DisplayCategoryEntry } from './types';

type RawCategory = {
  categoryNo: number;
  depth: number;
  label?: string | null;
  managementCode?: string | null;
  children?: RawCategory[] | null;
};

type CategoriesResponse = { multiLevelCategories?: RawCategory[] | null };

function normalize(raw: RawCategory): DisplayCategoryEntry {
  return {
    categoryNo: raw.categoryNo,
    name: raw.label?.trim() || `카테고리 #${raw.categoryNo}`,
    managementCode: raw.managementCode?.trim() ?? '',
    depth: raw.depth,
    children: (raw.children ?? []).map(normalize),
  };
}

// GET /categories — 전시카테고리 계층 목록(상위+하위 트리). 프론트 API라 노출함만 반환한다.
// keyword는 선택(어드민 검색 대응). 기본은 전체 트리.
export async function fetchDisplayCategories(
  clientId: string = SHOPBY_CLIENT_ID,
  keyword?: string,
): Promise<DisplayCategoryEntry[]> {
  const data = await shopApiGet<CategoriesResponse>(
    '/categories',
    keyword ? { keyword } : {},
    clientId,
  );
  return (data.multiLevelCategories ?? []).map(normalize);
}

// GET /categories/{categoryNo} — 선택한 상위의 하위/상세. 탭 선택 시 lazy 호출.
export async function fetchCategoryDetail(
  categoryNo: number,
  clientId: string = SHOPBY_CLIENT_ID,
): Promise<DisplayCategoryEntry> {
  const data = await shopApiGet<CategoriesResponse>(
    `/categories/${categoryNo}`,
    {},
    clientId,
  );
  const root = (data.multiLevelCategories ?? []).find((c) => c.categoryNo === categoryNo)
    ?? (data.multiLevelCategories ?? [])[0];
  if (!root) {
    return { categoryNo, name: `카테고리 #${categoryNo}`, managementCode: '', depth: 1, children: [] };
  }
  return normalize(root);
}
