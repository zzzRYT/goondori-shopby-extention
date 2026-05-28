import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDisplayBrandDetails, fetchShowcaseBrands, searchAllBrands } from './brands-showcase';

function page(nos: number[]) {
  return new Response(JSON.stringify({ items: nos.map((brandNo) => ({ brandNo })) }), { status: 200 });
}

describe('searchAllBrands', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('가득 찬 페이지면 다음 페이지를 이어 받고 brandNo만 모은다', async () => {
    const full = Array.from({ length: 100 }, (_, i) => i + 1);
    const responses = [page(full), page([101, 102])];
    const spy = vi.fn(() => Promise.resolve(responses.shift()!));
    vi.stubGlobal('fetch', spy);

    const result = await searchAllBrands('client');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result).toEqual([...full, 101, 102]);
  });

  it('단일 페이지(100개 미만)면 한 번만 호출한다', async () => {
    const spy = vi.fn(() => Promise.resolve(page([5, 6, 7])));
    vi.stubGlobal('fetch', spy);

    const result = await searchAllBrands('client');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([5, 6, 7]);
  });
});

describe('fetchDisplayBrandDetails', () => {
  afterEach(() => vi.unstubAllGlobals());

  function detail(brandNo: number, extraInfo = '', imageUrl = '') {
    return { brandNo, name: `브랜드${brandNo}`, extraInfo, displayAreaContentUrl: imageUrl };
  }

  it('100개 이하면 한 번만 호출하고 정규화한다', async () => {
    const spy = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [detail(1, 'c_1', 'https://img/1.png'), detail(2, 'ct_1')] }),
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

  it('100개 초과면 청크로 나눠 병렬 호출하고 brandNo 순서로 머지한다', async () => {
    const first = Array.from({ length: 100 }, (_, i) => i + 1);
    const second = [101, 102];

    const spy = vi.fn((input: URL) => {
      const url = new URL(input);
      const nos = url.searchParams.get('brandNos')!.split(',').map(Number);
      const items = nos.map((no) => detail(no));
      return Promise.resolve(new Response(JSON.stringify({ items }), { status: 200 }));
    });
    vi.stubGlobal('fetch', spy);

    const result = await fetchDisplayBrandDetails([...first, ...second], 'client');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(102);
    expect(result.map((r) => r.brandNo)).toEqual([...first, ...second]);
  });

  it('빈 입력이면 호출 없이 빈 배열을 반환한다', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);

    const result = await fetchDisplayBrandDetails([], 'client');

    expect(spy).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('null/누락 필드는 안전한 기본값으로 정규화한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ items: [{ brandNo: 9, name: null, extraInfo: null, displayAreaContentUrl: null }] }),
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
      if (url.pathname === '/brands/search') {
        return Promise.resolve(new Response(JSON.stringify({ items: [{ brandNo: 1 }, { brandNo: 2 }] }), { status: 200 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              { brandNo: 1, name: '브랜드1', extraInfo: 'c_1', displayAreaContentUrl: '' },
              { brandNo: 2, name: '브랜드2', extraInfo: '', displayAreaContentUrl: '' },
            ],
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal('fetch', spy);

    const result = await fetchShowcaseBrands('client');

    expect(calls).toEqual(['/brands/search', '/display/brands/search-by-nos']);
    expect(result.map((b) => b.brandNo)).toEqual([1, 2]);
  });
});
