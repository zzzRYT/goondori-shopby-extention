import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { collectScreeningList } from './collect';
import { findPageSizeSelect } from './list-harvest';

function loadFixture(): Document {
  const html = readFileSync(
    resolve(process.cwd(), 'tests/fixtures', 'admin-screening-list.html'),
    'utf-8',
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

// jsdom에는 레이아웃이 없어 스크롤·리로드가 일어나지 않는다.
// 대기 시간을 0으로 줄여 정적 문서 기준의 수집 결과를 검증한다.
const FAST = { waitMs: 0, settleTicks: 2, timeoutMs: 300, maxScrollSteps: 2, maxPages: 3 };

describe('collectScreeningList', () => {
  it('렌더된 행을 수집하고 총건수 미달이면 count-mismatch로 알린다', async () => {
    const doc = loadFixture();

    const result = await collectScreeningList(doc, FAST);

    expect(result.rows).toHaveLength(12); // 픽스처에 렌더된 12행(가상 스크롤)
    expect(result.totalCount).toBe(78);
    expect(result.status).toBe('count-mismatch'); // 12 ≠ 78 — 침묵 누락 금지
    expect(result.pagesVisited).toBe(1); // next 버튼이 disabled(span)라 1페이지에서 종료
  });

  it('페이지 사이즈를 200으로 전환한다', async () => {
    const doc = loadFixture();

    await collectScreeningList(doc, FAST);

    expect(findPageSizeSelect(doc)!.value).toBe('200');
  });

  it('수집 건수가 총건수와 같으면 ok', async () => {
    const doc = loadFixture();
    // 픽스처의 총건수를 렌더된 행 수에 맞춰 12로 조작
    const bold = [...doc.querySelectorAll('h4')]
      .find((h) => h.textContent?.includes('검색결과'))!
      .querySelector('b')!;
    bold.textContent = '12';

    const result = await collectScreeningList(doc, FAST);

    expect(result.status).toBe('ok');
  });

  it('그리드가 없으면 no-grid', async () => {
    const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');

    const result = await collectScreeningList(doc, FAST);

    expect(result).toEqual({ status: 'no-grid', rows: [], totalCount: null, pagesVisited: 0 });
  });

  it('현재 2페이지에서 시작해도 1페이지로 되돌린 뒤 전체를 수집한다', async () => {
    // jsdom엔 실제 페이지 전환이 없으므로 first/2 컨트롤에 핸들러를 붙여 SPA 재렌더(행 교체 +
    // tui-is-selected 텍스트 변경)를 흉내낸다. 시작은 2페이지 — 리셋이 없으면 101/102가 누락된다.
    mountGridOnPage2(document);

    const result = await collectScreeningList(document, FAST);

    const productNos = result.rows.map((row) => row.productNo).sort();
    // 1페이지(101,102)가 결과에 포함됐다는 것 자체가 "1페이지로 되돌린 뒤 수집"의 증거
    expect(productNos).toEqual(['101', '102', '201', '202']);
  });

  it('이미 1페이지면 first 컨트롤을 클릭하지 않는다(no-op)', async () => {
    document.body.innerHTML =
      '<div data-cy="grid"><table><tbody>' +
      '<tr><td data-column-name="productNo" data-row-key="0">301</td>' +
      '<td data-column-name="productName" data-row-key="0">상품301</td></tr>' +
      '</tbody></table></div>' +
      '<div class="tui-pagination">' +
      '<a href="#" class="tui-page-btn tui-is-disabled tui-first"><span>first</span></a>' +
      '<strong class="tui-page-btn tui-is-selected">1</strong>' +
      '<span class="tui-page-btn tui-is-disabled tui-next"><span>next</span></span>' +
      '</div>';
    const first = document.querySelector<HTMLElement>('a.tui-first')!;
    const clickSpy = vi.spyOn(first, 'click');

    const result = await collectScreeningList(document, FAST);

    expect(clickSpy).not.toHaveBeenCalled(); // 비활성 first는 건드리지 않는다
    expect(result.rows.map((row) => row.productNo)).toContain('301');
    expect(result.pagesVisited).toBe(1);
  });
});

// 그리드(2페이지 표시) + 페이저를 합성한다. first 클릭 → 1페이지 행/선택페이지로,
// "2" 클릭 → 2페이지 행/선택페이지로 교체해 어드민 SPA의 페이지 전환을 흉내낸다.
function mountGridOnPage2(doc: Document): void {
  const page1 = [
    { no: '101', name: '상품101' },
    { no: '102', name: '상품102' },
  ];
  const page2 = [
    { no: '201', name: '상품201' },
    { no: '202', name: '상품202' },
  ];
  const cells = (rows: { no: string; name: string }[]) =>
    rows
      .map(
        (row, i) =>
          `<tr><td data-column-name="productNo" data-row-key="${i}">${row.no}</td>` +
          `<td data-column-name="productName" data-row-key="${i}">${row.name}</td></tr>`,
      )
      .join('');

  doc.body.innerHTML =
    `<div data-cy="grid"><table><tbody id="rows">${cells(page2)}</tbody></table></div>` +
    '<div class="tui-pagination">' +
    '<a href="#" class="tui-page-btn tui-first"><span>first</span></a>' +
    '<a href="#" class="tui-page-btn" id="p1">1</a>' +
    '<strong class="tui-page-btn tui-is-selected" id="sel">2</strong>' +
    '<a href="#" class="tui-page-btn" id="p2">2</a>' +
    '<span class="tui-page-btn tui-is-disabled tui-next"><span>next</span></span>' +
    '</div>';

  const show = (rows: { no: string; name: string }[], page: string) => (event: Event) => {
    event.preventDefault();
    doc.getElementById('rows')!.innerHTML = cells(rows);
    doc.getElementById('sel')!.textContent = page;
  };
  doc.querySelector<HTMLElement>('a.tui-first')!.addEventListener('click', show(page1, '1'));
  doc.getElementById('p2')!.addEventListener('click', show(page2, '2'));
}
