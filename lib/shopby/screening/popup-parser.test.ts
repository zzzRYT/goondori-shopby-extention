import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScreeningDocument, waitForScreeningParse } from './popup-parser';

function loadFixture(name: string): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('parseScreeningDocument (admin-screening-popup.html 픽스처)', () => {
  it('섹션별 항목-값 레코드를 파싱한다', () => {
    const doc = loadFixture('admin-screening-popup.html');

    const product = parseScreeningDocument(doc);

    expect(product).not.toBeNull();
    expect(product!.fields['기본정보']?.['상품명']).toBe('[디라이프] 쿡 웨어 IH 3종 냄비세트');
    expect(product!.fields['기본정보']?.['제조사명']).toBe('');
    expect(product!.fields['판매정보']?.['판매수수료']).toBe('상품수수료, 15%');
    expect(product!.fields['판매정보']?.['판매가']).toBe('140,000원');
    expect(product!.fields['배송정보']?.['상품 중량']).toBe('0kg');
    expect(product!.fields['배송정보']?.['반품/교환 배송비']).toBe('편도기준 4,500 원');
    expect(product!.fields['상품항목추가정보']?.['상품항목추가정보']).toBe('');
  });

  it('이미지 src를 대표/리스트/상세로 분류한다', () => {
    const doc = loadFixture('admin-screening-popup.html');

    const product = parseScreeningDocument(doc);

    expect(product!.images.main).toEqual([
      '//shopby-images.cdn-nhncommerce.com/20260610/185503.692263644/133770595-1.jpg',
    ]);
    expect(product!.images.list).toEqual([]);
    expect(product!.images.detail).toHaveLength(10);
    expect(product!.images.detail[0]).toContain('ai.esmplus.com');
  });

  it('수정필요(의견 입력) 행은 항목에서 제외한다', () => {
    const doc = loadFixture('admin-screening-popup.html');

    const product = parseScreeningDocument(doc);

    expect(product!.fields['이미지정보']?.['수정필요']).toBeUndefined();
    expect(product!.fields['이미지정보']?.['배송안내']).toBe('기본 템플릿');
  });

  it('필수 섹션이 없으면 null (렌더 미완료)', () => {
    const doc = new DOMParser().parseFromString('<html><body><div id="root"></div></body></html>', 'text/html');

    expect(parseScreeningDocument(doc)).toBeNull();
  });
});

describe('waitForScreeningParse', () => {
  it('렌더 완료 문서는 즉시 ok를 반환한다', async () => {
    const doc = loadFixture('admin-screening-popup.html');

    const result = await waitForScreeningParse(doc, { timeoutMs: 100, pollMs: 10 });

    expect(result.status).toBe('ok');
  });

  it('비밀번호 입력이 보이면 login-redirect', async () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><form><input type="password"></form></body></html>',
      'text/html',
    );

    const result = await waitForScreeningParse(doc, { timeoutMs: 100, pollMs: 10 });

    expect(result.status).toBe('login-redirect');
  });

  it('타임아웃까지 렌더가 안 되면 not-rendered', async () => {
    const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');

    const result = await waitForScreeningParse(doc, { timeoutMs: 50, pollMs: 10 });

    expect(result.status).toBe('not-rendered');
  });
});
