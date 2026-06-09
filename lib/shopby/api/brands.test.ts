import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBrands } from './brands';

// /display/brands/search 는 {items} 래퍼 없이 [{brandNo, mainBrandName}] 배열을 반환한다.
function pageOf(count: number, startNo = 1): { brandNo: number; mainBrandName: string }[] {
  return Array.from({ length: count }, (_, i) => ({ brandNo: startNo + i, mainBrandName: `브랜드${startNo + i}` }));
}

describe('fetchBrands', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('display/brands/search 를 호출한다', async () => {
    const spy = vi.fn(() => Promise.resolve(new Response(JSON.stringify(pageOf(1)), { status: 200 })));
    vi.stubGlobal('fetch', spy);

    await fetchBrands('client');

    const requested = String((spy.mock.calls[0]![0] as URL).pathname);
    expect(requested).toBe('/display/brands/search');
  });

  it('단일 페이지(100개 미만)면 한 번만 호출하고 정규화한다', async () => {
    const spy = vi.fn(() => Promise.resolve(new Response(JSON.stringify(pageOf(2)), { status: 200 })));
    vi.stubGlobal('fetch', spy);

    const result = await fetchBrands('client');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { brandNo: 1, name: '브랜드1' },
      { brandNo: 2, name: '브랜드2' },
    ]);
  });

  it('가득 찬 페이지면 다음 페이지를 이어 받아 합친다', async () => {
    const responses = [
      new Response(JSON.stringify(pageOf(100, 1)), { status: 200 }),
      new Response(JSON.stringify(pageOf(3, 101)), { status: 200 }),
    ];
    const spy = vi.fn(() => Promise.resolve(responses.shift()!));
    vi.stubGlobal('fetch', spy);

    const result = await fetchBrands('client');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(103);
    expect(result.at(-1)).toEqual({ brandNo: 103, name: '브랜드103' });
  });

  it('이름이 비면 브랜드 번호로 라벨을 만든다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([{ brandNo: 7, mainBrandName: '  ' }]), { status: 200 }))),
    );

    const [entry] = await fetchBrands('client');

    expect(entry).toEqual({ brandNo: 7, name: '브랜드 #7' });
  });
});
