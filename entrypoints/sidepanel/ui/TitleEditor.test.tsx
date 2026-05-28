import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TitleEditor } from './TitleEditor';

function setTitle(value: string) {
  fireEvent.change(screen.getByLabelText('진열명'), { target: { value } });
}

function addWord(word: string) {
  const input = screen.getByLabelText('강조 단어 추가');
  fireEvent.change(input, { target: { value: word } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('TitleEditor', () => {
  it('단어를 추가하면 프리뷰에 자동 배정된 색이 입혀진다', () => {
    const { container } = render(<TitleEditor onChange={() => {}} />);

    setTitle('군인을 위한 꿀템');
    addWord('군인');

    const colored = container.querySelector('.title-preview span[style*="#008000"]');
    expect(colored?.textContent).toBe('군인');
    expect(screen.getByText('정상')).toBeTruthy();
  });

  it('진열명에 없는 단어 칩은 경고 배지를 표시한다', () => {
    render(<TitleEditor onChange={() => {}} />);

    setTitle('군인을 위한 꿀템');
    addWord('없는단어');

    expect(screen.getByText('경고 1')).toBeTruthy();
  });

  it('진열명과 직렬화된 색상 규칙을 onChange로 보고한다', () => {
    const onChange = vi.fn();
    render(<TitleEditor onChange={onChange} />);

    setTitle('군인을 위한 꿀템');
    addWord('군인');

    expect(onChange).toHaveBeenLastCalledWith({
      title: '군인을 위한 꿀템',
      color: '군인#008000',
      hasError: false,
    });
  });

  it('칩 색을 "색 없음"으로 바꾸면 직렬화에서 빠진다', () => {
    const onChange = vi.fn();
    render(<TitleEditor onChange={onChange} />);

    setTitle('군인을 위한 꿀템');
    addWord('군인');
    fireEvent.click(screen.getByLabelText('군인 색 변경'));
    fireEvent.click(screen.getByText('색 없음'));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: '군인을 위한 꿀템', color: '' }),
    );
  });

  it('기존 색상 규칙 원문을 붙여넣으면 칩으로 복원한다', () => {
    const onChange = vi.fn();
    render(<TitleEditor onChange={onChange} />);

    setTitle('군인을 위한 꿀템');
    fireEvent.change(screen.getByLabelText('기존 색상 규칙 불러오기'), {
      target: { value: '군인#008000, 꿀템#FFFF00' },
    });

    expect(screen.getByLabelText('군인 색 변경')).toBeTruthy();
    expect(screen.getByLabelText('꿀템 색 변경')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: '군인#008000, 꿀템#FFFF00' }),
    );
  });
});
