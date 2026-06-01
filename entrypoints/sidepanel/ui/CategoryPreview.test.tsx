import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryPreview } from './CategoryPreview';
import type { TopCategory } from '../../../lib/shopby/display-categories';

const tops: TopCategory[] = [
  { categoryNo: 1, name: '베스트', managementCode: 'c_1', depth: 1, order: 1, children: [
    { categoryNo: 11, name: '카테고리1', managementCode: '', depth: 2, children: [] },
  ] },
  { categoryNo: 2, name: '오늘의딜', managementCode: 'c_2', depth: 1, order: 2, children: [] },
];

describe('CategoryPreview', () => {
  it('상위 카테고리를 탭으로 렌더한다', () => {
    render(<CategoryPreview tops={tops} selectedNo={1} onSelect={() => {}} onOpen={() => {}} />);
    expect(screen.getByText('베스트')).toBeTruthy();
    expect(screen.getByText('오늘의딜')).toBeTruthy();
  });

  it('선택 상위의 하위를 칩으로 렌더한다', () => {
    render(<CategoryPreview tops={tops} selectedNo={1} onSelect={() => {}} onOpen={() => {}} />);
    expect(screen.getByText('카테고리1')).toBeTruthy();
  });

  it('선택 상위에 하위가 없으면 칩 행을 렌더하지 않는다', () => {
    render(<CategoryPreview tops={tops} selectedNo={2} onSelect={() => {}} onOpen={() => {}} />);
    expect(screen.queryByTestId('category-chip-row')).toBeNull();
  });

  it('탭 클릭 시 onSelect 호출', () => {
    const onSelect = vi.fn();
    const { getByText } = render(<CategoryPreview tops={tops} selectedNo={1} onSelect={onSelect} onOpen={() => {}} />);
    getByText('오늘의딜').click();
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
