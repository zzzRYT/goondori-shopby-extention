import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';
import type { ShowcaseBrand } from './types';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
export const BRAND_DETAIL_CHUNK_SIZE = 100;

type SearchItem = { brandNo: number; mainBrandName?: string | null };
// /display/brands/search 응답은 items 래핑 없이 배열 그대로 온다.
type SearchResponse = SearchItem[];

type DetailItem = {
  displayBrandNo: number;
  mainBrandName?: string | null;
  subBrandName?: string | null;
  extraInfo?: string | null;
  displayAreaContentUrl?: string | null;
};

// /display/brands/search-by-nos 응답은 { brands: [...] } 래핑이다.
type DetailResponse = { brands?: DetailItem[] | null };

// GET /display/brands/search — 브랜드 색인(ES) 기준 전체 브랜드 목록.
// brandName 빈 값으로 호출하면 전체 브랜드를 BRAND_NAME 정렬로 페이지네이션해 받는다.
// 응답이 PAGE_SIZE 미만이면 마지막 페이지로 간주.
export async function searchAllBrands(clientId: string = SHOPBY_CLIENT_ID): Promise<number[]> {
  const brandNos: number[] = [];

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const data = await shopApiGet<SearchResponse>(
      '/display/brands/search',
      {
        brandName: '',
        pageNumber,
        pageSize: PAGE_SIZE,
        sortCriterion: 'BRAND_NAME',
      },
      clientId,
    );

    const items = Array.isArray(data) ? data : [];
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
  const displayName = item.mainBrandName?.trim() || item.subBrandName?.trim() || `브랜드 #${item.displayBrandNo}`;
  return {
    brandNo: item.displayBrandNo,
    name: displayName,
    extraInfo: item.extraInfo ?? '',
    imageUrl: item.displayAreaContentUrl ?? '',
  };
}

// GET /display/brands/search-by-nos — 브랜드 번호 묶음으로 상세(extraInfo·이미지) 조회.
// 한 호출당 BRAND_DETAIL_CHUNK_SIZE 개로 청크 분할하고 병렬 실행하되,
// 결과는 입력 순서대로 머지한다(UI 정렬 안정성).
// 가정: /display/brands/search의 brandNo == search-by-nos의 displayBrandNo.
export async function fetchDisplayBrandDetails(
  brandNos: number[],
  clientId: string = SHOPBY_CLIENT_ID,
): Promise<ShowcaseBrand[]> {
  if (brandNos.length === 0) return [];

  const chunks = chunk(brandNos, BRAND_DETAIL_CHUNK_SIZE);
  const responses = await Promise.all(
    chunks.map((group) =>
      shopApiGet<DetailResponse>(
        '/display/brands/search-by-nos',
        { displayBrandNos: group.join(',') },
        clientId,
      ),
    ),
  );

  const byNo = new Map<number, ShowcaseBrand>();
  for (const response of responses) {
    for (const item of response.brands ?? []) byNo.set(item.displayBrandNo, normalize(item));
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
