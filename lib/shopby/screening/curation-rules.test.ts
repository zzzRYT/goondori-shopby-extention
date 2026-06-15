import { describe, expect, it } from 'vitest';
import { CURATION_META, CURATION_RULES, isCurationRule, mergeCurationRules } from './curation-rules';
import type { Rule } from './rules';

describe('CURATION_RULES', () => {
  it('모든 큐레이션 규칙은 기본 ON이고 메타(제목·설명)를 가진다', () => {
    for (const rule of CURATION_RULES) {
      expect(rule.enabled).toBe(true);
      expect(CURATION_META[rule.id]).toBeDefined();
    }
  });

  it('isCurationRule은 큐레이션 ID만 참', () => {
    expect(isCurationRule('curation-brand')).toBe(true);
    expect(isCurationRule('seed-manufacturer')).toBe(false);
    expect(isCurationRule('rule-abc')).toBe(false);
  });
});

describe('mergeCurationRules', () => {
  it('빠진 큐레이션 규칙을 앞쪽에 복원한다', () => {
    const saved: Rule[] = [
      { id: 'custom', type: 'required', section: '기본정보', field: '제조사명', enabled: true },
    ];

    const merged = mergeCurationRules(saved);

    expect(merged.slice(0, CURATION_RULES.length)).toEqual(CURATION_RULES);
    expect(merged.at(-1)).toEqual(saved[0]);
  });

  it('정의·enabled가 모두 같으면 원본 배열 참조를 그대로 반환한다(쓰기 방지)', () => {
    const toggledOff: Rule = { ...CURATION_RULES[0], enabled: false } as Rule;
    const saved: Rule[] = [toggledOff, ...CURATION_RULES.slice(1)];

    const merged = mergeCurationRules(saved);

    expect(merged).toBe(saved);
    expect(merged[0].enabled).toBe(false);
  });

  it('일부만 빠졌으면 빠진 것만 추가한다', () => {
    const saved: Rule[] = CURATION_RULES.slice(1);

    const merged = mergeCurationRules(saved);

    expect(merged).toHaveLength(CURATION_RULES.length);
    expect(merged[0]).toEqual(CURATION_RULES[0]);
  });

  it('규칙 정의는 코드가 정답 — 저장본의 옛 정의를 교정하되 enabled는 보존한다', () => {
    // 옛 버전: 검색어가 empty(있으면 위반)로 저장돼 있고, MD가 꺼둔 상태.
    const stale: Rule = {
      id: 'curation-search-keyword',
      type: 'empty',
      section: '기본정보',
      field: '검색어',
      enabled: false,
    };
    const saved: Rule[] = CURATION_RULES.map((rule) =>
      rule.id === stale.id ? stale : rule,
    );

    const merged = mergeCurationRules(saved);
    const fixed = merged.find((rule) => rule.id === 'curation-search-keyword')!;

    expect(fixed.type).toBe('required'); // 코드 정의로 교정됨
    expect(fixed.enabled).toBe(false); // 사용자가 끈 상태는 보존
  });

  it('비-큐레이션 규칙(시드·커스텀)은 큐레이션 뒤에 순서대로 유지된다', () => {
    const custom: Rule = { id: 'custom', type: 'required', section: '기본정보', field: '브랜드', enabled: true };
    const saved: Rule[] = [...CURATION_RULES, custom];

    const merged = mergeCurationRules(saved);

    expect(merged.at(-1)).toEqual(custom);
    expect(merged.slice(0, CURATION_RULES.length).every((rule) => rule.id.startsWith('curation-'))).toBe(true);
  });
});
