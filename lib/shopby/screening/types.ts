// 심사 팝업의 섹션 제목. 팝업 픽스처(tests/fixtures/admin-screening-popup.html) 기준.
export const SCREENING_SECTIONS = [
  '기본정보',
  '판매정보',
  '이미지정보',
  '배송정보',
  '상품항목추가정보',
] as const;

export type SectionName = (typeof SCREENING_SECTIONS)[number];

export type ScreeningImages = { main: string[]; list: string[]; detail: string[] };

export type ParsedScreeningProduct = {
  fields: Partial<Record<SectionName, Record<string, string>>>;
  images: ScreeningImages;
};

export type ScreeningRow = { productNo: string; productName: string };

export type CollectScreeningListResult = {
  status: 'ok' | 'no-grid' | 'count-mismatch';
  rows: ScreeningRow[];
  totalCount: number | null; // "검색결과 총 N건"
  pagesVisited: number;
};

export type ScreeningPopupResult =
  | { status: 'ok'; product: ParsedScreeningProduct }
  | { status: 'not-rendered' }
  | { status: 'login-redirect' };
