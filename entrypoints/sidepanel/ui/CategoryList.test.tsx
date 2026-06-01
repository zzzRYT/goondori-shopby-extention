import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryList } from './CategoryList';
import type { TopCategory } from '../../../lib/shopby/display-categories';

const tops: TopCategory[] = [
  { categoryNo: 1, name: '베스트', managementCode: 'c_1', depth: 1, order: 1, children: [
    { categoryNo: 11, name: '카테고리1', managementCode: '', depth: 2, children: [] },
  ] },
];

describe('CategoryList', () => {
  it('상위 행에 코드와 이름을 표시한다', () => {
    render(<CategoryList tops={tops} onOpen={() => {}} />);
    expect(screen.getByText('c_1')).toBeTruthy();
    expect(screen.getByText('베스트')).toBeTruthy();
  });

  it('기본은 접힘 — 하위가 보이지 않는다', () => {
    render(<CategoryList tops={tops} onOpen={() => {}} />);
    expect(screen.queryByText('카테고리1')).toBeNull();
  });

  it('상위 행 클릭 시 펼쳐져 하위가 보인다', () => {
    render(<CategoryList tops={tops} onOpen={() => {}} />);
    // 토글 버튼은 aria-expanded를 가진 유일한 버튼(열기 아이콘과 구분).
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('카테고리1')).toBeTruthy();
  });

  it('우측 열기 아이콘 클릭 시 onOpen(상위) 호출 (토글되지 않음)', () => {
    const onOpen = vi.fn();
    render(<CategoryList tops={tops} onOpen={onOpen} />);
    screen.getByRole('button', { name: '어드민에서 열기: 베스트' }).click();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ categoryNo: 1 }));
    expect(screen.queryByText('카테고리1')).toBeNull(); // 토글 안 됨
  });
});
