import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DisplayBuilder } from './DisplayBuilder';
import { deriveDisplay, INITIAL_BUILDER_STATE, type BuilderState } from './display-state';
import { fetchBrands } from '../../../lib/shopby/api/brands';

vi.mock('../../../lib/shopby/api/brands', () => ({
  fetchBrands: vi.fn(() => Promise.resolve([{ brandNo: 43186744, name: '나이키' }])),
}));

// controlled 전환 후: 부모가 상태를 소유한다. 테스트는 작은 컨트롤드 래퍼로 감싼다.
function Harness({ onState }: { onState?: (state: BuilderState) => void }) {
  const [value, setValue] = useState<BuilderState>(INITIAL_BUILDER_STATE);
  return (
    <DisplayBuilder
      value={value}
      onChange={(next) => {
        setValue(next);
        onState?.(next);
      }}
    />
  );
}

describe('DisplayBuilder', () => {
  it('사용자유형 칩 토글을 진열 ID 미리보기에 반영한다', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));

    expect(screen.getByText('c_d1_p_t_병')).toBeTruthy();
  });

  it('기존 진열 ID를 붙여넣으면 폼을 복원한다', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('기존 진열 ID'), { target: { value: 'c_d2_p_t_병부장' } });

    expect(screen.getByText('c_d2_p_t_병부장')).toBeTruthy();
    expect(screen.getByRole('button', { name: '병' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '부' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '장' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('홈 비노출(nd) 토글을 진열 ID 미리보기에 반영한다', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));
    fireEvent.click(screen.getByRole('button', { name: '비노출 nd' }));

    expect(screen.getByText('c_nd_p_t_병')).toBeTruthy();
  });

  it('nd 진열 ID를 붙여넣으면 홈 비노출 상태로 복원한다', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('기존 진열 ID'), { target: { value: 'c_nd_s_b_43215615' } });

    expect(screen.getByText('c_nd_s_b_43215615')).toBeTruthy();
    expect(screen.getByRole('button', { name: '비노출 nd' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('조립 결과(진열 ID·오류 여부)를 deriveDisplay로 도출한다', () => {
    const onState = vi.fn();
    render(<Harness onState={onState} />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));

    const last = onState.mock.calls.at(-1)?.[0] as BuilderState;
    const derived = deriveDisplay(last);
    expect(derived.displayId).toBe('c_d1_p_t_병');
    expect(derived.hasError).toBe(false);
  });

  it('브랜드 타입에서 브랜드를 선택하면 brandNo로 진열 ID를 조립한다', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: '브랜드 b' }));
    const combo = await screen.findByRole('combobox', { name: '브랜드' });
    fireEvent.focus(combo);
    fireEvent.click(screen.getByRole('option', { name: /나이키/ }));

    expect(screen.getByText('c_d1_p_b_43186744')).toBeTruthy();
  });
});
