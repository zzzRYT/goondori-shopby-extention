import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findBrandRow, nameCandidates, openBrandEditor } from './brand-editor-open';
import { BRAND_TREE_ITEM_LABEL_SELECTOR } from './selectors';

function loadTree(): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures/admin-brand-tree.html'), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('nameCandidates', () => {
  it('일반 브랜드 이름은 그 자체 + brandNo fallback', () => {
    expect(nameCandidates({ name: 'BOSE', brandNo: 99 })).toEqual(['BOSE', '99']);
  });

  it('"브랜드 #N" 형식은 숫자 부분도 후보에 추가', () => {
    expect(nameCandidates({ name: '브랜드 #43186165', brandNo: 43186165 })).toEqual([
      '브랜드 #43186165',
      '43186165',
    ]);
  });

  it('이름이 비어있어도 brandNo 후보로 매칭 가능', () => {
    expect(nameCandidates({ name: '', brandNo: 7 })).toEqual(['7']);
  });

  it('중복 후보는 정리한다', () => {
    expect(nameCandidates({ name: '42', brandNo: 42 })).toEqual(['42']);
  });
});

describe('findBrandRow (admin-brand-tree.html 실제 트리)', () => {
  let doc: Document;

  beforeEach(() => {
    doc = loadTree();
  });

  it('이름 기반 매칭으로 label 엘리먼트를 반환한다', () => {
    const row = findBrandRow(doc, { name: 'BOSE', brandNo: 100 });
    expect(row).not.toBeNull();
    expect(row?.matches(BRAND_TREE_ITEM_LABEL_SELECTOR)).toBe(true);
    expect(row?.textContent?.includes('BOSE')).toBe(true);
  });

  it('한글 이름 매칭', () => {
    const row = findBrandRow(doc, { name: '김오곤', brandNo: 1 });
    expect(row?.textContent?.includes('김오곤')).toBe(true);
  });

  it('이름이 없어 "브랜드 #43186165"로 fallback된 경우 숫자 텍스트 row를 찾는다', () => {
    const row = findBrandRow(doc, { name: '브랜드 #43186165', brandNo: 43186165 });
    expect(row).not.toBeNull();
    expect(row?.textContent?.includes('43186165')).toBe(true);
  });

  it('이름이 없으면 brandNo만으로 매칭', () => {
    const row = findBrandRow(doc, { name: '', brandNo: 43186171 });
    expect(row?.textContent?.includes('43186171')).toBe(true);
  });

  it('존재하지 않는 브랜드는 null', () => {
    expect(findBrandRow(doc, { name: '없는브랜드', brandNo: 0 })).toBeNull();
  });
});

describe('openBrandEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shopby 어드민이 아니면 wrong-host', async () => {
    const result = await openBrandEditor(
      document,
      { name: 'BOSE', brandNo: 1 },
      { hostname: 'example.com' },
    );
    expect(result.status).toBe('wrong-host');
  });

  it('트리가 없으면 not-found', async () => {
    const result = await openBrandEditor(
      document,
      { name: 'BOSE', brandNo: 1 },
      { hostname: 'enterprise-remote.shopby.co.kr', maxScrollSteps: 1, waitMs: 0 },
    );
    expect(result.status).toBe('not-found');
  });

  it('매치되는 row를 클릭하고 opened 반환', async () => {
    const tree = loadTree();
    document.body.appendChild(tree.body.firstElementChild!);

    const target = findBrandRow(document, { name: 'BOSE', brandNo: 1 });
    expect(target).not.toBeNull();
    const clickSpy = vi.spyOn(target!, 'click');

    const result = await openBrandEditor(
      document,
      { name: 'BOSE', brandNo: 1 },
      { hostname: 'enterprise-remote.shopby.co.kr', maxScrollSteps: 1, waitMs: 0 },
    );

    expect(result.status).toBe('opened');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
