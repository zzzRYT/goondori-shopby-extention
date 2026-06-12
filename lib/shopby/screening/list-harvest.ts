import type { ScreeningRow } from './types';

export const SCREENING_GRID_SELECTOR = '[data-cy="grid"]';

const PAGE_SIZE_VALUES = ['30', '50', '100', '200'];

export function findScreeningGrid(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(SCREENING_GRID_SELECTOR);
}

// "검색결과 총 <b>78</b> 건" — CSS 모듈 클래스 대신 텍스트로 앵커링.
export function readTotalCount(doc: Document): number | null {
  for (const heading of doc.querySelectorAll('h4')) {
    if (!heading.textContent?.includes('검색결과')) continue;
    const value = Number(heading.querySelector('b')?.textContent?.replace(/,/g, '').trim());
    if (Number.isInteger(value) && value >= 0) return value;
  }
  return null;
}

// 30/50/100/200 옵션 구성을 가진 select가 페이지 사이즈 셀렉터다(검색폼 select들과 구분).
export function findPageSizeSelect(doc: Document): HTMLSelectElement | null {
  for (const select of doc.querySelectorAll('select')) {
    const values = [...select.options].map((option) => option.value);
    if (PAGE_SIZE_VALUES.every((value) => values.includes(value))) return select;
  }
  return null;
}

// TUI 그리드는 가상 스크롤이라 "지금 DOM에 렌더된 행"만 수집된다. 전체 수집은 collect.ts가
// 스크롤을 돌리며 이 함수를 반복 호출해 합친다.
export function harvestVisibleRows(doc: Document): ScreeningRow[] {
  const rows: ScreeningRow[] = [];
  for (const cell of doc.querySelectorAll<HTMLElement>('td[data-column-name="productNo"]')) {
    const productNo = cell.textContent?.trim() ?? '';
    if (!/^\d+$/.test(productNo)) continue;

    const rowKey = cell.getAttribute('data-row-key');
    const nameCell =
      rowKey != null
        ? doc.querySelector(`td[data-column-name="productName"][data-row-key="${rowKey}"]`)
        : null;
    rows.push({
      productNo,
      productName: (nameCell?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    });
  }
  return rows;
}
