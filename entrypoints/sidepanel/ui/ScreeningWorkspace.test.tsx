import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanState } from '../hooks/useScreeningScan';
import { SEED_RULES } from '../../../lib/shopby/screening/seed-rules';

const startMock = vi.fn();
const cancelMock = vi.fn();
let scanState: ScanState;

vi.mock('../hooks/useScreeningRules', () => ({
  useScreeningRules: () => ({ rules: SEED_RULES, save: vi.fn() }),
}));
vi.mock('../hooks/useScreeningScan', () => ({
  useScreeningScan: () => ({ state: scanState, start: startMock, cancel: cancelMock }),
}));

import { ScreeningWorkspace } from './ScreeningWorkspace';

describe('ScreeningWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scanState = { phase: 'idle', done: 0, total: 0, results: [], countMismatch: false, error: null };
  });

  it('스캔 시작 버튼이 규칙과 함께 start를 호출한다', async () => {
    render(<ScreeningWorkspace />);

    await userEvent.click(screen.getByRole('button', { name: /스캔 시작/ }));

    expect(startMock).toHaveBeenCalledWith(SEED_RULES);
  });

  it('스캔 중에는 중단 버튼과 진행률을 보여준다', () => {
    scanState = { ...scanState, phase: 'scanning', done: 34, total: 78 };

    render(<ScreeningWorkspace />);

    expect(screen.getByRole('button', { name: /중단/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('34 / 78');
  });

  it('세션 만료 안내를 보여준다', () => {
    scanState = { ...scanState, phase: 'session-expired' };

    render(<ScreeningWorkspace />);

    expect(screen.getByText(/세션 만료/)).toBeInTheDocument();
  });

  it('수집 건수 불일치 경고를 보여준다', () => {
    scanState = { ...scanState, phase: 'done', countMismatch: true };

    render(<ScreeningWorkspace />);

    expect(screen.getByText(/일부 상품이 빠졌을 수 있어요/)).toBeInTheDocument();
  });
});
