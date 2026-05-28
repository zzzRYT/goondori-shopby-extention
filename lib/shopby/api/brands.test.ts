import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBrands } from './brands';

function pageOf(count: number, startNo = 1): { brandNo: number; name: string }[] {
  return Array.from({ length: count }, (_, i) => ({ brandNo: startNo + i, name: `브랜드${startNo + i}` }));
}

describe('fetchBrands', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('단일 페이지(100개 미만)면 한 번만 호출하고 정규화한다', async () => {
    const spy = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items: pageOf(2) }), { status: 200 })));
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
      new Response(JSON.stringify({ items: pageOf(100, 1) }), { status: 200 }),
      new Response(JSON.stringify({ items: pageOf(3, 101) }), { status: 200 }),
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
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items: [{ brandNo: 7, name: '  ' }] }), { status: 200 }))),
    );

    const [entry] = await fetchBrands('client');

    expect(entry).toEqual({ brandNo: 7, name: '브랜드 #7' });
  });
});
