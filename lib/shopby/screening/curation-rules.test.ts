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

  it('이미 있는 큐레이션 규칙은 저장본 우선 — 꺼둔 상태를 보존한다', () => {
    const toggledOff: Rule = { ...CURATION_RULES[0], enabled: false } as Rule;
    const saved: Rule[] = [toggledOff, ...CURATION_RULES.slice(1)];

    const merged = mergeCurationRules(saved);

    expect(merged).toBe(saved); // 빠진 규칙이 없으면 그대로 반환
    expect(merged[0].enabled).toBe(false);
  });

  it('일부만 빠졌으면 빠진 것만 추가한다', () => {
    const saved: Rule[] = CURATION_RULES.slice(1);

    const merged = mergeCurationRules(saved);

    expect(merged).toHaveLength(CURATION_RULES.length);
    expect(merged[0]).toEqual(CURATION_RULES[0]);
  });
});
