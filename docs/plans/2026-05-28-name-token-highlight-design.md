# `{이름}` 토큰 강조 — preview 매칭 설계

- 작성일: 2026-05-28
- 상태: 설계 확정 (구현 전)
- 관련 파일: [`TitleEditor.tsx`](../../entrypoints/sidepanel/ui/TitleEditor.tsx), [`lib/display-id/title.ts`](../../lib/display-id/title.ts)

## 1. 배경과 문제

진열명 편집기는 두 흐름이 있다.

- **저장값**: 진열명 원문(예: `{이름}님을 위한 추천`)에 `단어#HEX, …` 색상 규칙을
  덧붙여 `sectionExplain`에 들어간다.
- **프리뷰**: `previewTitle(title, previewName)`이 `{이름}`을 사용자 이름(기본 `지성현`)으로
  치환한 문자열을 보여준다.

색상 강조는 `renderColoredPreview(preview, rules)`에서 **치환된 preview 문자열**에 대해
`indexOf(rule.word)`로 매칭한다. 그런데 칩의 word에 예약어 `{이름}`을 등록하면,
치환된 preview에는 더 이상 `{이름}`이라는 문자열이 없으므로 매칭이 실패한다.

```
진열명:  "{이름}님을 위한 추천"
preview: "지성현님을 위한 추천"
칩:      {이름}#FF3B30
검색:    preview.indexOf("{이름}") → -1 ❌
```

결과: 사용자가 `{이름}` 칩을 등록해도 프리뷰에서 색칠되지 않는다.

## 2. 목표

칩에 `{이름}` 예약어를 등록하면, **프리뷰에 치환되어 보이는 사용자 이름이
색상으로 강조**되어야 한다.

부수 목표:

- 저장 포맷 무변경 (`단어#HEX, …` 유지).
- `parseColorSpec` 시그니처/책임 무변경 (진열명 원문 기준으로 단어 검증).
- 향후 다른 예약어(`{닉네임}` 등)가 추가되더라도 같은 메커니즘이 그대로 동작.

## 3. 접근 선택지

### A. 검색 시점에 word를 token-resolve *(채택)*

`findNextRule`에서 `previewTitle(rule.word, previewName)`로 변환한 키로 `indexOf` 한다.
저장 모델·파서·UI 상태 모두 무변경. 변경 범위는 `TitleEditor.tsx`의 두 함수.

장점:
- 변경 표면 최소(파일 1개, 함수 2개).
- 토큰 치환 책임이 이미 있는 `previewTitle`을 재사용해서, 토큰이 늘어도 자동 전파.
- 칩 word는 사용자가 입력한 그대로(`{이름}`) 저장·표시되어 왕복 일관성 유지.

### B. rules 생성 시점에 미리 word 치환

`parseColorSpec`이 `previewName`을 인자로 받아 word를 미리 치환한다.

단점:
- 파서가 UI 상태(프리뷰 이름)에 의존하게 됨 — 책임 분리 위반.
- `title.includes(word)` 경고 로직이 "원문에 토큰이 있는가"가 아니라
  "치환 후 결과에 사용자 이름이 있는가"로 의미가 흔들림.

### C. 별도 토큰 등록 UI 분리

`{이름}` 전용 색상 입력 필드를 따로 둔다.

단점:
- 저장 포맷에 별도 키가 필요하거나 직렬화가 복잡해짐.
- 현재 예약어가 `{이름}` 하나뿐이라 과한 일반화(YAGNI).

**결론: A**.

## 4. 변경 상세

`entrypoints/sidepanel/ui/TitleEditor.tsx`의 렌더 헬퍼만 수정한다.

```ts
// before
function renderColoredPreview(preview: string, rules: ColorRule[]) { ... }

function findNextRule(preview: string, rules: ColorRule[], cursor: number) {
  for (const rule of rules) {
    const index = preview.indexOf(rule.word, cursor);
    ...
  }
}
```

```ts
// after
function renderColoredPreview(
  preview: string,
  rules: ColorRule[],
  previewName: string,
) {
  ...
  const next = findNextRule(preview, rules, cursor, previewName);
  ...
  segments.push(
    <span style={{ '--title-color': next.rule.hex, color: 'var(--title-color)' }}>
      {next.resolved}
    </span>,
  );
  cursor = next.index + next.resolved.length;
}

function findNextRule(
  preview: string,
  rules: ColorRule[],
  cursor: number,
  previewName: string,
) {
  let match: { index: number; rule: ColorRule; resolved: string } | undefined;
  for (const rule of rules) {
    const resolved = previewTitle(rule.word, previewName); // {이름} → 지성현
    if (!resolved) continue;
    const index = preview.indexOf(resolved, cursor);
    if (index < 0) continue;
    if (!match || index < match.index) match = { index, rule, resolved };
  }
  return match;
}
```

호출부:

```ts
<p aria-label="색상 프리뷰">{renderColoredPreview(preview, rules, previewName)}</p>
```

핵심 포인트:

- **검색 키와 span 내부 텍스트 모두 `resolved`** — 치환된 문자열로 통일.
- `cursor` 전진 폭도 `resolved.length` — 매칭한 만큼 정확히 건너뛴다.
- `parseColorSpec`·저장 포맷·`WordChips` 모두 손대지 않는다.

## 5. 엣지 케이스

| 칩 word | 진열명 | previewName | 동작 |
|---|---|---|---|
| `{이름}` | `{이름}님을 위한…` | `지성현` | preview의 "지성현" 색칠 ✅ |
| `{이름}` | `{이름}님을 위한…` | `` (빈값) | `previewTitle`이 `OOO` 치환 → "OOO" 색칠 ✅ |
| `{이름}님` | `{이름}님을 위한…` | `지성현` | "지성현님" 색칠 ✅ |
| `추천` | `{이름}님을 위한 추천` | `지성현` | "추천" 색칠 (기존 회귀 없음) ✅ |
| `{이름}` | 진열명에 토큰 없음 | `지성현` | `parseColorSpec` 경고 (기존 정책 유지) ✅ |
| `지성현` | `{이름}님을…` | `지성현` | `parseColorSpec` 경고 — 원문에 없는 단어 (기존 정책 유지) ✅ |

빈 `previewName` 케이스가 일관적인 이유: `previewTitle('', …) → ''`,
`previewTitle('{이름}', '') → 'OOO'`. 빈 resolved는 `continue`로 건너뛴다.

## 6. 테스트 계획

`entrypoints/sidepanel/ui/TitleEditor.test.tsx`에 3 케이스 추가:

1. **칩 word가 `{이름}`이면 치환된 이름이 강조된다**
   - 진열명: `{이름}님을 위한 추천`
   - 칩: `{이름}#FF3B30`
   - 기대: 프리뷰의 `지성현`이 `<span style="color: var(--title-color)">`로 감싸짐.

2. **`previewName`이 비면 `OOO`가 강조된다**
   - 진열명: `{이름}님을 위한 추천`, 미리보기 이름 빈 문자열
   - 칩: `{이름}#FF3B30`
   - 기대: 프리뷰의 `OOO`가 span으로 감싸짐.

3. **일반 단어 칩은 회귀 없이 강조된다**
   - 진열명: `{이름}님을 위한 추천`
   - 칩: `추천#008000`
   - 기대: 프리뷰의 `추천`이 span으로 감싸짐.

`lib/display-id/title.test.ts`, `color.test.ts`는 무변경 — 도메인 로직 변경 없음.

## 7. 비포함 (YAGNI)

- 토큰 레지스트리 또는 전용 UI — 현재 토큰이 `{이름}` 하나.
- 저장 포맷 변경 — `단어#HEX, …` 그대로.
- `parseColorSpec` 시그니처 변경 — 원문 기준 검증 유지.
- WordChips 측 표시 변경 — 칩 라벨은 사용자 입력 그대로(`{이름}`).
