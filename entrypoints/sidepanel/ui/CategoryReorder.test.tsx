import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryReorder } from './CategoryReorder';
import { sendMessage } from '../../../lib/messaging';
import type { TopCategory } from '../../../lib/shopby/display-categories';

vi.mock('../../../lib/messaging', () => ({
  sendMessage: vi.fn(() => Promise.resolve({ status: 'done', applied: 3 })),
}));

function top(categoryNo: number, name: string, order: number): TopCategory {
  return { categoryNo, name, managementCode: `c_${order}`, depth: 1, children: [], order };
}

const TOPS: TopCategory[] = [top(10, 'A', 1), top(20, 'B', 2), top(30, 'C', 3)];

describe('CategoryReorder', () => {
  beforeEach(() => vi.mocked(sendMessage).mockClear());
  afterEach(() => vi.mocked(sendMessage).mockReset());

  it('상위가 2개 미만이면 렌더하지 않는다', () => {
    const { container } = render(<CategoryReorder env="c" tops={[TOPS[0]]} onApplied={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('순서 변경 전에는 적용 버튼이 비활성', () => {
    render(<CategoryReorder env="c" tops={TOPS} onApplied={() => {}} />);
    expect((screen.getByRole('button', { name: '순서 적용' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('▲▼로 순서를 바꾸면 적용이 활성화되고, 확인 모달에 저장 시퀀스를 보여준다', async () => {
    render(<CategoryReorder env="c" tops={TOPS} onApplied={() => {}} />);

    // A(첫 행)를 아래로 → [B, A, C]
    fireEvent.click(screen.getByRole('button', { name: 'A 아래로 이동' }));
    const apply = screen.getByRole('button', { name: '순서 적용' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);

    fireEvent.click(apply);
    const plan = screen.getByTestId('reorder-plan');
    // 인접 swap: B 파킹(c_4) → A 이동(c_2) → B 최종(c_1)
    expect(plan.textContent).toContain('B→ c_4');
    expect(plan.textContent).toContain('A→ c_2');
    expect(plan.textContent).toContain('B→ c_1');
  });

  it('저장 진행 시 올바른 steps로 메시지를 보낸다', async () => {
    render(<CategoryReorder env="c" tops={TOPS} onApplied={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'A 아래로 이동' }));
    fireEvent.click(screen.getByRole('button', { name: '순서 적용' }));
    fireEvent.click(screen.getByRole('button', { name: '저장 진행' }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage).toHaveBeenCalledWith('applyCategoryReorder', {
      env: 'c',
      steps: [
        { categoryNo: 20, name: 'B', newCode: 'c_4' },
        { categoryNo: 10, name: 'A', newCode: 'c_2' },
        { categoryNo: 20, name: 'B', newCode: 'c_1' },
      ],
    });
    await waitFor(() => expect(screen.getByText(/순서 변경 완료/)).toBeTruthy());
  });

  it('되돌리기로 원래 순서로 복귀한다', () => {
    render(<CategoryReorder env="c" tops={TOPS} onApplied={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'A 아래로 이동' }));
    expect((screen.getByRole('button', { name: '순서 적용' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect((screen.getByRole('button', { name: '순서 적용' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
