import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandShowcaseCard } from './BrandShowcaseCard';

const baseBrand = { brandNo: 1, name: '브랜드1', extraInfo: 'c_1', imageUrl: '' };

describe('BrandShowcaseCard', () => {
  it('썸네일·이름·슬롯 배지를 표시한다', () => {
    render(
      <BrandShowcaseCard
        slot={2}
        brand={{ ...baseBrand, imageUrl: 'https://img/x.png' }}
        env="prod"
        conflict={false}
      />,
    );

    expect(screen.getByRole('img', { name: '브랜드1' }).getAttribute('src')).toBe('https://img/x.png');
    expect(screen.getByText('브랜드1')).toBeTruthy();
    expect(screen.getByLabelText('노출 슬롯 2').textContent).toBe('c_2');
  });

  it('dev 환경에선 슬롯 배지가 ct_<n> 표기', () => {
    render(<BrandShowcaseCard slot={3} brand={baseBrand} env="dev" conflict={false} />);

    expect(screen.getByLabelText('노출 슬롯 3').textContent).toBe('ct_3');
  });

  it('imageUrl이 비면 placeholder가 표시되고 img는 렌더되지 않는다', () => {
    render(<BrandShowcaseCard slot={1} brand={baseBrand} env="prod" conflict={false} />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('brand-card-placeholder')).toBeTruthy();
  });

  it('conflict=true면 ⚠ 충돌 표시가 함께 나온다', () => {
    render(<BrandShowcaseCard slot={1} brand={baseBrand} env="prod" conflict={true} />);

    expect(screen.getByLabelText('동일 슬롯 충돌')).toBeTruthy();
  });
});
