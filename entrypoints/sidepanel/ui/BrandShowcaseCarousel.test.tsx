import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrandShowcaseCarousel } from './BrandShowcaseCarousel';

const slots = [
  { slot: 1, brand: { brandNo: 1, name: '브랜드1', extraInfo: 'c_1', imageUrl: '' } },
  { slot: 2, brand: { brandNo: 2, name: '브랜드2', extraInfo: 'c_2', imageUrl: '' } },
];

describe('BrandShowcaseCarousel', () => {
  it('슬롯 항목을 list 역할로 렌더한다', () => {
    render(<BrandShowcaseCarousel assignments={slots} env="prod" />);

    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('스크롤이 불필요할 때(콘텐츠 ≤ 컨테이너) chevron은 disabled', () => {
    render(<BrandShowcaseCarousel assignments={slots} env="prod" />);

    expect((screen.getByRole('button', { name: '이전 브랜드' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '다음 브랜드' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('다음 chevron 클릭 시 scrollBy가 호출된다', () => {
    // 콘텐츠가 컨테이너보다 넓다고 가정 — scrollWidth/clientWidth를 직접 stub
    const scrollBy = vi.fn();
    HTMLElement.prototype.scrollBy = scrollBy;
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 200 });

    render(<BrandShowcaseCarousel assignments={slots} env="prod" />);

    fireEvent.click(screen.getByRole('button', { name: '다음 브랜드' }));

    expect(scrollBy).toHaveBeenCalled();
    expect(scrollBy.mock.calls[0][0]).toMatchObject({ behavior: 'smooth' });
  });
});
