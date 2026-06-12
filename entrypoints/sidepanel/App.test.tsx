import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./ui/ScreeningWorkspace', () => ({
  ScreeningWorkspace: () => <div aria-label="상품심사 스캔">Screening Workspace Mock</div>,
}));

describe('App', () => {
  it('전시카테고리 탭이 보인다', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: '전시카테고리' })).toBeTruthy();
  });

  it('심사 탭을 클릭하면 ScreeningWorkspace를 보여준다', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '심사' }));

    expect(screen.getByLabelText('상품심사 스캔')).toBeInTheDocument();
  });
});
