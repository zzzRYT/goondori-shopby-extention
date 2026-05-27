import { describe, expect, it } from 'vitest';
import { buildDisplayId } from './build';

describe('buildDisplayId', () => {
  it('사용자유형 진열을 조립한다', () => {
    expect(buildDisplayId({ env: 'c', order: 1, method: 'p', type: 't', userTypes: ['병'] })).toBe(
      'c_1_p_t_병',
    );
  });

  it('복수 사용자유형을 이어붙인다', () => {
    expect(
      buildDisplayId({ env: 'c', order: 2, method: 'p', type: 't', userTypes: ['병', '부', '장'] }),
    ).toBe('c_2_p_t_병부장');
  });

  it('브랜드 진열(테스트환경/스와이프)을 조립한다', () => {
    expect(buildDisplayId({ env: 'ct', order: 4, method: 's', type: 'b', brandNo: '43215615' })).toBe(
      'ct_4_s_b_43215615',
    );
  });

  it('일반 진열 라벨을 붙인다', () => {
    expect(buildDisplayId({ env: 'c', order: 3, method: 'p', type: 'n', label: '베스트' })).toBe(
      'c_3_p_n_베스트',
    );
  });
});
