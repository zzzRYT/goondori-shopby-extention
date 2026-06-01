import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCategoryDetail,
  fetchDisplayCategories,
  fetchSimple1DepthCategories,
} from './categories';

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

// path별로 다른 응답을 돌려주는 fetch 스텁. simple-1depth는 평면 목록, 상세는 트리.
function routedFetch(routes: { simple1depth: unknown; detail: Record<number, unknown> }) {
  return vi.fn((input: unknown) => {
    const url = String(input);
    if (url.includes('/categories/simple-1depth')) return ok(routes.simple1depth);
    const match = /\/categories\/(\d+)/.exec(url);
    if (match) return ok(routes.detail[Number(match[1])]);
    throw new Error(`unexpected url: ${url}`);
  });
}

describe('fetchSimple1DepthCategories', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('평면 1차 목록을 depth 1 DisplayCategoryEntry로 정규화한다(children 없음)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok([
      { displayCategoryNo: 10, displayCategoryName: '베스트', displayManagementCode: 'c_1' },
    ])));

    const result = await fetchSimple1DepthCategories('client');

    expect(result).toEqual([
      { categoryNo: 10, name: '베스트', managementCode: 'c_1', depth: 1, children: [] },
    ]);
  });

  it('이름이 비면 "카테고리 #{no}" 라벨', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok([
      { displayCategoryNo: 7, displayCategoryName: '  ', displayManagementCode: '' },
    ])));

    const [entry] = await fetchSimple1DepthCategories('client');
    expect(entry.name).toBe('카테고리 #7');
  });
});

describe('fetchDisplayCategories', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('simple-1depth 상위에 코드가 있으면 상세로 children을 채운다', async () => {
    vi.stubGlobal('fetch', routedFetch({
      simple1depth: [{ displayCategoryNo: 10, displayCategoryName: '베스트', displayManagementCode: 'c_1' }],
      detail: { 10: SAMPLE },
    }));

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

  it('미분류(코드 없는) 상위는 상세를 호출하지 않고 children을 비운다', async () => {
    const spy = routedFetch({
      simple1depth: [{ displayCategoryNo: 7, displayCategoryName: '미분류', displayManagementCode: '' }],
      detail: {},
    });
    vi.stubGlobal('fetch', spy);

    const result = await fetchDisplayCategories('client');

    expect(result).toEqual([
      { categoryNo: 7, name: '미분류', managementCode: '', depth: 1, children: [] },
    ]);
    // simple-1depth 한 번만 호출, 상세 호출 없음
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String((spy.mock.calls[0] as unknown[])[0])).toContain('/categories/simple-1depth');
  });

  it('/categories(1일 캐싱 전체 트리)는 호출하지 않는다', async () => {
    const spy = routedFetch({
      simple1depth: [{ displayCategoryNo: 10, displayCategoryName: '베스트', displayManagementCode: 'c_1' }],
      detail: { 10: SAMPLE },
    });
    vi.stubGlobal('fetch', spy);

    await fetchDisplayCategories('client');

    const urls = spy.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(urls.some((url) => /\/categories(\?|$)/.test(url))).toBe(false);
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
