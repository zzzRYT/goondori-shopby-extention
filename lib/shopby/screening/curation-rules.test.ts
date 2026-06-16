import { describe, expect, it } from 'vitest';
import { CURATION_META, CURATION_RULES, isCurationRule, mergeCurationRules } from './curation-rules';
import { evaluate, type Rule } from './rules';
import type { ParsedScreeningProduct } from './types';

// 배송구분만 갈아끼우는 최소 상품 — 서비스상품군 규칙은 이 한 항목만 본다.
function productWithDelivery(배송구분: string): ParsedScreeningProduct {
  return {
    fields: { 기본정보: {}, 판매정보: {}, 배송정보: { 배송구분 } },
    images: { main: [], list: [], detail: [], detailTop: [], detailBottom: [] },
  };
}

// 판매기간만 갈아끼우는 최소 상품 — 판매 종료 임박 규칙은 이 한 항목만 본다.
function productWithSalePeriod(판매기간: string): ParsedScreeningProduct {
  return {
    fields: { 기본정보: {}, 판매정보: { 판매기간 }, 배송정보: {} },
    images: { main: [], list: [], detail: [], detailTop: [], detailBottom: [] },
  };
}

// 판매가/즉시할인가만 갈아끼우는 최소 상품 — 가격 상한 규칙은 이 두 항목만 본다.
function productWithPrices(판매가: string, 즉시할인가?: string): ParsedScreeningProduct {
  return {
    fields: { 기본정보: {}, 판매정보: { 판매가, ...(즉시할인가 !== undefined ? { 즉시할인가 } : {}) }, 배송정보: {} },
    images: { main: [], list: [], detail: [], detailTop: [], detailBottom: [] },
  };
}

describe('CURATION_RULES', () => {
  it('모든 기본 규칙은 ON이고 메타를 가진다', () => {
    for (const rule of CURATION_RULES) {
      expect(rule.enabled).toBe(true);
      expect(CURATION_META[rule.id]).toBeDefined();
    }
  });

  it('MD 검수 항목 10종을 기본으로 깐다', () => {
    expect(CURATION_RULES.map((r) => r.id)).toEqual([
      'curation-reverse-margin',
      'curation-zero-commission',
      'curation-discount-rate',
      'curation-main-image',
      'curation-name-length',
      'curation-service-group',
      'curation-zero-stock',
      'curation-display-category',
      'curation-sale-end-imminent',
      'curation-price-ceiling',
    ]);
  });

  it('isCurationRule은 현재 기본 규칙 ID만 참', () => {
    expect(isCurationRule('curation-reverse-margin')).toBe(true);
    expect(isCurationRule('curation-brand')).toBe(false); // 구버전
    expect(isCurationRule('seed-manufacturer')).toBe(false);
  });
});

describe('서비스상품군 방지(curation-service-group)', () => {
  const rule = CURATION_RULES.find((r) => r.id === 'curation-service-group')!;

  it("배송구분이 '쇼핑몰 배송'이면 서비스상품군으로 보고 위반", () => {
    const violations = evaluate(productWithDelivery('쇼핑몰 배송'), [rule]);
    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toBe('쇼핑몰 배송');
  });

  it("배송상품군('파트너사 배송')은 통과", () => {
    expect(evaluate(productWithDelivery('파트너사 배송'), [rule])).toEqual([]);
  });
});

describe('판매 종료 임박(curation-sale-end-imminent)', () => {
  const rule = CURATION_RULES.find((r) => r.id === 'curation-sale-end-imminent')!;
  const now = new Date(2026, 5, 16); // 2026-06-16

  it('상시 판매(종료일 2999)는 통과', () => {
    const period = '상시 판매, 2026-06-10 00:00:00 ~ 2999-12-31 23:59:59';
    expect(evaluate(productWithSalePeriod(period), [rule], now)).toEqual([]);
  });

  it('종료일이 5일 이내면 위반', () => {
    const period = '기간 판매, 2026-06-10 00:00:00 ~ 2026-06-18 23:59:59';
    const violations = evaluate(productWithSalePeriod(period), [rule], now);
    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toContain('2026-06-18');
    expect(violations[0].actual).toContain('2일 후 종료');
  });

  it('종료일이 정확히 기준값(5일)이면 위반(경계 포함)', () => {
    const period = '기간 판매, 2026-06-10 00:00:00 ~ 2026-06-21 23:59:59';
    expect(evaluate(productWithSalePeriod(period), [rule], now)).toHaveLength(1);
  });

  it('종료일이 기준값을 넘으면(6일 후) 통과', () => {
    const period = '기간 판매, 2026-06-10 00:00:00 ~ 2026-06-22 23:59:59';
    expect(evaluate(productWithSalePeriod(period), [rule], now)).toEqual([]);
  });

  it('이미 종료된 상품도 위반으로 잡고 "이미 종료"로 표기', () => {
    const period = '기간 판매, 2026-05-01 00:00:00 ~ 2026-06-10 23:59:59';
    const violations = evaluate(productWithSalePeriod(period), [rule], now);
    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toContain('이미 종료');
  });
});

describe('가격 상한 초과(curation-price-ceiling)', () => {
  const rule = CURATION_RULES.find((r) => r.id === 'curation-price-ceiling')!;

  it('판매가를 실수로 180만원 등록(즉시할인 5천)하면 위반 — 할인율 규칙이 못 잡는 사각지대', () => {
    // 할인율 = (1,800,000-1,795,000)/1,800,000 ≈ 0.3% → discountRateMax(70%)엔 안 걸린다.
    const violations = evaluate(productWithPrices('1,800,000원', '1,795,000원'), [rule]);
    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toContain('판매가 1,800,000원');
    expect(violations[0].actual).toContain('즉시할인가 1,795,000원');
  });

  it('정상 가격(14만원)은 통과', () => {
    expect(evaluate(productWithPrices('140,000원', '35,300원'), [rule])).toEqual([]);
  });

  it('즉시할인가가 없어도 판매가만으로 상한을 본다', () => {
    const violations = evaluate(productWithPrices('2,500,000원'), [rule]);
    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toBe('판매가 2,500,000원');
  });

  it('기준값(원)은 MD가 편집 가능 — 기준 200만이면 180만은 통과', () => {
    const raised = { ...rule, threshold: 2_000_000 };
    expect(evaluate(productWithPrices('1,800,000원', '1,795,000원'), [raised])).toEqual([]);
  });
});

describe('mergeCurationRules', () => {
  it('구버전 기본 규칙(curation-brand 등)은 로드 시 제거된다', () => {
    const saved: Rule[] = [
      { id: 'curation-brand', type: 'required', section: '기본정보', field: '브랜드', enabled: true },
      { id: 'seed-manufacturer', type: 'required', section: '기본정보', field: '제조사명', enabled: false },
    ];
    const merged = mergeCurationRules(saved);
    expect(merged.some((r) => r.id === 'curation-brand')).toBe(false); // 구버전 제거
    expect(merged.some((r) => r.id === 'seed-manufacturer')).toBe(true); // 시드 유지
    expect(merged.slice(0, CURATION_RULES.length).map((r) => r.id)).toEqual(CURATION_RULES.map((r) => r.id));
  });

  it('파생 규칙 threshold는 사용자 소유 — 저장본 값을 보존한다', () => {
    const edited: Rule = { id: 'curation-discount-rate', type: 'derived', kind: 'discountRateMax', threshold: 85, enabled: true };
    const saved: Rule[] = CURATION_RULES.map((r) =>
      r.id === 'curation-discount-rate' ? edited : r,
    );
    const merged = mergeCurationRules(saved);
    const rule = merged.find((r) => r.id === 'curation-discount-rate')!;
    expect((rule as { threshold?: number }).threshold).toBe(85); // 사용자 편집값 보존
  });

  it('파생 규칙 threshold가 저장본에 없으면(빈 값) 코드 기본값으로 채운다', () => {
    const cleared: Rule = { id: 'curation-name-length', type: 'derived', kind: 'maxLength', section: '기본정보', field: '상품명', enabled: true };
    const saved: Rule[] = CURATION_RULES.map((r) =>
      r.id === 'curation-name-length' ? cleared : r,
    );
    const merged = mergeCurationRules(saved);
    const rule = merged.find((r) => r.id === 'curation-name-length')!;
    expect((rule as { threshold?: number }).threshold).toBe(30); // 코드 기본값
  });

  it('enabled(끈 상태)는 여전히 보존된다', () => {
    const off: Rule = { ...CURATION_RULES[0], enabled: false } as Rule;
    const merged = mergeCurationRules([off, ...CURATION_RULES.slice(1)]);
    expect(merged[0].enabled).toBe(false);
  });

  it('비-큐레이션 규칙(시드·커스텀)은 큐레이션 뒤에 순서대로 유지된다', () => {
    const custom: Rule = { id: 'rule-x', type: 'required', section: '기본정보', field: '브랜드', enabled: true };
    const merged = mergeCurationRules([...CURATION_RULES, custom]);
    expect(merged.at(-1)).toEqual(custom);
  });

  it('정의·enabled가 모두 같으면 원본 배열 참조를 그대로 반환한다(쓰기 방지)', () => {
    const toggledOff: Rule = { ...CURATION_RULES[0], enabled: false } as Rule;
    const saved: Rule[] = [toggledOff, ...CURATION_RULES.slice(1)];
    const merged = mergeCurationRules(saved);
    expect(merged).toBe(saved);
  });
});
