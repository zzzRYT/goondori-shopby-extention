import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryGuide } from './CategoryGuide';

describe('CategoryGuide', () => {
  it('순서 변경 핵심 안내(중복 불가·중복확인·저장)를 보여준다', () => {
    render(<CategoryGuide />);
    expect(screen.getByText('전시 순서 변경 방법')).toBeTruthy();
    expect(screen.getByText(/중복이 허용되지 않으므로/)).toBeTruthy();
    expect(screen.getByText(/“중복 확인”과 “저장”이 필수/)).toBeTruthy();
    expect(screen.getByText(/c_1 → ‘’\(빈 값\)/)).toBeTruthy();
  });
});
