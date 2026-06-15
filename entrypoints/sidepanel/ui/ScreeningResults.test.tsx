import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ScreeningResult } from '../../../lib/shopby/screening/run-scan';
import { ScreeningResults } from './ScreeningResults';

const RESULTS: ScreeningResult[] = [
  { productNo: '1', productName: '정상 상품', kind: 'register', status: 'ok', violations: [], changes: [] },
  {
    productNo: '2',
    productName: '위반 1건',
    kind: 'register',
    status: 'ok',
    violations: [{ ruleId: 'r', label: '기본정보 · 제조사명', message: '필수 항목 공란', actual: '' }],
    changes: [],
  },
  {
    productNo: '3',
    productName: '위반 2건',
    kind: 'register',
    status: 'ok',
    violations: [
      { ruleId: 'a', label: '배송정보 · 상품 중량', message: '기대값 불일치 (기대 > 0)', actual: '0kg' },
      { ruleId: 'b', label: '이미지 · 상품이미지', message: '대표이미지 없음', actual: '' },
    ],
    changes: [],
  },
  { productNo: '4', productName: '수집 실패 상품', kind: 'register', status: 'failed', violations: [], changes: [], failReason: '수집 실패(타임아웃)' },
];

const MODIFY: ScreeningResult = {
  productNo: '9',
  productName: '수정 상품',
  kind: 'modify',
  status: 'ok',
  violations: [],
  changes: [{ section: '판매정보', label: '즉시할인', before: '15,000원', after: '20,000원' }],
};

describe('ScreeningResults', () => {
  it('기본은 위반만 보기 + 위반 많은 순 정렬', () => {
    render(<ScreeningResults results={RESULTS} onOpen={vi.fn()} />);

    const cards = screen.getAllByRole('button');
    expect(cards[0]).toHaveTextContent('위반 2건');
    expect(cards[1]).toHaveTextContent('위반 1건');
    expect(screen.queryByText(/정상 상품/)).not.toBeInTheDocument();
    expect(screen.getByText(/수집 실패 상품/)).toBeInTheDocument(); // 실패도 표시(침묵 누락 금지)
  });

  it('위반만 보기를 끄면 정상 상품도 보인다', async () => {
    render(<ScreeningResults results={RESULTS} onOpen={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: /위반만 보기/ }));

    expect(screen.getByText(/정상 상품/)).toBeInTheDocument();
  });

  it('카드 클릭 시 해당 상품번호로 onOpen', async () => {
    const onOpen = vi.fn();
    render(<ScreeningResults results={RESULTS} onOpen={onOpen} />);

    await userEvent.click(screen.getByText(/위반 2건/));

    expect(onOpen).toHaveBeenCalledWith('3');
  });

  it('위반 상세(항목·메시지·현재값)를 보여준다', () => {
    render(<ScreeningResults results={RESULTS} onOpen={vi.fn()} />);

    expect(screen.getByText(/상품 중량/)).toBeInTheDocument();
    expect(screen.getByText(/현재: 0kg/)).toBeInTheDocument();
  });

  it('수정 항목은 위반만 보기가 켜져 있어도 항상 노출된다', () => {
    render(<ScreeningResults results={[...RESULTS, MODIFY]} onOpen={vi.fn()} />);
    expect(screen.getByText(/수정 상품/)).toBeInTheDocument(); // 기본 violationsOnly=true
  });

  it('수정 카드는 변경 전 → 변경 후 diff를 보여준다', () => {
    render(<ScreeningResults results={[MODIFY]} onOpen={vi.fn()} />);
    expect(screen.getByText(/즉시할인/)).toBeInTheDocument();
    expect(screen.getByText(/15,000원 → 20,000원/)).toBeInTheDocument();
  });

  it('세그먼트 수정을 고르면 등록 항목은 숨는다', async () => {
    render(<ScreeningResults results={[...RESULTS, MODIFY]} onOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: '수정' }));
    expect(screen.getByText(/수정 상품/)).toBeInTheDocument();
    expect(screen.queryByText(/위반 2건/)).not.toBeInTheDocument();
  });
});
