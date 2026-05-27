import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DisplayBuilder } from './DisplayBuilder';

describe('DisplayBuilder', () => {
  it('사용자유형 칩 토글을 진열 ID 미리보기에 반영한다', () => {
    render(<DisplayBuilder />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));

    expect(screen.getByText('c_1_p_t_병')).toBeTruthy();
  });
});
