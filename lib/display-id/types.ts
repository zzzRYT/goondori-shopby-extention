export type Env = 'c' | 'ct';
export type Method = 'p' | 's';

export const USER_TYPE_CHARS = ['병', '곰', '가', '지', '부', '장', '팬'] as const;
export type UserTypeChar = (typeof USER_TYPE_CHARS)[number];

// 전시 토큰: 스토어 홈 노출 여부와 진열 순서를 한 토큰으로 표현한다.
//   onHome: true  → 홈에 전시(ID 의 `d{n}`), order 오름차순 정렬
//   onHome: false → 홈 비노출(ID 의 `nd`), 진열 ID 직접 조회로만 진입(브랜드 페이지 등)
export type Display = { onHome: true; order: number } | { onHome: false };

type DisplayCommon = { env: Env; display: Display; method: Method };

export type DisplaySpec =
  | (DisplayCommon & { type: 't'; userTypes: UserTypeChar[] })
  | (DisplayCommon & { type: 'b'; brandNo: string })
  | (DisplayCommon & { type: 'n'; label: string });

export type Issue = { field: string; severity: 'error' | 'warn'; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };
