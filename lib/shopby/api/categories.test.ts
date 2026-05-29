import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCategoryDetail, fetchDisplayCategories } from './categories';

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

const SAMPLE = {
  multiLevelCategories: [
    {
      categoryNo: 10,
      depth: 1,
      label: '베스트',
      managementCode: 'c_1',
      content: '',
      icon: '',
      children: [
        { categoryNo: 11, depth: 2, label: '카테고리1', managementCode: '', content: '', icon: '', children: [] },
      ],
    },
  ],
  flatCategories: [],
};

describe('fetchDisplayCategories', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('multiLevelCategories를 DisplayCategoryEntry 트리로 정규화한다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok(SAMPLE)));

    const result = await fetchDisplayCategories('client');

    expect(result).toEqual([
      {
        categoryNo: 10,
        name: '베스트',
        managementCode: 'c_1',
        depth: 1,
        children: [
          { categoryNo: 11, name: '카테고리1', managementCode: '', depth: 2, children: [] },
        ],
      },
    ]);
  });

  it('이름(label)이 비면 "카테고리 #{no}" 라벨', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({
      multiLevelCategories: [{ categoryNo: 7, depth: 1, label: '  ', managementCode: '', content: '', icon: '', children: [] }],
      flatCategories: [],
    })));

    const [entry] = await fetchDisplayCategories('client');
    expect(entry.name).toBe('카테고리 #7');
  });

  it('children 없으면 빈 배열로 정규화', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({
      multiLevelCategories: [{ categoryNo: 1, depth: 1, label: 'A', managementCode: 'c_1', content: '', icon: '' }],
      flatCategories: [],
    })));

    const [entry] = await fetchDisplayCategories('client');
    expect(entry.children).toEqual([]);
  });
});

describe('fetchCategoryDetail', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('단일 카테고리 상세의 children을 반환한다', async () => {
    const spy = vi.fn(() => ok(SAMPLE));
    vi.stubGlobal('fetch', spy);

    const detail = await fetchCategoryDetail(10, 'client');

    expect(detail.categoryNo).toBe(10);
    expect(detail.children).toHaveLength(1);
    expect(detail.children[0].name).toBe('카테고리1');
    // 경로에 categoryNo가 들어갔는지 확인
    const url = String((spy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('/categories/10');
  });
});
