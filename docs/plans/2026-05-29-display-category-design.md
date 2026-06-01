# 전시카테고리(Display Category) 익스텐션 기능 — 설계

> 작성: 2026-05-29. 브랜드 기능을 본떠 전시카테고리(상위/하위) 미리보기·확인·어드민
> 통합을 추가한다. 환경 구분은 관리코드 접두사(`c_`=운영, `ct_`=개발)로 한다.

## 목표

샵바이 전시카테고리를 군돌이 MD 워크플로에서 다루기 위한 3개 표면을 추가한다.

1. **미리보기** — 실제 스토어프론트 카테고리 내비게이션(상위 탭 + 하위 칩)을 재현.
   노출안함 카테고리는 보이지 않게 한다.
2. **설정 목록(확인용)** — 현재 설정된 상위/하위 카테고리를 접이식 라벨 목록으로 확인.
3. **어드민 통합** — 목록/미리보기에서 카테고리를 고르면 어드민 트리에서 해당 row를 열고,
   편집 폼의 코드 입력란 옆에 `c_`/`ct_` 토큰 가이드를 주입.

자동 채우기(진열 빌더식 fill)는 이번 범위에서 제외한다.

## 핵심 도메인 규칙

- **상위 카테고리(depth 1)** 에만 관리코드(`managementCode`)가 들어가며, 형식은
  `c_<순번>`(운영) 또는 `ct_<순번>`(개발). 기존 `lib/display-id`의 `Env` 체계와 동일.
- **하위 카테고리(depth 2+)** 는 관리코드를 쓰지 않는다.
- **노출여부** 는 편집 폼의 라디오(노출함=Y / 노출안함=N)로 설정된다. 스토어프론트
  프론트 API는 노출함 카테고리만 반환하므로, 프론트 API로 만든 미리보기는 노출 상태를
  자연히 반영한다.
- 상위의 노출된 하위가 0개면(= 하위 전부 노출안함) **하위 칩 행/하위 라벨을 렌더하지 않는다.**
  (Figma SubTab 노드 주석: "하위 카테고리 노출 ON/OFF 가능하도록 개발"과 일치.)

## 데이터 소스 (Shop 프론트 API)

기존 `lib/shopby/api/` 인프라(`shopApiGet`, 고정 `clientId`/헤더)를 재사용한다.

| 용도 | 엔드포인트 | operationId |
|---|---|---|
| 상위 트리 목록 | `GET /categories` (keyword 선택) | `get-categories-by-keyword` |
| 상위의 하위·상세 | `GET /categories/{categoryNo}` | `get-category` |

응답 필드(검증 완료, display-shop-public.yml):
- `multiLevelCategories[]`: `categoryNo`, `depth`, `label`(이름), `managementCode`(코드),
  `content`(HTML), `children[]`.
- 프론트 API라 **노출함 카테고리만** 반환한다(가정 — 구현 시 라이브로 확정).

신규 모듈:
- `lib/shopby/api/categories.ts`
  - `fetchDisplayCategories(keyword?)` → `GET /categories` 평탄화 → 상위 트리.
  - `fetchCategoryDetail(categoryNo)` → `GET /categories/{categoryNo}` → 하위/상세(lazy).
- `lib/shopby/api/types.ts`
  - `DisplayCategoryEntry = { categoryNo: number; name: string; managementCode: string;
    depth: number; children?: DisplayCategoryEntry[] }`

환경 코드 파서:
- `lib/shopby/category-code.ts`
  - `parseCategoryCode(code): { env: 'c' | 'ct'; order: number } | null`
  - 정규식 `^(c|ct)_(\d+)$`. 미일치 시 `null`(미분류).

## 사이드패널 UI — 전시카테고리 탭

`App.tsx`에 `{ id: 'category', label: '전시카테고리' }` 탭을 추가하고, 기존 `EnvToggle`,
`useRemoteList`, showcase 카드 패턴을 재사용한다.

```
[전시카테고리 탭]
┌──────────────────────────────────┐
│ 환경  [ 운영 c ] [ 개발 ct ]            │  ← EnvToggle 재사용
├──────────────────────────────────┤
│ 미리보기 (스토어프론트 목업)             │
│ ‹  홈 │베스트│오늘의딜│할인중│선물하기      │  ← 상위 탭(depth1, env 코드 필터)
│ (전체)(카테고리1)(카테고리2)...           │  ← 선택 상위의 하위 칩(노출된 것만)
├──────────────────────────────────┤
│ 설정 목록 (확인용, 접이식)               │
│ ▸  c_1   베스트            ›        │  ← 상위 행: 행=토글, 우측 아이콘=열기
│ ▾  c_2   오늘의딜          ›        │
│       · 카테고리1                     │  ← 하위 라벨 행(노출된 것만), 클릭=열기
│       · 카테고리2                     │
└──────────────────────────────────┘
```

### 컴포넌트

- `ui/CategoryShowcase.tsx` — 탭 컨테이너. `useRemoteList(fetchDisplayCategories)` + 환경
  토글 + 미리보기 + 설정 목록 조립.
- `ui/CategoryPreview.tsx` — Figma 스토어프론트 목업.
  - `CategoryTabBar` (상위): h-44, Pretendard SemiBold 15px, 선택 시 초록 `#3fb382`
    텍스트 + 하단 보더 2px, 비선택 `#8a8a8a`.
  - `CategoryChipRow` (하위): h-32, radius 99px, px-12/py-7, 선택 채움 `#474747`/`#f7f7f7`,
    비선택 아웃라인 `#dcdcdc`/`#8a8a8a`. 노출된 하위 0개면 행 미렌더.
  - 선택 상위 변경 시 `fetchCategoryDetail`로 하위 lazy 로드.
- `ui/CategoryList.tsx` + `ui/CategoryListItem.tsx` — 접이식 설정 목록.
  - 상위 행: chevron + 코드(`c_N`/`ct_N`) + 순번 + 이름. 기본 접힘. **행 클릭=토글,
    우측 열기 아이콘 클릭=`openCategoryEditor`.**
  - 하위 행: 라벨 형태(노출된 하위만), 클릭=`openCategoryEditor`.

### 상호작용

- 환경 토글은 상위를 `managementCode` 접두사로 필터(운영=`c_`, 개발=`ct_`).
  코드 없는 상위(미분류)는 미리보기·목록에서 제외하고 개수만 작게 표기.
- 미리보기 탭/칩, 설정 목록 항목 → 모두 어드민 트리에서 열기로 연결.

### 디자인 토큰 (style.css 추가)

`--color-category-primary: #3fb382`, `--color-line-strong: #dcdcdc`,
`--color-chip-active-bg: #474747`, `--color-chip-active-text: #f7f7f7`,
`--color-text-alt: #8a8a8a`. 글꼴은 기존 패널 글꼴 유지(Pretendard 가용 시 사용).

## 콘텐츠 스크립트 — 어드민 통합

전시카테고리 편집 폼은 안정적인 `name` 속성이 없어 CSS-모듈 클래스 prefix 셀렉터를 쓴다
(브랜드 트리 `[class*="TreeV2_..."]` 방식과 동일, 빌드 해시 suffix 변동 대비).

`lib/shopby/selectors.ts` 추가:
```ts
export const DISPLAY_CATEGORY_CODE_INPUT_SELECTOR =
  '[class*="display-category-management_input-code__"]';
export const DISPLAY_CATEGORY_NAME_INPUT_SELECTOR =
  '[class*="display-category-management_input-name__"]';
export const DISPLAY_CATEGORY_TREE_SELECTOR =
  '[class*="display-category-management_category-tree__"]';
export const DISPLAY_CATEGORY_NAME_WRAP_SELECTOR =
  '[class*="display-category-management_category-name-wrap__"]';
```

- `lib/shopby/category-editor-open.ts` (`brand-editor-open` 본뜸)
  - 트리에서 이름으로 row 찾기(가상스크롤 대비 단계 스크롤 재사용) → 클릭 → 상위면 코드
    입력란, 하위면 이름 입력란 focus + scrollIntoView.
  - host 가드(`*.shopby.co.kr` / `*.e-ncp.com`)는 브랜드와 공유.
  - **알려진 제약**: 카테고리 이름은 분기별 중복 가능. v1은 첫 매치, 하위는 부모 펼침 후
    best-effort. 중복 위험 코드 주석으로 명시.
- `lib/shopby/category-code-guide.ts` (`brand-extra-info-guide` 본뜸)
  - 코드 입력란을 감지해 옆에 가이드 주입. 내용: 상위는 `c_<순번>`(운영)·`ct_<순번>`(개발),
    하위는 코드 미사용. MutationObserver로 SPA 재렌더 대응. 중복 주입 방지 마커.
- `lib/messaging.ts`: `openCategoryEditor(request: { categoryNo: number; name: string;
  depth: number }): OpenCategoryEditorResult` 추가.
- `entrypoints/content.ts`: `startCategoryCodeGuide(document)` 호출 + `openCategoryEditor`
  핸들러 와이어링.

## 테스트

기존 패턴(jsdom + vitest)을 따르고 80%+ 커버리지를 유지한다.

- `category-code.test.ts` — `c_4`/`ct_4`/빈값/비정상 파싱.
- `api/categories.test.ts` — 평탄화, 상세, 페이징, 에러 정규화.
- `category-editor-open.test.ts` — `admin-display-category.html` 픽스처로 row 매치·클릭·
  focus, wrong-host/not-found.
- `category-code-guide.test.ts` — 코드 입력란 주입·중복 방지·observer 해제.
- `CategoryShowcase/Preview/List.test.tsx` — env 필터, 노출 하위 0개 시 칩 행/하위 라벨
  제거, 토글 vs 열기 분리 동작.

## 비범위 (YAGNI)

- 어드민 폼 자동 채우기(코드/이름/노출 라디오 fill).
- 카테고리 생성·삭제·순서 변경.
- 노출안함 카테고리 표시(프론트 API가 제외하므로 불필요).
- depth 3+ 전용 UI(데이터는 받되 미리보기는 상위/하위 2단까지).

## 검증해야 할 가정

1. 프론트 `GET /categories` 가 노출안함 카테고리를 실제로 제외하는가. (제외하지 않으면
   노출 필드 부재로 별도 처리 필요.)
2. 어드민 전시카테고리 트리의 클릭 가능한 row 구조(`category-name-wrap` 클릭 → SPA 편집
   폼 전환)와 하위 노드 펼침 동작.
3. `managementCode` 가 상위에만 채워지고 하위는 비는지(실데이터 확인).
