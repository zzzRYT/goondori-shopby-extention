import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { findCategoryRow, openCategoryEditor } from './category-editor-open';

function loadFixture(): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures/admin-display-category.html'), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('findCategoryRow (admin-display-category.html)', () => {
  let doc: Document;
  beforeEach(() => { doc = loadFixture(); });

  it('트리에서 이름으로 상위 카테고리 name-wrap을 찾는다', () => {
    const row = findCategoryRow(doc, { name: '설날특가', categoryNo: 0, depth: 1 });
    expect(row).not.toBeNull();
    expect(row?.textContent?.includes('설날특가')).toBe(true);
  });

  it('중첩된 하위 카테고리도 이름으로 찾는다', () => {
    const row = findCategoryRow(doc, { name: '효도의 정석', categoryNo: 0, depth: 2 });
    expect(row).not.toBeNull();
  });

  it('name-wrap에 아이콘 SVG가 섞여 있어도 첫 span 텍스트로 매칭한다', () => {
    // 실제 캡처의 "추천 특가"는 name-wrap 안에 숨김 아이콘 SVG가 함께 들어있다.
    const row = findCategoryRow(doc, { name: '추천 특가', categoryNo: 0, depth: 2 });
    expect(row).not.toBeNull();
  });

  it('없는 이름은 null', () => {
    expect(findCategoryRow(doc, { name: '없는카테고리', categoryNo: 0, depth: 1 })).toBeNull();
  });
});

describe('openCategoryEditor', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('어드민 호스트가 아니면 wrong-host', async () => {
    const result = await openCategoryEditor(document, { name: 'A', categoryNo: 1, depth: 1 }, { hostname: 'example.com' });
    expect(result.status).toBe('wrong-host');
  });

  it('트리에 없으면 not-found', async () => {
    const result = await openCategoryEditor(document, { name: 'A', categoryNo: 1, depth: 1 }, { hostname: 'service.shopby.co.kr' });
    expect(result.status).toBe('not-found');
  });

  it('"전체 열기" 버튼이 있으면 매칭 전에 클릭한다', async () => {
    let expandClicks = 0;
    document.body.innerHTML = `
      <button class="display-category-management_right-btn__a"><span>전체 열기</span></button>
      <button class="display-category-management_right-btn__b"><span>전체 닫기</span></button>
      <div class="display-category-management_category-tree__x">
        <div class="TreeV2_item-label__l">
          <div class="display-category-management_category-name-wrap__y"><span>베스트</span></div>
        </div>
      </div>`;
    document
      .querySelector('.display-category-management_right-btn__a')!
      .addEventListener('click', () => { expandClicks += 1; });

    await openCategoryEditor(document, { name: '베스트', categoryNo: 1, depth: 1 }, { hostname: 'service.shopby.co.kr' });
    expect(expandClicks).toBe(1);
  });

  it('매치되면 name-wrap이 아니라 감싸는 item-label을 클릭하고 opened', async () => {
    let labelClicks = 0;
    document.body.innerHTML = `
      <div class="display-category-management_category-tree__x">
        <div class="TreeV2_item-label__l">
          <div class="display-category-management_category-name-wrap__y"><span>베스트</span></div>
        </div>
      </div>`;
    document
      .querySelector('.TreeV2_item-label__l')!
      .addEventListener('click', () => { labelClicks += 1; });

    const result = await openCategoryEditor(document, { name: '베스트', categoryNo: 1, depth: 1 }, { hostname: 'service.shopby.co.kr' });
    expect(result.status).toBe('opened');
    expect(labelClicks).toBe(1);
  });
});
