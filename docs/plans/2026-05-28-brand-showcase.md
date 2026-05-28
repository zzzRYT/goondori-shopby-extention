# 브랜드 진열 Preview 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 사이드패널 '브랜드' 탭에서 extraInfo의 `c_<n>`/`ct_<n>` 슬롯에 매칭된 브랜드를 MO 앱과 동일한 가로 카루셀로 미리 보여주고, 어드민 브랜드 수정 페이지의 `extraInfo` 입력란 아래에 토큰 가이드를 inject.

**Architecture:** 순수 파싱 함수(`parseBrandSlots`) → API 통합(`fetchShowcaseBrands`) → UI 컴포넌트(`BrandShowcase` → `Carousel` → `Card`) → 어드민 가이드는 content script에서 MutationObserver로 등장 감지·inject.

**Tech Stack:** TypeScript, React 19, WXT, Vitest, JSDOM, Testing Library. 기존 `lib/shopby/api/client.ts`(shopApiGet)와 `useRemoteList` 훅 재사용.

**참고 문서:** `docs/plans/2026-05-28-brand-showcase-design.md`

---

## 작업 순서

A. 사이드패널 (Task 1–10): 셀렉터 의존 없음, 먼저 끝낸다.
B. 어드민 가이드 (Task 11–13): 정찰 → 모듈 → 연결.

각 Task는 RED → GREEN → COMMIT의 짧은 TDD 사이클이다.

---

### Task 1: 타입 추가 — `ShowcaseBrand`

**Files:**
- Modify: `lib/shopby/api/types.ts`

**Step 1: 타입 추가**

`lib/shopby/api/types.ts` 끝에 추가:

```ts
// extraInfo + 썸네일을 포함한 진열 미리보기용 브랜드 엔트리.
// /display/brands/search-by-nos 응답을 UI에 쓰기 좋게 정규화한 형태.
export type ShowcaseBrand = {
  brandNo: number;
  name: string;
  extraInfo: string;
  imageUrl: string;
};
```

**Step 2: 타입 컴파일만 확인**

Run: `pnpm compile`
Expected: 0 errors.

**Step 3: Commit**

```bash
git add lib/shopby/api/types.ts
git commit -m "feat(brand): add ShowcaseBrand type"
```

---

### Task 2: `parseBrandSlots` 순수 함수 (TDD)

**Files:**
- Create: `lib/shopby/brand-extra-info.ts`
- Create: `lib/shopby/brand-extra-info.test.ts`

**Step 1: 실패하는 테스트 작성**

`lib/shopby/brand-extra-info.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ShowcaseBrand } from './api/types';
import { parseBrandSlots } from './brand-extra-info';

function brand(brandNo: number, extraInfo: string): ShowcaseBrand {
  return { brandNo, name: `브랜드${brandNo}`, extraInfo, imageUrl: '' };
}

describe('parseBrandSlots', () => {
  it('prod 토글이면 c_<n>만 추출하고 슬롯 ASC로 정렬한다', () => {
    const result = parseBrandSlots(
      [brand(1, 'c_3'), brand(2, 'c_1'), brand(3, 'ct_2'), brand(4, 'c_2')],
      'prod',
    );

    expect(result.map((r) => ({ slot: r.slot, brandNo: r.brand.brandNo }))).toEqual([
      { slot: 1, brandNo: 2 },
      { slot: 2, brandNo: 4 },
      { slot: 3, brandNo: 1 },
    ]);
  });

  it('dev 토글이면 ct_<n>만 추출한다', () => {
    const result = parseBrandSlots([brand(1, 'c_1'), brand(2, 'ct_1 ct_3'), brand(3, 'ct_2')], 'dev');

    expect(result.map((r) => ({ slot: r.slot, brandNo: r.brand.brandNo }))).toEqual([
      { slot: 1, brandNo: 2 },
      { slot: 2, brandNo: 3 },
      { slot: 3, brandNo: 2 },
    ]);
  });

  it('단어 경계 — c_1은 c_10·accounting_c_1과 분리된다', () => {
    const result = parseBrandSlots([brand(1, 'accounting_c_1, c_10'), brand(2, 'c_1')], 'prod');

    expect(result.map((r) => ({ slot: r.slot, brandNo: r.brand.brandNo }))).toEqual([
      { slot: 1, brandNo: 2 },
      { slot: 10, brandNo: 1 },
    ]);
  });

  it('한 브랜드 같은 토큰 중복은 한 번만 등장한다', () => {
    const result = parseBrandSlots([brand(1, 'c_1, c_1')], 'prod');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ slot: 1, brand: { brandNo: 1 } });
  });

  it('다른 브랜드의 동일 슬롯은 둘 다 등장한다(충돌)', () => {
    const result = parseBrandSlots([brand(1, 'c_1'), brand(2, 'c_1')], 'prod');

    expect(result.map((r) => r.brand.brandNo)).toEqual([1, 2]);
    expect(result.every((r) => r.slot === 1)).toBe(true);
  });

  it('n ≤ 0이거나 토큰 매칭 0건이면 결과에서 제외한다', () => {
    const result = parseBrandSlots(
      [brand(1, 'c_0'), brand(2, 'c_-1'), brand(3, ''), brand(4, 'random text'), brand(5, 'c_2')],
      'prod',
    );

    expect(result.map((r) => r.brand.brandNo)).toEqual([5]);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm test:run lib/shopby/brand-extra-info.test.ts`
Expected: FAIL — `parseBrandSlots` not exported / module not found.

**Step 3: 구현**

`lib/shopby/brand-extra-info.ts`:

```ts
import type { ShowcaseBrand } from './api/types';

export type BrandEnv = 'prod' | 'dev';

export type SlotAssignment = {
  slot: number;
  brand: ShowcaseBrand;
};

// 단어 경계 기반 토큰 추출. c_1과 c_10, accounting_c_1을 정확히 분리한다.
// 콤마·공백·세미콜론을 구분자로 허용.
const TOKEN_RE = /(?:^|[\s,;])(c|ct)_(\d+)(?=$|[\s,;])/g;

// extraInfo에서 환경별 슬롯 번호 집합을 추출한다. n ≤ 0은 무시.
function extractSlots(extraInfo: string, env: BrandEnv): number[] {
  if (!extraInfo) return [];
  const prefix = env === 'prod' ? 'c' : 'ct';
  const slots = new Set<number>();

  for (const match of extraInfo.matchAll(TOKEN_RE)) {
    if (match[1] !== prefix) continue;
    const slot = Number(match[2]);
    if (Number.isFinite(slot) && slot >= 1) slots.add(slot);
  }

  return [...slots];
}

// 브랜드 목록에서 현재 환경의 슬롯 할당을 추려 ASC 정렬한다.
// 동일 슬롯에 여러 브랜드가 있으면 모두 유지(충돌 표시는 UI에서 처리).
export function parseBrandSlots(brands: ShowcaseBrand[], env: BrandEnv): SlotAssignment[] {
  const assignments: SlotAssignment[] = [];

  for (const brand of brands) {
    for (const slot of extractSlots(brand.extraInfo, env)) {
      assignments.push({ slot, brand });
    }
  }

  assignments.sort((a, b) => a.slot - b.slot);
  return assignments;
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm test:run lib/shopby/brand-extra-info.test.ts`
Expected: PASS, 6 tests.

**Step 5: Commit**

```bash
git add lib/shopby/brand-extra-info.ts lib/shopby/brand-extra-info.test.ts
git commit -m "feat(brand): parseBrandSlots — extraInfo c_/ct_ 토큰 슬롯 정렬"
```

---

### Task 3: `searchAllBrands` API — `/brands/search`

**Files:**
- Create: `lib/shopby/api/brands-showcase.ts`
- Create: `lib/shopby/api/brands-showcase.test.ts`

**Step 1: 실패하는 테스트 작성**

`lib/shopby/api/brands-showcase.test.ts`:

```ts
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
```

**Step 2: 테스트 실패 확인**

Run: `pnpm test:run lib/shopby/api/brands-showcase.test.ts`
Expected: FAIL — module not found.

**Step 3: 구현**

`lib/shopby/api/brands-showcase.ts`:

```ts
import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

type SearchItem = { brandNo: number };
type SearchResponse = { items?: SearchItem[] | null };

// GET /brands/search — 상품 카탈로그 기준 전체 브랜드 목록.
// 페이지네이션으로 brandNo만 수집한다(상세는 별도 API에서 받는다).
export async function searchAllBrands(clientId: string = SHOPBY_CLIENT_ID): Promise<number[]> {
  const brandNos: number[] = [];

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const data = await shopApiGet<SearchResponse>(
      '/brands/search',
      { pageNumber, pageSize: PAGE_SIZE },
      clientId,
    );

    const items = data.items ?? [];
    for (const item of items) brandNos.push(item.brandNo);

    if (items.length < PAGE_SIZE) break;
  }

  return brandNos;
}
```

**Step 4: 통과 확인**

Run: `pnpm test:run lib/shopby/api/brands-showcase.test.ts`
Expected: PASS, 2 tests.

**Step 5: Commit**

```bash
git add lib/shopby/api/brands-showcase.ts lib/shopby/api/brands-showcase.test.ts
git commit -m "feat(brand): searchAllBrands — /brands/search 페이지네이션"
```

---

### Task 4: `fetchDisplayBrandDetails` API — `/display/brands/search-by-nos`

**Files:**
- Modify: `lib/shopby/api/brands-showcase.ts`
- Modify: `lib/shopby/api/brands-showcase.test.ts`

**Step 1: 실패하는 테스트 추가**

`brands-showcase.test.ts`에 import 확장:

```ts
import { fetchDisplayBrandDetails, searchAllBrands } from './brands-showcase';
```

같은 파일에 describe 추가:

```ts
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
```

**Step 2: 실패 확인**

Run: `pnpm test:run lib/shopby/api/brands-showcase.test.ts`
Expected: FAIL — `fetchDisplayBrandDetails` not exported.

**Step 3: 구현 — `brands-showcase.ts`에 추가**

```ts
import type { ShowcaseBrand } from './types';

export const BRAND_DETAIL_CHUNK_SIZE = 100;

type DetailItem = {
  brandNo: number;
  name?: string | null;
  extraInfo?: string | null;
  displayAreaContentUrl?: string | null;
};

type DetailResponse = { items?: DetailItem[] | null };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalize(item: DetailItem): ShowcaseBrand {
  return {
    brandNo: item.brandNo,
    name: item.name?.trim() || `브랜드 #${item.brandNo}`,
    extraInfo: item.extraInfo ?? '',
    imageUrl: item.displayAreaContentUrl ?? '',
  };
}

// GET /display/brands/search-by-nos — brandNo 묶음에 대한 진열 상세(extraInfo·이미지) 조회.
// 한 호출당 BRAND_DETAIL_CHUNK_SIZE 개로 청크 분할하고 병렬 실행하되,
// 결과는 입력 순서대로 머지한다(UI 정렬 안정성).
export async function fetchDisplayBrandDetails(
  brandNos: number[],
  clientId: string = SHOPBY_CLIENT_ID,
): Promise<ShowcaseBrand[]> {
  if (brandNos.length === 0) return [];

  const chunks = chunk(brandNos, BRAND_DETAIL_CHUNK_SIZE);
  const responses = await Promise.all(
    chunks.map((group) =>
      shopApiGet<DetailResponse>('/display/brands/search-by-nos', { brandNos: group.join(',') }, clientId),
    ),
  );

  const byNo = new Map<number, ShowcaseBrand>();
  for (const response of responses) {
    for (const item of response.items ?? []) byNo.set(item.brandNo, normalize(item));
  }

  return brandNos.flatMap((no) => {
    const entry = byNo.get(no);
    return entry ? [entry] : [];
  });
}
```

**Step 4: 통과 확인**

Run: `pnpm test:run lib/shopby/api/brands-showcase.test.ts`
Expected: PASS, 6 tests total.

**Step 5: Commit**

```bash
git add lib/shopby/api/brands-showcase.ts lib/shopby/api/brands-showcase.test.ts
git commit -m "feat(brand): fetchDisplayBrandDetails — 청크 분할 + 입력 순서 머지"
```

---

### Task 5: `fetchShowcaseBrands` 통합 진입점

**Files:**
- Modify: `lib/shopby/api/brands-showcase.ts`
- Modify: `lib/shopby/api/brands-showcase.test.ts`

**Step 1: 실패 테스트 추가**

```ts
import { fetchDisplayBrandDetails, fetchShowcaseBrands, searchAllBrands } from './brands-showcase';

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
```

**Step 2: 실패 확인**

Run: `pnpm test:run lib/shopby/api/brands-showcase.test.ts`
Expected: FAIL — `fetchShowcaseBrands` not exported.

**Step 3: 구현 — `brands-showcase.ts` 끝에 추가**

```ts
// 브랜드 탭 진입 시 호출하는 통합 진입점. 카탈로그 brandNo를 모두 모은 뒤
// 청크로 상세(extraInfo·이미지)를 받아 단일 ShowcaseBrand[]로 반환한다.
export async function fetchShowcaseBrands(clientId: string = SHOPBY_CLIENT_ID): Promise<ShowcaseBrand[]> {
  const brandNos = await searchAllBrands(clientId);
  return fetchDisplayBrandDetails(brandNos, clientId);
}
```

**Step 4: 통과 확인**

Run: `pnpm test:run lib/shopby/api/brands-showcase.test.ts`
Expected: PASS, 7 tests total.

**Step 5: Commit**

```bash
git add lib/shopby/api/brands-showcase.ts lib/shopby/api/brands-showcase.test.ts
git commit -m "feat(brand): fetchShowcaseBrands 통합 진입점"
```

---

### Task 6: `EnvToggle` 컴포넌트

**Files:**
- Create: `entrypoints/sidepanel/ui/EnvToggle.tsx`
- Create: `entrypoints/sidepanel/ui/EnvToggle.test.tsx`

**Step 1: 실패하는 테스트**

`EnvToggle.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EnvToggle } from './EnvToggle';

describe('EnvToggle', () => {
  it('현재 환경에 해당하는 버튼이 aria-pressed=true', () => {
    render(<EnvToggle value="prod" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: '운영(prod)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '개발(dev)' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('다른 환경 버튼을 누르면 onChange가 호출된다', async () => {
    const onChange = vi.fn();
    render(<EnvToggle value="prod" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '개발(dev)' }));

    expect(onChange).toHaveBeenCalledWith('dev');
  });

  it('같은 환경 버튼을 다시 눌러도 onChange는 호출되지 않는다', async () => {
    const onChange = vi.fn();
    render(<EnvToggle value="prod" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '운영(prod)' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Step 2: 실패 확인**

Run: `pnpm test:run entrypoints/sidepanel/ui/EnvToggle.test.tsx`
Expected: FAIL — module not found.

**Step 3: 구현**

`EnvToggle.tsx`:

```tsx
import type { BrandEnv } from '../../../lib/shopby/brand-extra-info';

type EnvToggleProps = {
  value: BrandEnv;
  onChange: (next: BrandEnv) => void;
};

const OPTIONS: { value: BrandEnv; label: string }[] = [
  { value: 'prod', label: '운영(prod)' },
  { value: 'dev', label: '개발(dev)' },
];

// prod/dev 환경 토글. read-only viewer가 어떤 토큰(c_/ct_)을 보여줄지 결정한다.
export function EnvToggle({ value, onChange }: EnvToggleProps) {
  return (
    <div className="env-toggle" role="group" aria-label="브랜드 노출 환경">
      {OPTIONS.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            type="button"
            key={option.value}
            className="env-toggle__button"
            aria-pressed={pressed}
            onClick={() => {
              if (!pressed) onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 4: 통과 확인**

Run: `pnpm test:run entrypoints/sidepanel/ui/EnvToggle.test.tsx`
Expected: PASS, 3 tests.

**Step 5: Commit**

```bash
git add entrypoints/sidepanel/ui/EnvToggle.tsx entrypoints/sidepanel/ui/EnvToggle.test.tsx
git commit -m "feat(brand): EnvToggle prod/dev 세그먼트 컨트롤"
```

---

### Task 7: `BrandShowcaseCard` 컴포넌트

**Files:**
- Create: `entrypoints/sidepanel/ui/BrandShowcaseCard.tsx`
- Create: `entrypoints/sidepanel/ui/BrandShowcaseCard.test.tsx`

**Step 1: 실패 테스트**

`BrandShowcaseCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandShowcaseCard } from './BrandShowcaseCard';

const baseBrand = { brandNo: 1, name: '브랜드1', extraInfo: 'c_1', imageUrl: '' };

describe('BrandShowcaseCard', () => {
  it('썸네일·이름·슬롯 배지를 표시한다', () => {
    render(<BrandShowcaseCard slot={2} brand={{ ...baseBrand, imageUrl: 'https://img/x.png' }} env="prod" conflict={false} />);

    expect(screen.getByRole('img', { name: '브랜드1' })).toHaveAttribute('src', 'https://img/x.png');
    expect(screen.getByText('브랜드1')).toBeInTheDocument();
    expect(screen.getByLabelText('노출 슬롯 2')).toHaveTextContent('c_2');
  });

  it('dev 환경에선 슬롯 배지가 ct_<n> 표기', () => {
    render(<BrandShowcaseCard slot={3} brand={baseBrand} env="dev" conflict={false} />);

    expect(screen.getByLabelText('노출 슬롯 3')).toHaveTextContent('ct_3');
  });

  it('imageUrl이 비면 placeholder가 표시되고 img는 렌더되지 않는다', () => {
    render(<BrandShowcaseCard slot={1} brand={baseBrand} env="prod" conflict={false} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('brand-card-placeholder')).toBeInTheDocument();
  });

  it('conflict=true면 ⚠ 충돌 표시가 함께 나온다', () => {
    render(<BrandShowcaseCard slot={1} brand={baseBrand} env="prod" conflict={true} />);

    expect(screen.getByLabelText('동일 슬롯 충돌')).toBeInTheDocument();
  });
});
```

**Step 2: 실패 확인**

Run: `pnpm test:run entrypoints/sidepanel/ui/BrandShowcaseCard.test.tsx`
Expected: FAIL.

**Step 3: 구현**

`BrandShowcaseCard.tsx`:

```tsx
import type { ShowcaseBrand } from '../../../lib/shopby/api/types';
import type { BrandEnv } from '../../../lib/shopby/brand-extra-info';

type BrandShowcaseCardProps = {
  slot: number;
  brand: ShowcaseBrand;
  env: BrandEnv;
  conflict: boolean;
};

// 브랜드 진열 카루셀의 단일 카드. read-only.
// imageUrl이 비거나 로드 실패 시 mock과 같은 회색 placeholder로 대체한다.
export function BrandShowcaseCard({ slot, brand, env, conflict }: BrandShowcaseCardProps) {
  const tokenPrefix = env === 'prod' ? 'c' : 'ct';
  const slotLabel = `${tokenPrefix}_${slot}`;

  return (
    <article className="brand-card" role="listitem">
      <div className="brand-card__thumb">
        {brand.imageUrl ? (
          <img src={brand.imageUrl} alt={brand.name} width={80} height={80} loading="lazy" />
        ) : (
          <div className="brand-card__placeholder" data-testid="brand-card-placeholder" aria-hidden="true" />
        )}
        {conflict && (
          <span className="brand-card__conflict" aria-label="동일 슬롯 충돌" title="동일 슬롯에 여러 브랜드가 지정됨">
            ⚠
          </span>
        )}
      </div>
      <p className="brand-card__name" title={brand.name}>
        {brand.name}
      </p>
      <span className="brand-card__slot" aria-label={`노출 슬롯 ${slot}`}>
        {slotLabel}
      </span>
    </article>
  );
}
```

**Step 4: 통과 확인**

Run: `pnpm test:run entrypoints/sidepanel/ui/BrandShowcaseCard.test.tsx`
Expected: PASS, 4 tests.

**Step 5: Commit**

```bash
git add entrypoints/sidepanel/ui/BrandShowcaseCard.tsx entrypoints/sidepanel/ui/BrandShowcaseCard.test.tsx
git commit -m "feat(brand): BrandShowcaseCard — 썸네일·이름·슬롯 배지·충돌 표시"
```

---

### Task 8: `BrandShowcaseCarousel` — 가로 스크롤 + chevron

**Files:**
- Create: `entrypoints/sidepanel/ui/BrandShowcaseCarousel.tsx`
- Create: `entrypoints/sidepanel/ui/BrandShowcaseCarousel.test.tsx`

**Step 1: 실패 테스트**

`BrandShowcaseCarousel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BrandShowcaseCarousel } from './BrandShowcaseCarousel';

const slots = [
  { slot: 1, brand: { brandNo: 1, name: '브랜드1', extraInfo: 'c_1', imageUrl: '' } },
  { slot: 2, brand: { brandNo: 2, name: '브랜드2', extraInfo: 'c_2', imageUrl: '' } },
];

describe('BrandShowcaseCarousel', () => {
  it('슬롯 항목을 list 역할로 렌더한다', () => {
    render(<BrandShowcaseCarousel assignments={slots} env="prod" />);

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('스크롤이 불필요할 때(콘텐츠 ≤ 컨테이너) chevron은 disabled', () => {
    render(<BrandShowcaseCarousel assignments={slots} env="prod" />);

    expect(screen.getByRole('button', { name: '이전 브랜드' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 브랜드' })).toBeDisabled();
  });

  it('다음 chevron 클릭 시 scrollBy가 호출된다', async () => {
    // 콘텐츠가 컨테이너보다 넓다고 가정 — scrollWidth/clientWidth를 직접 stub
    const scrollBy = vi.fn();
    HTMLElement.prototype.scrollBy = scrollBy;
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 200 });

    render(<BrandShowcaseCarousel assignments={slots} env="prod" />);

    await userEvent.click(screen.getByRole('button', { name: '다음 브랜드' }));

    expect(scrollBy).toHaveBeenCalled();
    expect(scrollBy.mock.calls[0][0]).toMatchObject({ behavior: 'smooth' });
  });
});
```

**Step 2: 실패 확인**

Run: `pnpm test:run entrypoints/sidepanel/ui/BrandShowcaseCarousel.test.tsx`
Expected: FAIL — module not found.

**Step 3: 구현**

`BrandShowcaseCarousel.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrandEnv, SlotAssignment } from '../../../lib/shopby/brand-extra-info';
import { BrandShowcaseCard } from './BrandShowcaseCard';

type BrandShowcaseCarouselProps = {
  assignments: SlotAssignment[];
  env: BrandEnv;
};

const CARD_STEP = 96 + 12; // 카드 width + gap. style.css와 동기화 필요.

// 가로 스크롤 카루셀. CSS scroll-snap이 1차 동작 수단, chevron 버튼은 보조.
// chevron disabled 여부는 ResizeObserver + scroll 이벤트로 재계산한다.
export function BrandShowcaseCarousel({ assignments, env }: BrandShowcaseCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const recalc = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 0);
    setAtEnd(overflow <= 0 || el.scrollLeft >= overflow - 1);
  }, []);

  useEffect(() => {
    recalc();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', recalc, { passive: true });
    const observer = new ResizeObserver(recalc);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', recalc);
      observer.disconnect();
    };
  }, [recalc, assignments.length]);

  const scrollByStep = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * CARD_STEP, behavior: 'smooth' });
  };

  // 같은 슬롯에 여러 브랜드가 있으면 충돌 — 카드별로 conflict 플래그 계산.
  const slotCount = new Map<number, number>();
  for (const a of assignments) slotCount.set(a.slot, (slotCount.get(a.slot) ?? 0) + 1);

  return (
    <div className="brand-carousel">
      <button
        type="button"
        className="brand-carousel__chevron"
        aria-label="이전 브랜드"
        disabled={atStart}
        onClick={() => scrollByStep(-1)}
      >
        ‹
      </button>
      <div ref={trackRef} className="brand-carousel__track" role="list">
        {assignments.map((assignment, index) => (
          <BrandShowcaseCard
            key={`${assignment.slot}-${assignment.brand.brandNo}-${index}`}
            slot={assignment.slot}
            brand={assignment.brand}
            env={env}
            conflict={(slotCount.get(assignment.slot) ?? 0) > 1}
          />
        ))}
      </div>
      <button
        type="button"
        className="brand-carousel__chevron"
        aria-label="다음 브랜드"
        disabled={atEnd}
        onClick={() => scrollByStep(1)}
      >
        ›
      </button>
    </div>
  );
}
```

**Step 4: 통과 확인**

Run: `pnpm test:run entrypoints/sidepanel/ui/BrandShowcaseCarousel.test.tsx`
Expected: PASS, 3 tests.

**Step 5: Commit**

```bash
git add entrypoints/sidepanel/ui/BrandShowcaseCarousel.tsx entrypoints/sidepanel/ui/BrandShowcaseCarousel.test.tsx
git commit -m "feat(brand): BrandShowcaseCarousel — 가로 스크롤 + chevron disabled 동기화"
```

---

### Task 9: `BrandShowcase` 컨테이너

**Files:**
- Create: `entrypoints/sidepanel/ui/BrandShowcase.tsx`
- Create: `entrypoints/sidepanel/ui/BrandShowcase.test.tsx`

**Step 1: 실패 테스트**

`BrandShowcase.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrandShowcase } from './BrandShowcase';
import * as api from '../../../lib/shopby/api/brands-showcase';

const sample = [
  { brandNo: 1, name: '브랜드1', extraInfo: 'c_1 ct_2', imageUrl: '' },
  { brandNo: 2, name: '브랜드2', extraInfo: 'c_2', imageUrl: '' },
];

describe('BrandShowcase', () => {
  afterEach(() => vi.restoreAllMocks());

  it('로딩 중엔 스켈레톤을 보여준다', () => {
    vi.spyOn(api, 'fetchShowcaseBrands').mockReturnValue(new Promise(() => {}));

    render(<BrandShowcase />);

    expect(screen.getByTestId('brand-showcase-skeleton')).toBeInTheDocument();
  });

  it('에러 상태에선 메시지와 다시 시도 버튼을 표시한다', async () => {
    vi.spyOn(api, 'fetchShowcaseBrands').mockRejectedValue(new Error('네트워크 끊김'));

    render(<BrandShowcase />);

    expect(await screen.findByText('네트워크 끊김')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('성공 후 매칭 0건이면 안내 문구', async () => {
    vi.spyOn(api, 'fetchShowcaseBrands').mockResolvedValue([{ brandNo: 9, name: '브9', extraInfo: '', imageUrl: '' }]);

    render(<BrandShowcase />);

    expect(await screen.findByText(/노출 설정된 브랜드가 없습니다/)).toBeInTheDocument();
  });

  it('prod에서 dev로 토글하면 재요청 없이 다른 슬롯이 나타난다', async () => {
    const spy = vi.spyOn(api, 'fetchShowcaseBrands').mockResolvedValue(sample);

    render(<BrandShowcase />);

    await waitFor(() => expect(screen.getByText('브랜드1')).toBeInTheDocument());
    expect(screen.getByLabelText('노출 슬롯 1')).toHaveTextContent('c_1');

    await userEvent.click(screen.getByRole('button', { name: '개발(dev)' }));

    expect(screen.getByLabelText('노출 슬롯 2')).toHaveTextContent('ct_2');
    expect(spy).toHaveBeenCalledTimes(1); // 재요청 없음
  });
});
```

**Step 2: 실패 확인**

Run: `pnpm test:run entrypoints/sidepanel/ui/BrandShowcase.test.tsx`
Expected: FAIL — module not found.

**Step 3: 구현**

`BrandShowcase.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { fetchShowcaseBrands } from '../../../lib/shopby/api/brands-showcase';
import { parseBrandSlots, type BrandEnv } from '../../../lib/shopby/brand-extra-info';
import { useRemoteList } from '../hooks/useRemoteList';
import { BrandShowcaseCarousel } from './BrandShowcaseCarousel';
import { EnvToggle } from './EnvToggle';

const ENV_LABEL: Record<BrandEnv, string> = { prod: '운영(prod)', dev: '개발(dev)' };

// 브랜드 탭 컨테이너. 한 번 받은 ShowcaseBrand[]를 env 토글에 따라 즉시 재계산한다.
export function BrandShowcase() {
  const { items, status, error, reload } = useRemoteList(fetchShowcaseBrands);
  const [env, setEnv] = useState<BrandEnv>('prod');

  const assignments = useMemo(() => parseBrandSlots(items, env), [items, env]);

  return (
    <section className="brand-showcase" aria-label="브랜드 진열 미리보기">
      <header className="brand-showcase__header">
        <EnvToggle value={env} onChange={setEnv} />
        <button type="button" className="brand-showcase__reload" onClick={reload} disabled={status === 'loading'}>
          ↻ 새로고침
        </button>
      </header>

      {status === 'loading' && (
        <div className="brand-showcase__skeleton" data-testid="brand-showcase-skeleton" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="brand-showcase__skeleton-card" />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="brand-showcase__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={reload}>다시 시도</button>
        </div>
      )}

      {status === 'ready' && assignments.length === 0 && (
        <p className="brand-showcase__empty">
          {ENV_LABEL[env]} 환경에 노출 설정된 브랜드가 없습니다. shopby 어드민의 브랜드 추가 설명에 c_1, c_2…(또는 ct_1, ct_2…) 를 입력해 주세요.
        </p>
      )}

      {status === 'ready' && assignments.length > 0 && (
        <>
          <p className="brand-showcase__count">
            {ENV_LABEL[env]} 환경에 노출 설정된 브랜드 ({assignments.length})
          </p>
          <BrandShowcaseCarousel assignments={assignments} env={env} />
        </>
      )}
    </section>
  );
}
```

**Step 4: 통과 확인**

Run: `pnpm test:run entrypoints/sidepanel/ui/BrandShowcase.test.tsx`
Expected: PASS, 4 tests.

**Step 5: Commit**

```bash
git add entrypoints/sidepanel/ui/BrandShowcase.tsx entrypoints/sidepanel/ui/BrandShowcase.test.tsx
git commit -m "feat(brand): BrandShowcase 컨테이너 — env 토글 즉시 반영"
```

---

### Task 10: `App.tsx` 탭 연결 + 스타일 추가 + 수동 검증

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`
- Modify: `entrypoints/sidepanel/style.css`

**Step 1: App.tsx 수정**

`entrypoints/sidepanel/App.tsx`의 import에 추가:

```tsx
import { BrandShowcase } from './ui/BrandShowcase';
```

`activeTab === 'brand'` 블록을 교체:

```tsx
{activeTab === 'brand' && <BrandShowcase />}
```

(기존 `<div className="empty-pane">…</div>` 제거)

**Step 2: 스타일 추가**

`entrypoints/sidepanel/style.css` 끝에 추가:

```css
.brand-showcase {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brand-showcase__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.env-toggle {
  display: inline-flex;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.env-toggle__button {
  border: 0;
  padding: 6px 12px;
  background: transparent;
  font-size: 12px;
  color: #344054;
}

.env-toggle__button[aria-pressed="true"] {
  background: #1d4ed8;
  color: #fff;
}

.brand-showcase__reload {
  border: 1px solid #d0d5dd;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: #344054;
}

.brand-showcase__count {
  margin: 0;
  font-size: 12px;
  color: #475467;
}

.brand-showcase__empty {
  margin: 0;
  padding: 12px;
  background: #fff;
  border: 1px dashed #d0d5dd;
  border-radius: 8px;
  font-size: 12px;
  color: #475467;
}

.brand-showcase__error {
  padding: 12px;
  background: #fef3f2;
  border: 1px solid #fda29b;
  border-radius: 8px;
  color: #b42318;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.brand-showcase__skeleton {
  display: flex;
  gap: 12px;
}

.brand-showcase__skeleton-card {
  flex: 0 0 auto;
  width: 80px;
  height: 80px;
  border-radius: 16px;
  background: #e4e7ec;
  animation: brand-skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes brand-skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.brand-carousel {
  display: flex;
  align-items: center;
  gap: 4px;
}

.brand-carousel__chevron {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  font-size: 18px;
  color: #344054;
  border-radius: 999px;
}

.brand-carousel__chevron:disabled {
  color: #d0d5dd;
  cursor: not-allowed;
}

.brand-carousel__track {
  flex: 1 1 auto;
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
  padding: 4px 0 8px;
}

.brand-carousel__track > * {
  scroll-snap-align: start;
}

.brand-card {
  flex: 0 0 auto;
  width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.brand-card__thumb {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 16px;
  background: #e4e7ec;
  overflow: hidden;
}

.brand-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.brand-card__placeholder {
  width: 100%;
  height: 100%;
}

.brand-card__conflict {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 14px;
  background: #fef3f2;
  border-radius: 999px;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.brand-card__name {
  margin: 0;
  font-size: 12px;
  color: #1d2939;
  text-align: center;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-card__slot {
  font-size: 10px;
  color: #667085;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
```

**Step 3: 컴파일 + 전체 테스트**

Run: `pnpm compile && pnpm test:run`
Expected: 0 errors, 모든 테스트 PASS.

**Step 4: 수동 검증**

```bash
pnpm dev
```

- 사이드패널 열고 '브랜드' 탭 클릭
- 로딩 → 카루셀 표시 또는 빈 안내
- Prod/Dev 토글 시 슬롯 즉시 변경
- 카드 6개 이상이면 chevron 활성

**Step 5: Commit**

```bash
git add entrypoints/sidepanel/App.tsx entrypoints/sidepanel/style.css
git commit -m "feat(brand): App.tsx 브랜드 탭 연결 + 카루셀 스타일"
```

---

### Task 11: 어드민 `extraInfo` 셀렉터 정찰

**Files:**
- Modify: `docs/recon.md` (관찰 기록)
- Modify: `lib/shopby/selectors.ts`

**Step 1: 정찰**

`pnpm dev`로 익스텐션 로드한 상태에서 샵바이 어드민 브랜드 수정 페이지 열기 → DevTools로 "추가 설명" 입력란의 `name`/`id`/`data-*` 속성 확인. 가장 안정적인 속성을 골라 셀렉터 결정.

기대값(예측): `textarea[name="extraInfo"]`. 다르면 그에 맞춰 갱신.

**Step 2: `docs/recon.md`에 관찰 기록 추가** (1줄)

```
- 브랜드 수정 페이지 "추가 설명" 입력란: textarea[name="extraInfo"] (확인 후 갱신)
```

**Step 3: `selectors.ts`에 상수 추가**

`lib/shopby/selectors.ts`에 추가:

```ts
// 브랜드 수정 페이지 "추가 설명"(extraInfo) textarea. 가이드 inject 대상.
export const EXTRA_INFO_TEXTAREA_SELECTOR = 'textarea[name="extraInfo"]';
```

**Step 4: 타입체크**

Run: `pnpm compile`
Expected: 0 errors.

**Step 5: Commit**

```bash
git add docs/recon.md lib/shopby/selectors.ts
git commit -m "chore(brand): extraInfo textarea 셀렉터 정찰 + 상수 추가"
```

---

### Task 12: `brand-extra-info-guide` 모듈 (TDD)

**Files:**
- Create: `lib/shopby/brand-extra-info-guide.ts`
- Create: `lib/shopby/brand-extra-info-guide.test.ts`

**Step 1: 실패하는 테스트**

`brand-extra-info-guide.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startExtraInfoGuide, GUIDE_MARKER_ATTR } from './brand-extra-info-guide';

describe('startExtraInfoGuide', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('textarea가 이미 있으면 즉시 가이드를 inject한다', () => {
    document.body.innerHTML = '<textarea name="extraInfo"></textarea>';

    cleanup = startExtraInfoGuide(document);

    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).not.toBeNull();
  });

  it('이미 inject된 textarea엔 다시 inject하지 않는다(멱등)', () => {
    document.body.innerHTML = '<textarea name="extraInfo"></textarea>';

    cleanup = startExtraInfoGuide(document);
    cleanup();
    cleanup = startExtraInfoGuide(document);

    expect(document.querySelectorAll(`[${GUIDE_MARKER_ATTR}]`)).toHaveLength(1);
  });

  it('나중에 textarea가 등장해도 MutationObserver로 잡아 inject한다', async () => {
    cleanup = startExtraInfoGuide(document);

    const ta = document.createElement('textarea');
    ta.setAttribute('name', 'extraInfo');
    document.body.appendChild(ta);

    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).not.toBeNull();
  });

  it('cleanup 호출 시 observer가 해제된다', async () => {
    cleanup = startExtraInfoGuide(document);
    cleanup();
    cleanup = undefined;

    const ta = document.createElement('textarea');
    ta.setAttribute('name', 'extraInfo');
    document.body.appendChild(ta);
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).toBeNull();
  });
});
```

**Step 2: 실패 확인**

Run: `pnpm test:run lib/shopby/brand-extra-info-guide.test.ts`
Expected: FAIL.

**Step 3: 구현**

`lib/shopby/brand-extra-info-guide.ts`:

```ts
import { EXTRA_INFO_TEXTAREA_SELECTOR } from './selectors';

export const GUIDE_MARKER_ATTR = 'data-goondori-guide';
const GUIDE_VALUE = 'extra-info';

function buildGuide(doc: Document): HTMLElement {
  const aside = doc.createElement('aside');
  aside.setAttribute(GUIDE_MARKER_ATTR, GUIDE_VALUE);
  aside.style.cssText = [
    'margin: 8px 0',
    'padding: 10px 12px',
    'background: #f4f6fb',
    'border-left: 3px solid #1d4ed8',
    'border-radius: 6px',
    'font-size: 12px',
    'color: #1d2939',
    'line-height: 1.5',
  ].join(';');

  aside.innerHTML = `
    <p style="margin:0 0 6px;font-weight:600">군돌이 브랜드 노출 가이드</p>
    <ul style="margin:0 0 6px 18px;padding:0">
      <li><code>c_&lt;순번&gt;</code> — 운영(prod) 환경 노출 슬롯 (예: <code>c_1</code>, <code>c_2</code>)</li>
      <li><code>ct_&lt;순번&gt;</code> — 개발(dev) 환경 노출 슬롯 (예: <code>ct_1</code>, <code>ct_2</code>)</li>
    </ul>
    <p style="margin:0">콤마·공백·세미콜론으로 구분. 두 환경 동시 지정 가능.</p>
    <p style="margin:6px 0 0">익스텐션의 <strong>브랜드</strong> 탭에서 실제 노출 모습을 미리 볼 수 있어요.</p>
  `;

  return aside;
}

function injectGuideBelow(textarea: HTMLTextAreaElement) {
  const doc = textarea.ownerDocument;
  if (textarea.dataset.goondoriGuideAttached === '1') return;
  textarea.dataset.goondoriGuideAttached = '1';

  const guide = buildGuide(doc);
  textarea.insertAdjacentElement('afterend', guide);
}

function scan(root: Document | Element) {
  const matches = root.querySelectorAll<HTMLTextAreaElement>(EXTRA_INFO_TEXTAREA_SELECTOR);
  matches.forEach(injectGuideBelow);
}

// 브랜드 수정 페이지의 extraInfo textarea를 감지해 토큰 가이드를 inject한다.
// SPA 라우팅·iframe 재렌더에도 대응하도록 MutationObserver로 지속 감시.
// 반환된 cleanup으로 observer를 해제할 수 있다.
export function startExtraInfoGuide(doc: Document): () => void {
  scan(doc);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(EXTRA_INFO_TEXTAREA_SELECTOR) && node instanceof HTMLTextAreaElement) {
          injectGuideBelow(node);
        } else {
          scan(node);
        }
      }
    }
  });

  observer.observe(doc.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}
```

**Step 4: 통과 확인**

Run: `pnpm test:run lib/shopby/brand-extra-info-guide.test.ts`
Expected: PASS, 4 tests.

**Step 5: Commit**

```bash
git add lib/shopby/brand-extra-info-guide.ts lib/shopby/brand-extra-info-guide.test.ts
git commit -m "feat(brand): extraInfo 가이드 inject 모듈 + MutationObserver"
```

---

### Task 13: `content.ts` 연결 + 어드민 수동 검증

**Files:**
- Modify: `entrypoints/content.ts`

**Step 1: content.ts 수정**

`entrypoints/content.ts`의 import에 추가:

```ts
import { startExtraInfoGuide } from '../lib/shopby/brand-extra-info-guide';
```

`main()` 끝에 한 줄 추가:

```ts
main() {
  onMessage('fillDisplay', (message) => fillShopbyFields(DISPLAY_FIELD_MAP, message.data));
  onMessage('fillBanner', (message) => fillBannerFields(message.data));
  onMessage('fillExposure', (message) => fillExposureFields(message.data));
  onMessage('readCurrentDisplay', () => readByMap(DISPLAY_FIELD_MAP));
  startExtraInfoGuide(document);
}
```

**Step 2: 컴파일 + 전체 테스트**

Run: `pnpm compile && pnpm test:run`
Expected: 0 errors, 모든 테스트 PASS.

**Step 3: 빌드 확인**

Run: `pnpm build`
Expected: 빌드 성공.

**Step 4: 어드민에서 수동 검증**

`pnpm dev`로 익스텐션 로드한 뒤 샵바이 어드민의 브랜드 수정 페이지 열기:

- "추가 설명" 입력란 바로 아래에 가이드 카드가 한 번만 표시되는지
- 페이지 라우팅으로 다른 브랜드로 이동했다가 돌아와도 가이드가 다시 정상 표시되는지
- 가이드 스타일이 어드민 톤과 충돌 없이 보이는지

**Step 5: Commit**

```bash
git add entrypoints/content.ts
git commit -m "feat(brand): content script에 extraInfo 가이드 연결"
```

---

## 마무리 체크리스트

- [ ] `pnpm test:run` 전체 PASS
- [ ] `pnpm compile` 0 errors
- [ ] `pnpm build` 성공
- [ ] 사이드패널 브랜드 탭에서 prod/dev 토글 즉시 반영
- [ ] 카드 충분히 많을 때 chevron 양 끝 disabled 정상 동작
- [ ] 어드민 브랜드 수정 페이지에서 가이드 카드 1회 표시 (중복 없음)
- [ ] 디자인 문서(`2026-05-28-brand-showcase-design.md`)와 코드 일치
