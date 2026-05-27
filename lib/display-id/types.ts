export type Env = 'c' | 'ct';
export type Method = 'p' | 's';

export const USER_TYPE_CHARS = ['병', '곰', '가', '지', '부', '장', '팬'] as const;
export type UserTypeChar = (typeof USER_TYPE_CHARS)[number];

export type DisplaySpec =
  | { env: Env; order: number; method: Method; type: 't'; userTypes: UserTypeChar[] }
  | { env: Env; order: number; method: Method; type: 'b'; brandNo: string }
  | { env: Env; order: number; method: Method; type: 'n'; label: string };

export type Issue = { field: string; severity: 'error' | 'warn'; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };
