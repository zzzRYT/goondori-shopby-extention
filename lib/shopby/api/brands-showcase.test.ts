import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BRAND_DETAIL_CHUNK_SIZE,
  fetchDisplayBrandDetails,
  fetchShowcaseBrands,
  searchAllBrands,
} from './brands-showcase';

function searchPage(nos: number[]) {
  // /display/brands/search 응답: 배열 그대로
  return new Response(JSON.stringify(nos.map((brandNo) => ({ brandNo, mainBrandName: `브랜드${brandNo}` }))), {
    status: 200,
  });
}

describe('searchAllBrands', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('가득 찬 페이지면 다음 페이지를 이어 받고 brandNo만 모은다', async () => {
    const full = Array.from({ length: 100 }, (_, i) => i + 1);
    const responses = [searchPage(full), searchPage([101, 102])];
    const spy = vi.fn(() => Promise.resolve(responses.shift()!));
    vi.stubGlobal('fetch', spy);

    const result = await searchAllBrands('client');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result).toEqual([...full, 101, 102]);
  });

  it('단일 페이지(100개 미만)면 한 번만 호출한다', async () => {
    const spy = vi.fn(() => Promise.resolve(searchPage([5, 6, 7])));
    vi.stubGlobal('fetch', spy);

    const result = await searchAllBrands('client');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([5, 6, 7]);
  });

  it('쿼리에 pageSize=100 / sortCriterion=BRAND_NAME / pageNumber를 포함한다', async () => {
    const spy = vi.fn((_input: URL) => Promise.resolve(searchPage([])));
    vi.stubGlobal('fetch', spy);

    await searchAllBrands('client');

    const callUrl = new URL(spy.mock.calls[0][0]);
    expect(callUrl.pathname).toBe('/display/brands/search');
    expect(callUrl.searchParams.get('pageSize')).toBe('100');
    expect(callUrl.searchParams.get('sortCriterion')).toBe('BRAND_NAME');
    expect(callUrl.searchParams.get('pageNumber')).toBe('1');
    // brandName='' 은 shopApiGet이 빈 문자열을 제외하므로 직렬화되지 않는다(의도된 전체 조회).
  });
});

describe('fetchDisplayBrandDetails', () => {
  afterEach(() => vi.unstubAllGlobals());

  function detail(displayBrandNo: number, extraInfo = '', imageUrl = '') {
    return {
      displayBrandNo,
      mainBrandName: `브랜드${displayBrandNo}`,
      extraInfo,
      displayAreaContentUrl: imageUrl,
    };
  }

  it('청크 한도 이하면 한 번만 호출하고 정규화한다', async () => {
    const spy = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ brands: [detail(1, 'c_1', 'https://img/1.png'), detail(2, 'ct_1')] }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', spy);

    const result = await fetchDisplayBrandDetails([1, 2], 'client');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { brandNo: 1, name: '브랜드1', extraInfo: 'c_1', imageUrl: 'https://img/1.png' },
      { brandNo: 2, name: '브랜드2', extraInfo: 'ct_1', imageUrl: '' },
    ]);
  });

  it('청크 한도 초과면 청크로 나눠 병렬 호출하고 brandNo 순서로 머지한다', async () => {
    const totalChunks = 3;
    const tailSize = 2;
    const all = Array.from(
      { length: BRAND_DETAIL_CHUNK_SIZE * (totalChunks - 1) + tailSize },
      (_, i) => i + 1,
    );

    const spy = vi.fn((input: URL) => {
      const url = new URL(input);
      const nos = url.searchParams.get('displayBrandNos')!.split(',').map(Number);
      expect(nos.length).toBeLessThanOrEqual(BRAND_DETAIL_CHUNK_SIZE);
      const brands = nos.map((no) => detail(no));
      return Promise.resolve(new Response(JSON.stringify({ brands }), { status: 200 }));
    });
    vi.stubGlobal('fetch', spy);

    const result = await fetchDisplayBrandDetails(all, 'client');

    expect(spy).toHaveBeenCalledTimes(totalChunks);
    expect(result).toHaveLength(all.length);
    expect(result.map((r) => r.brandNo)).toEqual(all);
  });

  it('빈 입력이면 호출 없이 빈 배열을 반환한다', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);

    const result = await fetchDisplayBrandDetails([], 'client');

    expect(spy).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('protocol-relative 이미지 URL은 https:로 보정한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              brands: [
                {
                  displayBrandNo: 7,
                  mainBrandName: '브랜드7',
                  extraInfo: '',
                  displayAreaContentUrl: '//shopby-images.cdn-nhncommerce.com/path/image.png',
                },
                {
                  displayBrandNo: 8,
                  mainBrandName: '브랜드8',
                  extraInfo: '',
                  displayAreaContentUrl: 'https://already.example.com/x.png',
                },
              ],
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await fetchDisplayBrandDetails([7, 8], 'client');

    expect(result[0].imageUrl).toBe('https://shopby-images.cdn-nhncommerce.com/path/image.png');
    expect(result[1].imageUrl).toBe('https://already.example.com/x.png');
  });

  it('null/누락 필드는 안전한 기본값으로 정규화한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              brands: [
                {
                  displayBrandNo: 9,
                  mainBrandName: null,
                  subBrandName: null,
                  extraInfo: null,
                  displayAreaContentUrl: null,
                },
              ],
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    const [entry] = await fetchDisplayBrandDetails([9], 'client');

    expect(entry).toEqual({ brandNo: 9, name: '브랜드 #9', extraInfo: '', imageUrl: '' });
  });
});

describe('fetchShowcaseBrands', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searchAllBrands → fetchDisplayBrandDetails 순서로 호출하고 결과를 그대로 반환한다', async () => {
    const calls: string[] = [];
    const spy = vi.fn((input: URL) => {
      const url = new URL(input);
      calls.push(url.pathname);
      if (url.pathname === '/display/brands/search') {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { brandNo: 1, mainBrandName: '브랜드1' },
              { brandNo: 2, mainBrandName: '브랜드2' },
            ]),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            brands: [
              { displayBrandNo: 1, mainBrandName: '브랜드1', extraInfo: 'c_1', displayAreaContentUrl: '' },
              { displayBrandNo: 2, mainBrandName: '브랜드2', extraInfo: '', displayAreaContentUrl: '' },
            ],
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal('fetch', spy);

    const result = await fetchShowcaseBrands('client');

    expect(calls).toEqual(['/display/brands/search', '/display/brands/search-by-nos']);
    expect(result.map((b) => b.brandNo)).toEqual([1, 2]);
  });
});
