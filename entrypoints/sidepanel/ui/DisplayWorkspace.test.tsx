import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplayWorkspace } from './DisplayWorkspace';
import { sendMessage } from '../../../lib/messaging';

vi.mock('../../../lib/messaging', () => ({
  sendMessage: vi.fn(),
}));

describe('DisplayWorkspace', () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockReset();
  });

  it('진열 ID·진열명·색상을 한 번에 fillDisplay로 보낸다', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      filled: [{ key: 'displayId' }, { key: 'title' }, { key: 'color' }],
      failed: [],
    });
    render(<DisplayWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));
    fireEvent.change(screen.getByLabelText('진열명'), { target: { value: '군인을 위한 꿀템' } });
    fireEvent.change(screen.getByLabelText('색상 규칙'), { target: { value: '군인#008000' } });
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillDisplay', [
      { key: 'displayId', value: 'c_1_p_t_병' },
      { key: 'title', value: '군인을 위한 꿀템' },
      { key: 'color', value: '군인#008000' },
    ]);
    expect(await screen.findByText('채움 3 · 실패 0')).toBeTruthy();
  });

  it('진열명·색상이 비어 있으면 진열 ID만 보낸다', () => {
    vi.mocked(sendMessage).mockResolvedValue({ filled: [{ key: 'displayId' }], failed: [] });
    render(<DisplayWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillDisplay', [{ key: 'displayId', value: 'c_1_p_t_병' }]);
  });

  it('진열 ID에 오류가 있으면 채우기 버튼이 비활성화된다', () => {
    render(<DisplayWorkspace />);

    // 사용자유형 미선택 → "c_1_p_t_" 는 사용자 유형 문자가 비어 error.
    expect(screen.getByRole('button', { name: '어드민에 채우기' })).toHaveProperty('disabled', true);
  });
});
