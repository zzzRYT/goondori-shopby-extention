import { afterEach, describe, expect, it, vi } from 'vitest';
import { shopApiGet, ShopApiError } from './client';

function mockFetch(impl: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn((input: URL | RequestInfo, init?: RequestInit) => Promise.resolve(impl(input as URL, init)));
  vi.stubGlobal('fetch', spy);
  return spy;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('shopApiGet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('필수 헤더(Version·clientId·platform)를 붙여 호출한다', async () => {
    const spy = mockFetch(() => jsonResponse({ ok: true }));

    await shopApiGet('/display/sections', {}, 'real-client-id');

    const [, init] = spy.mock.calls[0];
    expect(init?.headers).toMatchObject({ Version: '1.0', clientId: 'real-client-id', platform: 'PC' });
  });

  it('정의된 쿼리만 붙이고 undefined·빈 문자열은 제외한다', async () => {
    const spy = mockFetch(() => jsonResponse({ ok: true }));

    await shopApiGet('/display/brands', { pageNumber: 2, 'filter.name': '', skip: undefined }, 'c');

    const [url] = spy.mock.calls[0] as [URL];
    expect(url.searchParams.get('pageNumber')).toBe('2');
    expect(url.searchParams.has('filter.name')).toBe(false);
    expect(url.searchParams.has('skip')).toBe(false);
  });

  it('clientId가 비어 있으면 호출 전에 에러를 던진다', async () => {
    const spy = mockFetch(() => jsonResponse({ ok: true }));

    await expect(shopApiGet('/display/sections', {}, '')).rejects.toBeInstanceOf(ShopApiError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('실패 응답의 JSON message·code를 ShopApiError로 정규화한다', async () => {
    mockFetch(() => jsonResponse({ code: 'CI001', message: 'clientId가 올바르지 않습니다.' }, 400));

    const error = await shopApiGet('/display/sections', {}, 'bad').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ShopApiError);
    expect((error as ShopApiError).message).toBe('clientId가 올바르지 않습니다.');
    expect((error as ShopApiError).status).toBe(400);
    expect((error as ShopApiError).code).toBe('CI001');
  });

  it('네트워크 실패는 연결 에러 메시지로 감싼다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

    const error = await shopApiGet('/display/sections', {}, 'c').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ShopApiError);
    expect((error as ShopApiError).message).toContain('연결하지 못했습니다');
  });
});
