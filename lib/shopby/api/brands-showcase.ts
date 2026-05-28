import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

type SearchItem = { brandNo: number };
type SearchResponse = { items?: SearchItem[] | null };

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
