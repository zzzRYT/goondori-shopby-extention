import { describe, expect, it } from 'vitest';
import { CURATION_META, CURATION_RULES, isCurationRule, mergeCurationRules } from './curation-rules';
import type { Rule } from './rules';

describe('CURATION_RULES', () => {
  it('모든 기본 규칙은 ON이고 메타를 가진다', () => {
    for (const rule of CURATION_RULES) {
      expect(rule.enabled).toBe(true);
      expect(CURATION_META[rule.id]).toBeDefined();
    }
  });

  it('MD 검수 항목 8종을 기본으로 깐다', () => {
    expect(CURATION_RULES.map((r) => r.id)).toEqual([
      'curation-reverse-margin',
      'curation-zero-commission',
      'curation-discount-rate',
      'curation-main-image',
      'curation-name-length',
      'curation-service-group',
      'curation-zero-stock',
      'curation-display-category',
    ]);
  });

  it('isCurationRule은 현재 기본 규칙 ID만 참', () => {
    expect(isCurationRule('curation-reverse-margin')).toBe(true);
    expect(isCurationRule('curation-brand')).toBe(false); // 구버전
    expect(isCurationRule('seed-manufacturer')).toBe(false);
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
