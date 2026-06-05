# 현재 어드민 진열 값 불러오기 (Load Current Display)

날짜: 2026-06-05
상태: 설계 확정 (구현 대기)

## 배경 / 문제

진열 탭의 사이드패널은 진열 ID·진열명·설명을 **조립해서 어드민 폼에 채워 넣는**(fill) 방향만 지원한다. 그런데 이미 값이 채워진 진열을 **수정**할 때는, 사용자가 어드민에 있는 값을 사이드패널에 손으로 다시 입력해야 한다.

플러밍은 이미 절반 깔려 있다:

- `lib/messaging.ts` — `readCurrentDisplay(): Record<string,string>` 프로토콜 존재
- `entrypoints/content.ts` — `readByMap(DISPLAY_FIELD_MAP)`로 어드민 폼에서 `sectionId`/`title`/`sectionExplain`을 읽어 반환
- `entrypoints/background.ts` — 활성 탭으로 중계
- `lib/display-id` — `parseDisplayId`(ID→조립값 복원), `recoverChips`(색상 문자열→칩) 모두 존재

**비어 있는 건 이 읽기 결과를 사이드패널 편집기에 주입하는 UI 경로뿐이다.**

## 목표

어드민에서 "진열 수정" 화면을 연 상태라면, 폼에 이미 입력된 **진열 ID·진열명·설명**을 사이드패널 편집기로 거꾸로 불러와 자동 할당한다.

## 확정된 결정 사항

| 결정 | 선택 |
|---|---|
| 트리거 | 진열 탭 진입(마운트) 시 자동 1회 + 수동 "재조회" 버튼 |
| 덮어쓰기 정책 | 어드민 값으로 전체 교체하되, **어드민에서 비어 있는 필드는 패널 값 유지(스킵)** |
| 상태 구조 | 상태를 부모(`DisplayWorkspace`)로 끌어올림 (controlled children) |
| prop 모양 | 자식마다 상태 객체 1개 + onChange 1개 |

## 아키텍처

`DisplayWorkspace`가 입력 상태의 단일 소유자가 되고, `DisplayBuilder`·`TitleEditor`는 표현(presentational) 컴포넌트로 전환된다.

```
DisplayWorkspace (상태 소유)
  ├─ builderState { env, onHome, order, method, type, userTypes, brandNo, label, sourceId }
  ├─ titleState   { title, chips, previewName }
  ├─ exposureYn
  │
  ├─▶ <DisplayBuilder value={builderState} onChange={setBuilderState} />
  └─▶ <TitleEditor    value={titleState}   onChange={setTitleState} />
```

### 데이터 흐름

```
진열 탭 진입(mount, useEffect 1회) ─┐
"재조회" 버튼 클릭            ─┴─▶ loadFromAdmin()
                                     │ sendMessage('readCurrentDisplay')
                                     ▼  { displayId, title, color }
                              applyAdminValues(read, prev)
                                     │ (빈 필드 스킵)
                        ┌────────────┴─────────────┐
                        ▼                          ▼
                 builderState 갱신            titleState 갱신
            parseDisplayId(displayId)        title ← title
            + sourceId = displayId           chips ← recoverChips(color)
```

### 파생값 헬퍼 (DRY)

fill에 필요한 `displayId`/`hasError`, `title`/`color`는 순수 함수로 도출된다. 부모(fill 필드 구성)와 자식(미리보기·검증 표시)이 같은 헬퍼를 공유한다.

- `deriveDisplay(builderState)` → `{ displayId, issues, hasError }` (`buildDisplayId` + `parseDisplayId` 래핑)
- `deriveTitle(titleState)` → `{ title, color, issues, hasError }` (`serializeChips` + `parseColorSpec` 래핑)

## 핵심 순수 함수

```ts
// 읽어온 레코드 + 현재 상태 → 다음 상태 (빈 필드 스킵 정책이 여기 집중)
function applyAdminValues(
  read: Record<string, string>,
  prev: { builder: BuilderState; title: TitleState },
): {
  builder: BuilderState;
  title: TitleState;
  loaded: Array<'displayId' | 'title' | 'color'>;
}
```

규칙:

- `read.displayId` 비어 있지 않으면 → `sourceId = displayId`. `parseDisplayId.ok`면 env/onHome/order/method/type/userTypes/brandNo/label 복원. 파싱 실패면 **sourceId만** 세팅하고 조립값은 그대로 둔다.
- `read.title` 비어 있지 않으면 → `title` 교체.
- `read.color` 비어 있지 않으면 → `chips = recoverChips(color)`.
- 각 교체가 일어난 키를 `loaded`에 담는다 → 상태줄 문구의 근거.

## UI

`DisplayWorkspace` 최상단 툴바:

```
┌──────────────────────────────────────────────┐
│ [↻ 현재 어드민 값 불러오기]   진열명·설명 불러옴 │
├──────────────────────────────────────────────┤
│  DisplayBuilder (진열 ID)                       │
│  TitleEditor   (진열명 편집)                    │
│  노출여부 / 채우기 버튼                          │
└──────────────────────────────────────────────┘
```

상태줄(4가지):

| 상태 | 문구 |
|---|---|
| 로딩 중 | `불러오는 중…` (버튼 disabled) |
| 성공(일부라도 채움) | `{loaded 필드 나열} 불러옴` (예: `진열 ID·진열명·설명 불러옴`) |
| 어드민 폼 없음(`{}` 반환) | `어드민에서 진열 수정 화면을 연 뒤 다시 눌러주세요` |
| 자동 1회 빈손 | 에러처럼 보이지 않게 중립 문구만 |

- 자동(마운트)·수동(버튼)은 같은 `loadFromAdmin()` 경로.
- 전체 교체 정책이라, 명시적 버튼으로 사용자가 *언제* 덮어쓸지 통제권을 갖는다.

## 엣지 케이스

| 상황 | 처리 |
|---|---|
| `readCurrentDisplay()` → `{}` | 상태 변경 없음, 안내 문구만 |
| `displayId` 있으나 파싱 실패 | `sourceId`엔 원문, 조립값은 유지 |
| `color`에 진열명에 없는 단어 | 칩은 복원, 색칠 경고는 TitleEditor 기존 검증이 표시 |
| 자동 + 버튼 연타 | `isLoading` 플래그로 중복 차단(버튼 disabled) |
| `sendMessage` 실패 | `try/catch` → 에러 문구, 크래시 없음 |

## 테스트 (TDD, 80%+)

1. **`applyAdminValues` 유닛** — 빈 필드 스킵 / 파싱 실패 시 sourceId만·spec 유지 / color→chips 복원 / `loaded` 정확성.
2. **`DisplayWorkspace.test.tsx`** — `sendMessage` 모킹: 마운트 자동 호출 1회 / 버튼 재조회 / 로딩 중 disabled / `{}` 안내 문구 / 실패 에러 문구.
3. **컨트롤드 전환 회귀** — `DisplayBuilder`·`TitleEditor`를 `value`/`onChange` 기반으로 갱신(기존 테스트 파일 수정).

## 영향 받는 파일

- `entrypoints/sidepanel/ui/DisplayWorkspace.tsx` — 상태 소유, 툴바, `loadFromAdmin`
- `entrypoints/sidepanel/ui/DisplayBuilder.tsx` — controlled 전환
- `entrypoints/sidepanel/ui/TitleEditor.tsx` — controlled 전환
- `lib/display-id/` 또는 워크스페이스 인접 — `applyAdminValues`, `deriveDisplay`, `deriveTitle` 헬퍼
- 관련 테스트 3종
- (읽기 배관 `content.ts`/`background.ts`/`messaging.ts`/`selectors.ts`는 변경 없음 — 재사용)
