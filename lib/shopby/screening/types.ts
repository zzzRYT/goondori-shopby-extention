// 심사 팝업의 섹션 제목. 팝업 픽스처(tests/fixtures/admin-screening-popup.html) 기준.
export const SCREENING_SECTIONS = [
  '기본정보',
  '판매정보',
  '이미지정보',
  '배송정보',
  '상품항목추가정보',
] as const;

export type SectionName = (typeof SCREENING_SECTIONS)[number];

// detail은 '상품 상세' 본문, detailTop/detailBottom은 '상품 상세(상단)/(하단)' — 앱에서 표현되지 않아 별도 검사 대상.
export type ScreeningImages = {
  main: string[];
  list: string[];
  detail: string[];
  detailTop: string[];
  detailBottom: string[];
};

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
  | ({ status: 'ok' } & ParsedScreening)
  | { status: 'not-rendered' }
  | { status: 'login-redirect' };

// 수정 심사 팝업의 변경 1건. before/after는 텍스트 비교(이미지 변경은 '(이미지)' 플레이스홀더).
export type ScreeningChange = {
  section: string;
  label: string;
  before: string;
  after: string;
};

// 팝업 파싱 결과의 판별 유니온 — 팝업 구조가 종류를 self-describing 한다.
export type ParsedScreening =
  | { kind: 'register'; product: ParsedScreeningProduct }
  | { kind: 'modify'; changes: ScreeningChange[] };
