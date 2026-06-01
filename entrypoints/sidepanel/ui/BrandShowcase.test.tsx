import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrandShowcase } from './BrandShowcase';
import * as api from '../../../lib/shopby/api/brands-showcase';

const sample = [
  { brandNo: 1, name: '브랜드1', extraInfo: 'c_1 ct_2', imageUrl: '' },
  { brandNo: 2, name: '브랜드2', extraInfo: 'c_2', imageUrl: '' },
];

describe('BrandShowcase', () => {
  afterEach(() => vi.restoreAllMocks());

  it('로딩 중엔 로딩 인디케이터를 보여준다', () => {
    vi.spyOn(api, 'fetchShowcaseBrands').mockReturnValue(new Promise(() => {}));

    render(<BrandShowcase />);

    expect(screen.getByTestId('brand-showcase-loading')).toBeTruthy();
  });

  it('에러 상태에선 메시지와 다시 시도 버튼을 표시한다', async () => {
    vi.spyOn(api, 'fetchShowcaseBrands').mockRejectedValue(new Error('네트워크 끊김'));

    render(<BrandShowcase />);

    expect(await screen.findByText('네트워크 끊김')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });

  it('성공 후 매칭 0건이면 안내 문구', async () => {
    vi.spyOn(api, 'fetchShowcaseBrands').mockResolvedValue([
      { brandNo: 9, name: '브9', extraInfo: '', imageUrl: '' },
    ]);

    render(<BrandShowcase />);

    expect(await screen.findByText(/노출 설정된 브랜드가 없습니다/)).toBeTruthy();
  });

  it('prod에서 dev로 토글하면 재요청 없이 다른 슬롯이 나타난다', async () => {
    const spy = vi.spyOn(api, 'fetchShowcaseBrands').mockResolvedValue(sample);

    render(<BrandShowcase />);

    // carousel과 list 양쪽에 같은 브랜드/슬롯 라벨이 노출된다 → getAll로 매칭.
    await waitFor(() => expect(screen.getAllByText('브랜드1').length).toBeGreaterThan(0));
    expect(screen.getAllByLabelText('노출 슬롯 1').map((el) => el.textContent)).toEqual(['c_1', 'c_1']);

    fireEvent.click(screen.getByRole('button', { name: '개발(dev)' }));

    expect(screen.getAllByLabelText('노출 슬롯 2').map((el) => el.textContent)).toEqual(['ct_2', 'ct_2']);
    expect(spy).toHaveBeenCalledTimes(1); // 재요청 없음
  });
});
