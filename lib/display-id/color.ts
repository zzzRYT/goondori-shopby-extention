import type { Issue, Result } from './types';

export type ColorRule = { word: string; hex: string };

// 칩은 색을 뗄 수 있다(=색 없음). hex가 null이면 직렬화에서 빠진다.
export type ColorChip = { word: string; hex: string | null };

// 팔레트 프리셋이자 자동 배정 폴백. 세션 내에서만 수정되고 저장하지 않는다.
export const DEFAULT_PALETTE: string[] = ['#008000', '#FFD400', '#FF3B30'];

const HEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export function isValidHex(value: string): boolean {
  return HEX.test(value);
}

// 칩 배열 → "단어#HEX, …" 문자열. parseColorSpec과 왕복이 맞도록 같은 형식을 쓴다.
// 색 없음(hex null)·빈 단어 칩은 제외한다.
export function serializeChips(chips: ColorChip[]): string {
  return chips
    .filter((chip): chip is ColorRule => chip.hex !== null && chip.word.trim() !== '')
    .map((chip) => `${chip.word}${chip.hex}`)
    .join(', ');
}

// 저장된 "단어#HEX, …" 원문을 칩으로 복원한다(왕복용, 설계 §6).
// parseColorSpec과 달리 진열명 포함 여부는 따지지 않고, hex가 유효한 세그먼트만 살린다.
// (진열명 경고는 직렬화 후 parseColorSpec이 다시 잡아낸다.)
export function recoverChips(spec: string): ColorChip[] {
  const trimmed = spec.trim();
  if (!trimmed) return [];

  const chips: ColorChip[] = [];
  for (const raw of trimmed.split(',')) {
    const segment = raw.trim();
    if (!segment) continue;

    const hashAt = segment.lastIndexOf('#');
    if (hashAt <= 0) continue;

    const word = segment.slice(0, hashAt).trim();
    const hex = segment.slice(hashAt);
    if (!word || !isValidHex(hex)) continue;

    chips.push({ word, hex });
  }

  return chips;
}

export function parseColorSpec(spec: string, title: string): Result<ColorRule[]> {
  const trimmed = spec.trim();
  if (!trimmed) return { ok: true, value: [] };

  const issues: Issue[] = [];
  const rules: ColorRule[] = [];

  for (const raw of trimmed.split(',')) {
    const segment = raw.trim();
    if (!segment) continue;

    const hashAt = segment.lastIndexOf('#');
    if (hashAt <= 0) {
      issues.push({
        field: 'color',
        severity: 'error',
        message: `형식 오류: "${segment}" — 단어#HEX 형태여야 합니다`,
      });
      continue;
    }

    const word = segment.slice(0, hashAt).trim();
    const hex = segment.slice(hashAt);

    if (!isValidHex(hex)) {
      issues.push({ field: 'color', severity: 'error', message: `잘못된 HEX: "${hex}"` });
      continue;
    }

    if (!title.includes(word)) {
      issues.push({
        field: 'color',
        severity: 'warn',
        message: `진열명에 없는 단어 "${word}" — 색칠되지 않고 무시됩니다`,
      });
    }

    rules.push({ word, hex });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: rules };
}
