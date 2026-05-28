import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { serializeChips, type ColorChip } from '../../../lib/display-id';
import { WordChips } from './WordChips';

function Harness({ initial = [] }: { initial?: ColorChip[] }) {
  const [chips, setChips] = useState<ColorChip[]>(initial);
  return (
    <>
      <WordChips chips={chips} onChange={setChips} />
      <output data-testid="serialized">{serializeChips(chips)}</output>
    </>
  );
}

function addWord(word: string) {
  const input = screen.getByLabelText('강조 단어 추가');
  fireEvent.change(input, { target: { value: word } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

function serialized() {
  return screen.getByTestId('serialized').textContent;
}

describe('WordChips', () => {
  it('단어 입력 후 Enter → 칩 추가 + 자동색 = DEFAULT_PALETTE[0]', () => {
    render(<Harness />);

    addWord('군인');

    expect(screen.getByText('군인')).toBeTruthy();
    expect(serialized()).toBe('군인#008000');
  });

  it('두 번째 칩은 라운드로빈으로 DEFAULT_PALETTE[1]을 받는다', () => {
    render(<Harness />);

    addWord('군인');
    addWord('꿀템');

    expect(serialized()).toBe('군인#008000, 꿀템#FFD400');
  });

  it('네 번째 칩은 라운드로빈이 DEFAULT_PALETTE[0]으로 되돌아온다', () => {
    render(<Harness />);

    addWord('가');
    addWord('나');
    addWord('다');
    addWord('라');

    expect(serialized()).toBe('가#008000, 나#FFD400, 다#FF3B30, 라#008000');
  });

  it('빈 단어는 칩을 만들지 않는다', () => {
    render(<Harness />);

    addWord('   ');

    expect(serialized()).toBe('');
  });

  it('칩의 컬러 피커로 색을 바꾸면 그 칩만 변경된다', () => {
    render(
      <Harness
        initial={[
          { word: '군인', hex: '#008000' },
          { word: '꿀템', hex: '#FFD400' },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText('군인 색 변경'), { target: { value: '#ff3b30' } });

    expect(serialized()).toBe('군인#ff3b30, 꿀템#FFD400');
  });

  it('× 클릭 → 칩 삭제', () => {
    render(
      <Harness
        initial={[
          { word: '군인', hex: '#008000' },
          { word: '꿀템', hex: '#FFD400' },
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText('군인 삭제'));

    expect(screen.queryByText('군인')).toBeNull();
    expect(serialized()).toBe('꿀템#FFD400');
  });

  it('IME 조합 중 Enter는 칩을 추가하지 않는다(마지막 글자 중복 방지)', () => {
    render(<Harness />);

    const input = screen.getByLabelText('강조 단어 추가') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '군인' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(screen.queryByText('군인')).toBeNull();
    expect(serialized()).toBe('');
    expect(input.value).toBe('군인');
  });
});
