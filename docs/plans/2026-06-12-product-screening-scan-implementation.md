# 상품심사 일괄 스캔 구현 계획 (Product Screening Scan Implementation Plan)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 상품심사(승인대기) 목록의 상품번호를 전부 추출해 심사 팝업 정보를 숨김 탭으로 수집하고, MD가 설정한 규칙(필수값·기대값·이미지) 위반 상품을 사이드패널 「심사」 탭에 보여준다.

**Architecture:** 설계 문서 `docs/plans/2026-06-12-product-screening-scan-design.md` 기준. 순수 로직(파서·규칙 엔진·수집·스캔 실행기)은 전부 `lib/shopby/screening/`에 두고(coverage 대상), 사이드패널 훅이 `browser.tabs`/`browser.scripting`으로 오케스트레이션한다. background 변경 없음 — 사이드패널은 확장 페이지라 `browser.tabs.*`를 직접 쓸 수 있고, `@webext-core/messaging@3`의 `sendMessage(type, data, { tabId, frameId })`로 특정 프레임에 직접 보내 멀티프레임 응답 레이스를 피한다(`lib/.../messaging/lib/index.js`에서 frameId 전달 확인 완료).

**Tech Stack:** WXT + React 19 + TypeScript, `@webext-core/messaging`, vitest(jsdom, Testing Library). 픽스처는 이미 저장됨: `tests/fixtures/admin-screening-list.html`(목록 그리드), `tests/fixtures/admin-screening-popup.html`(심사 팝업).

**재사용하는 기존 코드 (새로 만들지 말 것):**

| 무엇 | 어디 |
|---|---|
| React 폼에 안전한 값 주입(`setFieldValue`) | `lib/shopby/fill.ts:6` |
| tui-pagination 현재 페이지/다음 버튼(`readSelectedPage`, `findNextPageControl`) | `lib/shopby/brand-editor-open.ts` (export 됨) |
| 페이지네이션 셀렉터(`BRAND_PAGINATION_SELECTOR` 등 — 값은 범용 `.tui-pagination`) | `lib/shopby/selectors.ts:63-68` |
| 픽스처 로딩 idiom(`loadFixture`) | `lib/shopby/selectors.test.ts:11-14` 참고 |
| 메시징 프로토콜 정의 패턴 | `lib/messaging.ts` |
| 사이드패널 탭 등록 | `entrypoints/sidepanel/App.tsx` |

**작업 규칙:**

- 각 Task는 RED(실패 테스트) → GREEN(최소 구현) → 커밋 순서. 테스트 실행: `pnpm test:run <파일경로>`, 타입체크: `pnpm compile`.
- 커밋 메시지는 한국어 + conventional commit(`feat:`/`test:`/`docs:`), 본 repo 히스토리 스타일을 따른다.
- 모든 셀렉터는 CSS 모듈 해시(`Grid_grid-title__h9UjD` 류) 대신 `data-cy`·범용 클래스·텍스트 앵커를 쓴다.

---

### Task 0: 브랜치 생성 + 기준선 확인

**Step 1:** 브랜치 생성

```bash
git checkout -b feature/product-screening-scan
```

**Step 2:** 기존 테스트·타입 통과 확인 (기준선)

```bash
pnpm test:run && pnpm compile
```

Expected: 모두 PASS. 실패하면 멈추고 보고.

---

### Task 1: 도메인 타입 + 메시징 프로토콜

**Files:**
- Create: `lib/shopby/screening/types.ts`
- Modify: `lib/messaging.ts`

**Step 1: 타입 파일 작성**

```ts
// lib/shopby/screening/types.ts

// 심사 팝업의 섹션 제목. 팝업 픽스처(tests/fixtures/admin-screening-popup.html) 기준.
export const SCREENING_SECTIONS = [
  '기본정보',
  '판매정보',
  '이미지정보',
  '배송정보',
  '상품항목추가정보',
] as const;

export type SectionName = (typeof SCREENING_SECTIONS)[number];

export type ScreeningImages = { main: string[]; list: string[]; detail: string[] };

export type ParsedScreeningProduct = {
  fields: Partial<Record<SectionName, Record<string, string>>>;
  images: ScreeningImages;
};

export type ScreeningRow = { productNo: string; productName: string };

export type CollectScreeningListResult = {
  status: 'ok' | 'no-grid' | 'count-mismatch';
  rows: ScreeningRow[];
  totalCount: number | null; // "검색결과 총 N건"
  pagesVisited: number;
};

export type ScreeningPopupResult =
  | { status: 'ok'; product: ParsedScreeningProduct }
  | { status: 'not-rendered' }
  | { status: 'login-redirect' };
```

**Step 2: 메시징 프로토콜 확장**

`lib/messaging.ts`의 `Protocol` 인터페이스에 두 메서드를 추가하고 타입을 re-export:

```ts
// 상단 import에 추가
import type {
  CollectScreeningListResult,
  ScreeningPopupResult,
} from './shopby/screening/types';

// Protocol 인터페이스에 추가
interface Protocol {
  // ...기존 4개 유지...
  // 심사 탭: 목록 페이지(그리드가 있는 프레임)에서 상품번호 전체 수집.
  collectScreeningList(): CollectScreeningListResult;
  // 심사 탭: 심사 팝업 탭에서 렌더 대기 후 상품 정보 파싱.
  parseScreeningPopup(): ScreeningPopupResult;
}
```

**Step 3: 타입체크**

```bash
pnpm compile
```

Expected: PASS (아직 핸들러 미구현이어도 프로토콜 선언만으로는 에러 없음).

**Step 4: 커밋**

```bash
git add lib/shopby/screening/types.ts lib/messaging.ts
git commit -m "feat: 상품심사 스캔 도메인 타입·메시징 프로토콜 추가"
```

---

### Task 2: 심사 팝업 파서 (`popup-parser.ts`)

**Files:**
- Create: `lib/shopby/screening/popup-parser.ts`
- Test: `lib/shopby/screening/popup-parser.test.ts`
- Fixture(이미 존재): `tests/fixtures/admin-screening-popup.html`

**Step 1: 실패하는 테스트 작성**

```ts
// lib/shopby/screening/popup-parser.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScreeningDocument, waitForScreeningParse } from './popup-parser';

function loadFixture(name: string): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('parseScreeningDocument (admin-screening-popup.html 픽스처)', () => {
  it('섹션별 항목-값 레코드를 파싱한다', () => {
    const doc = loadFixture('admin-screening-popup.html');

    const product = parseScreeningDocument(doc);

    expect(product).not.toBeNull();
    expect(product!.fields['기본정보']?.['상품명']).toBe('[디라이프] 쿡 웨어 IH 3종 냄비세트');
    expect(product!.fields['기본정보']?.['제조사명']).toBe('');
    expect(product!.fields['판매정보']?.['판매수수료']).toBe('상품수수료, 15%');
    expect(product!.fields['판매정보']?.['판매가']).toBe('140,000원');
    expect(product!.fields['배송정보']?.['상품 중량']).toBe('0kg');
    expect(product!.fields['배송정보']?.['반품/교환 배송비']).toBe('편도기준 4,500 원');
    expect(product!.fields['상품항목추가정보']?.['상품항목추가정보']).toBe('');
  });

  it('이미지 src를 대표/리스트/상세로 분류한다', () => {
    const doc = loadFixture('admin-screening-popup.html');

    const product = parseScreeningDocument(doc);

    expect(product!.images.main).toEqual([
      '//shopby-images.cdn-nhncommerce.com/20260610/185503.692263644/133770595-1.jpg',
    ]);
    expect(product!.images.list).toEqual([]);
    expect(product!.images.detail).toHaveLength(10);
    expect(product!.images.detail[0]).toContain('ai.esmplus.com');
  });

  it('수정필요(의견 입력) 행은 항목에서 제외한다', () => {
    const doc = loadFixture('admin-screening-popup.html');

    const product = parseScreeningDocument(doc);

    expect(product!.fields['이미지정보']?.['수정필요']).toBeUndefined();
    expect(product!.fields['이미지정보']?.['배송안내']).toBe('기본 템플릿');
  });

  it('필수 섹션이 없으면 null (렌더 미완료)', () => {
    const doc = new DOMParser().parseFromString('<html><body><div id="root"></div></body></html>', 'text/html');

    expect(parseScreeningDocument(doc)).toBeNull();
  });
});

describe('waitForScreeningParse', () => {
  it('렌더 완료 문서는 즉시 ok를 반환한다', async () => {
    const doc = loadFixture('admin-screening-popup.html');

    const result = await waitForScreeningParse(doc, { timeoutMs: 100, pollMs: 10 });

    expect(result.status).toBe('ok');
  });

  it('비밀번호 입력이 보이면 login-redirect', async () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><form><input type="password"></form></body></html>',
      'text/html',
    );

    const result = await waitForScreeningParse(doc, { timeoutMs: 100, pollMs: 10 });

    expect(result.status).toBe('login-redirect');
  });

  it('타임아웃까지 렌더가 안 되면 not-rendered', async () => {
    const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');

    const result = await waitForScreeningParse(doc, { timeoutMs: 50, pollMs: 10 });

    expect(result.status).toBe('not-rendered');
  });
});
```

**Step 2: 실패 확인**

```bash
pnpm test:run lib/shopby/screening/popup-parser.test.ts
```

Expected: FAIL — `popup-parser` 모듈 없음.

**Step 3: 구현**

```ts
// lib/shopby/screening/popup-parser.ts
import {
  SCREENING_SECTIONS,
  type ParsedScreeningProduct,
  type ScreeningImages,
  type ScreeningPopupResult,
} from './types';

// CSS 모듈 해시(Layout_view-title__ZDIpZ)는 빌드마다 바뀔 수 있어 접두 부분만 매칭한다.
const SECTION_TITLE_SELECTOR = '[class*="Layout_view-title"]';

const DETAIL_IMAGE_FIELDS = new Set(['상품 상세', '상품 상세(상단)', '상품 상세(하단)']);

function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

// 심사 팝업의 섹션 테이블(항목|등록정보|수정필요항목)을 { 섹션: { 항목: 값 } }으로 파싱.
// 필수 섹션(기본정보·판매정보·배송정보)이 하나라도 없으면 렌더 미완료로 보고 null.
export function parseScreeningDocument(doc: Document): ParsedScreeningProduct | null {
  const fields: ParsedScreeningProduct['fields'] = {};
  const images: ScreeningImages = { main: [], list: [], detail: [] };

  for (const titleEl of doc.querySelectorAll(SECTION_TITLE_SELECTOR)) {
    const sectionName = SCREENING_SECTIONS.find((name) =>
      normalize(titleEl.textContent).startsWith(name),
    );
    if (!sectionName) continue;

    const table = titleEl.parentElement?.querySelector('table');
    if (!table) continue;

    const sectionFields: Record<string, string> = {};
    for (const row of table.querySelectorAll('tr')) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue; // th 헤더 행 스킵

      const label = normalize(cells[0].textContent);
      if (!label || label === '수정필요') continue; // 의견 textarea 행은 데이터가 아님

      sectionFields[label] = normalize(cells[1].textContent);
      if (sectionName === '이미지정보') collectImages(label, cells[1], images);
    }

    fields[sectionName] = sectionFields;
  }

  if (!fields['기본정보'] || !fields['판매정보'] || !fields['배송정보']) return null;
  return { fields, images };
}

function collectImages(label: string, cell: Element, images: ScreeningImages) {
  const srcs = [...cell.querySelectorAll('img')]
    .map((img) => img.getAttribute('src') ?? '')
    .filter(Boolean);

  if (label === '상품이미지') images.main.push(...srcs);
  else if (label === '리스트이미지') images.list.push(...srcs);
  else if (DETAIL_IMAGE_FIELDS.has(label)) images.detail.push(...srcs);
}

export type WaitOptions = { timeoutMs?: number; pollMs?: number };

// SPA 렌더 완료를 고정 지연 대신 조건 폴링으로 기다린다.
// 로그인 화면으로 리다이렉트된 경우(세션 만료)는 즉시 구분해 반환 — 연속 실패 방지의 근거.
export async function waitForScreeningParse(
  doc: Document,
  opts: WaitOptions = {},
): Promise<ScreeningPopupResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const pollMs = opts.pollMs ?? 300;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (doc.querySelector('input[type="password"]')) return { status: 'login-redirect' };

    const product = parseScreeningDocument(doc);
    if (product) return { status: 'ok', product };

    if (Date.now() >= deadline) return { status: 'not-rendered' };
    await sleep(pollMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Step 4: 통과 확인**

```bash
pnpm test:run lib/shopby/screening/popup-parser.test.ts
```

Expected: PASS (테스트 7개).

**Step 5: 커밋**

```bash
git add lib/shopby/screening/popup-parser.ts lib/shopby/screening/popup-parser.test.ts
git commit -m "feat: 심사 팝업 DOM 파서 추가(섹션 항목·이미지 분류·렌더 대기)"
```

---

### Task 3: 규칙 엔진 (`rules.ts`)

**Files:**
- Create: `lib/shopby/screening/rules.ts`
- Test: `lib/shopby/screening/rules.test.ts`

**Step 1: 실패하는 테스트 작성**

```ts
// lib/shopby/screening/rules.test.ts
import { describe, expect, it } from 'vitest';
import { evaluate, imageHost, parseNumeric, type Rule } from './rules';
import type { ParsedScreeningProduct } from './types';

// 픽스처 파싱 결과의 축약형. 규칙 엔진은 파서 출력 형태만 알면 된다.
function product(overrides?: Partial<ParsedScreeningProduct>): ParsedScreeningProduct {
  return {
    fields: {
      기본정보: { 상품명: '[디라이프] 쿡 웨어 IH 3종 냄비세트', 제조사명: '', 브랜드: '디라이프' },
      판매정보: { 판매수수료: '상품수수료, 15%', 판매가: '140,000원' },
      배송정보: { '상품 중량': '0kg', '반품/교환 배송비': '편도기준 4,500 원' },
    },
    images: {
      main: ['//shopby-images.cdn-nhncommerce.com/a/b.jpg'],
      list: [],
      detail: ['https://ai.esmplus.com/x/1.jpg', 'https://ai.esmplus.com/x/2.jpg'],
    },
    ...overrides,
  };
}

describe('parseNumeric', () => {
  it.each([
    ['140,000원', 140_000],
    ['15%', 15],
    ['0kg', 0],
    ['상품수수료, 15%', 15],
    ['1,000개', 1_000],
    ['편도기준 4,500 원', 4_500],
  ])('"%s" → %d', (raw, expected) => {
    expect(parseNumeric(raw)).toBe(expected);
  });

  it('숫자가 없으면 null', () => {
    expect(parseNumeric('')).toBeNull();
    expect(parseNumeric('상품상세참조')).toBeNull();
  });
});

describe('imageHost', () => {
  it('프로토콜 상대 URL의 호스트를 읽는다', () => {
    expect(imageHost('//shopby-images.cdn-nhncommerce.com/a.jpg')).toBe('shopby-images.cdn-nhncommerce.com');
  });

  it('상대 경로는 어드민 자체 자원으로 보고 null', () => {
    expect(imageHost('/static/a.jpg')).toBeNull();
  });
});

describe('evaluate', () => {
  it('required: 공란이면 위반', () => {
    const rule: Rule = { id: 'r1', type: 'required', section: '기본정보', field: '제조사명', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('공란');
  });

  it('required: 값이 있으면 통과', () => {
    const rule: Rule = { id: 'r1', type: 'required', section: '기본정보', field: '브랜드', enabled: true };

    expect(evaluate(product(), [rule])).toEqual([]);
  });

  it('required: 항목 자체가 없으면 파싱 불일치 위반 (조용히 통과 금지)', () => {
    const rule: Rule = { id: 'r1', type: 'required', section: '기본정보', field: '없는항목', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('항목을 찾지 못함');
  });

  it('expected gt: "0kg" > 0 은 위반', () => {
    const rule: Rule = { id: 'r1', type: 'expected', section: '배송정보', field: '상품 중량', op: 'gt', value: '0', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toBe('0kg');
  });

  it('expected equals: 문자열 불일치여도 숫자가 같으면 통과 ("상품수수료, 15%" = "15%")', () => {
    const rule: Rule = { id: 'r1', type: 'expected', section: '판매정보', field: '판매수수료', op: 'equals', value: '15%', enabled: true };

    expect(evaluate(product(), [rule])).toEqual([]);
  });

  it('expected equals: 숫자도 다르면 위반', () => {
    const rule: Rule = { id: 'r1', type: 'expected', section: '판매정보', field: '판매수수료', op: 'equals', value: '20%', enabled: true };

    expect(evaluate(product(), [rule])).toHaveLength(1);
  });

  it('expected 숫자 비교: 숫자를 못 뽑으면 "비교 불가" 위반으로 표면화', () => {
    const rule: Rule = { id: 'r1', type: 'expected', section: '기본정보', field: '브랜드', op: 'gt', value: '10', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('비교 불가');
  });

  it('image mainRequired: 대표이미지 있으면 통과, 없으면 위반', () => {
    const rule: Rule = { id: 'r1', type: 'image', kind: 'mainRequired', enabled: true };

    expect(evaluate(product(), [rule])).toEqual([]);
    expect(
      evaluate(product({ images: { main: [], list: [], detail: [] } }), [rule]),
    ).toHaveLength(1);
  });

  it('image listRequired: 리스트이미지 없으면 위반', () => {
    const rule: Rule = { id: 'r1', type: 'image', kind: 'listRequired', enabled: true };

    expect(evaluate(product(), [rule])).toHaveLength(1);
  });

  it('image detailMin: threshold 미만이면 위반', () => {
    const pass: Rule = { id: 'r1', type: 'image', kind: 'detailMin', threshold: 2, enabled: true };
    const fail: Rule = { id: 'r2', type: 'image', kind: 'detailMin', threshold: 3, enabled: true };

    expect(evaluate(product(), [pass])).toEqual([]);
    expect(evaluate(product(), [fail])).toHaveLength(1);
  });

  it('image externalHost: 허용 외 호스트를 위반으로 모아 보여준다', () => {
    const rule: Rule = { id: 'r1', type: 'image', kind: 'externalHost', enabled: true };

    const violations = evaluate(product(), [rule]);

    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toContain('ai.esmplus.com');
  });

  it('enabled=false 규칙은 평가하지 않는다', () => {
    const rule: Rule = { id: 'r1', type: 'required', section: '기본정보', field: '제조사명', enabled: false };

    expect(evaluate(product(), [rule])).toEqual([]);
  });
});
```

**Step 2: 실패 확인**

```bash
pnpm test:run lib/shopby/screening/rules.test.ts
```

Expected: FAIL — 모듈 없음.

**Step 3: 구현**

```ts
// lib/shopby/screening/rules.ts
import type { ParsedScreeningProduct, SectionName } from './types';

export type RuleOp = 'equals' | 'notEquals' | 'includes' | 'gt' | 'gte' | 'lt' | 'lte';
export type ImageRuleKind = 'mainRequired' | 'listRequired' | 'detailMin' | 'externalHost';

export type RequiredRule = {
  id: string;
  type: 'required';
  section: SectionName;
  field: string;
  enabled: boolean;
};

export type ExpectedRule = {
  id: string;
  type: 'expected';
  section: SectionName;
  field: string;
  op: RuleOp;
  value: string;
  enabled: boolean;
};

export type ImageRule = {
  id: string;
  type: 'image';
  kind: ImageRuleKind;
  threshold?: number; // detailMin: 최소 장수
  allowHosts?: string[]; // externalHost: 허용 호스트
  enabled: boolean;
};

export type Rule = RequiredRule | ExpectedRule | ImageRule;

export type Violation = { ruleId: string; label: string; message: string; actual: string };

export const DEFAULT_ALLOW_HOSTS = ['shopby-images.cdn-nhncommerce.com'];

const OP_LABELS: Record<RuleOp, string> = {
  equals: '=',
  notEquals: '≠',
  includes: '포함',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
};

// "140,000원" → 140000, "상품수수료, 15%" → 15. 첫 번째 숫자 토큰만 본다.
export function parseNumeric(raw: string): number | null {
  const match = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function imageHost(src: string): string | null {
  const normalized = src.startsWith('//') ? `https:${src}` : src;
  if (!/^https?:\/\//.test(normalized)) return null; // 상대경로는 어드민 자체 자원
  try {
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

export function evaluate(product: ParsedScreeningProduct, rules: Rule[]): Violation[] {
  const violations: Violation[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const violation = rule.type === 'image' ? checkImage(product, rule) : checkField(product, rule);
    if (violation) violations.push(violation);
  }
  return violations;
}

function checkField(
  product: ParsedScreeningProduct,
  rule: RequiredRule | ExpectedRule,
): Violation | null {
  const value = product.fields[rule.section]?.[rule.field];
  const label = `${rule.section} · ${rule.field}`;

  // 항목 자체가 없으면 카탈로그와 화면 구조가 어긋난 것 — 조용히 통과시키지 않는다.
  if (value === undefined) {
    return { ruleId: rule.id, label, message: '항목을 찾지 못함(화면 구조 변경 가능성)', actual: '' };
  }

  if (rule.type === 'required') {
    return value === ''
      ? { ruleId: rule.id, label, message: '필수 항목 공란', actual: '' }
      : null;
  }

  return checkExpected(rule, value, label);
}

function checkExpected(rule: ExpectedRule, value: string, label: string): Violation | null {
  const expectedText = `${OP_LABELS[rule.op]} ${rule.value}`;
  const fail = (message: string): Violation => ({ ruleId: rule.id, label, message, actual: value });

  if (rule.op === 'includes') {
    return value.includes(rule.value) ? null : fail(`기대값 불일치 (기대 ${expectedText})`);
  }

  if (rule.op === 'equals' || rule.op === 'notEquals') {
    // 문자열 우선 비교, 다르면 숫자 동치로 한 번 더 본다 ("상품수수료, 15%" = "15%").
    const stringMatch = value.trim() === rule.value.trim();
    const left = parseNumeric(value);
    const right = parseNumeric(rule.value);
    const numericMatch = left != null && right != null && left === right;
    const matched = stringMatch || numericMatch;
    const pass = rule.op === 'equals' ? matched : !matched;
    return pass ? null : fail(`기대값 불일치 (기대 ${expectedText})`);
  }

  const actual = parseNumeric(value);
  const expected = parseNumeric(rule.value);
  if (actual == null || expected == null) {
    return fail(`숫자 비교 불가 (기대 ${expectedText})`);
  }

  const pass =
    rule.op === 'gt' ? actual > expected
    : rule.op === 'gte' ? actual >= expected
    : rule.op === 'lt' ? actual < expected
    : actual <= expected;
  return pass ? null : fail(`기대값 불일치 (기대 ${expectedText})`);
}

function checkImage(product: ParsedScreeningProduct, rule: ImageRule): Violation | null {
  const { images } = product;
  const v = (label: string, message: string, actual: string): Violation => ({
    ruleId: rule.id,
    label,
    message,
    actual,
  });

  if (rule.kind === 'mainRequired') {
    return images.main.length === 0 ? v('이미지 · 상품이미지', '대표이미지 없음', '') : null;
  }
  if (rule.kind === 'listRequired') {
    return images.list.length === 0 ? v('이미지 · 리스트이미지', '리스트이미지 없음', '') : null;
  }
  if (rule.kind === 'detailMin') {
    const min = rule.threshold ?? 1;
    return images.detail.length < min
      ? v('이미지 · 상품 상세', `상세 이미지 ${min}장 미만`, `${images.detail.length}장`)
      : null;
  }

  const allow = rule.allowHosts?.length ? rule.allowHosts : DEFAULT_ALLOW_HOSTS;
  const all = [...images.main, ...images.list, ...images.detail];
  const offending = [
    ...new Set(
      all
        .map(imageHost)
        .filter((host): host is string => host != null && !allow.includes(host)),
    ),
  ];
  return offending.length
    ? v('이미지 · 호스트', '허용 외 이미지 호스트 사용', offending.join(', '))
    : null;
}
```

**Step 4: 통과 확인**

```bash
pnpm test:run lib/shopby/screening/rules.test.ts
```

Expected: PASS.

**Step 5: 커밋**

```bash
git add lib/shopby/screening/rules.ts lib/shopby/screening/rules.test.ts
git commit -m "feat: 심사 규칙 엔진 추가(필수값·기대값·이미지, 비교불가 표면화)"
```

---

### Task 4: 필드 카탈로그 + 시드 규칙 + 팝업 URL

**Files:**
- Create: `lib/shopby/screening/field-catalog.ts`
- Create: `lib/shopby/screening/seed-rules.ts`
- Create: `lib/shopby/screening/popup-url.ts`
- Test: `lib/shopby/screening/field-catalog.test.ts`

**Step 1: 실패하는 테스트 작성**

핵심 검증: **카탈로그의 모든 항목명이 실제 팝업 픽스처 파싱 결과에 존재**해야 한다(오타 가드), 시드 규칙은 전부 OFF여야 하고 시드 규칙의 field도 카탈로그에 있어야 한다.

```ts
// lib/shopby/screening/field-catalog.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIELD_CATALOG, type CatalogSection } from './field-catalog';
import { parseScreeningDocument } from './popup-parser';
import { screeningPopupUrl } from './popup-url';
import { SEED_RULES } from './seed-rules';

function loadProduct() {
  const html = readFileSync(
    resolve(process.cwd(), 'tests/fixtures', 'admin-screening-popup.html'),
    'utf-8',
  );
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return parseScreeningDocument(doc)!;
}

describe('FIELD_CATALOG', () => {
  it('카탈로그의 모든 항목이 팝업 픽스처 파싱 결과에 존재한다', () => {
    const product = loadProduct();

    for (const [section, fieldNames] of Object.entries(FIELD_CATALOG)) {
      for (const field of fieldNames) {
        expect(
          product.fields[section as CatalogSection]?.[field],
          `픽스처에 없는 카탈로그 항목: ${section} · ${field}`,
        ).toBeDefined();
      }
    }
  });
});

describe('SEED_RULES', () => {
  it('시드 규칙은 전부 OFF(선택 안함)로 제공한다', () => {
    expect(SEED_RULES.length).toBeGreaterThan(0);
    expect(SEED_RULES.every((rule) => rule.enabled === false)).toBe(true);
  });

  it('시드 규칙의 field는 카탈로그에 존재한다', () => {
    for (const rule of SEED_RULES) {
      if (rule.type === 'image') continue;
      expect(
        FIELD_CATALOG[rule.section as CatalogSection],
        `카탈로그에 없는 섹션: ${rule.section}`,
      ).toContain(rule.field);
    }
  });
});

describe('screeningPopupUrl', () => {
  it('상품번호로 심사 팝업 URL을 만든다', () => {
    expect(screeningPopupUrl('133770595')).toBe(
      'https://enterprise-remote.shopby.co.kr/popup/product-screening?globalProductNo=0&mallProductNo=133770595',
    );
  });
});
```

**Step 2: 실패 확인**

```bash
pnpm test:run lib/shopby/screening/field-catalog.test.ts
```

Expected: FAIL — 모듈 없음.

**Step 3: 구현**

```ts
// lib/shopby/screening/field-catalog.ts
import type { SectionName } from './types';

// 심사 팝업(tests/fixtures/admin-screening-popup.html)의 항목명 카탈로그.
// 규칙의 field는 자유 입력이 아니라 이 카탈로그에서 고른다 — 오타로 규칙이 영원히 안 걸리는 사고 방지.
// 이미지정보는 image 타입 규칙이 전담하므로 카탈로그에서 제외.
export const FIELD_CATALOG: Record<Exclude<SectionName, '이미지정보'>, string[]> = {
  기본정보: [
    '쇼핑몰', '파트너사', '판매방식', '제조사명', '제품모델명', '제품일련번호', '담당자',
    '표준카테고리', '전시카테고리', '플랫폼별 노출설정', 'URL로만 접근', '상품명', '영문상품명',
    '홍보문구', '브랜드', '성인인증', '장바구니', '결제수단설정', '검색어', '단축 URL 사용여부',
    '관련상품',
  ],
  판매정보: [
    '예약판매', '판매기간', '판매수수료', '판매가', '단위별 판매가', '가격대체문구 사용',
    '즉시할인', '즉시할인가', '공급가', '개별 적립금 설정', '적립금사용', '프로모션', '재고수량',
    '재입고 알림 사용설정', '최소구매수량', '최대구매수량', '옵션', '상품정보고시', '인증정보',
    '원산지', '매입처 상품명', '제조일자', '유효일자', '상품관리코드', 'HS CODE', '부가세',
    '주문환불', '아이콘 - 상시노출', '아이콘 - 노출기간', '아이콘 - 기간노출', '추가상품 전용',
    '추가상품 설정',
  ],
  배송정보: [
    '배송구분', '배송지정일', '묶음배송 가능여부', '해외배송 여부', '배송방법', '배송비유형',
    '출고지', '반품교환지', '반품/교환 배송비', '상품 중량',
  ],
  상품항목추가정보: ['상품항목추가정보'],
};

export type CatalogSection = keyof typeof FIELD_CATALOG;
```

```ts
// lib/shopby/screening/seed-rules.ts
import type { Rule } from './rules';

// 설계 결정: 시드 규칙은 전부 OFF(선택 안함)로 제공한다. MD가 필요한 것만 켜서 사용.
export const SEED_RULES: Rule[] = [
  { id: 'seed-manufacturer', type: 'required', section: '기본정보', field: '제조사명', enabled: false },
  { id: 'seed-model-name', type: 'required', section: '기본정보', field: '제품모델명', enabled: false },
  { id: 'seed-weight', type: 'expected', section: '배송정보', field: '상품 중량', op: 'gt', value: '0', enabled: false },
  { id: 'seed-main-image', type: 'image', kind: 'mainRequired', enabled: false },
  { id: 'seed-detail-images', type: 'image', kind: 'detailMin', threshold: 1, enabled: false },
];
```

```ts
// lib/shopby/screening/popup-url.ts
// 목록의 승인상태 클릭 시 열리는 팝업과 동일한 URL. globalProductNo=0 고정(관찰값).
export function screeningPopupUrl(productNo: string): string {
  return `https://enterprise-remote.shopby.co.kr/popup/product-screening?globalProductNo=0&mallProductNo=${encodeURIComponent(productNo)}`;
}
```

**Step 4: 통과 확인**

```bash
pnpm test:run lib/shopby/screening/field-catalog.test.ts
```

Expected: PASS.

**Step 5: 커밋**

```bash
git add lib/shopby/screening/field-catalog.ts lib/shopby/screening/seed-rules.ts lib/shopby/screening/popup-url.ts lib/shopby/screening/field-catalog.test.ts
git commit -m "feat: 심사 필드 카탈로그·시드 규칙(전부 OFF)·팝업 URL 빌더 추가"
```

---

### Task 5: 목록 수집 헬퍼 (`list-harvest.ts`)

**Files:**
- Create: `lib/shopby/screening/list-harvest.ts`
- Test: `lib/shopby/screening/list-harvest.test.ts`
- Fixture(이미 존재): `tests/fixtures/admin-screening-list.html`

**Step 1: 실패하는 테스트 작성**

```ts
// lib/shopby/screening/list-harvest.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findPageSizeSelect,
  findScreeningGrid,
  harvestVisibleRows,
  readTotalCount,
} from './list-harvest';

function loadFixture(): Document {
  const html = readFileSync(
    resolve(process.cwd(), 'tests/fixtures', 'admin-screening-list.html'),
    'utf-8',
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('list-harvest (admin-screening-list.html 픽스처)', () => {
  it('그리드 컨테이너를 찾는다', () => {
    expect(findScreeningGrid(loadFixture())).not.toBeNull();
  });

  it('"검색결과 총 N건"에서 총건수를 읽는다', () => {
    expect(readTotalCount(loadFixture())).toBe(78);
  });

  it('페이지 사이즈 셀렉터를 찾는다 (검색폼의 다른 select와 구분)', () => {
    const select = findPageSizeSelect(loadFixture());

    expect(select).not.toBeNull();
    expect([...select!.options].map((o) => o.value)).toEqual(['30', '50', '100', '200']);
  });

  it('렌더된 행에서 상품번호·상품명을 수집한다', () => {
    const rows = harvestVisibleRows(loadFixture());

    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ productNo: '133681147', productName: 'OIC 304 올스텐미니 요리국자' });
    expect(rows.every((row) => /^\d+$/.test(row.productNo))).toBe(true);
  });

  it('그리드가 없는 문서에서는 빈 결과', () => {
    const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');

    expect(findScreeningGrid(doc)).toBeNull();
    expect(readTotalCount(doc)).toBeNull();
    expect(findPageSizeSelect(doc)).toBeNull();
    expect(harvestVisibleRows(doc)).toEqual([]);
  });
});
```

**Step 2: 실패 확인**

```bash
pnpm test:run lib/shopby/screening/list-harvest.test.ts
```

Expected: FAIL — 모듈 없음.

**Step 3: 구현**

```ts
// lib/shopby/screening/list-harvest.ts
import type { ScreeningRow } from './types';

export const SCREENING_GRID_SELECTOR = '[data-cy="grid"]';

const PAGE_SIZE_VALUES = ['30', '50', '100', '200'];

export function findScreeningGrid(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(SCREENING_GRID_SELECTOR);
}

// "검색결과 총 <b>78</b> 건" — CSS 모듈 클래스 대신 텍스트로 앵커링.
export function readTotalCount(doc: Document): number | null {
  for (const heading of doc.querySelectorAll('h4')) {
    if (!heading.textContent?.includes('검색결과')) continue;
    const value = Number(heading.querySelector('b')?.textContent?.replace(/,/g, '').trim());
    if (Number.isInteger(value) && value >= 0) return value;
  }
  return null;
}

// 30/50/100/200 옵션 구성을 가진 select가 페이지 사이즈 셀렉터다(검색폼 select들과 구분).
export function findPageSizeSelect(doc: Document): HTMLSelectElement | null {
  for (const select of doc.querySelectorAll('select')) {
    const values = [...select.options].map((option) => option.value);
    if (PAGE_SIZE_VALUES.every((value) => values.includes(value))) return select;
  }
  return null;
}

// TUI 그리드는 가상 스크롤이라 "지금 DOM에 렌더된 행"만 수집된다. 전체 수집은 collect.ts가
// 스크롤을 돌리며 이 함수를 반복 호출해 합친다.
export function harvestVisibleRows(doc: Document): ScreeningRow[] {
  const rows: ScreeningRow[] = [];
  for (const cell of doc.querySelectorAll<HTMLElement>('td[data-column-name="productNo"]')) {
    const productNo = cell.textContent?.trim() ?? '';
    if (!/^\d+$/.test(productNo)) continue;

    const rowKey = cell.getAttribute('data-row-key');
    const nameCell =
      rowKey != null
        ? doc.querySelector(`td[data-column-name="productName"][data-row-key="${rowKey}"]`)
        : null;
    rows.push({
      productNo,
      productName: (nameCell?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    });
  }
  return rows;
}
```

**Step 4: 통과 확인**

```bash
pnpm test:run lib/shopby/screening/list-harvest.test.ts
```

Expected: PASS.

**Step 5: 커밋**

```bash
git add lib/shopby/screening/list-harvest.ts lib/shopby/screening/list-harvest.test.ts
git commit -m "feat: 심사 목록 그리드 수집 헬퍼 추가(총건수·페이지사이즈·행 추출)"
```

---

### Task 6: 수집 오케스트레이션 (`collect.ts`)

**Files:**
- Create: `lib/shopby/screening/collect.ts`
- Test: `lib/shopby/screening/collect.test.ts`

목록 페이지 content script에서 실행될 비동기 흐름: "200개 보기" 전환 → 행 안정화 대기 → 가상 스크롤 순회 수집 → 다음 페이지 → 반복. 페이지네이션 헬퍼는 `lib/shopby/brand-editor-open.ts`의 `readSelectedPage`/`findNextPageControl`을 재사용한다(범용 tui 셀렉터 기반).

**Step 1: 실패하는 테스트 작성**

jsdom 픽스처는 정적이므로(스크롤·리로드 없음) 다음을 검증한다: 행 수집 결과, 페이지 사이즈가 200으로 바뀌는 부수효과, next 비활성 시 1페이지에서 멈춤, 총건수 대비 미달 시 `count-mismatch`, 그리드 없으면 `no-grid`.

```ts
// lib/shopby/screening/collect.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectScreeningList } from './collect';
import { findPageSizeSelect } from './list-harvest';

function loadFixture(): Document {
  const html = readFileSync(
    resolve(process.cwd(), 'tests/fixtures', 'admin-screening-list.html'),
    'utf-8',
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

// jsdom에는 레이아웃이 없어 스크롤·리로드가 일어나지 않는다.
// 대기 시간을 0으로 줄여 정적 문서 기준의 수집 결과를 검증한다.
const FAST = { waitMs: 0, settleTicks: 2, timeoutMs: 300, maxScrollSteps: 2, maxPages: 3 };

describe('collectScreeningList', () => {
  it('렌더된 행을 수집하고 총건수 미달이면 count-mismatch로 알린다', async () => {
    const doc = loadFixture();

    const result = await collectScreeningList(doc, FAST);

    expect(result.rows).toHaveLength(12); // 픽스처에 렌더된 12행(가상 스크롤)
    expect(result.totalCount).toBe(78);
    expect(result.status).toBe('count-mismatch'); // 12 ≠ 78 — 침묵 누락 금지
    expect(result.pagesVisited).toBe(1); // next 버튼이 disabled(span)라 1페이지에서 종료
  });

  it('페이지 사이즈를 200으로 전환한다', async () => {
    const doc = loadFixture();

    await collectScreeningList(doc, FAST);

    expect(findPageSizeSelect(doc)!.value).toBe('200');
  });

  it('수집 건수가 총건수와 같으면 ok', async () => {
    const doc = loadFixture();
    // 픽스처의 총건수를 렌더된 행 수에 맞춰 12로 조작
    const bold = [...doc.querySelectorAll('h4')]
      .find((h) => h.textContent?.includes('검색결과'))!
      .querySelector('b')!;
    bold.textContent = '12';

    const result = await collectScreeningList(doc, FAST);

    expect(result.status).toBe('ok');
  });

  it('그리드가 없으면 no-grid', async () => {
    const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');

    const result = await collectScreeningList(doc, FAST);

    expect(result).toEqual({ status: 'no-grid', rows: [], totalCount: null, pagesVisited: 0 });
  });
});
```

**Step 2: 실패 확인**

```bash
pnpm test:run lib/shopby/screening/collect.test.ts
```

Expected: FAIL — 모듈 없음.

**Step 3: 구현**

```ts
// lib/shopby/screening/collect.ts
import { findNextPageControl, readSelectedPage } from '../brand-editor-open';
import { setFieldValue } from '../fill';
import { BRAND_PAGINATION_SELECTOR } from '../selectors';
import {
  findPageSizeSelect,
  findScreeningGrid,
  harvestVisibleRows,
  readTotalCount,
} from './list-harvest';
import type { CollectScreeningListResult, ScreeningRow } from './types';

export type CollectOptions = {
  waitMs?: number; // 폴링 간격
  settleTicks?: number; // 행 구성이 몇 틱 연속 동일하면 안정으로 볼지
  timeoutMs?: number; // 리로드/페이지 전환 대기 한도
  maxScrollSteps?: number; // 가상 스크롤 순회 상한
  maxPages?: number; // 페이지네이션 무한루프 방지 상한
};

const DEFAULTS: Required<CollectOptions> = {
  waitMs: 200,
  settleTicks: 3,
  timeoutMs: 10_000,
  maxScrollSteps: 60,
  maxPages: 50,
};

export async function collectScreeningList(
  doc: Document,
  options: CollectOptions = {},
): Promise<CollectScreeningListResult> {
  const opts = { ...DEFAULTS, ...options };

  if (!findScreeningGrid(doc)) {
    return { status: 'no-grid', rows: [], totalCount: null, pagesVisited: 0 };
  }

  await switchPageSizeTo200(doc, opts);
  const totalCount = readTotalCount(doc);

  const collected = new Map<string, ScreeningRow>();
  let pagesVisited = 0;

  for (let page = 0; page < opts.maxPages; page += 1) {
    await waitForRowsSettled(doc, opts);
    await scrollHarvest(doc, collected, opts);
    pagesVisited += 1;

    const pager = doc.querySelector(BRAND_PAGINATION_SELECTOR);
    const next = pager ? findNextPageControl(pager, readSelectedPage(pager)) : null;
    if (!next) break; // 마지막 페이지(next가 disabled span이면 null)

    const before = pager ? readSelectedPage(pager) : null;
    next.click();
    await waitForPageChange(doc, before, opts);
  }

  const rows = [...collected.values()];
  const status = totalCount != null && rows.length !== totalCount ? 'count-mismatch' : 'ok';
  return { status, rows, totalCount, pagesVisited };
}

async function switchPageSizeTo200(doc: Document, opts: Required<CollectOptions>) {
  const select = findPageSizeSelect(doc);
  if (!select || select.value === '200') return;

  setFieldValue(select, '200'); // React select라 native setter + change 이벤트 필요
  await sleep(opts.waitMs); // 리로드 시작 여유 — 이후 waitForRowsSettled가 안정화를 기다린다
}

// 행 구성(상품번호 시그니처)이 settleTicks 연속 동일해질 때까지 폴링.
// 리로드 중이면 시그니처가 계속 바뀌어 안정 카운트가 리셋된다.
async function waitForRowsSettled(doc: Document, opts: Required<CollectOptions>) {
  const deadline = Date.now() + opts.timeoutMs;
  let lastSignature = '';
  let stable = 0;

  while (Date.now() < deadline) {
    const signature = harvestVisibleRows(doc)
      .map((row) => row.productNo)
      .join(',');

    if (signature && signature === lastSignature) {
      stable += 1;
      if (stable >= opts.settleTicks) return;
    } else {
      stable = 0;
      lastSignature = signature;
    }
    await sleep(opts.waitMs);
  }
}

// 가상 스크롤 순회: lside 바디를 한 화면씩 내리며 보이는 행을 합친다.
// jsdom에는 스크롤 클램핑이 없어 scrollTop이 무한히 커지므로 maxScrollSteps가 상한.
async function scrollHarvest(
  doc: Document,
  collected: Map<string, ScreeningRow>,
  opts: Required<CollectOptions>,
) {
  const harvest = () => {
    for (const row of harvestVisibleRows(doc)) collected.set(row.productNo, row);
  };
  harvest();

  const container = doc.querySelector<HTMLElement>('.tui-grid-lside-area .tui-grid-body-area');
  if (!container) return;

  container.scrollTop = 0;
  const step = container.clientHeight || 400;

  for (let i = 0; i < opts.maxScrollSteps; i += 1) {
    const before = container.scrollTop;
    container.scrollTop = before + step;
    if (container.scrollTop === before) break; // 실제 브라우저: 끝까지 내려가면 클램핑
    await sleep(opts.waitMs);
    harvest();
  }
}

async function waitForPageChange(
  doc: Document,
  before: number | null,
  opts: Required<CollectOptions>,
) {
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const pager = doc.querySelector(BRAND_PAGINATION_SELECTOR);
    if (pager && readSelectedPage(pager) !== before) return;
    await sleep(opts.waitMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Step 4: 통과 확인**

```bash
pnpm test:run lib/shopby/screening/collect.test.ts
```

Expected: PASS. 주의: `waitForPageChange`는 픽스처에서 next가 null이라 호출되지 않음 — 커버리지가 비면 무시(라이브 경로).

**Step 5: 커밋**

```bash
git add lib/shopby/screening/collect.ts lib/shopby/screening/collect.test.ts
git commit -m "feat: 심사 목록 수집 오케스트레이션(200개 전환·가상스크롤·페이지 순회)"
```

---

### Task 7: content script 핸들러 연결

**Files:**
- Modify: `entrypoints/content.ts`

**Step 1: 핸들러 등록**

`entrypoints/content.ts`의 `main()` 안, 기존 `onMessage` 등록들 다음에 추가:

```ts
// 상단 import 추가
import { collectScreeningList } from '../lib/shopby/screening/collect';
import { waitForScreeningParse } from '../lib/shopby/screening/popup-parser';

// main() 안에 추가
// 심사 스캔: 사이드패널이 frameId를 지정해 보내므로(그리드 프레임 사전 탐색)
// 멀티프레임 브로드캐스트 레이스(docs/recon.md) 문제가 없다.
onMessage('collectScreeningList', () => collectScreeningList(document));
onMessage('parseScreeningPopup', () => waitForScreeningParse(document));
```

**Step 2: 타입체크**

```bash
pnpm compile
```

Expected: PASS.

**Step 3: 커밋**

```bash
git add entrypoints/content.ts
git commit -m "feat: 심사 수집·팝업 파싱 메시지를 content script에 연결"
```

---

### Task 8: 스캔 실행기 (`run-scan.ts`)

**Files:**
- Create: `lib/shopby/screening/run-scan.ts`
- Test: `lib/shopby/screening/run-scan.test.ts`

브라우저 API를 전혀 모르는 순수 실행기. 탭 열기/파싱/닫기는 `ScanPorts`로 주입받아 테스트에서 페이크로 대체한다.

**Step 1: 실패하는 테스트 작성**

```ts
// lib/shopby/screening/run-scan.test.ts
import { describe, expect, it, vi } from 'vitest';
import { runScan, type ScanPorts, type ScreeningResult } from './run-scan';
import type {
  CollectScreeningListResult,
  ParsedScreeningProduct,
  ScreeningPopupResult,
} from './types';
import type { Rule } from './rules';

const PRODUCT: ParsedScreeningProduct = {
  fields: { 기본정보: { 제조사명: '' }, 판매정보: {}, 배송정보: {} },
  images: { main: [], list: [], detail: [] },
};

const RULES: Rule[] = [
  { id: 'r1', type: 'required', section: '기본정보', field: '제조사명', enabled: true },
];

function list(rows: string[], status: CollectScreeningListResult['status'] = 'ok'): CollectScreeningListResult {
  return {
    status,
    rows: rows.map((productNo) => ({ productNo, productName: `상품${productNo}` })),
    totalCount: rows.length,
    pagesVisited: 1,
  };
}

function makePorts(overrides: Partial<ScanPorts> = {}): ScanPorts & { closed: number[] } {
  const closed: number[] = [];
  let nextTabId = 100;
  return {
    closed,
    collectList: vi.fn(async () => list(['1', '2'])),
    openPopup: vi.fn(async () => nextTabId++),
    parsePopup: vi.fn(async (): Promise<ScreeningPopupResult> => ({ status: 'ok', product: PRODUCT })),
    closePopup: vi.fn(async (tabId: number) => {
      closed.push(tabId);
    }),
    ...overrides,
  };
}

describe('runScan', () => {
  it('수집 → 상품별 파싱 → 규칙 평가 결과를 스트리밍한다', async () => {
    const ports = makePorts();
    const streamed: ScreeningResult[] = [];
    const progress: Array<[number, number]> = [];

    const summary = await runScan(ports, RULES, {
      onResult: (result) => streamed.push(result),
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(summary.phase).toBe('done');
    expect(summary.results).toHaveLength(2);
    expect(summary.results[0].violations).toHaveLength(1); // 제조사명 공란
    expect(streamed).toHaveLength(2);
    expect(progress).toEqual([[1, 2], [2, 2]]);
    expect(ports.closed).toHaveLength(2); // 열었던 탭은 항상 닫는다
  });

  it('파싱 실패는 1회 재시도 후 "수집 실패" 결과로 남긴다 (침묵 누락 금지)', async () => {
    const parsePopup = vi.fn(async (): Promise<ScreeningPopupResult> => ({ status: 'not-rendered' }));
    const ports = makePorts({ collectList: vi.fn(async () => list(['1'])), parsePopup });

    const summary = await runScan(ports, RULES);

    expect(parsePopup).toHaveBeenCalledTimes(2); // 1회 + 재시도 1회
    expect(summary.results[0].status).toBe('failed');
    expect(ports.closed).toHaveLength(2); // 시도마다 탭을 닫는다
  });

  it('login-redirect면 즉시 전체 중단(session-expired) — 연속 실패 방지', async () => {
    const ports = makePorts({
      collectList: vi.fn(async () => list(['1', '2', '3'])),
      parsePopup: vi.fn(async (): Promise<ScreeningPopupResult> => ({ status: 'login-redirect' })),
    });

    const summary = await runScan(ports, RULES);

    expect(summary.phase).toBe('session-expired');
    expect(summary.results).toHaveLength(0);
    expect(ports.openPopup).toHaveBeenCalledTimes(1); // 2·3번 상품은 시도하지 않음
  });

  it('취소 시그널이 켜지면 남은 큐를 버리고 수집된 결과는 유지한다', async () => {
    const signal = { cancelled: false };
    const ports = makePorts({
      collectList: vi.fn(async () => list(['1', '2', '3'])),
      parsePopup: vi.fn(async (): Promise<ScreeningPopupResult> => {
        signal.cancelled = true; // 첫 상품 처리 직후 취소
        return { status: 'ok', product: PRODUCT };
      }),
    });

    const summary = await runScan(ports, RULES, {}, signal);

    expect(summary.phase).toBe('cancelled');
    expect(summary.results).toHaveLength(1);
  });

  it('그리드를 못 찾으면 collect-failed', async () => {
    const ports = makePorts({
      collectList: vi.fn(async () => ({ status: 'no-grid' as const, rows: [], totalCount: null, pagesVisited: 0 })),
    });

    const summary = await runScan(ports, RULES);

    expect(summary.phase).toBe('collect-failed');
  });

  it('count-mismatch는 요약에 전파된다', async () => {
    const ports = makePorts({ collectList: vi.fn(async () => list(['1'], 'count-mismatch')) });

    const summary = await runScan(ports, RULES);

    expect(summary.countMismatch).toBe(true);
  });
});
```

**Step 2: 실패 확인**

```bash
pnpm test:run lib/shopby/screening/run-scan.test.ts
```

Expected: FAIL — 모듈 없음.

**Step 3: 구현**

```ts
// lib/shopby/screening/run-scan.ts
import { evaluate, type Rule, type Violation } from './rules';
import type {
  CollectScreeningListResult,
  ScreeningPopupResult,
  ScreeningRow,
} from './types';

export type ScreeningResult = {
  productNo: string;
  productName: string;
  status: 'ok' | 'failed';
  violations: Violation[];
  failReason?: string;
};

export type ScanPhase =
  | 'collecting'
  | 'scanning'
  | 'done'
  | 'cancelled'
  | 'session-expired'
  | 'collect-failed';

export type ScanPorts = {
  collectList(): Promise<CollectScreeningListResult>;
  openPopup(productNo: string): Promise<number>; // 생성한 탭 ID
  parsePopup(tabId: number): Promise<ScreeningPopupResult>;
  closePopup(tabId: number): Promise<void>;
};

export type ScanCallbacks = {
  onPhase?(phase: ScanPhase): void;
  onProgress?(done: number, total: number): void;
  onResult?(result: ScreeningResult): void;
};

export type ScanSummary = {
  phase: Extract<ScanPhase, 'done' | 'cancelled' | 'session-expired' | 'collect-failed'>;
  results: ScreeningResult[];
  totalCount: number | null;
  countMismatch: boolean;
};

// 순수 실행기: 브라우저 API는 ports로 주입받는다(테스트는 페이크 ports).
export async function runScan(
  ports: ScanPorts,
  rules: Rule[],
  callbacks: ScanCallbacks = {},
  signal: { cancelled: boolean } = { cancelled: false },
): Promise<ScanSummary> {
  callbacks.onPhase?.('collecting');
  const list = await ports.collectList();

  if (list.status === 'no-grid') {
    callbacks.onPhase?.('collect-failed');
    return { phase: 'collect-failed', results: [], totalCount: null, countMismatch: false };
  }

  const countMismatch = list.status === 'count-mismatch';
  const results: ScreeningResult[] = [];
  callbacks.onPhase?.('scanning');

  for (const [index, row] of list.rows.entries()) {
    if (signal.cancelled) {
      callbacks.onPhase?.('cancelled');
      return { phase: 'cancelled', results, totalCount: list.totalCount, countMismatch };
    }

    const outcome = await scanOne(ports, row);
    if (outcome === 'login-redirect') {
      callbacks.onPhase?.('session-expired');
      return { phase: 'session-expired', results, totalCount: list.totalCount, countMismatch };
    }

    const result: ScreeningResult =
      outcome.status === 'ok'
        ? {
            productNo: row.productNo,
            productName: row.productName,
            status: 'ok',
            violations: evaluate(outcome.product, rules),
          }
        : {
            productNo: row.productNo,
            productName: row.productName,
            status: 'failed',
            violations: [],
            failReason: '수집 실패(타임아웃)',
          };

    results.push(result);
    callbacks.onResult?.(result);
    callbacks.onProgress?.(index + 1, list.rows.length);
  }

  callbacks.onPhase?.('done');
  return { phase: 'done', results, totalCount: list.totalCount, countMismatch };
}

// 1회 재시도. login-redirect는 재시도하지 않고 즉시 전파(전체 중단 사유).
// 어떤 경로든 열었던 탭은 닫는다.
async function scanOne(
  ports: ScanPorts,
  row: ScreeningRow,
): Promise<Extract<ScreeningPopupResult, { status: 'ok' }> | { status: 'not-rendered' } | 'login-redirect'> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let tabId: number | null = null;
    try {
      tabId = await ports.openPopup(row.productNo);
      const parsed = await ports.parsePopup(tabId);
      if (parsed.status === 'login-redirect') return 'login-redirect';
      if (parsed.status === 'ok') return parsed;
      // not-rendered → 재시도 루프
    } catch {
      // 탭 생성/메시지 실패 → 재시도 루프
    } finally {
      if (tabId != null) {
        await ports.closePopup(tabId).catch(() => {});
      }
    }
  }
  return { status: 'not-rendered' };
}
```

**Step 4: 통과 확인**

```bash
pnpm test:run lib/shopby/screening/run-scan.test.ts
```

Expected: PASS (테스트 6개).

**Step 5: 전체 회귀 + 커밋**

```bash
pnpm test:run && pnpm compile
git add lib/shopby/screening/run-scan.ts lib/shopby/screening/run-scan.test.ts
git commit -m "feat: 심사 스캔 실행기 추가(재시도·세션만료 중단·취소·스트리밍)"
```

---

### Task 9: 규칙 저장 훅 (`useScreeningRules`)

**Files:**
- Create: `entrypoints/sidepanel/hooks/useScreeningRules.ts`
- Test: `entrypoints/sidepanel/hooks/useScreeningRules.test.ts`

**Step 1: 실패하는 테스트 작성**

WXT의 `fakeBrowser`(`wxt/testing`)가 `browser.storage.local`을 인메모리로 대체한다. 매 테스트 전 `fakeBrowser.reset()`.

```ts
// entrypoints/sidepanel/hooks/useScreeningRules.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_RULES } from '../../../lib/shopby/screening/seed-rules';
import type { Rule } from '../../../lib/shopby/screening/rules';
import { useScreeningRules } from './useScreeningRules';

describe('useScreeningRules', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('저장된 규칙이 없으면 시드 규칙(전부 OFF)을 깔고 저장한다', async () => {
    const { result } = renderHook(() => useScreeningRules());

    await waitFor(() => expect(result.current.rules).not.toBeNull());

    expect(result.current.rules).toEqual(SEED_RULES);
    const stored = await fakeBrowser.storage.local.get('screeningRules');
    expect(stored.screeningRules).toEqual(SEED_RULES);
  });

  it('저장된 규칙이 있으면 그대로 사용한다', async () => {
    const saved: Rule[] = [
      { id: 'custom', type: 'required', section: '기본정보', field: '브랜드', enabled: true },
    ];
    await fakeBrowser.storage.local.set({ screeningRules: saved });

    const { result } = renderHook(() => useScreeningRules());

    await waitFor(() => expect(result.current.rules).toEqual(saved));
  });

  it('save가 상태와 storage를 함께 갱신한다', async () => {
    const { result } = renderHook(() => useScreeningRules());
    await waitFor(() => expect(result.current.rules).not.toBeNull());

    const next: Rule[] = [{ ...SEED_RULES[0], enabled: true } as Rule];
    result.current.save(next);

    await waitFor(async () => {
      const stored = await fakeBrowser.storage.local.get('screeningRules');
      expect(stored.screeningRules).toEqual(next);
    });
  });
});
```

**Step 2: 실패 확인**

```bash
pnpm test:run entrypoints/sidepanel/hooks/useScreeningRules.test.ts
```

Expected: FAIL — 모듈 없음.

**Step 3: 구현**

```ts
// entrypoints/sidepanel/hooks/useScreeningRules.ts
import { useCallback, useEffect, useState } from 'react';
import type { Rule } from '../../../lib/shopby/screening/rules';
import { SEED_RULES } from '../../../lib/shopby/screening/seed-rules';

const STORAGE_KEY = 'screeningRules';

// 규칙은 chrome.storage.local에 저장. 최초 진입 시 시드 규칙(전부 OFF)을 깔아준다.
export function useScreeningRules() {
  const [rules, setRules] = useState<Rule[] | null>(null);

  useEffect(() => {
    let alive = true;

    void browser.storage.local.get(STORAGE_KEY).then((stored) => {
      if (!alive) return;
      const saved = stored[STORAGE_KEY] as Rule[] | undefined;
      if (Array.isArray(saved)) {
        setRules(saved);
      } else {
        setRules(SEED_RULES);
        void browser.storage.local.set({ [STORAGE_KEY]: SEED_RULES });
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback((next: Rule[]) => {
    setRules(next);
    void browser.storage.local.set({ [STORAGE_KEY]: next });
  }, []);

  return { rules, save };
}
```

참고: `browser`는 WXT 자동 import 전역(기존 `entrypoints/background.ts`와 동일 패턴, import 불필요).

**Step 4: 통과 확인 + 커밋**

```bash
pnpm test:run entrypoints/sidepanel/hooks/useScreeningRules.test.ts
git add entrypoints/sidepanel/hooks/useScreeningRules.ts entrypoints/sidepanel/hooks/useScreeningRules.test.ts
git commit -m "feat: 심사 규칙 storage 훅 추가(시드 규칙 자동 시드)"
```

---

### Task 10: 스캔 훅 (`useScreeningScan`) — 브라우저 포트 연결

**Files:**
- Create: `entrypoints/sidepanel/hooks/useScreeningScan.ts`

스캔 로직 자체는 Task 8의 `runScan`이 전부 검증했다. 이 훅은 실제 `browser.*` 포트를 만드는 얇은 어댑터라 단위 테스트를 생략한다(브라우저 API 목킹 비용 대비 가치 낮음 — 수동 검증은 Task 13). 타입체크만 통과시키면 된다.

**Step 1: 구현**

```ts
// entrypoints/sidepanel/hooks/useScreeningScan.ts
import { useCallback, useRef, useState } from 'react';
import { sendMessage } from '../../../lib/messaging';
import { screeningPopupUrl } from '../../../lib/shopby/screening/popup-url';
import type { Rule } from '../../../lib/shopby/screening/rules';
import {
  runScan,
  type ScanPhase,
  type ScanPorts,
  type ScreeningResult,
} from '../../../lib/shopby/screening/run-scan';
import type { ScreeningPopupResult } from '../../../lib/shopby/screening/types';

export type ScanState = {
  phase: ScanPhase | 'idle';
  done: number;
  total: number;
  results: ScreeningResult[];
  countMismatch: boolean;
  error: string | null;
};

const INITIAL: ScanState = {
  phase: 'idle',
  done: 0,
  total: 0,
  results: [],
  countMismatch: false,
  error: null,
};

export function useScreeningScan() {
  const [state, setState] = useState<ScanState>(INITIAL);
  const signalRef = useRef({ cancelled: false });

  const cancel = useCallback(() => {
    signalRef.current.cancelled = true;
  }, []);

  const start = useCallback(async (rules: Rule[]) => {
    signalRef.current = { cancelled: false };
    setState({ ...INITIAL, phase: 'collecting' });

    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id == null) {
      setState((prev) => ({ ...prev, phase: 'collect-failed', error: '활성 탭을 찾지 못했어요' }));
      return;
    }

    // 목록 그리드가 있는 프레임을 먼저 찾는다 — 멀티프레임 브로드캐스트 레이스 회피
    // (배경: entrypoints/background.ts:34-38 주석, docs/recon.md).
    const frameId = await findGridFrameId(activeTab.id);
    if (frameId == null) {
      setState((prev) => ({
        ...prev,
        phase: 'collect-failed',
        error: '활성 탭에서 상품심사 그리드를 찾지 못했어요 — 상품심사 목록을 연 상태에서 실행해주세요',
      }));
      return;
    }

    const summary = await runScan(
      makePorts(activeTab.id, frameId),
      rules,
      {
        onPhase: (phase) => setState((prev) => ({ ...prev, phase })),
        onProgress: (done, total) => setState((prev) => ({ ...prev, done, total })),
        onResult: (result) => setState((prev) => ({ ...prev, results: [...prev.results, result] })),
      },
      signalRef.current,
    );

    setState((prev) => ({ ...prev, phase: summary.phase, countMismatch: summary.countMismatch }));
  }, []);

  return { state, start, cancel };
}

async function findGridFrameId(tabId: number): Promise<number | null> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => Boolean(document.querySelector('[data-cy="grid"]')),
    });
    for (const injection of results) {
      if (injection.result) return injection.frameId ?? 0;
    }
  } catch {
    // 호스트 권한 밖 탭 등 — 아래서 null 처리
  }
  return null;
}

function makePorts(tabId: number, frameId: number): ScanPorts {
  return {
    collectList: () => sendMessage('collectScreeningList', undefined, { tabId, frameId }),
    openPopup: async (productNo) => {
      const tab = await browser.tabs.create({ url: screeningPopupUrl(productNo), active: false });
      if (tab.id == null) throw new Error('팝업 탭 생성 실패');
      return tab.id;
    },
    parsePopup: (popupTabId) => parseWithRetry(popupTabId),
    closePopup: async (popupTabId) => {
      await browser.tabs.remove(popupTabId).catch(() => {});
    },
  };
}

// content script 주입 전의 메시지는 "Could not establish connection"으로 실패한다 → 폴링 재시도.
// 주입 이후의 렌더 대기는 content script 쪽 waitForScreeningParse가 담당(자체 15초 타임아웃).
async function parseWithRetry(tabId: number): Promise<ScreeningPopupResult> {
  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await sendMessage('parseScreeningPopup', undefined, { tabId, frameId: 0 });
    } catch {
      await sleep(300);
    }
  }
  throw new Error('팝업 content script 응답 없음');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Step 2: 타입체크 + 커밋**

```bash
pnpm compile
git add entrypoints/sidepanel/hooks/useScreeningScan.ts
git commit -m "feat: 심사 스캔 훅 추가(프레임 탐색·숨김 탭 포트·진행률 상태)"
```

---

### Task 11: UI — 규칙 설정 + 결과 리스트

**Files:**
- Create: `entrypoints/sidepanel/ui/RuleSettings.tsx`
- Create: `entrypoints/sidepanel/ui/ScreeningResults.tsx`
- Test: `entrypoints/sidepanel/ui/RuleSettings.test.tsx`
- Test: `entrypoints/sidepanel/ui/ScreeningResults.test.tsx`

**Step 1: 실패하는 테스트 작성 (RuleSettings)**

```tsx
// entrypoints/sidepanel/ui/RuleSettings.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Rule } from '../../../lib/shopby/screening/rules';
import { RuleSettings } from './RuleSettings';

const RULES: Rule[] = [
  { id: 'r1', type: 'required', section: '기본정보', field: '제조사명', enabled: false },
  { id: 'r2', type: 'expected', section: '판매정보', field: '판매수수료', op: 'equals', value: '15%', enabled: true },
  { id: 'r3', type: 'image', kind: 'mainRequired', enabled: true },
];

describe('RuleSettings', () => {
  it('규칙을 설명 문구와 토글로 보여준다', () => {
    render(<RuleSettings rules={RULES} onChange={vi.fn()} />);

    expect(screen.getByText(/기본정보 · 제조사명 필수/)).toBeInTheDocument();
    expect(screen.getByText(/판매정보 · 판매수수료 = 15%/)).toBeInTheDocument();
    expect(screen.getByText(/대표이미지 필수/)).toBeInTheDocument();
  });

  it('토글하면 enabled만 바뀐 새 배열로 onChange', async () => {
    const onChange = vi.fn();
    render(<RuleSettings rules={RULES} onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox', { name: /제조사명 필수/ }));

    expect(onChange).toHaveBeenCalledWith([
      { ...RULES[0], enabled: true },
      RULES[1],
      RULES[2],
    ]);
  });

  it('삭제 버튼이 해당 규칙을 제거한다', async () => {
    const onChange = vi.fn();
    render(<RuleSettings rules={RULES} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /규칙 삭제: 기본정보 · 제조사명 필수/ }));

    expect(onChange).toHaveBeenCalledWith([RULES[1], RULES[2]]);
  });

  it('필수값 규칙을 추가할 수 있다 (필드는 카탈로그 드롭다운)', async () => {
    const onChange = vi.fn();
    render(<RuleSettings rules={[]} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('검사 유형'), 'required');
    await userEvent.selectOptions(screen.getByLabelText('섹션'), '배송정보');
    await userEvent.selectOptions(screen.getByLabelText('항목'), '상품 중량');
    await userEvent.click(screen.getByRole('button', { name: '규칙 추가' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0][0][0];
    expect(added).toMatchObject({ type: 'required', section: '배송정보', field: '상품 중량', enabled: true });
  });
});
```

**Step 2: 실패하는 테스트 작성 (ScreeningResults)**

```tsx
// entrypoints/sidepanel/ui/ScreeningResults.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ScreeningResult } from '../../../lib/shopby/screening/run-scan';
import { ScreeningResults } from './ScreeningResults';

const RESULTS: ScreeningResult[] = [
  { productNo: '1', productName: '정상 상품', status: 'ok', violations: [] },
  {
    productNo: '2',
    productName: '위반 1건',
    status: 'ok',
    violations: [{ ruleId: 'r', label: '기본정보 · 제조사명', message: '필수 항목 공란', actual: '' }],
  },
  {
    productNo: '3',
    productName: '위반 2건',
    status: 'ok',
    violations: [
      { ruleId: 'a', label: '배송정보 · 상품 중량', message: '기대값 불일치 (기대 > 0)', actual: '0kg' },
      { ruleId: 'b', label: '이미지 · 상품이미지', message: '대표이미지 없음', actual: '' },
    ],
  },
  { productNo: '4', productName: '수집 실패 상품', status: 'failed', violations: [], failReason: '수집 실패(타임아웃)' },
];

describe('ScreeningResults', () => {
  it('기본은 위반만 보기 + 위반 많은 순 정렬', () => {
    render(<ScreeningResults results={RESULTS} onOpen={vi.fn()} />);

    const cards = screen.getAllByRole('button');
    expect(cards[0]).toHaveTextContent('위반 2건');
    expect(cards[1]).toHaveTextContent('위반 1건');
    expect(screen.queryByText(/정상 상품/)).not.toBeInTheDocument();
    expect(screen.getByText(/수집 실패 상품/)).toBeInTheDocument(); // 실패도 표시(침묵 누락 금지)
  });

  it('위반만 보기를 끄면 정상 상품도 보인다', async () => {
    render(<ScreeningResults results={RESULTS} onOpen={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: /위반만 보기/ }));

    expect(screen.getByText(/정상 상품/)).toBeInTheDocument();
  });

  it('카드 클릭 시 해당 상품번호로 onOpen', async () => {
    const onOpen = vi.fn();
    render(<ScreeningResults results={RESULTS} onOpen={onOpen} />);

    await userEvent.click(screen.getByText(/위반 2건/));

    expect(onOpen).toHaveBeenCalledWith('3');
  });

  it('위반 상세(항목·메시지·현재값)를 보여준다', () => {
    render(<ScreeningResults results={RESULTS} onOpen={vi.fn()} />);

    expect(screen.getByText(/상품 중량/)).toBeInTheDocument();
    expect(screen.getByText(/현재: 0kg/)).toBeInTheDocument();
  });
});
```

**Step 3: 실패 확인**

```bash
pnpm test:run entrypoints/sidepanel/ui/RuleSettings.test.tsx entrypoints/sidepanel/ui/ScreeningResults.test.tsx
```

Expected: FAIL — 모듈 없음.

**Step 4: 구현 (RuleSettings)**

```tsx
// entrypoints/sidepanel/ui/RuleSettings.tsx
import { useState } from 'react';
import { FIELD_CATALOG, type CatalogSection } from '../../../lib/shopby/screening/field-catalog';
import type { ImageRuleKind, Rule, RuleOp } from '../../../lib/shopby/screening/rules';

type Props = { rules: Rule[]; onChange: (rules: Rule[]) => void };

const OP_OPTIONS: Array<{ value: RuleOp; label: string }> = [
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '≠' },
  { value: 'includes', label: '포함' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
];

const IMAGE_KIND_LABELS: Record<ImageRuleKind, string> = {
  mainRequired: '대표이미지 필수',
  listRequired: '리스트이미지 필수',
  detailMin: '상세 이미지 최소 장수',
  externalHost: '허용 외 이미지 호스트 경고',
};

export function describeRule(rule: Rule): string {
  if (rule.type === 'required') return `${rule.section} · ${rule.field} 필수`;
  if (rule.type === 'expected') {
    const op = OP_OPTIONS.find((option) => option.value === rule.op)?.label ?? rule.op;
    return `${rule.section} · ${rule.field} ${op} ${rule.value}`;
  }
  return rule.kind === 'detailMin'
    ? `${IMAGE_KIND_LABELS[rule.kind]} ${rule.threshold ?? 1}장`
    : IMAGE_KIND_LABELS[rule.kind];
}

export function RuleSettings({ rules, onChange }: Props) {
  function toggle(id: string, enabled: boolean) {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)));
  }

  function remove(id: string) {
    onChange(rules.filter((rule) => rule.id !== id));
  }

  return (
    <div className="rule-settings">
      <ul className="rule-settings__list">
        {rules.map((rule) => (
          <li key={rule.id} className="rule-settings__row">
            <label className="rule-settings__toggle">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(event) => toggle(rule.id, event.target.checked)}
              />
              {describeRule(rule)}
            </label>
            <button
              type="button"
              className="rule-settings__delete"
              aria-label={`규칙 삭제: ${describeRule(rule)}`}
              onClick={() => remove(rule.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <AddRuleForm onAdd={(rule) => onChange([...rules, rule])} />
    </div>
  );
}

const SECTIONS = Object.keys(FIELD_CATALOG) as CatalogSection[];

function AddRuleForm({ onAdd }: { onAdd: (rule: Rule) => void }) {
  const [type, setType] = useState<Rule['type']>('required');
  const [section, setSection] = useState<CatalogSection>('기본정보');
  const [field, setField] = useState<string>(FIELD_CATALOG['기본정보'][0]);
  const [op, setOp] = useState<RuleOp>('equals');
  const [value, setValue] = useState('');
  const [kind, setKind] = useState<ImageRuleKind>('mainRequired');
  const [threshold, setThreshold] = useState('1');

  function pickSection(next: CatalogSection) {
    setSection(next);
    setField(FIELD_CATALOG[next][0]);
  }

  function submit() {
    const id = `rule-${Date.now()}`;
    if (type === 'required') {
      onAdd({ id, type: 'required', section, field, enabled: true });
    } else if (type === 'expected') {
      onAdd({ id, type: 'expected', section, field, op, value, enabled: true });
    } else {
      onAdd({
        id,
        type: 'image',
        kind,
        threshold: kind === 'detailMin' ? Number(threshold) || 1 : undefined,
        enabled: true,
      });
    }
  }

  return (
    <div className="rule-settings__add">
      <label>
        검사 유형
        <select value={type} onChange={(event) => setType(event.target.value as Rule['type'])}>
          <option value="required">필수값</option>
          <option value="expected">기대값</option>
          <option value="image">이미지</option>
        </select>
      </label>

      {type !== 'image' && (
        <>
          <label>
            섹션
            <select value={section} onChange={(event) => pickSection(event.target.value as CatalogSection)}>
              {SECTIONS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            항목
            <select value={field} onChange={(event) => setField(event.target.value)}>
              {FIELD_CATALOG[section].map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {type === 'expected' && (
        <>
          <label>
            비교
            <select value={op} onChange={(event) => setOp(event.target.value as RuleOp)}>
              {OP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            기대값
            <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="예: 15%" />
          </label>
        </>
      )}

      {type === 'image' && (
        <>
          <label>
            이미지 검사
            <select value={kind} onChange={(event) => setKind(event.target.value as ImageRuleKind)}>
              {(Object.keys(IMAGE_KIND_LABELS) as ImageRuleKind[]).map((name) => (
                <option key={name} value={name}>{IMAGE_KIND_LABELS[name]}</option>
              ))}
            </select>
          </label>
          {kind === 'detailMin' && (
            <label>
              최소 장수
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </label>
          )}
        </>
      )}

      <button type="button" onClick={submit}>규칙 추가</button>
    </div>
  );
}
```

**Step 5: 구현 (ScreeningResults)**

```tsx
// entrypoints/sidepanel/ui/ScreeningResults.tsx
import { useMemo, useState } from 'react';
import type { ScreeningResult } from '../../../lib/shopby/screening/run-scan';

type Props = { results: ScreeningResult[]; onOpen: (productNo: string) => void };

export function ScreeningResults({ results, onOpen }: Props) {
  const [violationsOnly, setViolationsOnly] = useState(true);

  const visible = useMemo(() => {
    const filtered = violationsOnly
      ? results.filter((result) => result.status === 'failed' || result.violations.length > 0)
      : results;
    return [...filtered].sort((a, b) => b.violations.length - a.violations.length);
  }, [results, violationsOnly]);

  if (results.length === 0) return null;

  const violationCount = results.filter((result) => result.violations.length > 0).length;

  return (
    <div className="screening-results">
      <div className="screening-results__header">
        <p>
          위반 <b>{violationCount}</b>건 / 전체 {results.length}건
        </p>
        <label>
          <input
            type="checkbox"
            checked={violationsOnly}
            onChange={(event) => setViolationsOnly(event.target.checked)}
          />
          위반만 보기
        </label>
      </div>

      <ul className="screening-results__list">
        {visible.map((result) => (
          <li key={result.productNo}>
            <button
              type="button"
              className="screening-results__card"
              data-status={cardStatus(result)}
              onClick={() => onOpen(result.productNo)}
            >
              <span className="screening-results__title">
                {statusIcon(result)} {result.productNo} {result.productName}
              </span>
              {result.status === 'failed' && (
                <span className="screening-results__fail">{result.failReason}</span>
              )}
              {result.violations.map((violation, index) => (
                <span key={index} className="screening-results__violation">
                  · {violation.label}: {violation.message}
                  {violation.actual && ` (현재: ${violation.actual})`}
                </span>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cardStatus(result: ScreeningResult): 'failed' | 'violation' | 'clean' {
  if (result.status === 'failed') return 'failed';
  return result.violations.length > 0 ? 'violation' : 'clean';
}

function statusIcon(result: ScreeningResult): string {
  if (result.status === 'failed') return '✖';
  return result.violations.length > 0 ? '⚠' : '✅';
}
```

**Step 6: 통과 확인 + 커밋**

```bash
pnpm test:run entrypoints/sidepanel/ui/RuleSettings.test.tsx entrypoints/sidepanel/ui/ScreeningResults.test.tsx
git add entrypoints/sidepanel/ui/RuleSettings.tsx entrypoints/sidepanel/ui/ScreeningResults.tsx entrypoints/sidepanel/ui/RuleSettings.test.tsx entrypoints/sidepanel/ui/ScreeningResults.test.tsx
git commit -m "feat: 심사 규칙 설정·결과 리스트 UI 추가"
```

---

### Task 12: 심사 워크스페이스 + 탭 등록 + 스타일

**Files:**
- Create: `entrypoints/sidepanel/ui/ScreeningWorkspace.tsx`
- Test: `entrypoints/sidepanel/ui/ScreeningWorkspace.test.tsx`
- Modify: `entrypoints/sidepanel/App.tsx`
- Modify: `entrypoints/sidepanel/App.test.tsx` (기존 패턴 따라 심사 탭 케이스 추가)
- Modify: `entrypoints/sidepanel/style.css` (클래스 추가)

**Step 1: 실패하는 테스트 작성 (Workspace — 훅을 vi.mock으로 대체)**

```tsx
// entrypoints/sidepanel/ui/ScreeningWorkspace.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanState } from '../hooks/useScreeningScan';
import { SEED_RULES } from '../../../lib/shopby/screening/seed-rules';

const startMock = vi.fn();
const cancelMock = vi.fn();
let scanState: ScanState;

vi.mock('../hooks/useScreeningRules', () => ({
  useScreeningRules: () => ({ rules: SEED_RULES, save: vi.fn() }),
}));
vi.mock('../hooks/useScreeningScan', () => ({
  useScreeningScan: () => ({ state: scanState, start: startMock, cancel: cancelMock }),
}));

import { ScreeningWorkspace } from './ScreeningWorkspace';

describe('ScreeningWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scanState = { phase: 'idle', done: 0, total: 0, results: [], countMismatch: false, error: null };
  });

  it('스캔 시작 버튼이 규칙과 함께 start를 호출한다', async () => {
    render(<ScreeningWorkspace />);

    await userEvent.click(screen.getByRole('button', { name: /스캔 시작/ }));

    expect(startMock).toHaveBeenCalledWith(SEED_RULES);
  });

  it('스캔 중에는 중단 버튼과 진행률을 보여준다', () => {
    scanState = { ...scanState, phase: 'scanning', done: 34, total: 78 };

    render(<ScreeningWorkspace />);

    expect(screen.getByRole('button', { name: /중단/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('34 / 78');
  });

  it('세션 만료 안내를 보여준다', () => {
    scanState = { ...scanState, phase: 'session-expired' };

    render(<ScreeningWorkspace />);

    expect(screen.getByText(/세션 만료/)).toBeInTheDocument();
  });

  it('수집 건수 불일치 경고를 보여준다', () => {
    scanState = { ...scanState, phase: 'done', countMismatch: true };

    render(<ScreeningWorkspace />);

    expect(screen.getByText(/일부 상품이 빠졌을 수 있어요/)).toBeInTheDocument();
  });
});
```

**Step 2: 실패 확인**

```bash
pnpm test:run entrypoints/sidepanel/ui/ScreeningWorkspace.test.tsx
```

Expected: FAIL — 모듈 없음.

**Step 3: 구현 (Workspace)**

```tsx
// entrypoints/sidepanel/ui/ScreeningWorkspace.tsx
import { screeningPopupUrl } from '../../../lib/shopby/screening/popup-url';
import { useScreeningRules } from '../hooks/useScreeningRules';
import { useScreeningScan } from '../hooks/useScreeningScan';
import { RuleSettings } from './RuleSettings';
import { ScreeningResults } from './ScreeningResults';

const PHASE_LABELS: Record<string, string> = {
  collecting: '목록 수집 중…',
  scanning: '상품 정보 수집 중…',
  done: '완료',
  cancelled: '중단됨',
  'session-expired': '세션 만료 — 어드민 재로그인 후 다시 시도해주세요',
  'collect-failed': '목록 수집 실패',
};

export function ScreeningWorkspace() {
  const { rules, save } = useScreeningRules();
  const { state, start, cancel } = useScreeningScan();
  const running = state.phase === 'collecting' || state.phase === 'scanning';

  return (
    <section className="screening" aria-label="상품심사 스캔">
      <details className="screening__settings">
        <summary>규칙 설정</summary>
        {rules ? <RuleSettings rules={rules} onChange={save} /> : <p>규칙 불러오는 중…</p>}
      </details>

      <div className="screening__controls">
        {!running ? (
          <button
            type="button"
            className="screening__start"
            disabled={!rules}
            onClick={() => rules && void start(rules)}
          >
            ▶ 스캔 시작
          </button>
        ) : (
          <button type="button" className="screening__cancel" onClick={cancel}>
            ⏸ 중단
          </button>
        )}

        {state.phase !== 'idle' && (
          <p className="screening__status" role="status">
            {PHASE_LABELS[state.phase] ?? state.phase}
            {state.total > 0 && ` · ${state.done} / ${state.total}`}
          </p>
        )}
        {state.error && <p className="screening__error">{state.error}</p>}
        {state.countMismatch && (
          <p className="screening__warning">
            수집 건수가 목록 총 건수와 달라요 — 일부 상품이 빠졌을 수 있어요. 재스캔을 권장합니다.
          </p>
        )}
      </div>

      <ScreeningResults
        results={state.results}
        onOpen={(productNo) =>
          void browser.tabs.create({ url: screeningPopupUrl(productNo), active: true })
        }
      />
    </section>
  );
}
```

**Step 4: 탭 등록**

`entrypoints/sidepanel/App.tsx`:

```tsx
// import 추가
import { ScreeningWorkspace } from './ui/ScreeningWorkspace';

// TABS에 추가
const TABS: TabItem[] = [
  { id: 'display', label: '진열' },
  { id: 'brand', label: '브랜드' },
  { id: 'category', label: '전시카테고리' },
  { id: 'screening', label: '심사' },
];

// 워크스페이스 렌더 분기에 추가
{activeTab === 'screening' && <ScreeningWorkspace />}
```

`entrypoints/sidepanel/App.test.tsx`를 열어 기존 탭 전환 테스트 패턴을 확인하고, 같은 방식으로 "심사 탭 클릭 시 심사 워크스페이스가 보인다" 케이스를 1개 추가한다. ScreeningWorkspace가 storage를 만지므로 테스트 파일 상단에 `fakeBrowser.reset()`이 이미 있는지 확인하고 없으면 `beforeEach`에 추가.

**Step 5: 스타일 추가**

`entrypoints/sidepanel/style.css` 말미에 기존 BEM 네이밍을 따라 추가(기존 토큰·간격 변수 사용, 새 하드코딩 색은 결과 상태 3종만):

```css
/* 심사 탭 */
.screening { display: flex; flex-direction: column; gap: 12px; }
.screening__settings summary { cursor: pointer; font-weight: 600; }
.screening__controls { display: flex; flex-direction: column; gap: 6px; }
.screening__status { font-size: 12px; color: #475467; }
.screening__error { font-size: 12px; color: #f04438; }
.screening__warning { font-size: 12px; color: #b54708; }

.rule-settings__list { display: flex; flex-direction: column; gap: 4px; }
.rule-settings__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rule-settings__add { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }

.screening-results__header { display: flex; align-items: center; justify-content: space-between; }
.screening-results__list { display: flex; flex-direction: column; gap: 6px; }
.screening-results__card {
  display: flex; flex-direction: column; gap: 2px; width: 100%;
  text-align: left; padding: 8px; border-radius: 8px; border: 1px solid #e4e7ec;
}
.screening-results__card[data-status='violation'] { border-color: #fec84b; background: #fffaeb; }
.screening-results__card[data-status='failed'] { border-color: #fda29b; background: #fef3f2; }
.screening-results__violation { font-size: 12px; color: #475467; }
.screening-results__fail { font-size: 12px; color: #b42318; }
```

기존 style.css의 실제 클래스 패턴과 색 토큰을 먼저 보고, 충돌·중복이 있으면 기존 것을 따른다.

**Step 6: 전체 테스트 + 커밋**

```bash
pnpm test:run && pnpm compile
git add entrypoints/sidepanel/ui/ScreeningWorkspace.tsx entrypoints/sidepanel/ui/ScreeningWorkspace.test.tsx entrypoints/sidepanel/App.tsx entrypoints/sidepanel/App.test.tsx entrypoints/sidepanel/style.css
git commit -m "feat: 사이드패널에 심사 탭 추가(스캔 제어·진행률·결과 카드)"
```

---

### Task 13: 빌드 + 수동 검증 + 문서

**Step 1: 프로덕션 빌드**

```bash
pnpm build
```

Expected: 에러 없이 `.output/chrome-mv3` 생성.

**Step 2: 수동 검증 체크리스트** (사용자에게 안내하고 결과를 기다린다 — 직접 어드민 접속 불가)

`pnpm dev`로 로드한 뒤 어드민 상품심사 목록 페이지에서:

- [ ] 심사 탭 진입 → 규칙 설정 펼침 → 시드 규칙 5개가 전부 꺼져 있는지
- [ ] 규칙 2~3개 켜고 스캔 시작 → "200개 보기"로 자동 전환되는지
- [ ] 진행률 n/total이 올라가고 결과 카드가 스트리밍되는지
- [ ] 숨김 탭이 상품마다 열렸다 닫히는지 (탭 폭주 없는지)
- [ ] 위반 카드 클릭 → 해당 상품 심사 팝업이 활성 탭으로 열리는지
- [ ] 중단 버튼 → 즉시 멈추고 기존 결과 유지되는지
- [ ] 수집 건수와 "검색결과 총 N건"이 같은지 (다르면 경고 배너 확인)
- [ ] (가능하면) 로그아웃 상태로 스캔 → "세션 만료"로 즉시 중단되는지

**Step 3: 사용 가이드 갱신**

`README.md`의 "전체 구조 한눈에 보기" 표에 심사 탭 행을 추가하고, 진열/브랜드 탭 섹션과 같은 톤으로 "심사 탭 사용법" 섹션(스캔 흐름·규칙 설정·경고 의미)을 추가한다. `docs/USAGE.md`가 별도로 관리되면 동일하게 반영.

**Step 4: 커밋**

```bash
git add README.md docs/USAGE.md
git commit -m "docs: 심사 탭 사용 가이드 추가"
```

---

## 알려진 리스크 / 메모

- **가상 스크롤 수집**: jsdom에서는 스크롤 클램핑이 없어 `maxScrollSteps`로만 종료된다. 라이브에서 200행 페이지가 한 번에 다 수집되는지는 수동 검증(Step 2)에서 확인. 미달 시 `count-mismatch` 경고가 안전망.
- **페이지 사이즈 전환 직후 리로드 감지**: `settleTicks` 기반 안정화는 "리로드가 아직 시작 안 된 옛 행"을 안정으로 오인할 수 있다. 총건수 대조가 2차 안전망이며, 문제가 보이면 `tui-grid-layer-state`(로딩 레이어) 감시를 추가한다.
- **CSS 모듈 해시 드리프트**: 팝업 파서의 `[class*="Layout_view-title"]` 접두 매칭이 깨지면 모든 상품이 `not-rendered`로 떨어진다 — 침묵 실패가 아니라 "수집 실패" 카드로 드러나는 구조라 발견 가능.
- **`browser.tabs`/`browser.scripting`을 사이드패널에서 직접 호출**: manifest 권한(`scripting`, host_permissions)은 이미 충족. background 경유가 필요해지면(예: 사이드패널 닫혀도 계속 스캔) v2에서 옮긴다.
