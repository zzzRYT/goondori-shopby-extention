import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';
import type { BrandEntry } from './types';

type RawBrand = {
  brandNo: number;
  mainBrandName?: string | null;
};

// /display/brands/search 응답은 {items} 래퍼 없이 브랜드 배열을 그대로 반환한다.
type BrandsResponse = RawBrand[];

const PAGE_SIZE = 100;
// 안전 상한. PAGE_SIZE와 곱해 최대 5,000개까지만 받아 무한 루프를 막는다.
const MAX_PAGES = 50;

// GET /display/brands/search — 브랜드 색인(ES) 기준 브랜드 목록.
// brandName을 비우면 전체 브랜드를 받고, 마지막 페이지(받은 수 < PAGE_SIZE)까지 순회한다.
// 정렬은 브랜드명 오름차순(가나다순)으로 고정한다.
export async function fetchBrands(
  clientId: string = SHOPBY_CLIENT_ID,
): Promise<BrandEntry[]> {
  const brands: BrandEntry[] = [];

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const data = await shopApiGet<BrandsResponse>(
      '/display/brands/search',
      {
        pageNumber,
        pageSize: PAGE_SIZE,
        sortCriterion: 'BRAND_NAME',
        sortDirection: 'ASC',
      },
      clientId,
    );

    const items = Array.isArray(data) ? data : [];
    for (const brand of items) {
      brands.push({
        brandNo: brand.brandNo,
        name: brand.mainBrandName?.trim() || `브랜드 #${brand.brandNo}`,
      });
    }

    if (items.length < PAGE_SIZE) break;
  }

  return brands;
}
