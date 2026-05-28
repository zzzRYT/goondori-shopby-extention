import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';
import type { BrandEntry } from './types';

type RawBrand = {
  brandNo: number;
  name?: string | null;
};

type BrandsResponse = { items?: RawBrand[] | null; totalCount?: number };

const PAGE_SIZE = 100;
// 안전 상한. PAGE_SIZE와 곱해 최대 5,000개까지만 받아 무한 루프를 막는다.
const MAX_PAGES = 50;

// GET /display/brands — 상품 색인(ES) 기준 브랜드 목록.
// 판매 상태/품절과 무관하게 최대한 많이 받기 위해 ALL_CONDITIONS + 품절 포함으로 조회하고,
// 마지막 페이지(받은 수 < PAGE_SIZE)까지 순회한다. 기본 정렬은 브랜드명 가나다순.
export async function fetchBrands(clientId: string = SHOPBY_CLIENT_ID): Promise<BrandEntry[]> {
  const brands: BrandEntry[] = [];

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const data = await shopApiGet<BrandsResponse>(
      '/display/brands',
      {
        pageNumber,
        pageSize: PAGE_SIZE,
        'filter.saleStatus': 'ALL_CONDITIONS',
        'filter.soldOutIncluded': true,
      },
      clientId,
    );

    const items = data.items ?? [];
    for (const brand of items) {
      brands.push({ brandNo: brand.brandNo, name: brand.name?.trim() || `브랜드 #${brand.brandNo}` });
    }

    if (items.length < PAGE_SIZE) break;
  }

  return brands;
}
