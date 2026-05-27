import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplayBuilder } from './DisplayBuilder';
import { sendMessage } from '../../../lib/messaging';

vi.mock('../../../lib/messaging', () => ({
  sendMessage: vi.fn(),
}));

describe('DisplayBuilder', () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockReset();
  });

  it('사용자유형 칩 토글을 진열 ID 미리보기에 반영한다', () => {
    render(<DisplayBuilder />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));

    expect(screen.getByText('c_1_p_t_병')).toBeTruthy();
  });

  it('기존 진열 ID를 붙여넣으면 폼을 복원한다', () => {
    render(<DisplayBuilder />);

    fireEvent.change(screen.getByLabelText('기존 진열 ID'), { target: { value: 'c_2_p_t_병부장' } });

    expect(screen.getByText('c_2_p_t_병부장')).toBeTruthy();
    expect(screen.getByRole('button', { name: '병' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '부' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '장' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('채우기 버튼으로 어드민 fillDisplay 메시지를 보내고 결과를 표시한다', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ filled: [{ key: 'displayId' }], failed: [] });
    render(<DisplayBuilder />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillDisplay', [{ key: 'displayId', value: 'c_1_p_t_병' }]);
    expect(await screen.findByText('채움 1 · 실패 0')).toBeTruthy();
  });
});
