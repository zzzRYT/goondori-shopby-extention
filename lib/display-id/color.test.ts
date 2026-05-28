import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, parseColorSpec, recoverChips, serializeChips } from './color';

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

describe('serializeChips', () => {
  it('칩 배열을 "단어#HEX, …" 문자열로 만든다', () => {
    const out = serializeChips([
      { word: '군인', hex: '#008000' },
      { word: '꿀템', hex: '#FFFF00' },
    ]);

    expect(out).toBe('군인#008000, 꿀템#FFFF00');
  });

  it('hex가 null인("색 없음") 칩은 직렬화에서 제외한다', () => {
    const out = serializeChips([
      { word: '군인', hex: '#008000' },
      { word: '꿀템', hex: null },
    ]);

    expect(out).toBe('군인#008000');
  });

  it('단어가 비어 있는 칩은 직렬화에서 제외한다', () => {
    const out = serializeChips([
      { word: '  ', hex: '#008000' },
      { word: '군인', hex: '#008000' },
    ]);

    expect(out).toBe('군인#008000');
  });

  it('칩이 없거나 모두 색 없음이면 빈 문자열', () => {
    expect(serializeChips([])).toBe('');
    expect(serializeChips([{ word: '군인', hex: null }])).toBe('');
  });

  it('parseColorSpec과 왕복(round-trip)이 일치한다', () => {
    const original = '군인#008000, 꿀템#FFFF00';
    const parsed = parseColorSpec(original, '군인을 위한 꿀템');

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(serializeChips(parsed.value)).toBe(original);
    }
  });
});

describe('recoverChips', () => {
  it('저장 원문을 칩 배열로 복원한다', () => {
    expect(recoverChips('군인#008000, 꿀템#FFFF00')).toEqual([
      { word: '군인', hex: '#008000' },
      { word: '꿀템', hex: '#FFFF00' },
    ]);
  });

  it('진열명 포함 여부와 무관하게 유효한 hex 세그먼트를 살린다', () => {
    // 제목을 모르는 복원 시점이라 "단어가 진열명에 있는지"는 따지지 않는다.
    expect(recoverChips('없는단어#FF0000')).toEqual([{ word: '없는단어', hex: '#FF0000' }]);
  });

  it('잘못된 hex·# 없는 세그먼트는 버린다', () => {
    expect(recoverChips('군인#008000, 꿀템#ZZZ, 그냥단어')).toEqual([{ word: '군인', hex: '#008000' }]);
  });

  it('빈 문자열은 빈 배열', () => {
    expect(recoverChips('')).toEqual([]);
    expect(recoverChips('   ')).toEqual([]);
  });

  it('serializeChips와 왕복이 일치한다', () => {
    const spec = '군인#008000, 꿀템#FFFF00';
    expect(serializeChips(recoverChips(spec))).toBe(spec);
  });
});

describe('DEFAULT_PALETTE', () => {
  it('유효한 6자리 HEX 색의 비어 있지 않은 배열이다', () => {
    expect(DEFAULT_PALETTE.length).toBeGreaterThan(0);
    for (const hex of DEFAULT_PALETTE) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
