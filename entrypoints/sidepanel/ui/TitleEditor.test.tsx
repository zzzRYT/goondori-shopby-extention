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

function setPreviewName(value: string) {
  fireEvent.change(screen.getByLabelText('미리보기 이름'), { target: { value } });
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

  it('칩의 컬러 피커로 색을 바꾸면 직렬화에 반영된다', () => {
    const onChange = vi.fn();
    render(<TitleEditor onChange={onChange} />);

    setTitle('군인을 위한 꿀템');
    addWord('군인');
    fireEvent.change(screen.getByLabelText('군인 색 변경'), { target: { value: '#123456' } });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: '군인을 위한 꿀템', color: '군인#123456' }),
    );
  });

  it('칩의 단어가 {이름} 예약어면 치환된 사용자 이름이 강조된다', () => {
    const { container } = render(<TitleEditor onChange={() => {}} />);

    setTitle('{이름}님을 위한 추천');
    addWord('{이름}');

    const colored = container.querySelector('.title-preview span[style*="#008000"]');
    expect(colored?.textContent).toBe('지성현');
  });

  it('미리보기 이름이 비면 {이름} 칩은 OOO를 강조한다', () => {
    const { container } = render(<TitleEditor onChange={() => {}} />);

    setTitle('{이름}님을 위한 추천');
    addWord('{이름}');
    setPreviewName('');

    const colored = container.querySelector('.title-preview span[style*="#008000"]');
    expect(colored?.textContent).toBe('OOO');
  });

  it('진열명에 {이름} 토큰이 있어도 일반 단어 칩은 강조된다', () => {
    const { container } = render(<TitleEditor onChange={() => {}} />);

    setTitle('{이름}님을 위한 추천');
    addWord('추천');

    const colored = container.querySelector('.title-preview span[style*="#008000"]');
    expect(colored?.textContent).toBe('추천');
  });
});
