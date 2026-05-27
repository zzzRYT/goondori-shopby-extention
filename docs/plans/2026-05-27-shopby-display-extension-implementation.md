# 샵바이 진열·배너 관리 크롬 익스텐션 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** MD가 샵바이 어드민에서 진열 ID·색상·배너를 손으로 입력하던 작업을, 크롬 사이드패널 폼으로 조립·검증하고 어드민 페이지 필드에 자동으로 채워주는(저장은 사람이) 익스텐션을 만든다.

**Architecture:** WXT 파일 기반 엔트리포인트로 사이드패널(React UI) · content script(어드민 DOM 채우기) · background(패널 열기·메시지 중계) 3개 컨텍스트를 둔다. 진열 ID/색상 규칙은 DOM과 무관한 순수 TS 도메인 코어(`lib/display-id`)로 격리해 테스트 가능성을 극대화하고, DOM 의존부(`lib/shopby` 셀렉터)만 따로 격리해 샵바이 UI 변경에 대비한다.

**Tech Stack:** WXT, React, TypeScript, Vitest(+jsdom), Playwright, @webext-core/messaging, WXT storage.

**참고 설계 문서:** [`2026-05-27-shopby-display-extension-design.md`](./2026-05-27-shopby-display-extension-design.md)

---

## 진행 전 필수 메모

- **Stage 0~3은 외부 의존 없이 지금 완주 가능.**
- **Stage 4~6은 실제 샵바이 어드민 HTML / 브랜드 API가 필요.** Stage 4 시작 전 "정찰(reconnaissance)" 태스크에서 HTML 스냅샷과 API 존재 여부를 확보해야 한다. 확보 전에는 인터페이스와 픽스처 기반 테스트만 작성하고 실제 셀렉터는 비워둔다.
- 모든 도메인 작업은 TDD: 실패 테스트 → 최소 구현 → 통과 → 커밋.
- 커밋 메시지는 한국어 conventional commits. (이 저장소는 attribution 비활성화 — Co-Authored-By 라인 없음)

---

## Stage 0 — 프로젝트 셋업

### Task 0.1: WXT + React 스캐폴드

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `entrypoints/`

**Step 1:** WXT 프로젝트 초기화 (이미 존재하는 git/docs는 유지).

Run:
```bash
npx wxt@latest init . --template react-ts --pm npm
```
초기화가 기존 파일을 덮어쓰려 하면 충돌 항목(.gitignore 등)은 우리 것 유지.

**Step 2:** 의존성 설치.

Run:
```bash
npm install
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom
npm install @webext-core/messaging
```

**Step 3:** 빌드가 도는지 확인.

Run: `npm run build`
Expected: `.output/chrome-mv3/` 생성, 에러 없음.

**Step 4: Commit**
```bash
git add -A
git commit -m "chore: WXT + React + TS 프로젝트 스캐폴드 및 의존성 설정"
```

### Task 0.2: manifest 설정 (사이드패널 + host_permissions)

**Files:**
- Modify: `wxt.config.ts`

**Step 1:** `wxt.config.ts`의 manifest에 사이드패널·권한 추가. 샵바이 어드민 도메인은 정찰 단계에서 확정하되, 우선 플레이스홀더로 둔다.

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '군도리 샵바이 진열·배너 관리',
    permissions: ['sidePanel', 'storage', 'activeTab', 'scripting'],
    // TODO(정찰): 실제 샵바이 어드민 origin 으로 교체
    host_permissions: ['https://*.shopby.co.kr/*', 'https://*.e-ncp.com/*'],
    side_panel: { default_path: 'sidepanel/index.html' },
    action: {},
  },
});
```

**Step 2:** Vitest 설정 파일 작성.

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: { provider: 'v8', include: ['lib/**'] },
  },
});
```

**Step 3:** `package.json` scripts에 `"test": "vitest"`, `"test:run": "vitest run"`, `"coverage": "vitest run --coverage"` 추가.

**Step 4:** Run: `npm run test:run` → 테스트 0개여도 정상 종료(exit 0) 확인.

**Step 5: Commit**
```bash
git add -A
git commit -m "chore: 사이드패널 manifest + Vitest 설정"
```

---

## Stage 1 — 도메인 코어 `lib/display-id` (★ 핵심, 풀 TDD)

DOM·브라우저 API 의존 없음. 커버리지 80%+ 집중. 공통 타입을 먼저 만든다.

### Task 1.1: 공통 타입 & Result

**Files:**
- Create: `lib/display-id/types.ts`
- Test: `lib/display-id/types.test.ts` (없음 — 타입 전용)

**Step 1:** 타입 정의.
```ts
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
```

**Step 2: Commit**
```bash
git add lib/display-id/types.ts
git commit -m "feat: 진열 도메인 타입 정의"
```

### Task 1.2: buildDisplayId

**Files:**
- Create: `lib/display-id/build.ts`
- Test: `lib/display-id/build.test.ts`

**Step 1: Write failing test** (문서 예시를 그대로 케이스로)
```ts
import { describe, it, expect } from 'vitest';
import { buildDisplayId } from './build';

describe('buildDisplayId', () => {
  it('사용자유형 진열을 조립한다', () => {
    expect(buildDisplayId({ env: 'c', order: 1, method: 'p', type: 't', userTypes: ['병'] }))
      .toBe('c_1_p_t_병');
  });
  it('복수 사용자유형을 이어붙인다', () => {
    expect(buildDisplayId({ env: 'c', order: 2, method: 'p', type: 't', userTypes: ['병','부','장'] }))
      .toBe('c_2_p_t_병부장');
  });
  it('브랜드 진열(테스트환경/스와이프)을 조립한다', () => {
    expect(buildDisplayId({ env: 'ct', order: 4, method: 's', type: 'b', brandNo: '43215615' }))
      .toBe('ct_4_s_b_43215615');
  });
  it('일반 진열 라벨을 붙인다', () => {
    expect(buildDisplayId({ env: 'c', order: 3, method: 'p', type: 'n', label: '베스트' }))
      .toBe('c_3_p_n_베스트');
  });
});
```

**Step 2:** Run `npm run test:run -- build` → FAIL (buildDisplayId 없음).

**Step 3: Implement**
```ts
import type { DisplaySpec } from './types';

export function buildDisplayId(spec: DisplaySpec): string {
  const head = `${spec.env}_${spec.order}_${spec.method}`;
  switch (spec.type) {
    case 't': return `${head}_t_${spec.userTypes.join('')}`;
    case 'b': return `${head}_b_${spec.brandNo}`;
    case 'n': return `${head}_n_${spec.label}`;
  }
}
```

**Step 4:** Run `npm run test:run -- build` → PASS.

**Step 5: Commit**
```bash
git add lib/display-id/build.ts lib/display-id/build.test.ts
git commit -m "feat: buildDisplayId — spec를 진열 ID 문자열로 조립"
```

### Task 1.3: parseDisplayId (역파싱 + 검증)

**Files:**
- Create: `lib/display-id/parse.ts`
- Test: `lib/display-id/parse.test.ts`

**Step 1: Write failing tests**
```ts
import { describe, it, expect } from 'vitest';
import { parseDisplayId } from './parse';

describe('parseDisplayId', () => {
  it('유효한 사용자유형 진열을 파싱한다', () => {
    const r = parseDisplayId('c_2_p_t_병부장');
    expect(r).toEqual({ ok: true, value: { env: 'c', order: 2, method: 'p', type: 't', userTypes: ['병','부','장'] } });
  });
  it('브랜드 진열을 파싱한다', () => {
    const r = parseDisplayId('ct_4_s_b_43215615');
    expect(r).toEqual({ ok: true, value: { env: 'ct', order: 4, method: 's', type: 'b', brandNo: '43215615' } });
  });
  it('일반 진열 라벨은 그대로 보존한다(밑줄 포함 가능)', () => {
    const r = parseDisplayId('c_3_p_n_베스트_추천');
    expect(r).toEqual({ ok: true, value: { env: 'c', order: 3, method: 'p', type: 'n', label: '베스트_추천' } });
  });
  it('잘못된 환경 접미사는 error', () => {
    const r = parseDisplayId('x_1_p_t_병');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some(i => i.field === 'env' && i.severity === 'error')).toBe(true);
  });
  it('순서가 0/음수/소수면 error', () => {
    for (const bad of ['c_0_p_t_병', 'c_-1_p_t_병', 'c_1.5_p_t_병']) {
      expect(parseDisplayId(bad).ok).toBe(false);
    }
  });
  it('사용자유형 외 문자는 error', () => {
    expect(parseDisplayId('c_1_p_t_병XYZ').ok).toBe(false);
  });
  it('브랜드 번호가 숫자가 아니면 error', () => {
    expect(parseDisplayId('c_1_p_b_abc').ok).toBe(false);
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**
```ts
import { USER_TYPE_CHARS, type DisplaySpec, type Issue, type Result, type UserTypeChar } from './types';

const ENVS = ['c', 'ct'];
const METHODS = ['p', 's'];

export function parseDisplayId(id: string): Result<DisplaySpec> {
  const issues: Issue[] = [];
  const parts = id.split('_');
  const [env, orderStr, method, type, ...rest] = parts;
  const detail = rest.join('_');

  if (!ENVS.includes(env)) issues.push({ field: 'env', severity: 'error', message: `환경 접미사는 c 또는 ct 여야 합니다 (받음: ${env ?? '없음'})` });
  const order = Number(orderStr);
  if (!Number.isInteger(order) || order < 1) issues.push({ field: 'order', severity: 'error', message: `진열 순서는 1 이상 정수여야 합니다 (받음: ${orderStr ?? '없음'})` });
  if (!METHODS.includes(method)) issues.push({ field: 'method', severity: 'error', message: `표시 방법은 p 또는 s 여야 합니다 (받음: ${method ?? '없음'})` });
  if (!['t', 'b', 'n'].includes(type)) issues.push({ field: 'type', severity: 'error', message: `진열 타입은 t/b/n 여야 합니다 (받음: ${type ?? '없음'})` });

  if (type === 't') {
    const chars = [...detail];
    const invalid = chars.filter(c => !USER_TYPE_CHARS.includes(c as UserTypeChar));
    if (chars.length === 0) issues.push({ field: 'detail', severity: 'error', message: '사용자 유형 문자가 비어 있습니다' });
    if (invalid.length) issues.push({ field: 'detail', severity: 'error', message: `허용되지 않은 사용자 유형 문자: ${invalid.join(', ')}` });
    if (issues.length) return { ok: false, issues };
    return { ok: true, value: { env: env as 'c'|'ct', order, method: method as 'p'|'s', type: 't', userTypes: chars as UserTypeChar[] } };
  }
  if (type === 'b') {
    if (!/^\d+$/.test(detail)) issues.push({ field: 'detail', severity: 'error', message: `브랜드 번호는 숫자여야 합니다 (받음: ${detail || '없음'})` });
    if (issues.length) return { ok: false, issues };
    return { ok: true, value: { env: env as 'c'|'ct', order, method: method as 'p'|'s', type: 'b', brandNo: detail } };
  }
  if (type === 'n') {
    if (issues.length) return { ok: false, issues };
    return { ok: true, value: { env: env as 'c'|'ct', order, method: method as 'p'|'s', type: 'n', label: detail } };
  }
  return { ok: false, issues };
}
```

**Step 4:** Run → PASS.

**Step 5: 왕복(round-trip) 테스트 추가** — `parse(build(spec)) === spec` 를 위 4개 spec에 대해 검증하는 테스트를 같은 파일에 추가하고 PASS 확인.

**Step 6: Commit**
```bash
git add lib/display-id/parse.ts lib/display-id/parse.test.ts
git commit -m "feat: parseDisplayId — 진열 ID 역파싱 + 검증, 왕복 테스트"
```

### Task 1.4: 색상 규칙 parse + 진열명 교차검증

**Files:**
- Create: `lib/display-id/color.ts`
- Test: `lib/display-id/color.test.ts`

**Step 1: Write failing tests**
```ts
import { describe, it, expect } from 'vitest';
import { parseColorSpec } from './color';

describe('parseColorSpec', () => {
  it('단어#HEX 쌍을 파싱한다', () => {
    const r = parseColorSpec('군인#008000, 꿀템#FFFF00', '군인을 위한 꿀템');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([
      { word: '군인', hex: '#008000' }, { word: '꿀템', hex: '#FFFF00' },
    ]);
  });
  it('공백 포함 단어를 허용한다', () => {
    const r = parseColorSpec('추천 상품#FFFF00', '{이름}님을 위한 추천 상품');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]).toEqual({ word: '추천 상품', hex: '#FFFF00' });
  });
  it('진열명에 없는 단어는 warn', () => {
    const r = parseColorSpec('없는단어#FF0000', '군인을 위한 꿀템');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some(i => i.severity === 'warn')).toBe(true);
  });
  it('잘못된 HEX는 error', () => {
    const r = parseColorSpec('군인#ZZZ', '군인');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some(i => i.severity === 'error')).toBe(true);
  });
  it('빈 문자열은 빈 배열', () => {
    expect(parseColorSpec('', '아무거나')).toEqual({ ok: true, value: [] });
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**
```ts
import type { Issue, Result } from './types';

export type ColorRule = { word: string; hex: string };
const HEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export function parseColorSpec(spec: string, title: string): Result<ColorRule[]> {
  const trimmed = spec.trim();
  if (!trimmed) return { ok: true, value: [] };

  const issues: Issue[] = [];
  const rules: ColorRule[] = [];
  for (const raw of trimmed.split(',')) {
    const seg = raw.trim();
    if (!seg) continue;
    const hashAt = seg.lastIndexOf('#');
    if (hashAt <= 0) { issues.push({ field: 'color', severity: 'error', message: `형식 오류: "${seg}" — 단어#HEX 형태여야 합니다` }); continue; }
    const word = seg.slice(0, hashAt).trim();
    const hex = seg.slice(hashAt);
    if (!HEX.test(hex)) { issues.push({ field: 'color', severity: 'error', message: `잘못된 HEX: "${hex}"` }); continue; }
    if (!title.includes(word)) { issues.push({ field: 'color', severity: 'warn', message: `진열명에 없는 단어 "${word}" — 색칠되지 않고 무시됩니다` }); }
    rules.push({ word, hex });
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, value: rules };
}
```

> 주의: warn만 있어도 `ok: false`로 반환해 호출부가 issues를 표시하게 한다. UI는 severity로 차단/경고를 구분(error는 채우기 차단, warn은 노란 안내).

**Step 4:** Run → PASS.

**Step 5: Commit**
```bash
git add lib/display-id/color.ts lib/display-id/color.test.ts
git commit -m "feat: 색상 규칙 파싱 + 진열명 교차검증"
```

### Task 1.5: 진열명 미리보기 ({이름} 치환)

**Files:**
- Create: `lib/display-id/title.ts`
- Test: `lib/display-id/title.test.ts`

**Step 1: Write failing test**
```ts
import { describe, it, expect } from 'vitest';
import { previewTitle } from './title';

describe('previewTitle', () => {
  it('{이름}을 사용자 이름으로 치환한다', () => {
    expect(previewTitle('{이름}님을 위한 추천 상품', '지성현')).toBe('지성현님을 위한 추천 상품');
  });
  it('예약어가 없으면 그대로', () => {
    expect(previewTitle('군인을 위한 꿀템', '지성현')).toBe('군인을 위한 꿀템');
  });
  it('이름 미지정 시 플레이스홀더로 표시', () => {
    expect(previewTitle('{이름}님 환영', '')).toBe('OOO님 환영');
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**
```ts
export function previewTitle(title: string, userName: string): string {
  return title.replaceAll('{이름}', userName || 'OOO');
}
```
> 저장값에는 `{이름}` 을 유지한다(앱이 런타임 치환). 이 함수는 미리보기 전용.

**Step 4:** Run → PASS. **Step 5: Commit**
```bash
git add lib/display-id/title.ts lib/display-id/title.test.ts
git commit -m "feat: 진열명 {이름} 예약어 미리보기 치환"
```

### Task 1.6: 도메인 배럴 + 커버리지 확인

**Step 1:** `lib/display-id/index.ts` 에서 build/parse/color/title/types re-export.
**Step 2:** Run: `npm run coverage` → `lib/display-id` 80%+ 확인.
**Step 3: Commit**
```bash
git add lib/display-id/index.ts
git commit -m "chore: display-id 도메인 배럴 export"
```

---

## Stage 2 — 사이드패널 UI 셸 + DisplayBuilder

도메인 코어에만 의존(DOM 자동화는 Stage 3에서 붙임). 컴포넌트는 작게 쪼갠다.

### Task 2.1: 사이드패널 앱 셸 + 탭 네비게이션

**Files:**
- Modify/Create: `entrypoints/sidepanel/App.tsx`, `entrypoints/sidepanel/ui/Tabs.tsx`

탭: 「진열」 / 「배너」 / 「브랜드」. 우선 「진열」만 내용 채우고 나머지는 placeholder.

**Step 1:** 컴포넌트 작성(상태는 로컬 `useState`, URL/전역상태 불필요 — YAGNI).
**Step 2:** Run `npm run dev` 로 사이드패널 로드 확인(크롬에서 익스텐션 로드 → 사이드패널 열기).
**Step 3: Commit** `feat: 사이드패널 앱 셸 + 탭 네비게이션`

### Task 2.2: DisplayBuilder 폼 (라이브 ID 미리보기 + 검증 배지)

**Files:**
- Create: `entrypoints/sidepanel/ui/DisplayBuilder.tsx`, `.../UserTypeChips.tsx`
- Test: `entrypoints/sidepanel/ui/DisplayBuilder.test.tsx` (Testing Library)

**Step 1: Write failing test** — 폼 입력 시 `buildDisplayId` 결과가 미리보기에 뜨고, 사용자유형 칩 토글이 ID에 반영되는지.
```tsx
// 예: 환경 c, 순서 1, 방법 p, 타입 t, 병 칩 선택 → "c_1_p_t_병" 텍스트가 보인다
```
**Step 2:** Run → FAIL.
**Step 3:** 구현 — 환경 토글/순서 number/방법 라디오/타입 라디오 + 타입별 상세(사용자유형 칩, 브랜드 검색칸(Stage 5에서 매핑 연결), 일반 라벨). 하단 미리보기는 `buildDisplayId(spec)`, 검증 배지는 `parseDisplayId(preview)` 의 issues 표시.
**Step 4:** Run → PASS.
**Step 5: Commit** `feat: DisplayBuilder 폼 + 라이브 ID 미리보기/검증 배지`

### Task 2.3: 기존 ID 붙여넣기 → 폼 복원

**Files:** Modify `DisplayBuilder.tsx`; Test 추가.

**Step 1:** 실패 테스트 — "c_2_p_t_병부장" 붙여넣기 → 폼 필드들이 그 값으로 채워진다(`parseDisplayId` 사용).
**Step 2-4:** 구현·통과.
**Step 5: Commit** `feat: 진열 ID 붙여넣기 시 폼 자동 복원`

### Task 2.4: TitleEditor (진열명 + 색상 + 프리뷰)

**Files:** Create `.../TitleEditor.tsx`; Test.

**Step 1:** 실패 테스트 — 진열명 + 색상 입력 → `parseColorSpec` warn/error가 배지로, `previewTitle` 결과에 색이 입혀진 프리뷰.
**Step 2-4:** 구현·통과.
**Step 5: Commit** `feat: TitleEditor — 진열명/색상 입력 + 색상 프리뷰`

---

## Stage 3 — 메시징 + content script 채우기 메커니즘 (mock 대상)

실제 셀렉터 없이도 "값 주입 + 이벤트 발생 + 부분 실패 리포트" 메커니즘 자체를 jsdom으로 테스트한다.

### Task 3.1: 메시징 계약 정의

**Files:** Create `lib/messaging.ts`.
```ts
import { defineExtensionMessaging } from '@webext-core/messaging';

export type FillField = { key: string; value: string };
export type FillResult = {
  filled: { key: string }[];
  failed: { key: string; reason: string }[];
};
interface Protocol {
  fillDisplay(fields: FillField[]): FillResult;
  fillBanner(fields: FillField[]): FillResult;
  readCurrentDisplay(): Record<string, string>; // 역파싱용 현재 페이지 값
}
export const { sendMessage, onMessage } = defineExtensionMessaging<Protocol>();
```
**Commit:** `feat: content↔panel 메시징 계약 정의`

### Task 3.2: DOM 채우기 유틸 (값 주입 + 네이티브 이벤트) — jsdom 테스트

**Files:** Create `lib/shopby/fill.ts`; Test `lib/shopby/fill.test.ts`.

**Step 1: Write failing test** (jsdom)
```ts
// input 엘리먼트에 setFieldValue 하면 value가 바뀌고 input/change 이벤트가 1번씩 발생한다.
// 존재하지 않는 셀렉터는 failed 로 리포트된다.
```
**Step 2:** Run → FAIL.
**Step 3: Implement** — `setNativeValue(el, value)` 로 React 호환 값 설정 후 `dispatchEvent(new Event('input', {bubbles:true}))` + `'change'`. `fillByMap(doc, fieldMap, fields)` 가 `FillResult` 반환(못 찾은 키는 failed).

> React 제어 input 대응: prototype value setter 사용
> ```ts
> const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
> Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
> ```

**Step 4:** Run → PASS. **Step 5: Commit** `feat: DOM 필드 채우기 유틸 + 부분 실패 리포트`

### Task 3.3: background — 사이드패널 토글 + 탭 중계

**Files:** Modify `entrypoints/background.ts`.

**Step 1:** action 클릭 시 `chrome.sidePanel.open`. 사이드패널의 fill 요청을 활성 탭 content script로 중계.
**Step 2:** 수동 확인(크롬). **Step 3: Commit** `feat: background 사이드패널 열기 + 메시지 중계`

### Task 3.4: content script — 채우기 실행 + 하이라이트

**Files:** Modify `entrypoints/content.ts`.

**Step 1:** `onMessage('fillDisplay', ...)` → `fillByMap` 호출 → 채운 필드 초록, 실패 지점 빨강 마커(짧게). FillResult 반환.
**Step 2:** content가 샵바이 어드민 origin 에서만 동작하도록 가드(아니면 "어드민 페이지에서 열어주세요").
**Step 3: Commit** `feat: content script 채우기 실행 + 성공/실패 위치 하이라이트`

### Task 3.5: 사이드패널 FillButton + 결과 리포트

**Files:** Create `.../FillButton.tsx`, `.../FillReport.tsx`; Modify `DisplayBuilder`.

**Step 1:** error issues 있으면 버튼 비활성. 클릭 → `sendMessage('fillDisplay', fields)` → "채움 N · 실패 M (필드명+사유)" 리포트.
**Step 2: Commit** `feat: 어드민에 채우기 버튼 + 부분 실패 리포트 UI`

---

## ⚠️ Stage 4 진입 전 — 정찰 (BLOCKER)

### Task 4.0: 어드민 HTML 스냅샷 & 브랜드 소스 확보

**산출물(아래가 없으면 Stage 4~6 진행 불가):**
1. 상품 진열 수정 페이지 HTML 덤프 → `tests/fixtures/admin-display.html`
2. 메인배너/띠배너 관리 페이지 HTML 덤프 → `tests/fixtures/admin-banner.html`
3. 브랜드 관리 페이지 HTML 덤프 → `tests/fixtures/admin-brand.html`
4. 각 페이지 네트워크 탭에서 브랜드 목록 / 저장 관련 **XHR 존재 여부** 기록 → `docs/recon.md`
5. 실제 어드민 origin 확정 → `wxt.config.ts` host_permissions / content matches 교체

**진행:** 사용자(또는 admin 계정 보유자)가 DevTools로 위 HTML/네트워크 정보를 제공. 확보 후 커밋: `chore: 어드민 페이지 픽스처 및 정찰 메모 추가`

---

## Stage 5 — 브랜드 소스 3단 폴백 + BrandMap UI

> 정찰 결과(API 유무)에 따라 구현체가 갈린다.

### Task 5.1: BrandSource 인터페이스 + storage

**Files:** Create `lib/shopby/brand.ts`, `lib/storage.ts`.
```ts
export type BrandEntry = { name: string; brandNo: string };
export interface BrandSource { fetchBrands(): Promise<BrandEntry[]>; }
```
`storage.defineItem<BrandEntry[]>('local:brandMap', { fallback: [] })`. **Commit.**

### Task 5.2: 소스 구현 (정찰 분기)

- API 있으면: `ShopbyApiBrandSource` — 픽스처 응답으로 정규화 테스트.
- 없으면: `AdminPageBrandSource` — `admin-brand.html` 픽스처에서 이름+번호 추출 테스트.
- 공통: 폴백 체인 `loadBrands()` → 결과 storage 캐시. TDD로 각각.
**Commit** 단위로.

### Task 5.3: DisplayBuilder 브랜드 검색 연결 + BrandMap CRUD UI

- 브랜드 타입 선택 시 매핑 검색 → 번호 자동 입력. **매핑 비어도 번호 직접 입력 가능**(테스트로 보장).
- BrandMap 탭: 목록/추가/수정/삭제 + "어드민에서 가져오기".
**Commit** 단위로.

---

## Stage 6 — 배너 폼

### Task 6.1: 메인 배너 폼
- 16:9/3:2 중 하나만 사용 규칙, 노출설정/노출기간/랜딩URL. 셀렉터는 `admin-banner.html` 기준.
- 채우기 → FillReport 재사용. TDD(폼 검증) + 픽스처 채우기 테스트.

### Task 6.2: 띠 배너 폼
- `구좌명` = **연결할 진열 ID** 로 강제(자유입력 금지). 진열 ID 검증 재사용(`parseDisplayId`).
- 비율 무시 안내 문구. 채우기 → FillReport.
**Commit** 단위로.

---

## Stage 7 — E2E + 마감

### Task 7.1: Playwright E2E (얇게)
- mock 어드민 HTML 페이지(픽스처)를 띄우고: 사이드패널 폼 작성 → 검증 배지 → 채우기 → 필드 채워짐 + 실패 위치 표기 확인.
- 라이브 운영 어드민 미실행.

### Task 7.2: 마감
- `npm run coverage` 도메인 80%+ 재확인, `npm run build` 무에러.
- README: 설치(개발자 모드 로드), 사용법, 정찰 절차, "저장은 사람이" 안전 원칙 명시.
**Commit:** `docs: README + E2E, v1 마감`

---

## v1 범위 밖 (YAGNI)
- 진열/배너 초안 저장·재사용 템플릿
- 팀 간 공유(storage.sync/외부 저장)
- 저장 버튼 자동 클릭(완전 자동화)
- 현황 대시보드(전체 진열 조회·시각화)
