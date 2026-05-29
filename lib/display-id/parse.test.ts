import { describe, expect, it } from 'vitest';
import { buildDisplayId } from './build';
import { parseDisplayId } from './parse';
import type { DisplaySpec } from './types';

describe('parseDisplayId', () => {
  it('유효한 사용자유형 진열을 파싱한다', () => {
    const r = parseDisplayId('c_d2_p_t_병부장');

    expect(r).toEqual({
      ok: true,
      value: { env: 'c', display: { onHome: true, order: 2 }, method: 'p', type: 't', userTypes: ['병', '부', '장'] },
    });
  });

  it('브랜드 진열을 파싱한다', () => {
    const r = parseDisplayId('ct_d4_s_b_43215615');

    expect(r).toEqual({
      ok: true,
      value: { env: 'ct', display: { onHome: true, order: 4 }, method: 's', type: 'b', brandNo: '43215615' },
    });
  });

  it('nd 토큰을 홈 비노출 진열로 파싱한다', () => {
    const r = parseDisplayId('c_nd_s_b_43215615');

    expect(r).toEqual({
      ok: true,
      value: { env: 'c', display: { onHome: false }, method: 's', type: 'b', brandNo: '43215615' },
    });
  });

  it('일반 진열 라벨은 그대로 보존한다(밑줄 포함 가능)', () => {
    const r = parseDisplayId('c_d3_p_n_베스트_추천');

    expect(r).toEqual({
      ok: true,
      value: { env: 'c', display: { onHome: true, order: 3 }, method: 'p', type: 'n', label: '베스트_추천' },
    });
  });

  it('잘못된 환경 접미사는 error', () => {
    const r = parseDisplayId('x_d1_p_t_병');

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((issue) => issue.field === 'env' && issue.severity === 'error')).toBe(true);
    }
  });

  it('전시 토큰이 d{n}/nd 형식이 아니면 error', () => {
    for (const bad of ['c_1_p_t_병', 'c_d0_p_t_병', 'c_d-1_p_t_병', 'c_d1.5_p_t_병', 'c_x_p_t_병']) {
      const r = parseDisplayId(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.issues.some((issue) => issue.field === 'display' && issue.severity === 'error')).toBe(true);
      }
    }
  });

  it('사용자유형 외 문자는 error', () => {
    expect(parseDisplayId('c_d1_p_t_병XYZ').ok).toBe(false);
  });

  it('브랜드 번호가 숫자가 아니면 error', () => {
    expect(parseDisplayId('c_d1_p_b_abc').ok).toBe(false);
  });

  it('buildDisplayId 결과를 원래 spec으로 역파싱한다', () => {
    const specs: DisplaySpec[] = [
      { env: 'c', display: { onHome: true, order: 1 }, method: 'p', type: 't', userTypes: ['병'] },
      { env: 'c', display: { onHome: true, order: 2 }, method: 'p', type: 't', userTypes: ['병', '부', '장'] },
      { env: 'ct', display: { onHome: true, order: 4 }, method: 's', type: 'b', brandNo: '43215615' },
      { env: 'c', display: { onHome: false }, method: 's', type: 'b', brandNo: '43215615' },
      { env: 'c', display: { onHome: true, order: 3 }, method: 'p', type: 'n', label: '베스트' },
    ];

    for (const spec of specs) {
      expect(parseDisplayId(buildDisplayId(spec))).toEqual({ ok: true, value: spec });
    }
  });
});
