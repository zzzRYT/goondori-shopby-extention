import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TitleEditor } from './TitleEditor';

describe('TitleEditor', () => {
  it('진열명과 색상 규칙으로 색상 프리뷰를 만든다', () => {
    render(<TitleEditor onChange={() => {}} />);

    fireEvent.change(screen.getByLabelText('진열명'), { target: { value: '군인을 위한 꿀템' } });
    fireEvent.change(screen.getByLabelText('색상 규칙'), { target: { value: '군인#008000, 꿀템#FFFF00' } });

    expect(screen.getByText('정상')).toBeTruthy();
    expect(screen.getByText('군인').getAttribute('style')).toContain('#008000');
    expect(screen.getByText('꿀템').getAttribute('style')).toContain('#FFFF00');
  });

  it('진열명에 없는 색상 단어는 경고 배지를 표시한다', () => {
    render(<TitleEditor onChange={() => {}} />);

    fireEvent.change(screen.getByLabelText('진열명'), { target: { value: '군인을 위한 꿀템' } });
    fireEvent.change(screen.getByLabelText('색상 규칙'), { target: { value: '없는단어#FF0000' } });

    expect(screen.getByText('경고 1')).toBeTruthy();
  });

  it('진열명과 색상 규칙 원문을 onChange로 보고한다', () => {
    const onChange = vi.fn();
    render(<TitleEditor onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('진열명'), { target: { value: '군인을 위한 꿀템' } });
    fireEvent.change(screen.getByLabelText('색상 규칙'), { target: { value: '군인#008000' } });

    expect(onChange).toHaveBeenLastCalledWith({
      title: '군인을 위한 꿀템',
      color: '군인#008000',
      hasError: false,
    });
  });

  it('잘못된 HEX는 hasError true로 보고한다', () => {
    const onChange = vi.fn();
    render(<TitleEditor onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('진열명'), { target: { value: '베스트' } });
    fireEvent.change(screen.getByLabelText('색상 규칙'), { target: { value: '베스트#ZZZ' } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ hasError: true }));
  });
});
