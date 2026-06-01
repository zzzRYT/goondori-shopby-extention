import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';
import { parseCategoryCode } from '../category-code';
import type { DisplayCategoryEntry } from './types';

type RawCategory = {
  categoryNo: number;
  depth: number;
  label?: string | null;
  managementCode?: string | null;
  children?: RawCategory[] | null;
};

type CategoriesResponse = { multiLevelCategories?: RawCategory[] | null };

// /categories/simple-1depth 응답 항목(평면 1차 목록).
type Simple1Depth = {
  displayCategoryNo: number;
  displayCategoryName?: string | null;
  displayManagementCode?: string | null;
};

function normalize(raw: RawCategory): DisplayCategoryEntry {
  return {
    categoryNo: raw.categoryNo,
    name: raw.label?.trim() || `카테고리 #${raw.categoryNo}`,
    managementCode: raw.managementCode?.trim() ?? '',
    depth: raw.depth,
    children: (raw.children ?? []).map(normalize),
  };
}

// GET /categories/simple-1depth — 1차 카테고리 평면 목록(children 없음).
// /categories(전체 트리)는 1일 캐싱이라 프리뷰엔 부적절해, 캐싱 없는 이 엔드포인트로 상위만 받는다.
export async function fetchSimple1DepthCategories(
  clientId: string = SHOPBY_CLIENT_ID,
): Promise<DisplayCategoryEntry[]> {
  const data = await shopApiGet<Simple1Depth[]>('/categories/simple-1depth', {}, clientId);
  return (data ?? []).map((c) => ({
    categoryNo: c.displayCategoryNo,
    name: c.displayCategoryName?.trim() || `카테고리 #${c.displayCategoryNo}`,
    managementCode: c.displayManagementCode?.trim() ?? '',
    depth: 1,
    children: [],
  }));
}

// 전시카테고리 상위+하위 트리. simple-1depth로 상위를 받고, 코드(c_/ct_) 있는 상위만
// /categories/{categoryNo} 상세로 하위를 채운다. 미분류 상위는 화면에 안 나오므로 상세를 생략한다.
// 1일 캐싱되는 /categories를 피해 어드민 변경이 바로 반영되게 한다.
export async function fetchDisplayCategories(
  clientId: string = SHOPBY_CLIENT_ID,
): Promise<DisplayCategoryEntry[]> {
  const tops = await fetchSimple1DepthCategories(clientId);
  return Promise.all(
    tops.map(async (top) => {
      if (parseCategoryCode(top.managementCode) === null) return top;
      const detail = await fetchCategoryDetail(top.categoryNo, clientId);
      return { ...top, children: detail.children };
    }),
  );
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
