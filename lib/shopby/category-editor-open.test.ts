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

  it('트리에서 이름으로 카테고리 name-wrap을 찾는다', () => {
    const row = findCategoryRow(doc, { name: '설날특가', categoryNo: 0, depth: 1 });
    expect(row).not.toBeNull();
    expect(row?.textContent?.includes('설날특가')).toBe(true);
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

  it('매치되면 클릭하고 opened', async () => {
    document.body.innerHTML = `
      <div class="display-category-management_category-tree__x">
        <div class="display-category-management_category-name-wrap__y"><span>베스트</span></div>
      </div>`;
    const result = await openCategoryEditor(document, { name: '베스트', categoryNo: 1, depth: 1 }, { hostname: 'service.shopby.co.kr' });
    expect(result.status).toBe('opened');
  });
});
