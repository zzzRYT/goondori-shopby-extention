import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScreeningChanges, parseScreeningDocument, waitForScreeningParse } from './popup-parser';

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
    expect(product!.images.detailTop).toEqual([]);
    expect(product!.images.detailBottom).toEqual([]);
  });

  it('상품 상세(상단)/(하단) 이미지를 별도 버킷으로 분류한다', () => {
    // 픽스처에는 상단/하단 이미지가 없어 합성 문서로 라우팅을 검증한다.
    const html = `
      <html><body>
        <div><h3 class="Layout_view-title__x">기본정보</h3><table><tr><td>상품명</td><td>테스트</td></tr></table></div>
        <div><h3 class="Layout_view-title__x">판매정보</h3><table><tr><td>판매가</td><td>1,000원</td></tr></table></div>
        <div><h3 class="Layout_view-title__x">배송정보</h3><table><tr><td>배송구분</td><td>파트너사 배송</td></tr></table></div>
        <div><h3 class="Layout_view-title__x">이미지정보</h3><table>
          <tr><td>상품 상세(상단)</td><td><img src="https://a.com/top.jpg"></td></tr>
          <tr><td>상품 상세</td><td><img src="https://a.com/body.jpg"></td></tr>
          <tr><td>상품 상세(하단)</td><td><img src="https://a.com/bottom.jpg"></td></tr>
        </table></div>
      </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const product = parseScreeningDocument(doc);

    expect(product!.images.detailTop).toEqual(['https://a.com/top.jpg']);
    expect(product!.images.detail).toEqual(['https://a.com/body.jpg']);
    expect(product!.images.detailBottom).toEqual(['https://a.com/bottom.jpg']);
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

describe('parseScreeningChanges (admin-screening-popup-modify.html 픽스처)', () => {
  it('변경 전/후 헤더 테이블의 행을 diff로 파싱한다', () => {
    const doc = loadFixture('admin-screening-popup-modify.html');

    const changes = parseScreeningChanges(doc);

    expect(changes).not.toBeNull();
    expect(changes).toContainEqual({ section: '판매정보', label: '즉시할인', before: '15,000원', after: '20,000원' });
    expect(changes).toContainEqual({ section: '판매정보', label: '즉시할인가', before: '24,900원', after: '19,900원' });
  });

  it('이미지 변경 행은 텍스트가 없어 (이미지) 플레이스홀더로 남긴다 (침묵 누락 금지)', () => {
    const doc = loadFixture('admin-screening-popup-modify.html');

    const changes = parseScreeningChanges(doc);

    expect(changes).toContainEqual({ section: '이미지정보', label: '상품이미지', before: '(이미지)', after: '(이미지)' });
  });

  it('별도 승인거부 의견(변경 전/후 헤더 없음) 행은 제외한다', () => {
    const doc = loadFixture('admin-screening-popup-modify.html');

    const changes = parseScreeningChanges(doc);

    expect(changes!.some((c) => c.label === '수정필요')).toBe(false);
  });

  it('등록 팝업(변경 전/후 헤더 없음)은 null', () => {
    const doc = loadFixture('admin-screening-popup.html');

    expect(parseScreeningChanges(doc)).toBeNull();
  });

  it('변경 전/후 헤더만 있고 데이터 행이 없으면 null (렌더 미완료)', () => {
    const html = `<html><body><div>
      <div class="Layout_view-title__x">판매정보</div>
      <table><tr><th>항목</th><th>변경 전 등록정보</th><th>변경 후 등록정보</th></tr></table>
    </div></body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(parseScreeningChanges(doc)).toBeNull();
  });
});
