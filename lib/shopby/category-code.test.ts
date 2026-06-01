import { describe, expect, it } from 'vitest';
import { parseCategoryCode } from './category-code';

describe('parseCategoryCode', () => {
  it('운영 코드 c_1을 env=c, order=1로 파싱', () => {
    expect(parseCategoryCode('c_1')).toEqual({ env: 'c', order: 1 });
  });

  it('개발 코드 ct_4를 env=ct, order=4로 파싱', () => {
    expect(parseCategoryCode('ct_4')).toEqual({ env: 'ct', order: 4 });
  });

  it('두 자리 순번도 파싱', () => {
    expect(parseCategoryCode('c_12')).toEqual({ env: 'c', order: 12 });
  });

  it('빈 문자열은 null', () => {
    expect(parseCategoryCode('')).toBeNull();
  });

  it('접두사가 다르면 null', () => {
    expect(parseCategoryCode('x_1')).toBeNull();
  });

  it('순번 없는 코드는 null', () => {
    expect(parseCategoryCode('c_')).toBeNull();
    expect(parseCategoryCode('ct')).toBeNull();
  });

  it('접미사가 붙으면 null (정확 매칭)', () => {
    expect(parseCategoryCode('c_1_x')).toBeNull();
  });
});
