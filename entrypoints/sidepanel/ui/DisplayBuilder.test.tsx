import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DisplayBuilder } from './DisplayBuilder';
import { fetchBrands } from '../../../lib/shopby/api/brands';

vi.mock('../../../lib/shopby/api/brands', () => ({
  fetchBrands: vi.fn(() => Promise.resolve([{ brandNo: 43186744, name: '나이키' }])),
}));

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

  it('브랜드 타입에서 브랜드를 선택하면 brandNo로 진열 ID를 조립한다', async () => {
    render(<DisplayBuilder onChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '브랜드 b' }));
    const combo = await screen.findByRole('combobox', { name: '브랜드' });
    fireEvent.focus(combo);
    fireEvent.click(screen.getByRole('option', { name: /나이키/ }));

    expect(screen.getByText('c_1_p_b_43186744')).toBeTruthy();
  });
});
