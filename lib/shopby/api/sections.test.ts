import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSections } from './sections';

function stubJson(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))),
  );
}

describe('fetchSections', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sectionId가 있는 진열만 정규화해 반환한다', async () => {
    stubJson({
      sections: [
        { sectionNo: 1, sectionId: 'c_d1_p_t_병부장', sectionName: '베스트' },
        { sectionNo: 2, sectionId: '  ', sectionName: '아이디 없음' },
        { sectionNo: 3, sectionId: null, sectionName: '아이디 null' },
      ],
    });

    const result = await fetchSections('client');

    expect(result).toEqual([{ sectionNo: 1, sectionId: 'c_d1_p_t_병부장', sectionName: '베스트' }]);
  });

  it('진열명이 비면 진열 ID를 라벨로 대체한다', async () => {
    stubJson({ sections: [{ sectionNo: 5, sectionId: 'c_d2_s_b_43215615', sectionName: '   ' }] });

    const [entry] = await fetchSections('client');

    expect(entry.sectionName).toBe('c_d2_s_b_43215615');
  });

  it('sections가 없으면 빈 배열을 반환한다', async () => {
    stubJson({});

    expect(await fetchSections('client')).toEqual([]);
  });
});
