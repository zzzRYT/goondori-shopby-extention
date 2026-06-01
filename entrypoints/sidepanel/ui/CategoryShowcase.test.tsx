import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryShowcase } from './CategoryShowcase';

vi.mock('../../../lib/messaging', () => ({
  sendMessage: vi.fn(() => Promise.resolve({ status: 'opened' })),
}));

// /categories/simple-1depth 평면 1차 목록.
const SIMPLE_1DEPTH = [
  { displayCategoryNo: 1, displayCategoryName: '베스트', displayManagementCode: 'c_1' },
  { displayCategoryNo: 2, displayCategoryName: '테스트탭', displayManagementCode: 'ct_1' },
];

// /categories/{categoryNo} 상세(하위 트리).
const DETAIL: Record<number, unknown> = {
  1: { multiLevelCategories: [{ categoryNo: 1, depth: 1, label: '베스트', managementCode: 'c_1', children: [] }], flatCategories: [] },
  2: { multiLevelCategories: [{ categoryNo: 2, depth: 1, label: '테스트탭', managementCode: 'ct_1', children: [] }], flatCategories: [] },
};

function stubFetch(impl: (input?: unknown) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

// simple-1depth와 상세를 path로 분기하는 기본 스텁.
function routed(simple1depth: unknown = SIMPLE_1DEPTH, detail: Record<number, unknown> = DETAIL) {
  return (input: unknown) => {
    const url = String(input);
    if (url.includes('/categories/simple-1depth')) return ok(simple1depth);
    const match = /\/categories\/(\d+)/.exec(url);
    if (match) return ok(detail[Number(match[1])]);
    return Promise.resolve(new Response('{}', { status: 404 }));
  };
}

describe('CategoryShowcase', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('운영 환경 기본 — c_ 상위만 보인다', async () => {
    stubFetch(routed());
    render(<CategoryShowcase />);
    await waitFor(() => expect(screen.getAllByText('베스트').length).toBeGreaterThan(0));
    expect(screen.queryByText('테스트탭')).toBeNull();
  });

  it('개발(ct) 토글 시 ct_ 상위만 보인다', async () => {
    stubFetch(routed());
    render(<CategoryShowcase />);
    await waitFor(() => expect(screen.getAllByText('베스트').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /테스트 ct/ }));
    await waitFor(() => expect(screen.getAllByText('테스트탭').length).toBeGreaterThan(0));
    expect(screen.queryByText('베스트')).toBeNull();
  });

  it('로딩 중에는 로딩 인디케이터를 보여준다', () => {
    stubFetch(() => new Promise(() => {})); // never resolves
    render(<CategoryShowcase />);
    expect(screen.getByTestId('category-showcase-loading')).toBeTruthy();
  });

  it('에러 시 alert를 보여준다', async () => {
    stubFetch(() => Promise.resolve(new Response('{"message":"실패"}', { status: 500 })));
    render(<CategoryShowcase />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('해당 환경에 코드 상위가 없으면 빈 안내를 보여준다', async () => {
    stubFetch(routed([
      { displayCategoryNo: 9, displayCategoryName: '미분류', displayManagementCode: '' },
    ], {}));
    render(<CategoryShowcase />);
    await waitFor(() => expect(screen.getByText(/코드 설정된 상위 카테고리가 없습니다/)).toBeTruthy());
  });
});
