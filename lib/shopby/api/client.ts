import { SHOP_API_BASE, SHOPBY_API_VERSION, SHOPBY_CLIENT_ID, SHOPBY_PLATFORM } from './config';

export class ShopApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = 'ShopApiError';
    this.status = options.status;
    this.code = options.code;
  }
}

type QueryValue = string | number | boolean | undefined;
export type Query = Record<string, QueryValue>;

type ErrorBody = { message?: unknown; code?: unknown };

// 샵바이 Shop API GET 호출. 필수 헤더(Version·clientId·platform)를 붙이고, 실패 응답의
// JSON 에러 메시지를 사람이 읽을 수 있는 ShopApiError로 정규화한다.
// clientId 인자는 테스트에서 주입하기 위한 것이며, 기본값은 고정 설정을 쓴다.
export async function shopApiGet<T>(path: string, query: Query = {}, clientId: string = SHOPBY_CLIENT_ID): Promise<T> {
  if (!clientId) {
    throw new ShopApiError('샵바이 clientId가 설정되지 않았습니다. config.ts를 확인하세요.');
  }

  const url = new URL(path, SHOP_API_BASE);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Version: SHOPBY_API_VERSION,
        clientId,
        platform: SHOPBY_PLATFORM,
      },
    });
  } catch {
    throw new ShopApiError('샵바이 API에 연결하지 못했습니다. 네트워크를 확인하세요.');
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = (body ?? {}) as ErrorBody;
    const message = typeof errorBody.message === 'string' ? errorBody.message : `요청에 실패했습니다 (${response.status}).`;
    const code = typeof errorBody.code === 'string' ? errorBody.code : undefined;
    throw new ShopApiError(message, { status: response.status, code });
  }

  return body as T;
}
