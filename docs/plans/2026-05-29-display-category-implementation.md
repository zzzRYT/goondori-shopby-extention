# 전시카테고리(Display Category) 기능 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 샵바이 전시카테고리(상위/하위)를 스토어프론트 미리보기 + 접이식 설정 목록으로 보여주고, 어드민 트리에서 열기 + 코드 가이드 주입까지 제공하는 익스텐션 기능을 추가한다.

**Architecture:** 브랜드 기능의 3개 표면(API 픽커 / 사이드패널 탭 / 콘텐츠 스크립트 통합)을 본떠 동일 구조로 만든다. 데이터는 Shop 프론트 API(`GET /categories`, `GET /categories/{categoryNo}`) 한 곳에서 받고, 노출 상태는 프론트 API가 노출함만 반환하는 특성으로 자연 반영한다. 환경 구분은 상위 관리코드 접두사(`c_`=운영, `ct_`=개발)로 한다.

**Tech Stack:** WXT 0.20, React 19, TypeScript, vitest + jsdom, @webext-core/messaging. 패키지 매니저 pnpm. 작업 위치: 워크트리 `.worktrees/display-category`, 브랜치 `feature/display-category`.

**설계 문서:** `docs/plans/2026-05-29-display-category-design.md`

**공통 규칙:** DRY · YAGNI · TDD(RED→GREEN→REFACTOR) · 매 태스크 커밋. 모든 명령은 워크트리 루트에서 실행. 테스트 단일 실행은 `pnpm vitest run <path>`, 전체는 `pnpm test:run`.

---

## Phase 1 — 도메인·데이터 계층 (UI 없음)

### Task 1: 관리코드 파서 (`parseCategoryCode`)

**Files:**
- Create: `lib/shopby/category-code.ts`
- Test: `lib/shopby/category-code.test.ts`

**Step 1: 실패하는 테스트 작성**

```ts
// lib/shopby/category-code.test.ts
import { describe, expect, it } from 'vitest';
import { parseCategoryCode } from './category-code';

describe('parseCategoryCode', () => {
  it('운영 코드 c_1을 env=c, order=1로 파싱', () => {
    expect(parseCategoryCode('c_1')).toEqual({ env: 'c', order: 1 });
  });

  it('개발 코드 ct_4를 env=ct, order=4로 파싱', () => {
    expect(parseCategoryCode('ct_4')).toEqual({ env: 'ct', order: 4 });
  });

  it('두 자리 순번도 파싱', () => {
    expect(parseCategoryCode('c_12')).toEqual({ env: 'c', order: 12 });
  });

  it('빈 문자열은 null', () => {
    expect(parseCategoryCode('')).toBeNull();
  });

  it('접두사가 다르면 null', () => {
    expect(parseCategoryCode('x_1')).toBeNull();
  });

  it('순번 없는 코드는 null', () => {
    expect(parseCategoryCode('c_')).toBeNull();
    expect(parseCategoryCode('ct')).toBeNull();
  });

  it('접미사가 붙으면 null (정확 매칭)', () => {
    expect(parseCategoryCode('c_1_x')).toBeNull();
  });
});
```

**Step 2: 실패 확인** — Run: `pnpm vitest run lib/shopby/category-code.test.ts` · Expected: FAIL ("parseCategoryCode is not a function" / 모듈 없음)

**Step 3: 최소 구현**

```ts
// lib/shopby/category-code.ts
import type { Env } from '../display-id/types';

export type CategoryCode = { env: Env; order: number };

const CODE_RE = /^(c|ct)_(\d+)$/;

// 전시 상위 카테고리 관리코드(c_<순번> / ct_<순번>)를 환경+순번으로 파싱한다.
// 형식이 아니면(하위 카테고리·미분류 포함) null. 기존 display-id Env 체계와 동일한 접두사.
export function parseCategoryCode(code: string): CategoryCode | null {
  const match = CODE_RE.exec(code.trim());
  if (!match) return null;

  const order = Number(match[2]);
  if (!Number.isInteger(order) || order < 1) return null;

  return { env: match[1] as Env, order };
}
```

**Step 4: 통과 확인** — Run: `pnpm vitest run lib/shopby/category-code.test.ts` · Expected: PASS

**Step 5: 커밋**

```bash
git add lib/shopby/category-code.ts lib/shopby/category-code.test.ts
git commit -m "feat: 전시카테고리 관리코드 파서 추가"
```

---

### Task 2: 카테고리 API (`fetchDisplayCategories`, `fetchCategoryDetail`)

**Files:**
- Modify: `lib/shopby/api/types.ts` (타입 추가)
- Create: `lib/shopby/api/categories.ts`
- Test: `lib/shopby/api/categories.test.ts`

참고: `lib/shopby/api/brands.ts`(호출 패턴), `lib/shopby/api/client.ts`(`shopApiGet`), `lib/shopby/api/brands.test.ts`(`vi.stubGlobal('fetch', …)` 패턴).

**Step 1: 타입 추가 (`types.ts`)**

```ts
// lib/shopby/api/types.ts 끝에 추가
// 전시카테고리 트리 엔트리. /categories multiLevelCategories를 UI용으로 정규화.
// managementCode는 상위(depth 1)에만 의미 있는 c_/ct_ 코드, 하위는 빈 문자열일 수 있다.
export type DisplayCategoryEntry = {
  categoryNo: number;
  name: string;
  managementCode: string;
  depth: number;
  children: DisplayCategoryEntry[];
};
```

**Step 2: 실패하는 테스트 작성**

```ts
// lib/shopby/api/categories.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCategoryDetail, fetchDisplayCategories } from './categories';

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

const SAMPLE = {
  multiLevelCategories: [
    {
      categoryNo: 10,
      depth: 1,
      label: '베스트',
      managementCode: 'c_1',
      content: '',
      icon: '',
      children: [
        { categoryNo: 11, depth: 2, label: '카테고리1', managementCode: '', content: '', icon: '', children: [] },
      ],
    },
  ],
  flatCategories: [],
};

describe('fetchDisplayCategories', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('multiLevelCategories를 DisplayCategoryEntry 트리로 정규화한다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok(SAMPLE)));

    const result = await fetchDisplayCategories('client');

    expect(result).toEqual([
      {
        categoryNo: 10,
        name: '베스트',
        managementCode: 'c_1',
        depth: 1,
        children: [
          { categoryNo: 11, name: '카테고리1', managementCode: '', depth: 2, children: [] },
        ],
      },
    ]);
  });

  it('이름(label)이 비면 "카테고리 #{no}" 라벨', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({
      multiLevelCategories: [{ categoryNo: 7, depth: 1, label: '  ', managementCode: '', content: '', icon: '', children: [] }],
      flatCategories: [],
    })));

    const [entry] = await fetchDisplayCategories('client');
    expect(entry.name).toBe('카테고리 #7');
  });

  it('children 없으면 빈 배열로 정규화', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({
      multiLevelCategories: [{ categoryNo: 1, depth: 1, label: 'A', managementCode: 'c_1', content: '', icon: '' }],
      flatCategories: [],
    })));

    const [entry] = await fetchDisplayCategories('client');
    expect(entry.children).toEqual([]);
  });
});

describe('fetchCategoryDetail', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('단일 카테고리 상세의 children을 반환한다', async () => {
    const spy = vi.fn(() => ok(SAMPLE));
    vi.stubGlobal('fetch', spy);

    const detail = await fetchCategoryDetail(10, 'client');

    expect(detail.categoryNo).toBe(10);
    expect(detail.children).toHaveLength(1);
    expect(detail.children[0].name).toBe('카테고리1');
    // 경로에 categoryNo가 들어갔는지 확인
    const url = String((spy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('/categories/10');
  });
});
```

**Step 3: 실패 확인** — Run: `pnpm vitest run lib/shopby/api/categories.test.ts` · Expected: FAIL (모듈 없음)

**Step 4: 최소 구현**

```ts
// lib/shopby/api/categories.ts
import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';
import type { DisplayCategoryEntry } from './types';

type RawCategory = {
  categoryNo: number;
  depth: number;
  label?: string | null;
  managementCode?: string | null;
  children?: RawCategory[] | null;
};

type CategoriesResponse = { multiLevelCategories?: RawCategory[] | null };

function normalize(raw: RawCategory): DisplayCategoryEntry {
  return {
    categoryNo: raw.categoryNo,
    name: raw.label?.trim() || `카테고리 #${raw.categoryNo}`,
    managementCode: raw.managementCode?.trim() ?? '',
    depth: raw.depth,
    children: (raw.children ?? []).map(normalize),
  };
}

// GET /categories — 전시카테고리 계층 목록(상위+하위 트리). 프론트 API라 노출함만 반환한다.
// keyword는 선택(어드민 검색 대응). 기본은 전체 트리.
export async function fetchDisplayCategories(
  clientId: string = SHOPBY_CLIENT_ID,
  keyword?: string,
): Promise<DisplayCategoryEntry[]> {
  const data = await shopApiGet<CategoriesResponse>(
    '/categories',
    keyword ? { keyword } : {},
    clientId,
  );
  return (data.multiLevelCategories ?? []).map(normalize);
}

// GET /categories/{categoryNo} — 선택한 상위의 하위/상세. 탭 선택 시 lazy 호출.
export async function fetchCategoryDetail(
  categoryNo: number,
  clientId: string = SHOPBY_CLIENT_ID,
): Promise<DisplayCategoryEntry> {
  const data = await shopApiGet<CategoriesResponse>(
    `/categories/${categoryNo}`,
    {},
    clientId,
  );
  const root = (data.multiLevelCategories ?? []).find((c) => c.categoryNo === categoryNo)
    ?? (data.multiLevelCategories ?? [])[0];
  if (!root) {
    return { categoryNo, name: `카테고리 #${categoryNo}`, managementCode: '', depth: 1, children: [] };
  }
  return normalize(root);
}
```

**Step 5: 통과 확인** — Run: `pnpm vitest run lib/shopby/api/categories.test.ts` · Expected: PASS

**Step 6: 커밋**

```bash
git add lib/shopby/api/types.ts lib/shopby/api/categories.ts lib/shopby/api/categories.test.ts
git commit -m "feat: 전시카테고리 Shop API 조회(목록·상세) 추가"
```

---

## Phase 2 — 콘텐츠 스크립트 (어드민 통합)

### Task 3: 카테고리 셀렉터 추가

**Files:**
- Modify: `lib/shopby/selectors.ts` (끝에 추가)
- Test: `lib/shopby/selectors.test.ts` (기존 파일에 케이스 추가)

전시카테고리 편집 폼은 안정적인 `name` 속성이 없어 CSS-모듈 클래스 prefix 매칭을 쓴다(브랜드 트리와 동일 방침). 픽스처 `tests/fixtures/admin-display-category.html`에서 확인된 클래스:
`display-category-management_input-code__…`, `…_input-name__…`, `…_category-tree__…`, `…_category-name-wrap__…`.

**Step 1: 실패하는 테스트 (기존 selectors.test.ts에 추가)**

```ts
// lib/shopby/selectors.test.ts 에 추가
import {
  DISPLAY_CATEGORY_CODE_INPUT_SELECTOR,
  DISPLAY_CATEGORY_NAME_WRAP_SELECTOR,
} from './selectors';

describe('전시카테고리 셀렉터', () => {
  it('코드 입력란 prefix 매칭', () => {
    const el = document.createElement('input');
    el.className = 'display-category-management_input-code__0-V7R';
    expect(el.matches(DISPLAY_CATEGORY_CODE_INPUT_SELECTOR)).toBe(true);
  });

  it('트리 이름 wrap prefix 매칭', () => {
    const el = document.createElement('div');
    el.className = 'display-category-management_category-name-wrap__18Ezs';
    expect(el.matches(DISPLAY_CATEGORY_NAME_WRAP_SELECTOR)).toBe(true);
  });
});
```

**Step 2: 실패 확인** — Run: `pnpm vitest run lib/shopby/selectors.test.ts` · Expected: FAIL (export 없음)

**Step 3: 구현 (`selectors.ts` 끝에 추가)**

```ts
// 전시카테고리 편집 페이지. name 속성이 없어 CSS 모듈 클래스 prefix(substring) 매칭.
// suffix(__0-V7R 등)는 빌드 해시라 변동 가능.
export const DISPLAY_CATEGORY_CODE_INPUT_SELECTOR =
  '[class*="display-category-management_input-code__"]';
export const DISPLAY_CATEGORY_NAME_INPUT_SELECTOR =
  '[class*="display-category-management_input-name__"]';
export const DISPLAY_CATEGORY_TREE_SELECTOR =
  '[class*="display-category-management_category-tree__"]';
export const DISPLAY_CATEGORY_NAME_WRAP_SELECTOR =
  '[class*="display-category-management_category-name-wrap__"]';
```

**Step 4: 통과 확인** · **Step 5: 커밋**

```bash
git add lib/shopby/selectors.ts lib/shopby/selectors.test.ts
git commit -m "feat: 전시카테고리 편집 폼/트리 셀렉터 추가"
```

---

### Task 4: 어드민 트리에서 카테고리 열기 (`category-editor-open.ts`)

**Files:**
- Create: `lib/shopby/category-editor-open.ts`
- Test: `lib/shopby/category-editor-open.test.ts`

참고: `lib/shopby/brand-editor-open.ts`(스크롤 탐색·host 가드 패턴 그대로 차용). 차이점 — 트리 row 이름은 `DISPLAY_CATEGORY_NAME_WRAP_SELECTOR` 안의 텍스트로 매칭하고, 클릭 후 상위는 코드 입력란, 하위는 이름 입력란을 focus한다.

> **알려진 제약:** 카테고리 이름은 분기별 중복 가능. v1은 트리에서 첫 매치를 클릭한다(하위는 부모가 펼쳐져 있어야 보임 — best-effort). 코드 주석에 명시.

**Step 1: 실패하는 테스트 작성**

```ts
// lib/shopby/category-editor-open.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { findCategoryRow, openCategoryEditor } from './category-editor-open';

function loadFixture(): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures/admin-display-category.html'), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('findCategoryRow (admin-display-category.html)', () => {
  let doc: Document;
  beforeEach(() => { doc = loadFixture(); });

  it('트리에서 이름으로 카테고리 name-wrap을 찾는다', () => {
    // 픽스처에 존재하는 이름으로 교체할 것 (예: 구현 전 픽스처에서 실제 카테고리명 확인)
    const row = findCategoryRow(doc, { name: '설날특가', categoryNo: 0, depth: 1 });
    expect(row).not.toBeNull();
    expect(row?.textContent?.includes('설날특가')).toBe(true);
  });

  it('없는 이름은 null', () => {
    expect(findCategoryRow(doc, { name: '없는카테고리', categoryNo: 0, depth: 1 })).toBeNull();
  });
});

describe('openCategoryEditor', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('어드민 호스트가 아니면 wrong-host', async () => {
    const result = await openCategoryEditor(document, { name: 'A', categoryNo: 1, depth: 1 }, { hostname: 'example.com' });
    expect(result.status).toBe('wrong-host');
  });

  it('트리에 없으면 not-found', async () => {
    const result = await openCategoryEditor(document, { name: 'A', categoryNo: 1, depth: 1 }, { hostname: 'service.shopby.co.kr' });
    expect(result.status).toBe('not-found');
  });

  it('매치되면 클릭하고 opened', async () => {
    document.body.innerHTML = `
      <div class="display-category-management_category-tree__x">
        <div class="display-category-management_category-name-wrap__y"><span>베스트</span></div>
      </div>`;
    const result = await openCategoryEditor(document, { name: '베스트', categoryNo: 1, depth: 1 }, { hostname: 'service.shopby.co.kr' });
    expect(result.status).toBe('opened');
  });
});
```

> 구현 전, `python3`/grep으로 `tests/fixtures/admin-display-category.html`에서 `category-name-wrap` 안의 실제 카테고리명을 한 개 확인해 첫 테스트의 이름을 맞출 것.

**Step 2: 실패 확인** — Run: `pnpm vitest run lib/shopby/category-editor-open.test.ts` · Expected: FAIL

**Step 3: 구현**

```ts
// lib/shopby/category-editor-open.ts
import type { OpenCategoryEditorRequest, OpenCategoryEditorResult } from '../messaging';
import {
  DISPLAY_CATEGORY_CODE_INPUT_SELECTOR,
  DISPLAY_CATEGORY_NAME_INPUT_SELECTOR,
  DISPLAY_CATEGORY_NAME_WRAP_SELECTOR,
  DISPLAY_CATEGORY_TREE_SELECTOR,
} from './selectors';

// 트리 row에서 카테고리 이름이 일치하는 name-wrap 엘리먼트를 반환한다.
// 이름은 분기별 중복 가능 → 첫 매치 사용(하위는 부모 펼침 상태에서만 보임, best-effort).
export function findCategoryRow(
  doc: Document | Element,
  request: OpenCategoryEditorRequest,
): HTMLElement | null {
  const target = request.name.trim();
  if (!target) return null;

  const wraps = doc.querySelectorAll<HTMLElement>(DISPLAY_CATEGORY_NAME_WRAP_SELECTOR);
  for (const wrap of wraps) {
    if ((wrap.textContent?.trim() ?? '') === target) return wrap;
  }
  return null;
}

type OpenOptions = { maxScrollSteps?: number; scrollStepPx?: number; waitMs?: number; hostname?: string };
const DEFAULTS: Omit<Required<OpenOptions>, 'hostname'> = { maxScrollSteps: 30, scrollStepPx: 240, waitMs: 50 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isShopbyAdminHost = (h: string) => h.endsWith('.shopby.co.kr') || h.endsWith('.e-ncp.com');

async function findWithScroll(doc: Document, request: OpenCategoryEditorRequest, opts: typeof DEFAULTS) {
  const immediate = findCategoryRow(doc, request);
  if (immediate) return immediate;

  const container = doc.querySelector<HTMLElement>(DISPLAY_CATEGORY_TREE_SELECTOR);
  if (!container) return null;

  container.scrollTop = 0;
  for (let step = 0; step < opts.maxScrollSteps; step += 1) {
    const hit = findCategoryRow(doc, request);
    if (hit) return hit;
    const before = container.scrollTop;
    container.scrollTop = before + opts.scrollStepPx;
    if (container.scrollTop === before) break;
    await sleep(opts.waitMs);
  }
  return findCategoryRow(doc, request);
}

// 클릭 후 등장하는 편집 폼 입력란을 focus. 상위는 코드 입력란, 하위는 이름 입력란 우선.
async function focusFieldSoon(doc: Document, depth: number, opts: typeof DEFAULTS) {
  const selector = depth <= 1 ? DISPLAY_CATEGORY_CODE_INPUT_SELECTOR : DISPLAY_CATEGORY_NAME_INPUT_SELECTOR;
  for (let step = 0; step < opts.maxScrollSteps; step += 1) {
    const el = doc.querySelector<HTMLInputElement>(selector);
    if (el) {
      el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
      return;
    }
    await sleep(opts.waitMs);
  }
}

export async function openCategoryEditor(
  doc: Document,
  request: OpenCategoryEditorRequest,
  options: OpenOptions = {},
): Promise<OpenCategoryEditorResult> {
  const hostname = options.hostname ?? doc.location.hostname;
  if (!isShopbyAdminHost(hostname)) {
    return { status: 'wrong-host', message: '어드민 페이지에서 열어주세요' };
  }

  const opts = { ...DEFAULTS, ...options };
  const row = await findWithScroll(doc, request, opts);
  if (!row) {
    return { status: 'not-found', message: '관리자 트리에서 해당 카테고리를 찾지 못했어요' };
  }

  row.scrollIntoView?.({ block: 'center' });
  row.click();
  await focusFieldSoon(doc, request.depth, opts);
  return { status: 'opened' };
}
```

> 메시징 타입(`OpenCategoryEditorRequest`/`Result`)은 Task 6에서 추가한다. 이 태스크를 먼저 컴파일하려면 Task 6의 타입 추가를 함께 진행하거나, 임시로 로컬 타입을 두지 말고 **Task 6을 이 태스크 직전에 끼워** 메시징 타입부터 추가해도 된다. (권장: Task 6의 타입 정의 부분만 먼저 적용 → Task 4 → 나머지 Task 6 와이어링.)

**Step 4: 통과 확인** · **Step 5: 커밋**

```bash
git add lib/shopby/category-editor-open.ts lib/shopby/category-editor-open.test.ts
git commit -m "feat: 어드민 트리에서 전시카테고리 열기"
```

---

### Task 5: 코드 가이드 주입 (`category-code-guide.ts`)

**Files:**
- Create: `lib/shopby/category-code-guide.ts`
- Test: `lib/shopby/category-code-guide.test.ts`

참고: `lib/shopby/brand-extra-info-guide.ts`(주입·MutationObserver·중복방지 마커 패턴). 차이점 — 대상이 textarea가 아니라 코드 `input`이고, 안내 문구가 상위 코드/하위 미사용을 설명한다.

**Step 1: 실패하는 테스트 작성**

```ts
// lib/shopby/category-code-guide.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { GUIDE_MARKER_ATTR, startCategoryCodeGuide } from './category-code-guide';

afterEach(() => { document.body.innerHTML = ''; });

function makeCodeInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.className = 'display-category-management_input-code__abc';
  document.body.appendChild(input);
  return input;
}

describe('startCategoryCodeGuide', () => {
  it('코드 입력란 옆에 가이드를 1회 주입한다', () => {
    const input = makeCodeInput();
    const stop = startCategoryCodeGuide(document);
    const guide = document.querySelector(`[${GUIDE_MARKER_ATTR}]`);
    expect(guide).not.toBeNull();
    expect(input.nextElementSibling).toBe(guide);
    stop();
  });

  it('중복 주입하지 않는다', () => {
    makeCodeInput();
    const stop = startCategoryCodeGuide(document);
    startCategoryCodeGuide(document)();
    expect(document.querySelectorAll(`[${GUIDE_MARKER_ATTR}]`)).toHaveLength(1);
    stop();
  });

  it('나중에 추가된 코드 입력란도 observer가 잡는다', async () => {
    const stop = startCategoryCodeGuide(document);
    makeCodeInput();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).not.toBeNull();
    stop();
  });
});
```

**Step 2: 실패 확인** — Run: `pnpm vitest run lib/shopby/category-code-guide.test.ts` · Expected: FAIL

**Step 3: 구현** (브랜드 가이드를 본떠 작성, 셀렉터/문구만 교체)

```ts
// lib/shopby/category-code-guide.ts
import { DISPLAY_CATEGORY_CODE_INPUT_SELECTOR } from './selectors';

export const GUIDE_MARKER_ATTR = 'data-goondori-category-guide';
const GUIDE_VALUE = 'category-code';

function buildGuide(doc: Document): HTMLElement {
  const aside = doc.createElement('aside');
  aside.setAttribute(GUIDE_MARKER_ATTR, GUIDE_VALUE);
  aside.style.cssText = [
    'margin: 8px 0', 'padding: 10px 12px', 'background: #f4f6fb',
    'border-left: 3px solid #3fb382', 'border-radius: 6px',
    'font-size: 12px', 'color: #1d2939', 'line-height: 1.5',
  ].join(';');
  aside.innerHTML = `
    <p style="margin:0 0 6px;font-weight:600">군돌이 전시카테고리 코드 가이드</p>
    <ul style="margin:0 0 6px 18px;padding:0">
      <li><code>c_&lt;순번&gt;</code> — 운영(prod) 상위 카테고리 (예: <code>c_1</code>, <code>c_2</code>)</li>
      <li><code>ct_&lt;순번&gt;</code> — 개발(dev) 상위 카테고리 (예: <code>ct_1</code>, <code>ct_2</code>)</li>
    </ul>
    <p style="margin:0">하위 카테고리는 관리코드를 쓰지 않습니다.</p>
    <p style="margin:6px 0 0">익스텐션의 <strong>전시카테고리</strong> 탭에서 노출 모습을 미리 볼 수 있어요.</p>
  `;
  return aside;
}

function injectGuideBelow(input: HTMLInputElement) {
  if (input.dataset.goondoriCategoryGuideAttached === '1') return;
  input.dataset.goondoriCategoryGuideAttached = '1';
  input.insertAdjacentElement('afterend', buildGuide(input.ownerDocument));
}

function scan(root: Document | Element) {
  root.querySelectorAll<HTMLInputElement>(DISPLAY_CATEGORY_CODE_INPUT_SELECTOR).forEach(injectGuideBelow);
}

// 전시카테고리 편집 폼의 코드 입력란을 감지해 c_/ct_ 가이드를 주입. SPA 재렌더 대응.
export function startCategoryCodeGuide(doc: Document): () => void {
  scan(doc);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(DISPLAY_CATEGORY_CODE_INPUT_SELECTOR) && node instanceof HTMLInputElement) {
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

**Step 4: 통과 확인** · **Step 5: 커밋**

```bash
git add lib/shopby/category-code-guide.ts lib/shopby/category-code-guide.test.ts
git commit -m "feat: 전시카테고리 코드 입력란 가이드 주입"
```

---

### Task 6: 메시징 타입 + 콘텐츠 스크립트 와이어링

**Files:**
- Modify: `lib/messaging.ts`
- Modify: `entrypoints/content.ts`

> 주의: Task 4가 이 타입에 의존한다. 실제 작업 순서는 **6a(타입) → 4 → 5 → 6b(와이어링)** 으로 진행하면 컴파일이 끊기지 않는다.

**Step 6a: 메시징 타입 추가 (`lib/messaging.ts`)**

```ts
// 타입 블록에 추가
export type OpenCategoryEditorRequest = {
  name: string;
  categoryNo: number;
  depth: number;
};

export type OpenCategoryEditorStatus = 'opened' | 'not-found' | 'wrong-host';

export type OpenCategoryEditorResult = {
  status: OpenCategoryEditorStatus;
  message?: string;
};

// Protocol 인터페이스에 추가:
//   openCategoryEditor(request: OpenCategoryEditorRequest): OpenCategoryEditorResult;
```

**Step 6b: 와이어링 (`entrypoints/content.ts`)** — import + main() 안에 등록

```ts
import { openCategoryEditor } from '../lib/shopby/category-editor-open';
import { startCategoryCodeGuide } from '../lib/shopby/category-code-guide';

// main() 안, startExtraInfoGuide(document); 다음 줄에 추가:
onMessage('openCategoryEditor', (message) => openCategoryEditor(document, message.data));
startCategoryCodeGuide(document);
```

**Step 검증** — Run: `pnpm compile` (타입 체크) + `pnpm test:run` · Expected: 0 errors, 모든 테스트 통과

**커밋**

```bash
git add lib/messaging.ts entrypoints/content.ts
git commit -m "feat: openCategoryEditor 메시지·코드 가이드 콘텐츠 스크립트 와이어링"
```

---

## Phase 3 — 사이드패널 UI (전시카테고리 탭)

### Task 7: 미리보기/목록용 선택 로직 (`display-categories.ts`)

**Files:**
- Create: `lib/shopby/display-categories.ts`
- Test: `lib/shopby/display-categories.test.ts`

순수 함수로 UI 데이터 가공을 분리한다(브랜드의 `brand-extra-info.ts` 역할). env로 상위를 필터하고, 노출된 하위만 남긴다.

**Step 1: 실패하는 테스트 작성**

```ts
// lib/shopby/display-categories.test.ts
import { describe, expect, it } from 'vitest';
import { filterTopCategoriesByEnv, type DisplayCategoryEntry } from './display-categories';

const tree: DisplayCategoryEntry[] = [
  { categoryNo: 1, name: '베스트', managementCode: 'c_1', depth: 1, children: [
    { categoryNo: 11, name: '카테고리1', managementCode: '', depth: 2, children: [] },
  ] },
  { categoryNo: 2, name: '오늘의딜', managementCode: 'ct_1', depth: 1, children: [] },
  { categoryNo: 3, name: '미분류', managementCode: '', depth: 1, children: [] },
];

describe('filterTopCategoriesByEnv', () => {
  it('운영(c) 환경은 c_ 접두 상위만, order 오름차순', () => {
    const result = filterTopCategoriesByEnv(tree, 'c');
    expect(result.map((c) => c.categoryNo)).toEqual([1]);
    expect(result[0].order).toBe(1);
  });

  it('개발(ct) 환경은 ct_ 접두 상위만', () => {
    const result = filterTopCategoriesByEnv(tree, 'ct');
    expect(result.map((c) => c.categoryNo)).toEqual([2]);
  });

  it('코드 없는 상위(미분류)는 제외', () => {
    expect(filterTopCategoriesByEnv(tree, 'c').some((c) => c.categoryNo === 3)).toBe(false);
  });
});
```

**Step 2: 실패 확인** · **Step 3: 구현**

```ts
// lib/shopby/display-categories.ts
import type { DisplayCategoryEntry } from './api/types';
import { parseCategoryCode } from './category-code';
import type { Env } from '../display-id/types';

export type { DisplayCategoryEntry } from './api/types';

export type TopCategory = DisplayCategoryEntry & { order: number };

// 상위 카테고리를 env(c/ct) 코드 접두사로 필터하고 순번 오름차순 정렬한다.
// 코드 없는 상위(미분류)는 제외한다.
export function filterTopCategoriesByEnv(tree: DisplayCategoryEntry[], env: Env): TopCategory[] {
  const result: TopCategory[] = [];
  for (const entry of tree) {
    const code = parseCategoryCode(entry.managementCode);
    if (!code || code.env !== env) continue;
    result.push({ ...entry, order: code.order });
  }
  result.sort((a, b) => a.order - b.order);
  return result;
}

// 미분류(코드 없는) 상위 개수 — UI에 "제외 N건" 표기용.
export function countUnclassifiedTop(tree: DisplayCategoryEntry[]): number {
  return tree.filter((e) => parseCategoryCode(e.managementCode) === null).length;
}
```

**Step 4: 통과 확인** · **Step 5: 커밋**

```bash
git add lib/shopby/display-categories.ts lib/shopby/display-categories.test.ts
git commit -m "feat: 전시카테고리 env 필터·정렬 선택 로직"
```

---

### Task 8: 미리보기 컴포넌트 (`CategoryPreview`) + 스타일

**Files:**
- Create: `entrypoints/sidepanel/ui/CategoryPreview.tsx`
- Create: `entrypoints/sidepanel/ui/CategoryPreview.test.tsx`
- Modify: `entrypoints/sidepanel/style.css` (디자인 토큰·클래스 추가)

Figma(node 25858-232537) 스토어프론트 목업. 상위 탭(선택 시 초록 밑줄) + 하위 칩(선택 채움). **노출된 하위 0개면 칩 행 미렌더.**

토큰: 초록 `#3fb382`, 라인 `#dcdcdc`, 칩 채움 `#474747`/글자 `#f7f7f7`, 비선택 글자 `#8a8a8a`. 탭 h-44 SemiBold 15px, 칩 h-32 radius 99px.

**Step 1: 실패하는 테스트 작성** (@testing-library/react — `BrandShowcaseList.test.tsx` 스타일 참고)

```tsx
// entrypoints/sidepanel/ui/CategoryPreview.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryPreview } from './CategoryPreview';
import type { TopCategory } from '../../../lib/shopby/display-categories';

const tops: TopCategory[] = [
  { categoryNo: 1, name: '베스트', managementCode: 'c_1', depth: 1, order: 1, children: [
    { categoryNo: 11, name: '카테고리1', managementCode: '', depth: 2, children: [] },
  ] },
  { categoryNo: 2, name: '오늘의딜', managementCode: 'c_2', depth: 1, order: 2, children: [] },
];

describe('CategoryPreview', () => {
  it('상위 카테고리를 탭으로 렌더한다', () => {
    render(<CategoryPreview tops={tops} selectedNo={1} onSelect={() => {}} onOpen={() => {}} />);
    expect(screen.getByText('베스트')).toBeInTheDocument();
    expect(screen.getByText('오늘의딜')).toBeInTheDocument();
  });

  it('선택 상위의 하위를 칩으로 렌더한다', () => {
    render(<CategoryPreview tops={tops} selectedNo={1} onSelect={() => {}} onOpen={() => {}} />);
    expect(screen.getByText('카테고리1')).toBeInTheDocument();
  });

  it('선택 상위에 하위가 없으면 칩 행을 렌더하지 않는다', () => {
    render(<CategoryPreview tops={tops} selectedNo={2} onSelect={() => {}} onOpen={() => {}} />);
    expect(screen.queryByTestId('category-chip-row')).toBeNull();
  });

  it('탭 클릭 시 onSelect 호출', async () => {
    const onSelect = vi.fn();
    const { getByText } = render(<CategoryPreview tops={tops} selectedNo={1} onSelect={onSelect} onOpen={() => {}} />);
    getByText('오늘의딜').click();
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
```

**Step 2: 실패 확인** · **Step 3: 구현**

```tsx
// entrypoints/sidepanel/ui/CategoryPreview.tsx
import type { TopCategory } from '../../../lib/shopby/display-categories';
import type { DisplayCategoryEntry } from '../../../lib/shopby/api/types';

type Props = {
  tops: TopCategory[];
  selectedNo: number | null;
  onSelect: (categoryNo: number) => void;
  onOpen: (entry: DisplayCategoryEntry) => void;
};

export function CategoryPreview({ tops, selectedNo, onSelect, onOpen }: Props) {
  const selected = tops.find((t) => t.categoryNo === selectedNo) ?? tops[0] ?? null;
  const children = selected?.children ?? [];

  return (
    <div className="category-preview" aria-label="스토어프론트 미리보기">
      <div className="category-preview__tabs" role="tablist">
        {tops.map((top) => (
          <button
            key={top.categoryNo}
            type="button"
            role="tab"
            aria-selected={top.categoryNo === selected?.categoryNo}
            className="category-preview__tab"
            data-active={top.categoryNo === selected?.categoryNo}
            onClick={() => onSelect(top.categoryNo)}
            onDoubleClick={() => onOpen(top)}
          >
            {top.name}
          </button>
        ))}
      </div>

      {children.length > 0 && (
        <div className="category-preview__chips" data-testid="category-chip-row">
          {children.map((child, i) => (
            <button
              key={child.categoryNo}
              type="button"
              className="category-preview__chip"
              data-active={i === 0}
              onClick={() => onOpen(child)}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**style.css 추가** (정확한 토큰 반영):

```css
/* 전시카테고리 미리보기 — Figma node 25858-232537 */
.category-preview { background: #fff; border: 1px solid #ebebeb; border-radius: 8px; overflow: hidden; }
.category-preview__tabs { display: flex; align-items: center; border-bottom: 1px solid #ebebeb; padding: 0 12px; }
.category-preview__tab {
  flex: 1 0 0; height: 44px; border: 0; background: none; cursor: pointer;
  font-weight: 600; font-size: 15px; color: #8a8a8a; border-bottom: 2px solid transparent;
}
.category-preview__tab[data-active='true'] { color: #3fb382; border-bottom-color: #3fb382; }
.category-preview__chips { display: flex; gap: 6px; align-items: center; padding: 10px 0 10px 16px; overflow-x: auto; }
.category-preview__chip {
  height: 32px; padding: 7px 12px; border-radius: 99px; cursor: pointer;
  border: 1px solid #dcdcdc; background: #fff; color: #8a8a8a; font-size: 14px; font-weight: 500; white-space: nowrap;
}
.category-preview__chip[data-active='true'] { background: #474747; color: #f7f7f7; border-color: #474747; font-weight: 600; }
```

**Step 4: 통과 확인** · **Step 5: 커밋**

```bash
git add entrypoints/sidepanel/ui/CategoryPreview.tsx entrypoints/sidepanel/ui/CategoryPreview.test.tsx entrypoints/sidepanel/style.css
git commit -m "feat: 전시카테고리 스토어프론트 미리보기 컴포넌트"
```

---

### Task 9: 접이식 설정 목록 (`CategoryList`)

**Files:**
- Create: `entrypoints/sidepanel/ui/CategoryList.tsx`
- Create: `entrypoints/sidepanel/ui/CategoryList.test.tsx`
- Modify: `entrypoints/sidepanel/style.css`

상위 행: chevron + 코드 + 순번 + 이름. **행 클릭=접기/펼치기 토글, 우측 열기 아이콘=onOpen.** 하위 행(노출된 하위만): 클릭=onOpen.

**Step 1: 실패하는 테스트 작성**

```tsx
// entrypoints/sidepanel/ui/CategoryList.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryList } from './CategoryList';
import type { TopCategory } from '../../../lib/shopby/display-categories';

const tops: TopCategory[] = [
  { categoryNo: 1, name: '베스트', managementCode: 'c_1', depth: 1, order: 1, children: [
    { categoryNo: 11, name: '카테고리1', managementCode: '', depth: 2, children: [] },
  ] },
];

describe('CategoryList', () => {
  it('상위 행에 코드와 이름을 표시한다', () => {
    render(<CategoryList tops={tops} onOpen={() => {}} />);
    expect(screen.getByText('c_1')).toBeInTheDocument();
    expect(screen.getByText('베스트')).toBeInTheDocument();
  });

  it('기본은 접힘 — 하위가 보이지 않는다', () => {
    render(<CategoryList tops={tops} onOpen={() => {}} />);
    expect(screen.queryByText('카테고리1')).toBeNull();
  });

  it('상위 행 클릭 시 펼쳐져 하위가 보인다', () => {
    render(<CategoryList tops={tops} onOpen={() => {}} />);
    screen.getByRole('button', { name: /베스트/ }).click();
    expect(screen.getByText('카테고리1')).toBeInTheDocument();
  });

  it('우측 열기 아이콘 클릭 시 onOpen(상위) 호출 (토글되지 않음)', () => {
    const onOpen = vi.fn();
    render(<CategoryList tops={tops} onOpen={onOpen} />);
    screen.getByRole('button', { name: '어드민에서 열기: 베스트' }).click();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ categoryNo: 1 }));
    expect(screen.queryByText('카테고리1')).toBeNull(); // 토글 안 됨
  });
});
```

**Step 2: 실패 확인** · **Step 3: 구현**

```tsx
// entrypoints/sidepanel/ui/CategoryList.tsx
import { useState } from 'react';
import type { TopCategory } from '../../../lib/shopby/display-categories';
import type { DisplayCategoryEntry } from '../../../lib/shopby/api/types';

type Props = { tops: TopCategory[]; onOpen: (entry: DisplayCategoryEntry) => void };

export function CategoryList({ tops, onOpen }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(no: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(no) ? next.delete(no) : next.add(no);
      return next;
    });
  }

  return (
    <ul className="category-list" aria-label="설정 목록">
      {tops.map((top) => {
        const open = expanded.has(top.categoryNo);
        return (
          <li key={top.categoryNo} className="category-list__group">
            <div className="category-list__row">
              <button type="button" className="category-list__toggle" aria-expanded={open} onClick={() => toggle(top.categoryNo)}>
                <span className="category-list__chevron" data-open={open}>▸</span>
                <code className="category-list__code">{top.managementCode}</code>
                <span className="category-list__name">{top.name}</span>
              </button>
              <button type="button" className="category-list__open" aria-label={`어드민에서 열기: ${top.name}`} onClick={() => onOpen(top)}>
                ›
              </button>
            </div>
            {open && top.children.length > 0 && (
              <ul className="category-list__children">
                {top.children.map((child) => (
                  <li key={child.categoryNo}>
                    <button type="button" className="category-list__child" onClick={() => onOpen(child)}>
                      · {child.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

**style.css 추가** (간단 목록 스타일; 토큰 재사용)

```css
.category-list { list-style: none; margin: 0; padding: 0; }
.category-list__row { display: flex; align-items: center; border-bottom: 1px solid #ebebeb; }
.category-list__toggle { flex: 1 0 0; display: flex; gap: 8px; align-items: center; padding: 10px 8px; border: 0; background: none; cursor: pointer; text-align: left; }
.category-list__chevron { transition: transform 150ms; }
.category-list__chevron[data-open='true'] { transform: rotate(90deg); }
.category-list__code { font-size: 12px; color: #3fb382; font-weight: 600; }
.category-list__name { font-size: 14px; color: #171717; }
.category-list__open { padding: 8px 12px; border: 0; background: none; cursor: pointer; color: #8a8a8a; font-size: 18px; }
.category-list__children { list-style: none; margin: 0; padding: 0 0 6px 28px; }
.category-list__child { border: 0; background: none; cursor: pointer; padding: 6px 4px; color: #474747; font-size: 13px; }
```

**Step 4: 통과 확인** · **Step 5: 커밋**

```bash
git add entrypoints/sidepanel/ui/CategoryList.tsx entrypoints/sidepanel/ui/CategoryList.test.tsx entrypoints/sidepanel/style.css
git commit -m "feat: 전시카테고리 접이식 설정 목록"
```

---

### Task 10: 컨테이너 (`CategoryShowcase`) — env 토글 + 미리보기 + 목록 조립

**Files:**
- Create: `entrypoints/sidepanel/ui/CategoryShowcase.tsx`
- Create: `entrypoints/sidepanel/ui/CategoryShowcase.test.tsx`

`BrandShowcase.tsx` 컨테이너 패턴 차용. `useRemoteList(fetchDisplayCategories)` + 환경 토글(c/ct, 자체 segmented 버튼 재사용) + `filterTopCategoriesByEnv`. 클릭 → `sendMessage('openCategoryEditor', …)`로 현재 탭에 전달.

> EnvToggle은 BrandEnv(prod/dev)에 묶여 있으므로 재사용하지 않고, `DisplayBuilder`의 segmented 버튼 마크업(`.segmented`/`.segmented__button`)을 그대로 써서 c/ct 토글을 만든다.

**메시지 전송 유틸** — `sendMessage`는 콘텐츠 스크립트(현재 탭)로 보내야 한다. 기존 브랜드 row 클릭이 어떻게 보내는지 확인할 것: `entrypoints/sidepanel/ui/BrandShowcaseCard.tsx` 또는 `BrandShowcaseList.tsx`에서 `openBrandEditor` 전송 코드를 grep(`sendMessage('openBrandEditor'`)해 동일 방식(activeTab frameId 등)으로 `openCategoryEditor`를 전송한다.

**Step 1: 실패하는 테스트 작성** (네트워크는 `fetch` stub, 메시지는 모킹)

```tsx
// entrypoints/sidepanel/ui/CategoryShowcase.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryShowcase } from './CategoryShowcase';

const TREE = {
  multiLevelCategories: [
    { categoryNo: 1, depth: 1, label: '베스트', managementCode: 'c_1', content: '', icon: '', children: [] },
    { categoryNo: 2, depth: 1, label: '테스트탭', managementCode: 'ct_1', content: '', icon: '', children: [] },
  ],
  flatCategories: [],
};

describe('CategoryShowcase', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('운영 환경 기본 — c_ 상위만 보인다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(TREE), { status: 200 }))));
    render(<CategoryShowcase />);
    await waitFor(() => expect(screen.getAllByText('베스트').length).toBeGreaterThan(0));
    expect(screen.queryByText('테스트탭')).toBeNull();
  });
});
```

> 위 테스트는 컨테이너 동작의 골격이다. `BrandShowcase.test.tsx`의 로딩/에러/빈상태 테스트 구조를 참고해 loading 스켈레톤·error·empty(`해당 환경에 코드 설정된 상위 카테고리가 없습니다`) 케이스를 추가할 것.

**Step 2~4: 구현 후 통과** — `BrandShowcase.tsx` 구조를 본떠 작성:
- 상태: `env: 'c' | 'ct'`(기본 'c'), `selectedNo`.
- `tops = filterTopCategoriesByEnv(items, env)`.
- 렌더: 환경 segmented 토글 → 새로고침 → loading/error/empty → `CategoryPreview` + `CategoryList`.
- `onOpen(entry)` = `sendMessage('openCategoryEditor', { name: entry.name, categoryNo: entry.categoryNo, depth: entry.depth }, { /* 현재 탭 지정 — 브랜드와 동일 */ })`.

**Step 5: 커밋**

```bash
git add entrypoints/sidepanel/ui/CategoryShowcase.tsx entrypoints/sidepanel/ui/CategoryShowcase.test.tsx
git commit -m "feat: 전시카테고리 탭 컨테이너(환경 토글·미리보기·목록 조립)"
```

---

### Task 11: App 탭 등록

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`

**Step 1: 실패하는 테스트** (App에 탭이 추가됐는지 — 기존 App 테스트 유무 확인 후, 없으면 간단 렌더 테스트 추가 또는 수동 검증으로 대체)

```tsx
// 가능하면 App.test.tsx에 추가
import { render, screen } from '@testing-library/react';
import App from '../App';
it('전시카테고리 탭이 보인다', () => {
  render(<App />);
  expect(screen.getByRole('tab', { name: '전시카테고리' })).toBeInTheDocument();
});
```

**Step 2~4: 구현**

```tsx
// App.tsx 변경
import { CategoryShowcase } from './ui/CategoryShowcase';

const TABS: TabItem[] = [
  { id: 'display', label: '진열' },
  { id: 'brand', label: '브랜드' },
  { id: 'category', label: '전시카테고리' },
];

// 워크스페이스 분기에 추가:
{activeTab === 'category' && <CategoryShowcase />}
```

**Step 5: 전체 검증 + 커밋**

```bash
pnpm compile && pnpm test:run
git add entrypoints/sidepanel/App.tsx entrypoints/sidepanel/App.test.tsx
git commit -m "feat: 사이드패널 전시카테고리 탭 등록"
```

---

## 최종 검증 (전체 완료 후)

1. `pnpm compile` — 타입 0 에러.
2. `pnpm test:run` — 전체 통과(기존 188 + 신규), 커버리지 80%+ (`pnpm coverage`).
3. `pnpm build` — 프로덕션 빌드 성공.
4. **수동/라이브 검증 (설계 문서의 "검증해야 할 가정"):**
   - `GET /categories`가 노출안함 카테고리를 제외하는지 실제 응답으로 확인.
   - 어드민 전시카테고리 페이지에서 트리 row 클릭 → 편집 폼 전환, 코드 입력란 가이드 주입 확인.
   - 하위 노드 펼침 후 열기 동작 확인.
   - `managementCode`가 상위에만 채워지는지 확인.
5. 가정이 깨지면(예: 프론트 API가 노출안함도 반환) 해당 태스크 보강 — 노출 필드 기반 필터를 `display-categories.ts`에 추가.

## 참고 — 작업 순서 요약

Phase 1 (Task 1→2) → Phase 2 (Task 6a 타입 → 3 → 4 → 5 → 6b 와이어링) → Phase 3 (Task 7→8→9→10→11) → 최종 검증.
