# 전시카테고리 순서 변경(Reorder) — 설계

> 작성: 2026-06-01. 전시카테고리 상위(depth 1) 관리코드 순번을 사이드패널에서
> 재정렬하고, 어드민 폼을 통해 자동으로 반영한다. brand의 `openBrandEditor`/
> `openCategoryEditor`(어드민 트리 열기)를 토대로 확장한다.

## 배경 / 문제

전시카테고리의 표시 순서는 상위 카테고리 **관리코드**(`c_<순번>` / `ct_<순번>`)의
순번으로 결정된다. shopby가 관리코드 **유일성을 강제**하므로, 두 카테고리의 순번을
맞바꾸려 해도 "어느 순간에도 중복 코드 불가" 제약에 걸린다.

예) `c_1` ↔ `c_2` 교체는 직접 swap이 불가능하고, 임시코드를 경유해야 한다:

```
c_1 → c_3 (저장)   # 자리 비움(임시)
c_2 → c_1 (저장)
c_3 → c_2 (저장)
```

상위가 많거나 임의 재배치를 하면 이 임시코드 경유(temp dance)가 누적되어 수동
작업이 매우 번거롭다. 이를 익스텐션이 **최소 저장 시퀀스 계산 + 반자동 적용**으로
타개한다.

## 확정된 결정 (브레인스토밍 결과)

- **이동 목적지**: 어드민 전시카테고리 관리 트리(스토어프론트 아님).
- **트리 도달 방식(A안)**: "전체 열기" 버튼 선클릭으로 트리를 모두 펼친 뒤, brand와
  동일한 이름 매칭 + 단계 스크롤로 노드를 찾아 `TreeV2_item-label`을 클릭.
- **이름 중복 구분 불필요**: 관리코드 유일성을 shopby가 강제하므로 상위 식별은
  사실상 코드로 유일. (이름 기반 disambiguation 로직은 도입하지 않음)
- **자동화 수준**: 반자동 — DOM 폼 조작(코드 입력 → 저장 버튼 클릭 → 결과 확인 → 다음).
  어드민 저장 API 직호출(완전자동)은 채택하지 않음.
- **저장 후 alert**: 브라우저 **네이티브 회색 박스**(`window.alert`/`confirm`).
  MAIN world 주입으로 래핑해 자동 통과 + 메시지 캡처(저장 성공/실패 판별).
- **순서 지정 UX**: ▲/▼ 버튼으로 위/아래 한 칸 이동 → "적용" 버튼(드래그 아님).
  적용 전 실제 저장 시퀀스 미리보기 + 운영데이터 경고.

## 실제 어드민 DOM 사실 (main 캡처 `tests/fixtures/admin-display-category.html`)

- 트리는 brand와 동일한 `TreeV2` 컴포넌트이나 **중첩(`<ul><li>`) 계층**.
  - 노드: `li.TreeV2_tree-item > div.TreeV2_item-label`(클릭 대상) >
    `div.TreeV2_content > div.display-category-management_category-name-wrap > span`(이름).
  - 펼침 화살표: `div.TreeV2_arrow`. 자식은 부모 `li` 내부 중첩 `<ul>`.
- **"전체 열기" 버튼**: `button.display-category-management_right-btn__` 중
  `<span>전체 열기</span>`를 가진 것(line 277). "전체 닫기"는 같은 클래스의 다른 버튼.
- **`categoryNo` 등 식별 data 속성이 트리 DOM에 없음** → 이름 매칭만 가능.
- `category-name-wrap` 안에 숨김 아이콘 SVG가 섞일 수 있음 → 비교는 **첫 `<span>` 텍스트**.
- 저장 버튼: `.bottom-bar button[type="submit"]`(value/텍스트 "저장", `class="btn red"`).
- 코드/이름 입력: 기존 `DISPLAY_CATEGORY_CODE_INPUT_SELECTOR` /
  `DISPLAY_CATEGORY_NAME_INPUT_SELECTOR`.
- 편집 폼은 `enterprise-remote.shopby.co.kr` **iframe** 안에 렌더된다(`*.shopby.co.kr`
  host_permission으로 커버). 저장·alert도 그 iframe 컨텍스트에서 발생.

## 설계

### 1) 어드민 트리 열기 보강 (`lib/shopby/category-editor-open.ts`)

기존 `openCategoryEditor` 흐름에 단계 추가:

```
1. 호스트 검증 (기존)
2. expandAll(doc): "전체 열기" 버튼(텍스트로 "열기"/"닫기" 구분) 탐색 → 클릭 → waitMs 대기.
   못 찾으면 펼침 없이 진행(graceful; 평면/이미펼침 대비, 중단 아님).
3. findWithScroll: 펼친 트리에서 이름 매칭(매칭 단위를 첫 <span> 텍스트로 보강).
4. 매칭 name-wrap → closest('.TreeV2_item-label 셀렉터') 클릭 (현재는 name-wrap 직접 클릭).
5. focusFieldSoon: depth<=1 코드입력 / depth>=2 이름입력 (기존).
```

### 2) 최소 저장 시퀀스 알고리즘 (`lib/shopby/category-reorder.ts`, 순수 함수)

```
입력: [{categoryNo, name, 현재order, 목표order}]  (같은 env)
1. 제자리(현재==목표) 제외 (저장 0회)
2. "현재→목표" 방향으로 사이클 분해
3. 안전 임시 order T = 현재 env 미사용 최대 order + 1 (충돌 불가)
4. 각 사이클(길이 k):
   - 첫 노드 → T 저장
   - 사이클 따라 한 칸씩 당겨 저장 (k-1회)
   - T 보유 노드 → 마지막 목표 저장
   ⇒ 사이클당 k+1회
총 저장 = 이동대상 수 N + 사이클 개수.  (사이클 종료 시 T는 비므로 재사용)
```

출력: `CategoryReorderStep[]` = `{categoryNo, name, newCode}` 순서 리스트.
`newCode`는 `env` + order로 조립(`c_<n>` / `ct_<n>`).

### 3) alert 처리 (MAIN world 주입, 스코프 한정) — `entrypoints/content/alert-suppressor.ts`

- `window.alert`/`window.confirm`을 래핑. 공유 DOM 플래그
  (`document.documentElement.dataset.gndAutoConfirm`)가 **ON일 때만** 자동 통과
  (`confirm`→`true`, `alert`→무시). OFF면 원본 호출 → 평소 수동 편집의 진짜 경고는 보존.
- 삼킨 메시지를 `postMessage`로 isolated content script에 전달 → 저장 성공/실패 문구 판별.
- WXT `injectScript`로 배치 시작 시 1회 주입(멱등). 배치 끝 → 플래그 OFF + 원본 복구.

### 4) 실행 엔진 (`lib/shopby/category-reorder-apply.ts`)

```
applyReorder(doc, steps):
  플래그 ON (alert 자동통과·메시지 캡처)
  for (i, step) of steps:
    1. openCategoryEditor(name)        # 1) 전체열기 + 이름매칭 + item-label 클릭
    2. 코드 input 등장 폴링
    3. setFieldValue(codeInput, step.newCode)   # 기존 fill.ts 재사용(React 제어 input)
    4. 저장 버튼 클릭
    5. 캡처 메시지 판별: 성공→다음 / 실패→중단(failedAt 기록)
  finally: 플래그 OFF + 복구
  return { status, applied, failedAt? }
```

- **단계 원자성**: 코드 1개 변경+저장+성공확인까지 끝나야 다음. 실패 시 멈추고 적용 수 보고
  (롤백 없음; 시퀀스는 중간 지점도 중복 없는 일관 상태를 보장).
- **재진입**: 저장 후 SPA가 폼/트리를 갱신할 수 있어 매 단계 `openCategoryEditor` 재호출.

### 5) 메시징 (`lib/messaging.ts`)

```ts
export type CategoryReorderStep = { categoryNo: number; name: string; newCode: string };
export type ApplyCategoryReorderRequest = { env: 'c' | 'ct'; steps: CategoryReorderStep[] };
export type ApplyCategoryReorderResult = {
  status: 'done' | 'partial' | 'wrong-host' | 'aborted';
  applied: number;
  failedAt?: { index: number; name: string; reason: string };
};
// Protocol: applyCategoryReorder(request): ApplyCategoryReorderResult 추가
```

### 6) 사이드패널 UX (`CategoryShowcase` / `CategoryPreview`)

- 상위 항목마다 ▲/▼ 버튼(맨 위/아래는 비활성, `aria-label` "위로 이동"/"아래로 이동").
- 순서 변경 시 "적용" 버튼 활성 + 원래순서 대비 diff.
- 적용 → 확인 모달: 목표 순서 + **실제 저장 시퀀스 미리보기**
  (예 "설날특가 c_1→c_3 / 베스트 c_2→c_1 / 설날특가 c_3→c_2 (저장 3회)")
  + 운영데이터 경고 + 어드민 탭 필요 안내.
- 확정 → `sendMessage('applyCategoryReorder', {env, steps})`.
- 진행 상태 "2/3 저장 중…" 단계 표시, 실패 시 멈춘 지점 + 사유.
- 어드민 탭 없으면 `wrong-host` 안내(openCategoryEditor와 동일 패턴).

## 파일 구성

| 파일 | 책임 |
|---|---|
| `lib/shopby/category-reorder.ts` | 순수: order → 최소 저장 시퀀스 |
| `lib/shopby/category-reorder-apply.ts` | DOM 실행 엔진 |
| `entrypoints/content/alert-suppressor.ts` | MAIN world alert/confirm 래퍼 주입 |
| `lib/shopby/category-editor-open.ts` | `expandAll` + item-label 클릭 보강 |
| `lib/shopby/selectors.ts` | `DISPLAY_CATEGORY_SAVE_BUTTON_SELECTOR`, item-label/arrow 셀렉터 추가 |
| `lib/messaging.ts` | `applyCategoryReorder` 타입·프로토콜 |
| `entrypoints/content.ts` | 핸들러 와이어링 + 주입 |
| `entrypoints/sidepanel/ui/CategoryShowcase.tsx`, `CategoryPreview.tsx` | ▲▼·적용·확인 모달·진행상태 |

## 테스트 (TDD, 80%+)

- `category-reorder.test.ts`: 2-사이클(사용자 예시), 3-사이클, 다중 사이클, 제자리(0회),
  항등순열, temp 충돌 회피, env 분리.
- `category-reorder-apply.test.ts`: jsdom 픽스처로 단계 실행·성공판별·실패중단·wrong-host.
- `alert-suppressor` 단위: 플래그 ON/OFF 통과·원본호출, 메시지 캡처.
- `category-editor-open.test.ts` 보강: expandAll 클릭, 중첩 트리 펼침 후 매칭, item-label 클릭.
- UI: ▲▼ 순서변경 → 적용 활성/diff, 확인 모달 시퀀스 표시.

## 알려진 한계 / 최종 수동 검증 항목

- 저장 성공/실패 **문구**(매칭 문자열)는 실제 어드민에서 1회 캡처해 확정 필요(현재 미확보).
- 저장 버튼/트리 셀렉터는 합성+캡처 기반 — 실제 정합성은 수동 검증으로 확정.
- 임시코드 저장의 부수효과("최종 저장 후 카테고리번호/URL 생성" 안내 문구 관련) 없는지 확인.
- 네이티브 alert이 `confirm`(저장 전)·`alert`(저장 후) 모두 나타날 수 있어 둘 다 래핑.
