import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';
import type { ShowcaseBrand } from './types';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
export const BRAND_DETAIL_CHUNK_SIZE = 100;

type SearchItem = { brandNo: number };
type SearchResponse = { items?: SearchItem[] | null };

type DetailItem = {
  brandNo: number;
  name?: string | null;
  extraInfo?: string | null;
  displayAreaContentUrl?: string | null;
};

type DetailResponse = { items?: DetailItem[] | null };

// GET /brands/search — 상품 카탈로그 기준 전체 브랜드 목록.
// 페이지네이션으로 brandNo만 수집한다(상세는 별도 API에서 받는다).
export async function searchAllBrands(clientId: string = SHOPBY_CLIENT_ID): Promise<number[]> {
  const brandNos: number[] = [];

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const data = await shopApiGet<SearchResponse>(
      '/brands/search',
      { pageNumber, pageSize: PAGE_SIZE },
      clientId,
    );

    const items = data.items ?? [];
    for (const item of items) brandNos.push(item.brandNo);

    if (items.length < PAGE_SIZE) break;
  }

  return brandNos;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalize(item: DetailItem): ShowcaseBrand {
  return {
    brandNo: item.brandNo,
    name: item.name?.trim() || `브랜드 #${item.brandNo}`,
    extraInfo: item.extraInfo ?? '',
    imageUrl: item.displayAreaContentUrl ?? '',
  };
}

// GET /display/brands/search-by-nos — brandNo 묶음에 대한 진열 상세(extraInfo·이미지) 조회.
// 한 호출당 BRAND_DETAIL_CHUNK_SIZE 개로 청크 분할하고 병렬 실행하되,
// 결과는 입력 순서대로 머지한다(UI 정렬 안정성).
export async function fetchDisplayBrandDetails(
  brandNos: number[],
  clientId: string = SHOPBY_CLIENT_ID,
): Promise<ShowcaseBrand[]> {
  if (brandNos.length === 0) return [];

  const chunks = chunk(brandNos, BRAND_DETAIL_CHUNK_SIZE);
  const responses = await Promise.all(
    chunks.map((group) =>
      shopApiGet<DetailResponse>('/display/brands/search-by-nos', { brandNos: group.join(',') }, clientId),
    ),
  );

  const byNo = new Map<number, ShowcaseBrand>();
  for (const response of responses) {
    for (const item of response.items ?? []) byNo.set(item.brandNo, normalize(item));
  }

  return brandNos.flatMap((no) => {
    const entry = byNo.get(no);
    return entry ? [entry] : [];
  });
}

// 브랜드 탭 진입 시 호출하는 통합 진입점. 카탈로그 brandNo를 모두 모은 뒤
// 청크로 상세(extraInfo·이미지)를 받아 단일 ShowcaseBrand[]로 반환한다.
export async function fetchShowcaseBrands(clientId: string = SHOPBY_CLIENT_ID): Promise<ShowcaseBrand[]> {
  const brandNos = await searchAllBrands(clientId);
  return fetchDisplayBrandDetails(brandNos, clientId);
}
