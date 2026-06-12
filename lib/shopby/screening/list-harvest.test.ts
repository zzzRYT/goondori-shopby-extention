import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findPageSizeSelect,
  findScreeningGrid,
  harvestVisibleRows,
  readTotalCount,
} from './list-harvest';

function loadFixture(): Document {
  const html = readFileSync(
    resolve(process.cwd(), 'tests/fixtures', 'admin-screening-list.html'),
    'utf-8',
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('list-harvest (admin-screening-list.html 픽스처)', () => {
  it('그리드 컨테이너를 찾는다', () => {
    expect(findScreeningGrid(loadFixture())).not.toBeNull();
  });

  it('"검색결과 총 N건"에서 총건수를 읽는다', () => {
    expect(readTotalCount(loadFixture())).toBe(78);
  });

  it('페이지 사이즈 셀렉터를 찾는다 (검색폼의 다른 select와 구분)', () => {
    const select = findPageSizeSelect(loadFixture());

    expect(select).not.toBeNull();
    expect([...select!.options].map((o) => o.value)).toEqual(['30', '50', '100', '200']);
  });

  it('렌더된 행에서 상품번호·상품명을 수집한다', () => {
    const rows = harvestVisibleRows(loadFixture());

    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ productNo: '133681147', productName: 'OIC 304 올스텐미니 요리국자' });
    expect(rows.every((row) => /^\d+$/.test(row.productNo))).toBe(true);
  });

  it('그리드가 없는 문서에서는 빈 결과', () => {
    const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');

    expect(findScreeningGrid(doc)).toBeNull();
    expect(readTotalCount(doc)).toBeNull();
    expect(findPageSizeSelect(doc)).toBeNull();
    expect(harvestVisibleRows(doc)).toEqual([]);
  });
});
