# MD 검수 큐레이션 규칙 교체 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

날짜: 2026-06-16

**Goal:** 기존 기본 큐레이션 규칙(브랜드·검색어·배송구분 등 6종)을 제거하고, MD가 실제 큐레이션을 바탕으로 요청한 **상품 승인 단계 검수 규칙 8종**을 기본값으로 깐다. MD가 직접 규칙을 추가/토글하는 기능은 그대로 유지한다.

**Architecture:** 검수 규칙 엔진(`lib/shopby/screening/rules.ts`)에 단일 필드 비교로는 표현 못 하는 검사(가격 교차비교·할인율 계산·글자수·전시카테고리 개수)를 위한 `derived` 규칙 타입을 추가한다. 나머지(수수료 0%·재고 0·서비스상품군·썸네일 누락)는 기존 `expected`/`required`/`image` 규칙 + 친화적 메타로 재사용한다. 기본 규칙 세트(`curation-rules.ts`)를 MD 체크리스트로 교체하고, 로드 시 구버전 기본 규칙을 자동 정리한다.

**Tech Stack:** TypeScript, React 19, WXT(웹익스텐션), Vitest + jsdom. 순수 함수 우선, 브라우저 API는 ports/hook으로 주입.

---

## 현재 구조 요약 (착수 전 필독)

검수 스캔 파이프라인:

1. `lib/shopby/screening/collect.ts` — 심사 목록 그리드를 1페이지부터 끝까지 수집(`ScreeningRow[]`). **변경 없음.**
2. `lib/shopby/screening/popup-parser.ts` — 상품별 심사 팝업을 파싱. 등록 심사는 `{ kind:'register', product }`, 수정 심사는 `{ kind:'modify', changes }`. **변경 없음.**
3. `lib/shopby/screening/rules.ts` — 규칙 엔진. `Rule` 판별 유니온 + `evaluate(product, rules): Violation[]`. **여기에 `derived` 타입 추가.**
4. `lib/shopby/screening/curation-rules.ts` — 기본 큐레이션 규칙(ON·삭제불가) + 메타 + `mergeCurationRules`. **MD 규칙으로 교체.**
5. `lib/shopby/screening/seed-rules.ts` — 시드 규칙(전부 OFF). **변경 없음**(선택: 중복되는 `seed-main-image` 정리).
6. `lib/shopby/screening/run-scan.ts` — 워커 풀로 상품별 스캔, 등록은 `evaluate`, 수정은 diff. **변경 없음.**
7. `entrypoints/sidepanel/hooks/useScreeningRules.ts` — `chrome.storage.local`에 규칙 저장/병합. **변경 없음**(병합 로직은 `curation-rules.ts`에 있음).
8. `entrypoints/sidepanel/ui/RuleSettings.tsx` — 규칙 토글/삭제/추가 UI. **`derived` 표시·추가 지원.**
9. `entrypoints/sidepanel/ui/ScreeningResults.tsx` — 결과 카드. **변경 없음**(위반 메시지는 엔진이 생성).

`Rule` 타입(현재):

```ts
export type Rule = RequiredRule | EmptyRule | ExpectedRule | ImageRule;
```

`ImageRule`이 이미 `kind` 판별자로 여러 검사(`mainRequired`/`detailMin`/…)를 묶는다 — `derived`도 같은 패턴을 따른다.

---

## 범위 (확정)

### 이번 플랜 (상품 승인 단계 검수 — 8종 기본 규칙)

| # | MD 요청 | 구현 방식 | 데이터 출처(심사 팝업) |
|---|---------|-----------|------------------------|
| 1 | 역마진(공급가 > 판매가) | **신규** `derived.reverseMargin` | 판매정보·공급가/즉시할인가/판매가 ✓ |
| 2 | 수수료율 0% | 재사용 `expected 판매수수료 > 0` | 판매정보·판매수수료 ✓ |
| 3 | 할인율 이상치(70% 이상) | **신규** `derived.discountRateMax` | 판매정보·판매가/즉시할인(가) ✓ |
| 4 | 썸네일 이미지 누락 | 재사용 `image.mainRequired` | 이미지정보·상품이미지 ✓ |
| 5 | 상품명 글자수 초과(30자) | **신규** `derived.maxLength` | 기본정보·상품명 ✓ |
| 6 | 서비스상품군 등록 방지 | 재사용 `required 배송구분`(추정 프록시) | 배송정보·배송구분 ✓ |
| 7 | 재고 0개 등록 방지 | 재사용 `expected 재고수량 > 0` | 판매정보·재고수량 ✓ |
| 8 | 전시카테고리 중복(1개 초과) | **신규** `derived.displayCategoryMax` | 기본정보·전시카테고리 ✓ |

> 신규 `derived` kind는 4개: `reverseMargin`, `discountRateMax`, `maxLength`, `displayCategoryMax`.

**픽스처 실측값**(`tests/fixtures/admin-screening-popup.html`)으로 모두 검증 가능:
판매가 `140,000원` · 즉시할인 `104,700원` · 즉시할인가 `35,300원` · 공급가 `30,005원` · 판매수수료 `상품수수료, 15%` · 재고수량 `1,000개` · 전시카테고리 `테크가전` · 상품명 `[디라이프] 쿡 웨어 IH 3종 냄비세트` · 배송구분 `파트너사 배송`.

### 이번 플랜 제외 (후속 단계로 분리 — 아래 "후속 단계" 섹션에 설계만 문서화)

- **옵션별 가격 편차**: 심사 팝업은 `옵션: 사용 안 함`만 표기하고 옵션별 가격을 노출하지 않음. Shop API 상품상세 조회 신규 연동 필요 → **Phase 2**.
- **품절/노출중지 실시간 필터 · 진열 종료 임박 알림**: MD가 "상품 승인단계 외"로 분류한 진열·큐레이션(DisplayBuilder) 화면 기능 → **Phase 3**.

### 6번 "서비스상품군" 프록시에 대한 설계 노트

심사 팝업에는 `상품군`(productGroup) 항목이 없다. 대신 **서비스상품은 배송구분이 공란**이라는 점을 이용해 `required 배송정보·배송구분`으로 추정한다(기존 `curation-deliverable-only` 규칙과 동일 원리). 정확한 `상품군` 판별이 필요해지면 Phase 2의 Shop API 연동에서 함께 처리한다 — 메타 설명에 "추정"임을 명시한다.

---

## Task 1: 규칙 엔진에 `derived` 타입 추가 (`rules.ts`)

**Files:**
- Modify: `lib/shopby/screening/rules.ts`
- Test: `lib/shopby/screening/rules.test.ts`

`derived`는 `image`처럼 `kind` 판별자로 여러 계산 검사를 묶는다. 각 kind는 `checkDerived`에서 전용 로직.

타입(파일 상단 `ImageRule` 아래에 추가):

```ts
export type DerivedRuleKind = 'reverseMargin' | 'discountRateMax' | 'displayCategoryMax' | 'maxLength';

// 단일 필드 비교로 표현 못 하는 계산 검사(가격 교차비교·할인율·글자수·개수).
// threshold: discountRateMax(기본 70)·displayCategoryMax(기본 1)·maxLength(기본 30)
// section/field: maxLength에서만 사용(어떤 항목의 글자수를 볼지)
export type DerivedRule = {
  id: string;
  type: 'derived';
  kind: DerivedRuleKind;
  threshold?: number;
  section?: SectionName;
  field?: string;
  enabled: boolean;
};

export type Rule = RequiredRule | EmptyRule | ExpectedRule | ImageRule | DerivedRule;
```

`evaluate` 라우팅 변경:

```ts
export function evaluate(product: ParsedScreeningProduct, rules: Rule[]): Violation[] {
  const violations: Violation[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const violation =
      rule.type === 'image' ? checkImage(product, rule)
      : rule.type === 'derived' ? checkDerived(product, rule)
      : checkField(product, rule);
    if (violation) violations.push(violation);
  }
  return violations;
}
```

`checkDerived`(파일 하단 `checkImage` 옆에 추가):

```ts
function checkDerived(product: ParsedScreeningProduct, rule: DerivedRule): Violation | null {
  const sales = product.fields['판매정보'] ?? {};
  const basic = product.fields['기본정보'] ?? {};
  const v = (label: string, message: string, actual: string): Violation => ({
    ruleId: rule.id,
    label,
    message,
    actual,
  });

  if (rule.kind === 'reverseMargin') {
    // 실판매가 = 즉시할인가(고객 실결제가) 우선, 없으면 판매가. 공급가가 그보다 크면 역마진.
    const supplyRaw = sales['공급가'];
    const saleRaw = sales['즉시할인가'] || sales['판매가'];
    const supply = parseNumeric(supplyRaw ?? '');
    const sale = parseNumeric(saleRaw ?? '');
    if (supply == null || sale == null) {
      return v('판매정보 · 공급가', '역마진 비교 불가(가격 항목 없음)', '');
    }
    return supply > sale
      ? v('판매정보 · 공급가', '역마진(공급가 > 판매가)', `공급가 ${supplyRaw} > 판매 ${saleRaw}`)
      : null;
  }

  if (rule.kind === 'discountRateMax') {
    const threshold = rule.threshold ?? 70;
    const list = parseNumeric(sales['판매가'] ?? '');
    if (list == null || list === 0) {
      return v('판매정보 · 즉시할인', '할인율 계산 불가(판매가 없음)', sales['판매가'] ?? '');
    }
    // 할인율 = (판매가 - 즉시할인가)/판매가. 즉시할인가가 없으면 즉시할인(할인금액)/판매가. 둘 다 없으면 0%.
    const finalPrice = parseNumeric(sales['즉시할인가'] ?? '');
    const discountAmt = parseNumeric(sales['즉시할인'] ?? '');
    const rate =
      finalPrice != null ? ((list - finalPrice) / list) * 100
      : discountAmt != null ? (discountAmt / list) * 100
      : 0;
    return rate >= threshold
      ? v('판매정보 · 즉시할인', `할인율 ${threshold}% 이상`, `${rate.toFixed(1)}%`)
      : null;
  }

  if (rule.kind === 'displayCategoryMax') {
    const threshold = rule.threshold ?? 1;
    const raw = basic['전시카테고리'];
    if (raw === undefined) {
      return v('기본정보 · 전시카테고리', '항목을 찾지 못함(화면 구조 변경 가능성)', '');
    }
    const count = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).length;
    return count > threshold
      ? v('기본정보 · 전시카테고리', `전시카테고리 ${threshold}개 초과`, `${count}개: ${raw}`)
      : null;
  }

  // maxLength
  const section = rule.section ?? '기본정보';
  const field = rule.field ?? '상품명';
  const threshold = rule.threshold ?? 30;
  const value = product.fields[section]?.[field];
  const label = `${section} · ${field}`;
  if (value === undefined) {
    return v(label, '항목을 찾지 못함(화면 구조 변경 가능성)', '');
  }
  return value.length > threshold
    ? v(label, `글자수 ${threshold}자 초과`, `${value.length}자`)
    : null;
}
```

> 설계 노트: 전시카테고리 다중 등록 시 구분자는 실측 샘플이 1개뿐이라 미확정 — 쉼표/줄바꿈 split로 시작. 실제 멀티 카테고리 팝업을 확보하면 구분자만 조정(엔진 한 줄). 한계는 코드 주석으로 남긴다.

### Step 1: 실패하는 테스트 작성

`lib/shopby/screening/rules.test.ts`의 `describe('evaluate', …)` 안에 추가. 기존 `product()` 헬퍼를 재사용하되 판매정보를 확장한다. 먼저 헬퍼의 판매정보 기본값을 픽스처에 맞춰 보강:

```ts
// product() 헬퍼의 fields.판매정보를 아래로 교체(픽스처 실측값)
판매정보: {
  판매수수료: '상품수수료, 15%',
  판매가: '140,000원',
  즉시할인: '104,700원',
  즉시할인가: '35,300원',
  공급가: '30,005원',
  재고수량: '1,000개',
},
```

(기본정보에 `전시카테고리: '테크가전'`도 추가)

테스트 케이스:

```ts
describe('derived', () => {
  it('reverseMargin: 공급가 ≤ 실판매가면 통과', () => {
    const rule: Rule = { id: 'd1', type: 'derived', kind: 'reverseMargin', enabled: true };
    expect(evaluate(product(), [rule])).toEqual([]);
  });

  it('reverseMargin: 공급가 > 실판매가면 위반', () => {
    const rule: Rule = { id: 'd1', type: 'derived', kind: 'reverseMargin', enabled: true };
    const p = product({
      fields: { ...product().fields, 판매정보: { ...product().fields.판매정보, 공급가: '50,000원' } },
    });
    const violations = evaluate(p, [rule]);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('역마진');
  });

  it('discountRateMax: 할인율이 threshold 이상이면 위반(140,000→35,300 ≈ 74.8%)', () => {
    const rule: Rule = { id: 'd1', type: 'derived', kind: 'discountRateMax', threshold: 70, enabled: true };
    const violations = evaluate(product(), [rule]);
    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toContain('74.8%');
  });

  it('discountRateMax: threshold 미만이면 통과', () => {
    const rule: Rule = { id: 'd1', type: 'derived', kind: 'discountRateMax', threshold: 80, enabled: true };
    expect(evaluate(product(), [rule])).toEqual([]);
  });

  it('displayCategoryMax: 1개면 통과, 2개 이상이면 위반', () => {
    const rule: Rule = { id: 'd1', type: 'derived', kind: 'displayCategoryMax', threshold: 1, enabled: true };
    expect(evaluate(product(), [rule])).toEqual([]);

    const multi = product({
      fields: { ...product().fields, 기본정보: { ...product().fields.기본정보, 전시카테고리: '테크가전, 리빙' } },
    });
    expect(evaluate(multi, [rule])).toHaveLength(1);
  });

  it('maxLength: threshold 초과면 위반', () => {
    const short: Rule = { id: 'd1', type: 'derived', kind: 'maxLength', section: '기본정보', field: '상품명', threshold: 30, enabled: true };
    const long: Rule = { id: 'd2', type: 'derived', kind: 'maxLength', section: '기본정보', field: '상품명', threshold: 10, enabled: true };
    expect(evaluate(product(), [short])).toEqual([]); // 상품명 22자 < 30
    expect(evaluate(product(), [long])).toHaveLength(1);
  });

  it('derived: 대상 항목이 없으면 조용히 통과시키지 않고 위반으로 표면화', () => {
    const rule: Rule = { id: 'd1', type: 'derived', kind: 'displayCategoryMax', threshold: 1, enabled: true };
    const p = product({ fields: { ...product().fields, 기본정보: {} } });
    expect(evaluate(p, [rule])[0].message).toContain('항목을 찾지 못함');
  });
});
```

### Step 2: 테스트 실패 확인

Run: `pnpm vitest run lib/shopby/screening/rules.test.ts`
Expected: FAIL — `derived`는 아직 없는 타입/로직(컴파일 또는 단언 실패).

### Step 3: 최소 구현

위 `DerivedRule`/`Rule`/`evaluate`/`checkDerived` 코드를 `lib/shopby/screening/rules.ts`에 반영.

### Step 4: 테스트 통과 확인

Run: `pnpm vitest run lib/shopby/screening/rules.test.ts`
Expected: PASS(신규 derived 케이스 + 기존 케이스 회귀 없음).

### Step 5: 커밋

```bash
git add lib/shopby/screening/rules.ts lib/shopby/screening/rules.test.ts
git commit -m "feat: 검수 규칙 엔진에 derived(계산) 타입 추가"
```

---

## Task 2: 기본 규칙 세트를 MD 체크리스트로 교체 (`curation-rules.ts`)

**Files:**
- Modify: `lib/shopby/screening/curation-rules.ts`
- Test: `lib/shopby/screening/curation-rules.test.ts`

### Step 1: 실패하는 테스트 작성

`curation-rules.test.ts`를 새 규칙 세트 기준으로 갱신. 핵심 추가/교체:

```ts
it('모든 기본 규칙은 ON이고 메타를 가진다', () => {
  for (const rule of CURATION_RULES) {
    expect(rule.enabled).toBe(true);
    expect(CURATION_META[rule.id]).toBeDefined();
  }
});

it('MD 검수 항목 8종을 기본으로 깐다', () => {
  expect(CURATION_RULES.map((r) => r.id)).toEqual([
    'curation-reverse-margin',
    'curation-zero-commission',
    'curation-discount-rate',
    'curation-main-image',
    'curation-name-length',
    'curation-service-group',
    'curation-zero-stock',
    'curation-display-category',
  ]);
});

it('구버전 기본 규칙(curation-brand 등)은 로드 시 제거된다', () => {
  const saved: Rule[] = [
    { id: 'curation-brand', type: 'required', section: '기본정보', field: '브랜드', enabled: true },
    { id: 'seed-manufacturer', type: 'required', section: '기본정보', field: '제조사명', enabled: false },
  ];
  const merged = mergeCurationRules(saved);
  expect(merged.some((r) => r.id === 'curation-brand')).toBe(false); // 구버전 제거
  expect(merged.some((r) => r.id === 'seed-manufacturer')).toBe(true); // 시드 유지
  expect(merged.slice(0, CURATION_RULES.length).map((r) => r.id)).toEqual(CURATION_RULES.map((r) => r.id));
});

it('저장본의 enabled(끈 상태)는 보존하되 정의는 코드가 정답', () => {
  const stale: Rule = { id: 'curation-discount-rate', type: 'derived', kind: 'discountRateMax', threshold: 50, enabled: false };
  const merged = mergeCurationRules([stale, ...CURATION_RULES.slice(1)]);
  const fixed = merged.find((r) => r.id === 'curation-discount-rate')!;
  expect(fixed.enabled).toBe(false);                  // 사용자가 끈 상태 보존
  expect((fixed as any).threshold).toBe(70);          // 코드 정의(70)로 교정
});
```

기존 테스트 중 `curation-search-keyword` empty→required 케이스는 삭제(해당 규칙이 사라짐).

### Step 2: 테스트 실패 확인

Run: `pnpm vitest run lib/shopby/screening/curation-rules.test.ts`
Expected: FAIL — 아직 옛 규칙 세트.

### Step 3: 최소 구현

`lib/shopby/screening/curation-rules.ts` 전체 교체:

```ts
import type { Rule } from './rules';

// MD 큐레이션 체크리스트(상품 승인 단계). 기본 ON·삭제 불가, 토글만 가능 — 로드 시 병합으로 항상 복원.
export const CURATION_RULES: Rule[] = [
  { id: 'curation-reverse-margin', type: 'derived', kind: 'reverseMargin', enabled: true },
  { id: 'curation-zero-commission', type: 'expected', section: '판매정보', field: '판매수수료', op: 'gt', value: '0', enabled: true },
  { id: 'curation-discount-rate', type: 'derived', kind: 'discountRateMax', threshold: 70, enabled: true },
  { id: 'curation-main-image', type: 'image', kind: 'mainRequired', enabled: true },
  { id: 'curation-name-length', type: 'derived', kind: 'maxLength', section: '기본정보', field: '상품명', threshold: 30, enabled: true },
  { id: 'curation-service-group', type: 'required', section: '배송정보', field: '배송구분', enabled: true },
  { id: 'curation-zero-stock', type: 'expected', section: '판매정보', field: '재고수량', op: 'gt', value: '0', enabled: true },
  { id: 'curation-display-category', type: 'derived', kind: 'displayCategoryMax', threshold: 1, enabled: true },
];

export type CurationMeta = { title: string; note: string };

export const CURATION_META: Record<string, CurationMeta> = {
  'curation-reverse-margin': { title: '역마진 경고', note: '공급가가 실판매가(즉시할인가)보다 높으면 위반' },
  'curation-zero-commission': { title: '수수료 0% 경고', note: '판매수수료가 0%면 위반' },
  'curation-discount-rate': { title: '할인율 이상치(70% 이상)', note: '할인율이 70% 이상이면 오기입(0 하나 더 붙음 등) 가능성' },
  'curation-main-image': { title: '대표이미지 누락', note: '대표(썸네일) 이미지가 없으면 위반' },
  'curation-name-length': { title: '상품명 글자수 초과(30자)', note: '상품명이 30자를 넘으면 메인 UI에서 깨질 위험' },
  'curation-service-group': { title: '서비스상품군 방지', note: '배송구분이 공란이면 서비스상품군(앱 미구현) 추정' },
  'curation-zero-stock': { title: '재고 0개 경고', note: '재고수량이 0이면 앱에서 품절로 노출' },
  'curation-display-category': { title: '전시카테고리 중복(1개 초과)', note: '전시카테고리가 2개 이상이면 오등록(예: 테크 외 상품의 테크 등록) 가능성' },
};

export function isCurationRule(id: string): boolean {
  return id in CURATION_META;
}

// 기본 규칙의 '정의'는 코드가 정답 — 저장본에서 가져오는 건 enabled(MD가 끈 상태)뿐.
// 비-큐레이션(시드·커스텀)만 순서 그대로 뒤에 유지한다.
// curation- 접두인데 현재 메타에 없는 ID(구버전 기본 규칙)는 제거 — 옛 저장본을 자동 마이그레이션한다.
// 변경이 없으면 원본 배열 참조를 그대로 돌려준다(불필요한 storage 쓰기 방지).
export function mergeCurationRules(saved: Rule[]): Rule[] {
  const enabledById = new Map(saved.map((rule) => [rule.id, rule.enabled]));
  const reconciledCuration = CURATION_RULES.map((rule) => {
    const enabled = enabledById.get(rule.id);
    return enabled === undefined ? rule : { ...rule, enabled };
  });
  const rest = saved.filter((rule) => !rule.id.startsWith('curation-'));
  const next = [...reconciledCuration, ...rest];
  return JSON.stringify(next) === JSON.stringify(saved) ? saved : next;
}
```

### Step 4: 테스트 통과 확인

Run: `pnpm vitest run lib/shopby/screening/curation-rules.test.ts`
Expected: PASS.

### Step 5: 커밋

```bash
git add lib/shopby/screening/curation-rules.ts lib/shopby/screening/curation-rules.test.ts
git commit -m "feat: 기본 검수 규칙을 MD 큐레이션 체크리스트 8종으로 교체"
```

---

## Task 3: 규칙 설정 UI에 `derived` 표시·추가 지원 (`RuleSettings.tsx`)

**Files:**
- Modify: `entrypoints/sidepanel/ui/RuleSettings.tsx`
- Test: `entrypoints/sidepanel/ui/RuleSettings.test.tsx`

기본 규칙은 `CURATION_META`의 친화적 제목으로 이미 잘 표시된다(상단 "기본 큐레이션" 섹션). `derived`는 **추가 규칙(커스텀)** 으로 노출/추가될 때만 `describeRule`이 필요하다.

### Step 1: 실패하는 테스트 작성

`RuleSettings.test.tsx`에 추가:

```ts
it('derived 규칙을 추가 규칙 목록에서 사람이 읽을 수 있게 표시한다', () => {
  const rules: Rule[] = [
    { id: 'rule-1', type: 'derived', kind: 'maxLength', section: '기본정보', field: '영문상품명', threshold: 50, enabled: true },
  ];
  render(<RuleSettings rules={rules} onChange={() => {}} />);
  expect(screen.getByText(/영문상품명 50자 초과/)).toBeInTheDocument();
});
```

(추가 폼으로 derived 규칙을 만드는 상호작용 테스트는 기존 AddRuleForm 테스트 패턴을 따른다.)

### Step 2: 테스트 실패 확인

Run: `pnpm vitest run entrypoints/sidepanel/ui/RuleSettings.test.tsx`
Expected: FAIL — `describeRule`이 derived를 모름.

### Step 3: 최소 구현

`describeRule`에 derived 분기 추가(`image` 처리 앞):

```ts
if (rule.type === 'derived') {
  if (rule.kind === 'maxLength') return `${rule.section ?? '기본정보'} · ${rule.field ?? '상품명'} ${rule.threshold ?? 30}자 초과`;
  if (rule.kind === 'discountRateMax') return `할인율 ${rule.threshold ?? 70}% 이상`;
  if (rule.kind === 'displayCategoryMax') return `전시카테고리 ${rule.threshold ?? 1}개 초과`;
  return '역마진(공급가 > 판매가)';
}
```

`AddRuleForm`에 `derived` 검사 유형 추가:

- `검사 유형` 셀렉트에 `<option value="derived">계산 검사</option>` 추가
- `type === 'derived'`일 때: `kind` 셀렉트(역마진/할인율/전시카테고리/글자수) + `threshold` 입력(역마진 제외) + `maxLength`일 때 섹션·항목 셀렉트(`FIELD_CATALOG` 재사용)
- `submit`에서 `DerivedRule` 생성:

```ts
} else if (type === 'derived') {
  onAdd({
    id,
    type: 'derived',
    kind,
    threshold: kind === 'reverseMargin' ? undefined : Number(threshold) || undefined,
    section: kind === 'maxLength' ? section : undefined,
    field: kind === 'maxLength' ? field : undefined,
    enabled: true,
  });
}
```

(`kind` 상태는 `DerivedRuleKind`로 별도 useState. 기존 image `kind` state와 충돌하지 않게 `derivedKind`로 명명.)

### Step 4: 테스트 통과 확인

Run: `pnpm vitest run entrypoints/sidepanel/ui/RuleSettings.test.tsx`
Expected: PASS.

### Step 5: 커밋

```bash
git add entrypoints/sidepanel/ui/RuleSettings.tsx entrypoints/sidepanel/ui/RuleSettings.test.tsx
git commit -m "feat: 규칙 설정 UI에 계산(derived) 검사 표시·추가 지원"
```

---

## Task 4: 전체 타입체크·테스트·빌드 검증 + 문서 갱신

**Files:**
- Modify: `README.md`(검수 규칙 설명 섹션), `docs/USAGE.md`(있으면 검수 항목 설명)

### Step 1: 전체 회귀 확인

```bash
pnpm vitest run        # 전 테스트 GREEN
pnpm compile           # tsc --noEmit, 타입 오류 0
pnpm build             # wxt build 성공
```

Expected: 3개 모두 성공. 실패 시 해당 파일만 수정 후 재실행.

### Step 2: 수동 스모크(선택, 어드민 로그인 필요)

1. `pnpm dev`로 확장 로드 → 사이드패널 "규칙 설정" 펼치기
2. "기본 큐레이션"에 MD 8종이 보이고, 구버전(브랜드/검색어 등)이 **안 보이는지** 확인
3. 심사 목록에서 스캔 → 역마진/할인율/재고0/글자수 위반이 카드에 뜨는지 확인

### Step 3: 문서 갱신

`README.md`의 검수 큐레이션 규칙 목록을 MD 8종으로 교체하고, "옵션 가격 편차"·"진열 큐레이션"은 후속 단계임을 명시. (doc-updater 에이전트 활용 가능.)

### Step 4: 커밋

```bash
git add README.md docs/USAGE.md
git commit -m "docs: 검수 규칙을 MD 큐레이션 8종으로 갱신 + 후속 단계 명시"
```

---

## 후속 단계 (이번 플랜 제외 — 설계만 기록)

### Phase 2: 옵션별 가격 편차 + 정확한 상품군 판별 (Shop API 연동)

**문제:** 심사 팝업은 `옵션: 사용 안 함`만 표기하고 옵션별 가격을 노출하지 않는다. 상품군(서비스/배송)도 직접 항목이 없다.

**접근:**
- `lib/shopby/api/`에 `products.ts` 추가 — `productNo`로 상품상세(옵션 목록·옵션가·productGroup) 조회. 기존 `client.ts`/`config.ts` 패턴 재사용. (Shop API 베이스/헤더는 메모리 `shopby-shop-api` 참조.)
- 스캔 중 등록 상품마다 1회 조회. **동시성/레이트리밋 주의** — `SCAN_CONCURRENCY=4`와 별개로 API 호출 백오프 필요.
- `derived.optionPriceDeviation`: 기본가 대비 옵션가 최대 편차가 threshold(예: 기본가의 ±50% 또는 절대 금액) 초과 시 위반.
- `derived.serviceProductGroup`: productGroup이 서비스군이면 위반(6번 프록시를 정확판별로 승급).
- 위험: 스캔 시간 증가·API 실패 처리. 옵션 미사용 상품은 조회 스킵으로 비용 절감.

### Phase 3: 진열·큐레이션 실시간 필터 (DisplayBuilder 화면, 승인단계 외)

**대상:** MD가 "상품 승인단계 외"로 분류한 2건.
- **품절/노출중지 자동 필터링:** 메인·기획전 구좌에 진열된 상품 중 실시간 품절/판매중지 상태를 표시·자동 제외. `entrypoints/sidepanel/ui/DisplayBuilder.tsx`/`DisplayWorkspace.tsx` + Shop API 상품 상태 조회.
- **진열 종료 임박 알림:** 기간 특가/타임딜처럼 노출 종료일이 임박/지난 상품 표시. 진열 구성에 종료일 메타가 있으면 그걸, 없으면 상품 판매기간을 사용.
- 별도 데이터원(진열/구좌 상태)·별도 화면이라 검수 스캔과 분리된 작업.

---

## 영향 범위

- **변경:** `rules.ts`·`curation-rules.ts`·`RuleSettings.tsx`(+ 각 테스트), `README.md`.
- **무변경:** `collect.ts`·`list-harvest.ts`·`popup-parser.ts`·`run-scan.ts`·`useScreeningRules.ts`·`ScreeningResults.tsx`·`field-catalog.ts`·`seed-rules.ts`.
- **마이그레이션:** 기존 사용자 storage의 구버전 `curation-*` 규칙은 `mergeCurationRules`가 로드 시 자동 제거 — 사용자 조작 불필요.
- **위험:** 낮음. 엔진은 신규 타입 추가(기존 경로 보존, 회귀 테스트로 고정). 전시카테고리 구분자만 실측 미확정(코드 한 줄로 조정 가능, 주석 명시).
- **DRY/YAGNI:** 표현 가능한 4종은 기존 규칙 재사용, 계산 필요한 4종만 신규 kind. 데이터가 없는 옵션 편차·승인단계 외 진열 기능은 구현하지 않고 설계만 기록.
