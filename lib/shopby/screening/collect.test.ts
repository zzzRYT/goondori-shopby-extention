import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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
});
