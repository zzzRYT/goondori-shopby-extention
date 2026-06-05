import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplayWorkspace } from './DisplayWorkspace';
import { sendMessage } from '../../../lib/messaging';

vi.mock('../../../lib/messaging', () => ({
  sendMessage: vi.fn(),
}));

// fillDisplay와 readCurrentDisplay가 같은 mock을 공유하므로 메시지 타입으로 분기한다.
// readCurrentDisplay는 기본적으로 빈 객체(어드민 폼 없음)를 돌려주게 둔다.
function mockMessaging(readResult: Record<string, string> = {}) {
  vi.mocked(sendMessage).mockImplementation((async (type: string) => {
    if (type === 'readCurrentDisplay') return readResult;
    return { filled: [{ key: 'displayId' }], failed: [] };
  }) as unknown as typeof sendMessage);
}

describe('DisplayWorkspace', () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockReset();
    mockMessaging();
  });

  it('진열 ID·진열명·색상을 한 번에 fillDisplay로 보낸다', async () => {
    render(<DisplayWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));
    fireEvent.change(screen.getByLabelText('진열명'), { target: { value: '군인을 위한 꿀템' } });
    const wordInput = screen.getByLabelText('강조 단어 추가');
    fireEvent.change(wordInput, { target: { value: '군인' } });
    fireEvent.keyDown(wordInput, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillDisplay', [
      { key: 'displayId', value: 'c_d1_p_t_병' },
      { key: 'title', value: '군인을 위한 꿀템' },
      { key: 'color', value: '군인#008000' },
    ]);
  });

  it('진열명·색상이 비어 있으면 진열 ID만 보낸다', () => {
    render(<DisplayWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillDisplay', [{ key: 'displayId', value: 'c_d1_p_t_병' }]);
  });

  it('진열 ID에 오류가 있으면 채우기 버튼이 비활성화된다', () => {
    render(<DisplayWorkspace />);

    expect(screen.getByRole('button', { name: '어드민에 채우기' })).toHaveProperty('disabled', true);
  });

  it('노출여부를 선택하면 display.radio.exposureYn 필드를 함께 보낸다', () => {
    render(<DisplayWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));
    fireEvent.click(screen.getByRole('button', { name: '비노출' }));
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillDisplay', [
      { key: 'displayId', value: 'c_d1_p_t_병' },
      { key: 'display.radio.exposureYn', value: 'N' },
    ]);
  });

  it('노출여부를 다시 누르면 선택 해제되고 필드가 빠진다', () => {
    render(<DisplayWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: '병' }));
    fireEvent.click(screen.getByRole('button', { name: '노출' }));
    fireEvent.click(screen.getByRole('button', { name: '노출' }));
    fireEvent.click(screen.getByRole('button', { name: '어드민에 채우기' }));

    expect(sendMessage).toHaveBeenCalledWith('fillDisplay', [{ key: 'displayId', value: 'c_d1_p_t_병' }]);
  });

  it('마운트 시 어드민 값을 자동으로 불러와 편집기에 채운다', async () => {
    mockMessaging({ displayId: 'c_d2_p_t_병', title: '군인을 위한 꿀템', color: '군인#008000' });
    render(<DisplayWorkspace />);

    expect(await screen.findByText('진열 ID·진열명·설명 불러옴')).toBeTruthy();
    expect(screen.getByText('c_d2_p_t_병')).toBeTruthy();
    expect(screen.getByLabelText('진열명')).toHaveProperty('value', '군인을 위한 꿀템');
    expect(screen.getByRole('button', { name: '병' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('재조회 버튼으로 어드민 값을 다시 불러온다', async () => {
    let call = 0;
    vi.mocked(sendMessage).mockImplementation((async (type: string) => {
      if (type === 'readCurrentDisplay') {
        call += 1;
        return call === 1 ? {} : { displayId: 'c_d1_p_t_병' };
      }
      return { filled: [], failed: [] };
    }) as unknown as typeof sendMessage);
    render(<DisplayWorkspace />);

    // 마운트 자동 조회가 끝나 버튼이 평상 라벨로 돌아오면 클릭한다.
    fireEvent.click(await screen.findByRole('button', { name: /현재 어드민 값 불러오기/ }));

    expect(await screen.findByText('진열 ID 불러옴')).toBeTruthy();
    expect(screen.getByText('c_d1_p_t_병')).toBeTruthy();
  });

  it('어드민 폼이 없으면(빈 응답) 수동 조회 시 안내 문구를 보여준다', async () => {
    mockMessaging({});
    render(<DisplayWorkspace />);

    fireEvent.click(await screen.findByRole('button', { name: /현재 어드민 값 불러오기/ }));

    expect(await screen.findByText('어드민에서 진열 수정 화면을 연 뒤 다시 눌러주세요')).toBeTruthy();
  });

  it('읽기 실패 시 에러 문구를 보여준다', async () => {
    vi.mocked(sendMessage).mockImplementation((async (type: string) => {
      if (type === 'readCurrentDisplay') throw new Error('content script 응답 없음');
      return { filled: [], failed: [] };
    }) as unknown as typeof sendMessage);
    render(<DisplayWorkspace />);

    expect(await screen.findByText('어드민 값을 불러오지 못했어요')).toBeTruthy();
  });
});
