import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DisplayBuilder } from './DisplayBuilder';

describe('DisplayBuilder', () => {
  it('사용자유형 칩 토글을 진열 ID 미리보기에 반영한다', () => {
    render(<DisplayBuilder onChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));

    expect(screen.getByText('c_1_p_t_병')).toBeTruthy();
  });

  it('기존 진열 ID를 붙여넣으면 폼을 복원한다', () => {
    render(<DisplayBuilder onChange={() => {}} />);

    fireEvent.change(screen.getByLabelText('기존 진열 ID'), { target: { value: 'c_2_p_t_병부장' } });

    expect(screen.getByText('c_2_p_t_병부장')).toBeTruthy();
    expect(screen.getByRole('button', { name: '병' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '부' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '장' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('조립 결과(진열 ID·오류 여부)를 onChange로 보고한다', () => {
    const onChange = vi.fn();
    render(<DisplayBuilder onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));

    expect(onChange).toHaveBeenLastCalledWith({ displayId: 'c_1_p_t_병', hasError: false });
  });
});
