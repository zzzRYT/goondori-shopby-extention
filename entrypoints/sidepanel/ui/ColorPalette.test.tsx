import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ColorPalette } from './ColorPalette';

function Harness({ initial = ['#008000', '#ffd400', '#ff3b30'] }: { initial?: string[] }) {
  const [palette, setPalette] = useState<string[]>(initial);
  return (
    <>
      <ColorPalette palette={palette} onChange={setPalette} />
      <output data-testid="palette">{palette.join(',')}</output>
    </>
  );
}

function palette() {
  return screen.getByTestId('palette').textContent;
}

describe('ColorPalette', () => {
  it('팔레트 색마다 피커 스와치를 렌더한다', () => {
    render(<Harness />);

    expect(screen.getByLabelText('팔레트 색 1')).toBeTruthy();
    expect(screen.getByLabelText('팔레트 색 2')).toBeTruthy();
    expect(screen.getByLabelText('팔레트 색 3')).toBeTruthy();
  });

  it('"색 추가" → 색이 하나 늘어난다', () => {
    render(<Harness />);

    fireEvent.click(screen.getByText('＋ 색 추가'));

    expect(palette()).toBe('#008000,#ffd400,#ff3b30,#2563eb');
  });

  it('삭제 → 그 색만 빠진다', () => {
    render(<Harness />);

    fireEvent.click(screen.getByLabelText('팔레트 색 2 삭제'));

    expect(palette()).toBe('#008000,#ff3b30');
  });

  it('피커로 색을 수정한다', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('팔레트 색 1'), { target: { value: '#123456' } });

    expect(palette()).toBe('#123456,#ffd400,#ff3b30');
  });
});
