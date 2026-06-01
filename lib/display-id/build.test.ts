import { describe, expect, it } from 'vitest';
import { buildDisplayId, buildDisplayToken } from './build';

describe('buildDisplayToken', () => {
  it('홈 전시 ON 이면 d{n} 으로 직렬화한다', () => {
    expect(buildDisplayToken({ onHome: true, order: 1 })).toBe('d1');
    expect(buildDisplayToken({ onHome: true, order: 12 })).toBe('d12');
  });

  it('홈 비노출이면 nd 로 직렬화한다', () => {
    expect(buildDisplayToken({ onHome: false })).toBe('nd');
  });
});

describe('buildDisplayId', () => {
  it('사용자유형 진열을 조립한다', () => {
    expect(
      buildDisplayId({ env: 'c', display: { onHome: true, order: 1 }, method: 'p', type: 't', userTypes: ['병'] }),
    ).toBe('c_d1_p_t_병');
  });

  it('복수 사용자유형을 이어붙인다', () => {
    expect(
      buildDisplayId({
        env: 'c',
        display: { onHome: true, order: 2 },
        method: 'p',
        type: 't',
        userTypes: ['병', '부', '장'],
      }),
    ).toBe('c_d2_p_t_병부장');
  });

  it('브랜드 진열(테스트환경/스와이프)을 조립한다', () => {
    expect(
      buildDisplayId({ env: 'ct', display: { onHome: true, order: 4 }, method: 's', type: 'b', brandNo: '43215615' }),
    ).toBe('ct_d4_s_b_43215615');
  });

  it('홈 비노출 브랜드 진열을 nd 토큰으로 조립한다', () => {
    expect(
      buildDisplayId({ env: 'c', display: { onHome: false }, method: 's', type: 'b', brandNo: '43215615' }),
    ).toBe('c_nd_s_b_43215615');
  });

  it('일반 진열 라벨을 붙인다', () => {
    expect(
      buildDisplayId({ env: 'c', display: { onHome: true, order: 3 }, method: 'p', type: 'n', label: '베스트' }),
    ).toBe('c_d3_p_n_베스트');
  });
});
