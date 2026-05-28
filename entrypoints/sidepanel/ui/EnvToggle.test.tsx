import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EnvToggle } from './EnvToggle';

describe('EnvToggle', () => {
  it('현재 환경에 해당하는 버튼이 aria-pressed=true', () => {
    render(<EnvToggle value="prod" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: '운영(prod)' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '개발(dev)' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('다른 환경 버튼을 누르면 onChange가 호출된다', () => {
    const onChange = vi.fn();
    render(<EnvToggle value="prod" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '개발(dev)' }));

    expect(onChange).toHaveBeenCalledWith('dev');
  });

  it('같은 환경 버튼을 다시 눌러도 onChange는 호출되지 않는다', () => {
    const onChange = vi.fn();
    render(<EnvToggle value="prod" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '운영(prod)' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
