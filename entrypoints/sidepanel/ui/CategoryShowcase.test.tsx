import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryShowcase } from './CategoryShowcase';

vi.mock('../../../lib/messaging', () => ({
  sendMessage: vi.fn(() => Promise.resolve({ status: 'opened' })),
}));

const TREE = {
  multiLevelCategories: [
    { categoryNo: 1, depth: 1, label: '베스트', managementCode: 'c_1', content: '', icon: '', children: [] },
    { categoryNo: 2, depth: 1, label: '테스트탭', managementCode: 'ct_1', content: '', icon: '', children: [] },
  ],
  flatCategories: [],
};

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

function okTree(body: unknown) {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe('CategoryShowcase', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('운영 환경 기본 — c_ 상위만 보인다', async () => {
    stubFetch(okTree(TREE));
    render(<CategoryShowcase />);
    await waitFor(() => expect(screen.getAllByText('베스트').length).toBeGreaterThan(0));
    expect(screen.queryByText('테스트탭')).toBeNull();
  });

  it('개발(ct) 토글 시 ct_ 상위만 보인다', async () => {
    stubFetch(okTree(TREE));
    render(<CategoryShowcase />);
    await waitFor(() => expect(screen.getAllByText('베스트').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /테스트 ct/ }));
    await waitFor(() => expect(screen.getAllByText('테스트탭').length).toBeGreaterThan(0));
    expect(screen.queryByText('베스트')).toBeNull();
  });

  it('로딩 중에는 스켈레톤을 보여준다', () => {
    stubFetch(() => new Promise(() => {})); // never resolves
    render(<CategoryShowcase />);
    expect(screen.getByTestId('category-showcase-skeleton')).toBeTruthy();
  });

  it('에러 시 alert를 보여준다', async () => {
    stubFetch(() => Promise.resolve(new Response('{"message":"실패"}', { status: 500 })));
    render(<CategoryShowcase />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('해당 환경에 코드 상위가 없으면 빈 안내를 보여준다', async () => {
    stubFetch(okTree({ multiLevelCategories: [
      { categoryNo: 9, depth: 1, label: '미분류', managementCode: '', content: '', icon: '', children: [] },
    ], flatCategories: [] }));
    render(<CategoryShowcase />);
    await waitFor(() => expect(screen.getByText(/코드 설정된 상위 카테고리가 없습니다/)).toBeTruthy());
  });
});
