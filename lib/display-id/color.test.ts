import { describe, expect, it } from 'vitest';
import { parseColorSpec } from './color';

describe('parseColorSpec', () => {
  it('단어#HEX 쌍을 파싱한다', () => {
    const r = parseColorSpec('군인#008000, 꿀템#FFFF00', '군인을 위한 꿀템');

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual([
        { word: '군인', hex: '#008000' },
        { word: '꿀템', hex: '#FFFF00' },
      ]);
    }
  });

  it('공백 포함 단어를 허용한다', () => {
    const r = parseColorSpec('추천 상품#FFFF00', '{이름}님을 위한 추천 상품');

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value[0]).toEqual({ word: '추천 상품', hex: '#FFFF00' });
    }
  });

  it('진열명에 없는 단어는 warn', () => {
    const r = parseColorSpec('없는단어#FF0000', '군인을 위한 꿀템');

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((issue) => issue.severity === 'warn')).toBe(true);
    }
  });

  it('잘못된 HEX는 error', () => {
    const r = parseColorSpec('군인#ZZZ', '군인');

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((issue) => issue.severity === 'error')).toBe(true);
    }
  });

  it('빈 문자열은 빈 배열', () => {
    expect(parseColorSpec('', '아무거나')).toEqual({ ok: true, value: [] });
  });
});
