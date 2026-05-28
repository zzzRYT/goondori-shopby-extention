import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchAllBrands } from './brands-showcase';

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
