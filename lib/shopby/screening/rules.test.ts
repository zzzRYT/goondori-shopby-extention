import { describe, expect, it } from 'vitest';
import { evaluate, imageHost, parseNumeric, type Rule } from './rules';
import type { ParsedScreeningProduct } from './types';

// 픽스처 파싱 결과의 축약형. 규칙 엔진은 파서 출력 형태만 알면 된다.
function product(overrides?: Partial<ParsedScreeningProduct>): ParsedScreeningProduct {
  return {
    fields: {
      기본정보: { 상품명: '[디라이프] 쿡 웨어 IH 3종 냄비세트', 제조사명: '', 브랜드: '디라이프' },
      판매정보: { 판매수수료: '상품수수료, 15%', 판매가: '140,000원' },
      배송정보: { '상품 중량': '0kg', '반품/교환 배송비': '편도기준 4,500 원' },
    },
    images: {
      main: ['//shopby-images.cdn-nhncommerce.com/a/b.jpg'],
      list: [],
      detail: ['https://ai.esmplus.com/x/1.jpg', 'https://ai.esmplus.com/x/2.jpg'],
    },
    ...overrides,
  };
}

describe('parseNumeric', () => {
  it.each([
    ['140,000원', 140_000],
    ['15%', 15],
    ['0kg', 0],
    ['상품수수료, 15%', 15],
    ['1,000개', 1_000],
    ['편도기준 4,500 원', 4_500],
  ])('"%s" → %d', (raw, expected) => {
    expect(parseNumeric(raw)).toBe(expected);
  });

  it('숫자가 없으면 null', () => {
    expect(parseNumeric('')).toBeNull();
    expect(parseNumeric('상품상세참조')).toBeNull();
  });
});

describe('imageHost', () => {
  it('프로토콜 상대 URL의 호스트를 읽는다', () => {
    expect(imageHost('//shopby-images.cdn-nhncommerce.com/a.jpg')).toBe('shopby-images.cdn-nhncommerce.com');
  });

  it('상대 경로는 어드민 자체 자원으로 보고 null', () => {
    expect(imageHost('/static/a.jpg')).toBeNull();
  });
});

describe('evaluate', () => {
  it('required: 공란이면 위반', () => {
    const rule: Rule = { id: 'r1', type: 'required', section: '기본정보', field: '제조사명', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('공란');
  });

  it('required: 값이 있으면 통과', () => {
    const rule: Rule = { id: 'r1', type: 'required', section: '기본정보', field: '브랜드', enabled: true };

    expect(evaluate(product(), [rule])).toEqual([]);
  });

  it('required: 항목 자체가 없으면 파싱 불일치 위반 (조용히 통과 금지)', () => {
    const rule: Rule = { id: 'r1', type: 'required', section: '기본정보', field: '없는항목', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('항목을 찾지 못함');
  });

  it('expected gt: "0kg" > 0 은 위반', () => {
    const rule: Rule = { id: 'r1', type: 'expected', section: '배송정보', field: '상품 중량', op: 'gt', value: '0', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toBe('0kg');
  });

  it('expected equals: 문자열 불일치여도 숫자가 같으면 통과 ("상품수수료, 15%" = "15%")', () => {
    const rule: Rule = { id: 'r1', type: 'expected', section: '판매정보', field: '판매수수료', op: 'equals', value: '15%', enabled: true };

    expect(evaluate(product(), [rule])).toEqual([]);
  });

  it('expected equals: 숫자도 다르면 위반', () => {
    const rule: Rule = { id: 'r1', type: 'expected', section: '판매정보', field: '판매수수료', op: 'equals', value: '20%', enabled: true };

    expect(evaluate(product(), [rule])).toHaveLength(1);
  });

  it('expected 숫자 비교: 숫자를 못 뽑으면 "비교 불가" 위반으로 표면화', () => {
    const rule: Rule = { id: 'r1', type: 'expected', section: '기본정보', field: '브랜드', op: 'gt', value: '10', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('비교 불가');
  });

  it('image mainRequired: 대표이미지 있으면 통과, 없으면 위반', () => {
    const rule: Rule = { id: 'r1', type: 'image', kind: 'mainRequired', enabled: true };

    expect(evaluate(product(), [rule])).toEqual([]);
    expect(
      evaluate(product({ images: { main: [], list: [], detail: [] } }), [rule]),
    ).toHaveLength(1);
  });

  it('image listRequired: 리스트이미지 없으면 위반', () => {
    const rule: Rule = { id: 'r1', type: 'image', kind: 'listRequired', enabled: true };

    expect(evaluate(product(), [rule])).toHaveLength(1);
  });

  it('image detailMin: threshold 미만이면 위반', () => {
    const pass: Rule = { id: 'r1', type: 'image', kind: 'detailMin', threshold: 2, enabled: true };
    const fail: Rule = { id: 'r2', type: 'image', kind: 'detailMin', threshold: 3, enabled: true };

    expect(evaluate(product(), [pass])).toEqual([]);
    expect(evaluate(product(), [fail])).toHaveLength(1);
  });

  it('image externalHost: 허용 외 호스트를 위반으로 모아 보여준다', () => {
    const rule: Rule = { id: 'r1', type: 'image', kind: 'externalHost', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toContain('ai.esmplus.com');
  });

  it('enabled=false 규칙은 평가하지 않는다', () => {
    const rule: Rule = { id: 'r1', type: 'required', section: '기본정보', field: '제조사명', enabled: false };

    expect(evaluate(product(), [rule])).toEqual([]);
  });
});
