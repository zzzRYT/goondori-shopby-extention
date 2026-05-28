import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { serializeChips, type ColorChip } from '../../../lib/display-id';
import { WordChips } from './WordChips';

const PALETTE = ['#008000', '#FFD400', '#FF3B30'];

function Harness({
  palette = PALETTE,
  initial = [],
}: {
  palette?: string[];
  initial?: ColorChip[];
}) {
  const [chips, setChips] = useState<ColorChip[]>(initial);
  return (
    <>
      <WordChips chips={chips} palette={palette} onChange={setChips} />
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
  it('단어 입력 후 Enter → 칩 추가 + 자동색 = palette[0]', () => {
    render(<Harness />);

    addWord('군인');

    expect(screen.getByText('군인')).toBeTruthy();
    expect(serialized()).toBe('군인#008000');
  });

  it('두 번째 칩은 라운드로빈으로 palette[1]을 받는다', () => {
    render(<Harness />);

    addWord('군인');
    addWord('꿀템');

    expect(serialized()).toBe('군인#008000, 꿀템#FFD400');
  });

  it('네 번째 칩은 라운드로빈이 palette[0]으로 되돌아온다', () => {
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

  it('칩 스와치 클릭 → 팔레트 색 선택 → 그 칩만 변경', () => {
    render(<Harness initial={[{ word: '군인', hex: '#008000' }, { word: '꿀템', hex: '#FFD400' }]} />);

    fireEvent.click(screen.getByLabelText('군인 색 변경'));
    fireEvent.click(screen.getByLabelText('색 #FF3B30'));

    expect(serialized()).toBe('군인#FF3B30, 꿀템#FFD400');
  });

  it('직접 hex 입력 → 그 칩 색에 반영', () => {
    render(<Harness initial={[{ word: '군인', hex: '#008000' }]} />);

    fireEvent.click(screen.getByLabelText('군인 색 변경'));
    fireEvent.change(screen.getByLabelText('직접 색 지정'), { target: { value: '#123456' } });

    expect(serialized()).toBe('군인#123456');
  });

  it('# 없이 입력해도 정규화해서 반영한다', () => {
    render(<Harness initial={[{ word: '군인', hex: '#008000' }]} />);

    fireEvent.click(screen.getByLabelText('군인 색 변경'));
    fireEvent.change(screen.getByLabelText('직접 색 지정'), { target: { value: 'abcdef' } });

    expect(serialized()).toBe('군인#abcdef');
  });

  it('"색 없음" → 직렬화에서 제외', () => {
    render(<Harness initial={[{ word: '군인', hex: '#008000' }, { word: '꿀템', hex: '#FFD400' }]} />);

    fireEvent.click(screen.getByLabelText('군인 색 변경'));
    fireEvent.click(screen.getByText('색 없음'));

    expect(serialized()).toBe('꿀템#FFD400');
  });

  it('× 클릭 → 칩 삭제', () => {
    render(<Harness initial={[{ word: '군인', hex: '#008000' }, { word: '꿀템', hex: '#FFD400' }]} />);

    fireEvent.click(screen.getByLabelText('군인 삭제'));

    expect(screen.queryByText('군인')).toBeNull();
    expect(serialized()).toBe('꿀템#FFD400');
  });

  it('팔레트가 비면 기본 팔레트로 자동 배정 폴백', () => {
    render(<Harness palette={[]} />);

    addWord('군인');

    expect(serialized()).toBe('군인#008000');
  });
});
