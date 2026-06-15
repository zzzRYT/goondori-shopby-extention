import {
  SCREENING_SECTIONS,
  type ParsedScreeningProduct,
  type ScreeningImages,
  type ScreeningPopupResult,
} from './types';

// CSS 모듈 해시(Layout_view-title__ZDIpZ)는 빌드마다 바뀔 수 있어 접두 부분만 매칭한다.
const SECTION_TITLE_SELECTOR = '[class*="Layout_view-title"]';

const IMAGE_FIELD_BUCKETS: Record<string, keyof ScreeningImages> = {
  상품이미지: 'main',
  리스트이미지: 'list',
  '상품 상세': 'detail',
  '상품 상세(상단)': 'detailTop',
  '상품 상세(하단)': 'detailBottom',
};

function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

// 심사 팝업의 섹션 테이블(항목|등록정보|수정필요항목)을 { 섹션: { 항목: 값 } }으로 파싱.
// 필수 섹션(기본정보·판매정보·배송정보)이 하나라도 없으면 렌더 미완료로 보고 null.
export function parseScreeningDocument(doc: Document): ParsedScreeningProduct | null {
  const fields: ParsedScreeningProduct['fields'] = {};
  const images: ScreeningImages = { main: [], list: [], detail: [], detailTop: [], detailBottom: [] };

  for (const titleEl of doc.querySelectorAll(SECTION_TITLE_SELECTOR)) {
    const sectionName = SCREENING_SECTIONS.find((name) =>
      normalize(titleEl.textContent).startsWith(name),
    );
    if (!sectionName) continue;

    const table = titleEl.parentElement?.querySelector('table');
    if (!table) continue;

    const sectionFields: Record<string, string> = {};
    for (const row of table.querySelectorAll('tr')) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue; // th 헤더 행 스킵

      const label = normalize(cells[0].textContent);
      if (!label || label === '수정필요') continue; // 의견 textarea 행은 데이터가 아님

      sectionFields[label] = normalize(cells[1].textContent);
      if (sectionName === '이미지정보') collectImages(label, cells[1], images);
    }

    fields[sectionName] = sectionFields;
  }

  if (!fields['기본정보'] || !fields['판매정보'] || !fields['배송정보']) return null;
  return { fields, images };
}

function collectImages(label: string, cell: Element, images: ScreeningImages) {
  const bucket = IMAGE_FIELD_BUCKETS[label];
  if (!bucket) return;

  const srcs = [...cell.querySelectorAll('img')]
    .map((img) => img.getAttribute('src') ?? '')
    .filter(Boolean);
  images[bucket].push(...srcs);
}

export type WaitOptions = { timeoutMs?: number; pollMs?: number };

// SPA 렌더 완료를 고정 지연 대신 조건 폴링으로 기다린다.
// 로그인 화면으로 리다이렉트된 경우(세션 만료)는 즉시 구분해 반환 — 연속 실패 방지의 근거.
export async function waitForScreeningParse(
  doc: Document,
  opts: WaitOptions = {},
): Promise<ScreeningPopupResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const pollMs = opts.pollMs ?? 300;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (doc.querySelector('input[type="password"]')) return { status: 'login-redirect' };

    const product = parseScreeningDocument(doc);
    if (product) return { status: 'ok', product };

    if (Date.now() >= deadline) return { status: 'not-rendered' };
    await sleep(pollMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
