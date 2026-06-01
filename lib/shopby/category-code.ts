import type { Env } from '../display-id/types';

export type CategoryCode = { env: Env; order: number };

const CODE_RE = /^(c|ct)_(\d+)$/;

// 전시 상위 카테고리 관리코드(c_<순번> / ct_<순번>)를 환경+순번으로 파싱한다.
// 형식이 아니면(하위 카테고리·미분류 포함) null. 기존 display-id Env 체계와 동일한 접두사.
export function parseCategoryCode(code: string): CategoryCode | null {
  const match = CODE_RE.exec(code.trim());
  if (!match) return null;

  const order = Number(match[2]);
  if (!Number.isInteger(order) || order < 1) return null;

  return { env: match[1] as Env, order };
}

// 환경+순번을 전시 상위 카테고리 관리코드 문자열로 조립한다. parseCategoryCode의 역.
export function buildCategoryCode(env: Env, order: number): string {
  return `${env}_${order}`;
}
