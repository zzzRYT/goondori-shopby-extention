import type { Issue, Result } from './types';

export type ColorRule = { word: string; hex: string };

const HEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

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

    if (!HEX.test(hex)) {
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
