import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BannerBuilder } from './BannerBuilder';
import { sendMessage } from '../../../lib/messaging';

vi.mock('../../../lib/messaging', () => ({
  sendMessage: vi.fn(),
}));

describe('BannerBuilder', () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockReset();
    vi.mocked(sendMessage).mockResolvedValue({ filled: [], failed: [] });
  });

  it('띠 모드에서 구좌명이 잘못된 진열 ID면 오류 배지를 띄우고 채우기를 막는다', () => {
    render(<BannerBuilder />);

    fireEvent.click(screen.getByRole('button', { name: '띠' }));
    fireEvent.change(screen.getByLabelText('구좌명'), { target: { value: '잘못된ID' } });

    expect(screen.getByText('오류 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: '어드민에 채우기' })).toHaveProperty('disabled', true);
  });

  it('띠 모드에서 유효한 진열 ID와 랜딩 URL을 fillBanner로 보낸다', () => {
    render(<BannerBuilder />);

    fireEvent.click(screen.getByRole('button', { name: '띠' }));
    fireEvent.change(screen.getByLabelText('구좌명'), { target: { value: 'c_1_p_t_병부장' } });
    fireEvent.change(screen.getByLabelText('랜딩 URL'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillBanner', [
      { key: 'account0.accountName', value: 'c_1_p_t_병부장' },
      { key: 'account0.landingUrl', value: 'https://example.com' },
    ]);
  });

  it('메인 모드 16:9 프리셋으로 사이즈를 채우고 fillBanner에 포함한다', () => {
    render(<BannerBuilder />);

    fireEvent.change(screen.getByLabelText('구좌명'), { target: { value: '스토어_메인배너' } });
    fireEvent.click(screen.getByRole('button', { name: '16:9' }));
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillBanner', [
      { key: 'account0.accountName', value: '스토어_메인배너' },
      { key: 'account0.width', value: '16' },
      { key: 'account0.height', value: '9' },
    ]);
  });

  it('구좌 번호를 2로 바꾸면 account1 키로 보낸다', () => {
    render(<BannerBuilder />);

    fireEvent.change(screen.getByLabelText('구좌 번호'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('구좌명'), { target: { value: '스토어_메인배너' } });
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillBanner', [{ key: 'account1.accountName', value: '스토어_메인배너' }]);
  });
});
