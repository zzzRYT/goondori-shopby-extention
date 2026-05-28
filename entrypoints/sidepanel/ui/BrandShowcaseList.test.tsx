import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '../../../lib/messaging';
import { BrandShowcaseList } from './BrandShowcaseList';

vi.mock('../../../lib/messaging', () => ({
  sendMessage: vi.fn(),
}));

const assignments = [
  { slot: 1, brand: { brandNo: 11, name: '브랜드A', extraInfo: 'c_1', imageUrl: 'https://img/a.png' } },
  { slot: 2, brand: { brandNo: 22, name: '브랜드B', extraInfo: 'c_2', imageUrl: '' } },
  { slot: 2, brand: { brandNo: 33, name: '브랜드C', extraInfo: 'c_2', imageUrl: '' } },
];

describe('BrandShowcaseList', () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockReset();
    vi.mocked(sendMessage).mockResolvedValue({ status: 'opened' });
  });

  it('전달된 순서대로 행을 렌더하고 prod 환경은 c_n 라벨을 쓴다', () => {
    render(<BrandShowcaseList assignments={assignments} env="prod" />);

    const rows = screen.getAllByTestId('brand-list-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('c_1')).toBeTruthy();
    expect(within(rows[0]).getByText('브랜드A')).toBeTruthy();
    expect(within(rows[0]).getByText('#11')).toBeTruthy();
    expect(within(rows[1]).getByText('c_2')).toBeTruthy();
    expect(within(rows[2]).getByText('c_2')).toBeTruthy();
  });

  it('dev 환경에선 ct_n 라벨을 쓴다', () => {
    render(<BrandShowcaseList assignments={assignments.slice(0, 1)} env="dev" />);

    expect(screen.getByText('ct_1')).toBeTruthy();
  });

  it('동일 슬롯이 둘 이상인 행에는 충돌 표시가 붙는다', () => {
    render(<BrandShowcaseList assignments={assignments} env="prod" />);

    const conflictRows = screen.getAllByLabelText('동일 슬롯 충돌');
    expect(conflictRows).toHaveLength(2);
    const rows = screen.getAllByTestId('brand-list-row');
    expect(within(rows[0]).queryByLabelText('동일 슬롯 충돌')).toBeNull();
  });

  it('imageUrl이 비면 placeholder가 노출된다', () => {
    render(<BrandShowcaseList assignments={[assignments[1]]} env="prod" />);

    const img = screen.queryByRole('img');
    expect(img).toBeNull();
  });

  it('row 클릭 시 openBrandEditor 메시지를 보낸다', async () => {
    render(<BrandShowcaseList assignments={assignments} env="prod" />);

    const rows = screen.getAllByTestId('brand-list-row');
    fireEvent.click(rows[1]);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('openBrandEditor', { name: '브랜드B', brandNo: 22 });
    });
  });

  it('not-found 응답이면 오류 힌트를 보여준다', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      status: 'not-found',
      message: '관리자 트리에서 해당 브랜드를 찾지 못했어요',
    });
    render(<BrandShowcaseList assignments={assignments} env="prod" />);

    const rows = screen.getAllByTestId('brand-list-row');
    fireEvent.click(rows[0]);

    const hint = await screen.findByRole('status');
    expect(hint.textContent).toContain('찾지 못했어요');
  });
});
