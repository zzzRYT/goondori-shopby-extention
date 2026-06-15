import {
  SCREENING_SECTIONS,
  type ParsedScreeningProduct,
  type ParsedScreening,
  type ScreeningChange,
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

const CHANGE_HEADER_RE = /변경 전|변경 후/;

// 수정 심사 팝업: '변경 전/후' 헤더를 가진 섹션 테이블만 골라 행별 diff를 만든다.
// 그런 테이블이 하나도 없으면(등록 팝업이거나 렌더 전) null — 폴링이 계속된다.
export function parseScreeningChanges(doc: Document): ScreeningChange[] | null {
  const changes: ScreeningChange[] = [];

  for (const titleEl of doc.querySelectorAll(SECTION_TITLE_SELECTOR)) {
    const table = titleEl.parentElement?.querySelector('table');
    if (!table || !hasChangeHeader(table)) continue;

    const section = normalize(titleEl.textContent);
    for (const row of table.querySelectorAll('tr')) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) continue; // th 헤더 행/비-diff 행 스킵
      const label = normalize(cells[0].textContent);
      if (!label) continue;
      changes.push({ section, label, before: cellText(cells[1]), after: cellText(cells[2]) });
    }
  }

  return changes.length > 0 ? changes : null;
}

function hasChangeHeader(table: Element): boolean {
  for (const th of table.querySelectorAll('th')) {
    if (CHANGE_HEADER_RE.test(normalize(th.textContent))) return true;
  }
  return false;
}

// 텍스트가 비고 이미지가 있으면 '(이미지)' — 이미지 변경을 침묵 누락하지 않되,
// v1은 텍스트 비교라 어떤 이미지로 바뀌었는지까진 표현하지 않는다(알려진 한계).
function cellText(cell: Element): string {
  const text = normalize(cell.textContent);
  if (text) return text;
  return cell.querySelector('img') ? '(이미지)' : '';
}

// 종류 판별: 수정(변경 전/후) 우선 검사 후 등록. 둘 다 아니면 null(렌더 전).
export function parseScreening(doc: Document): ParsedScreening | null {
  const changes = parseScreeningChanges(doc);
  if (changes) return { kind: 'modify', changes };
  const product = parseScreeningDocument(doc);
  if (product) return { kind: 'register', product };
  return null;
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

    const parsed = parseScreening(doc);
    if (parsed) return { status: 'ok', ...parsed };

    if (Date.now() >= deadline) return { status: 'not-rendered' };
    await sleep(pollMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
