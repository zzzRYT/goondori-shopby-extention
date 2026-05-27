import { describe, expect, it } from 'vitest';
import { previewTitle } from './title';

describe('previewTitle', () => {
  it('{이름}을 사용자 이름으로 치환한다', () => {
    expect(previewTitle('{이름}님을 위한 추천 상품', '지성현')).toBe('지성현님을 위한 추천 상품');
  });

  it('예약어가 없으면 그대로', () => {
    expect(previewTitle('군인을 위한 꿀템', '지성현')).toBe('군인을 위한 꿀템');
  });

  it('이름 미지정 시 플레이스홀더로 표시', () => {
    expect(previewTitle('{이름}님 환영', '')).toBe('OOO님 환영');
  });
});
