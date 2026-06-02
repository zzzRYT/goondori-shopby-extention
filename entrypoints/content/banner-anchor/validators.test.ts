import { describe, expect, it } from 'vitest';
import type { SectionEntry } from '../../../lib/shopby/api/types';
import {
  validateActiveAccountCount,
  validateBannerImage,
  validateMainSize,
  validateStripAccountName,
  validateStripHeight,
} from './validators';

const SECTIONS: SectionEntry[] = [
  { sectionNo: 1, sectionId: 'c_d1_p_t_병부장', sectionName: '병부장' },
  { sectionNo: 2, sectionId: 'ct_d3_s_b_43215615', sectionName: '필립스' },
];

describe('validateStripAccountName', () => {
  it('비어 있는 값은 검증 통과(미설정 구좌)', () => {
    expect(validateStripAccountName(0, '', SECTIONS)).toBeNull();
    expect(validateStripAccountName(0, '   ', SECTIONS)).toBeNull();
  });

  it('형식 OK + 진열 존재 → 통과', () => {
    expect(validateStripAccountName(0, 'c_d1_p_t_병부장', SECTIONS)).toBeNull();
    expect(validateStripAccountName(1, 'ct_d3_s_b_43215615', SECTIONS)).toBeNull();
  });

  it('형식 위반 → 에러 메시지에 필드명·원본값·원인 포함', () => {
    const issue = validateStripAccountName(0, '아무거나', SECTIONS);
    expect(issue?.field).toBe('구좌 1 진열 ID');
    expect(issue?.reason).toMatch(/「아무거나」/);
    expect(issue?.reason).toMatch(/형식이 아닙니다/);
  });

  it('형식 OK지만 진열 목록에 없음 → 에러', () => {
    const issue = validateStripAccountName(2, 'c_d9_p_t_곰', SECTIONS);
    expect(issue?.field).toBe('구좌 3 진열 ID');
    expect(issue?.reason).toMatch(/찾을 수 없는/);
  });
});

describe('validateStripHeight', () => {
  it('비어 있는 값은 검증 통과(기본값/미설정 구좌)', () => {
    expect(validateStripHeight(0, '')).toBeNull();
    expect(validateStripHeight(0, '   ')).toBeNull();
  });

  it('84 또는 104는 통과', () => {
    expect(validateStripHeight(0, '84')).toBeNull();
    expect(validateStripHeight(0, '104')).toBeNull();
    expect(validateStripHeight(0, ' 84 ')).toBeNull();
  });

  it('84/104가 아니면 경고(필드명·원본값 포함)', () => {
    const issue = validateStripHeight(0, '90');
    expect(issue?.field).toBe('구좌 1 세로(높이)');
    expect(issue?.reason).toMatch(/84 또는 104/);
    expect(issue?.reason).toMatch(/90/);
  });

  it('숫자가 아니면 경고', () => {
    expect(validateStripHeight(1, 'abc')?.field).toBe('구좌 2 세로(높이)');
    expect(validateStripHeight(1, 'abc')?.reason).toMatch(/84 또는 104/);
  });
});

describe('validateBannerImage', () => {
  it('이미지가 있으면 통과', () => {
    expect(validateBannerImage(0, true)).toBeNull();
  });

  it('이미지가 없으면 경고(필드명·안내 포함)', () => {
    const issue = validateBannerImage(0, false);
    expect(issue?.field).toBe('구좌 1 배너 이미지');
    expect(issue?.reason).toMatch(/이미지가 설정되지 않/);
  });
});

describe('validateMainSize', () => {
  it('둘 다 비어 있으면 통과(사용 안 함 구좌)', () => {
    expect(validateMainSize(0, '', '')).toBeNull();
    expect(validateMainSize(0, '  ', '  ')).toBeNull();
  });

  it('한쪽만 비어 있으면 에러', () => {
    expect(validateMainSize(0, '16', '')?.reason).toMatch(/둘 다 입력/);
    expect(validateMainSize(0, '', '9')?.reason).toMatch(/둘 다 입력/);
  });

  it('16:9 비율은 통과(정확값 + 비례값)', () => {
    expect(validateMainSize(0, '16', '9')).toBeNull();
    expect(validateMainSize(0, '1920', '1080')).toBeNull();
  });

  it('3:2 비율은 통과', () => {
    expect(validateMainSize(0, '3', '2')).toBeNull();
    expect(validateMainSize(0, '600', '400')).toBeNull();
  });

  it('16:9 / 3:2 둘 다 아니면 에러(예: 12:5, 4:3)', () => {
    expect(validateMainSize(0, '12', '5')?.reason).toMatch(/16:9 또는 3:2/);
    expect(validateMainSize(0, '4', '3')?.reason).toMatch(/16:9 또는 3:2/);
  });

  it('포트레이트(9:16, 2:3)는 W>H 규칙 위반으로 에러', () => {
    expect(validateMainSize(0, '9', '16')?.reason).toMatch(/16:9 또는 3:2/);
    expect(validateMainSize(0, '1080', '1920')?.reason).toMatch(/16:9 또는 3:2/);
  });

  it('숫자가 아니거나 0 이하면 에러', () => {
    expect(validateMainSize(0, 'abc', '9')?.reason).toMatch(/0보다 큰 숫자/);
    expect(validateMainSize(0, '0', '0')?.reason).toMatch(/0보다 큰 숫자/);
    expect(validateMainSize(0, '-16', '-9')?.reason).toMatch(/0보다 큰 숫자/);
  });
});

describe('validateActiveAccountCount', () => {
  it('정확히 1개는 통과', () => {
    expect(validateActiveAccountCount(1)).toBeNull();
  });

  it('0개는 에러(아무것도 노출 안 됨)', () => {
    const issue = validateActiveAccountCount(0);
    expect(issue?.field).toBe('메인배너 사용 구좌');
    expect(issue?.reason).toMatch(/사용 중인 구좌가 없/);
  });

  it('2개 이상은 에러(3-3 규칙 위반)', () => {
    expect(validateActiveAccountCount(2)?.reason).toMatch(/2개/);
    expect(validateActiveAccountCount(3)?.reason).toMatch(/3개/);
  });
});
