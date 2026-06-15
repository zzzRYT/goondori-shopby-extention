# 수정 심사(변경 전/후) diff 큐레이션

날짜: 2026-06-15

## 문제

심사 스캔은 현재 **상품 등록 심사만** 처리한다. 수정 심사(이미 승인된 상품의 변경
요청, 목록 상태 "수정 후 승인대기" = `AFTER_APPROVAL_READY`) 상품을 만나면 팝업
파싱이 영원히 실패해 **타임아웃**으로 빠진다.

원인: 수정 심사 팝업은 등록 심사 팝업과 DOM 구조가 다르다.

- 등록: `항목 | 등록정보 | 수정필요항목`(3열), `기본정보·판매정보·배송정보·이미지정보` 등 전체 섹션
- 수정: `항목 | 변경 전 등록정보 | 변경 후 등록정보 | 수정필요항목`(4열), **변경된 섹션만**(예: 판매정보만)

`parseScreeningDocument`(`lib/shopby/screening/popup-parser.ts:53`)는 `기본정보·판매정보·배송정보`가
모두 있어야 파싱 성공으로 본다. 수정 팝업엔 `기본정보·배송정보`가 없어 항상 `null` →
`waitForScreeningParse`가 15초 폴링 후 `not-rendered` → `scanOne`이 1회 재시도(또 15초) →
`'수집 실패(타임아웃)'`.

## 목표

수정 심사 상품도 스캔에 포함한다. 단, 수정 팝업엔 **변경된 필드만** 들어 있어 기존
큐레이션 규칙(브랜드 필수·검색어·배송구분 등)은 검사 대상 필드가 화면에 없어 적용
불가하다. 따라서 수정 항목은 **규칙 평가 없이 변경 내역(diff)을 그대로, 무조건 노출**한다
(이미 검증이 끝난 상품의 변경이므로 "무엇이 바뀌었는지"를 빠짐없이 보여주는 게 목적).

결과 패널에서 등록 심사와 수정 심사를 **세그먼트 필터(전체/등록/수정)**로 분리해 확인한다.

### 설계 결정(확정)

- 수정 결과는 **순수 diff**: 각 변경 필드를 `항목: 변경전 → 변경후`로 노출, 규칙 평가 없음.
- 분리 UX는 **세그먼트 필터**(기존 "위반만 보기" 옆에 전체/등록/수정 토글).
- 목록의 `applyStatus`는 **수집하지 않는다**. 팝업 구조가 self-describing이라 **파서가 종류를
  판별**한다 — 더 견고하고 `collect.ts`/`list-harvest.ts` 변경이 불필요.
- v1은 **텍스트 diff** 기준. 이미지 변경(before/after 썸네일)은 텍스트가 비어 diff가 빈약할
  수 있어 후속으로 둔다(알려진 한계).

## 접근

### 1) 파서: 종류 판별 + diff 파싱 (`popup-parser.ts`, `types.ts`)

파서를 판별 유니온 반환으로 전환:

```ts
type ScreeningChange = { section: string; label: string; before: string; after: string };

type ParsedScreening =
  | { kind: 'register'; product: ParsedScreeningProduct }
  | { kind: 'modify'; changes: ScreeningChange[] };
```

종류 판별(CSS 해시 무관, 텍스트 앵커링):

- 어떤 섹션 테이블의 헤더(`th`)에 `"변경 전"`/`"변경 후"`가 있으면 → 수정 팝업
- 없으면 → 기존 등록 파서 경로

수정 파싱:

- `변경 전/후` 헤더를 가진 테이블만 순회 → 각 데이터 행에서 `cells[0]=항목`,
  `cells[1]=변경전`, `cells[2]=변경후`
- 섹션명은 기존처럼 `[class*="Layout_view-title"]`에서 취득(예: `판매정보 · 즉시할인`)
- `별도 승인거부 의견`(변경전/후 헤더 없음)·`수정필요항목` 체크박스 열은 자연히 제외

렌더 완료 신호(= 타임아웃 해결의 핵심):

- 등록: 기존(`기본정보·판매정보·배송정보` 모두 존재)
- 수정: `변경 전/후` 헤더 테이블 ≥1개 + 데이터 행 ≥1개

`parseScreeningDocument`가 `ParsedScreening | null`을 반환하도록 바꾸면
`waitForScreeningParse`는 non-null일 때 `ok`를 돌려주어 두 종류 모두 자동 처리된다 —
더는 폴링하다 타임아웃 나지 않는다. `ScreeningPopupResult`의 `ok` 변형도 같은 유니온을
품도록 확장한다.

### 2) 스캔 결과 모델 & 라우팅 (`run-scan.ts`)

```ts
type ScreeningResult = {
  productNo: string;
  productName: string;
  kind: 'register' | 'modify';   // 신규
  status: 'ok' | 'failed';
  violations: Violation[];        // register 전용 (modify는 항상 [])
  changes: ScreeningChange[];     // modify 전용 (register는 항상 [])
  failReason?: string;
};
```

결과 조립 분기(워커 내부):

- `parsed.kind === 'register'` → 기존대로 `evaluate(product, rules)` → `violations`
- `parsed.kind === 'modify'` → 규칙 평가 안 함, `changes`만 채움, `violations: []`

변경 없는 부분: `scanOne`의 팝업 열기/재시도/세션만료, 워커 풀(`SCAN_CONCURRENCY=4`),
진행률/취소/세션만료 처리 모두 그대로. `collect.ts`·`list-harvest.ts`는 손대지 않는다.
`scanOne` 반환 타입만 `kind`를 품도록 확장(파서가 이미 판별 유니온을 반환하므로 그대로 전달).

설계 노트: `violations`/`changes`를 한 타입에 두되 종류별로 한쪽만 채운다 — 분리 타입보다
UI 정렬·필터가 단순하다.

### 3) 결과 UI: 세그먼트 필터 + diff 카드 (`ScreeningResults.tsx`)

기존 "위반만 보기" 옆에 세그먼트 필터 추가: `[전체] [등록] [수정]`.

필터 합성 규칙:

- 세그먼트가 먼저 종류를 거름: 전체(둘 다) / 등록(register만) / 수정(modify만)
- "위반만 보기"는 **등록 항목에만** 적용(수정엔 위반 개념 없음)
- 수정 항목은 **무조건 노출** — "위반만 보기"가 켜져 있어도 자기 세그먼트가 활성이면 항상 보임

카드 표시:

- 등록: 기존 그대로(✅/⚠/✖, 위반 목록)
- 수정: 아이콘 `✎`, 제목 `✎ {productNo} {productName} · 변경 {N}건`, 그 아래 변경 행:
  `· 판매정보 · 즉시할인: 15,000원 → 20,000원`
- 카드 클릭 시 기존처럼 상품 팝업 열기(`onOpen`)

헤더 카운트: "등록 위반 N · 수정 K · 전체 M건"으로 종류별 카운트 노출.

정렬: 등록은 위반 수 내림차순(기존), 수정은 변경 수 내림차순. `전체` 보기에선 종류로 1차
그룹핑 후 각자 정렬하며 **수정을 위로**(검증 끝난 상품의 변경을 먼저 띄움).

## 테스트

새 픽스처: `tests/fixtures/admin-screening-popup-modify.html` — 4열 `변경 전/후` 테이블 +
`별도 승인거부 의견` 섹션. 이미지 변경 행을 한 줄 넣어 "텍스트 비는 케이스"를 박제.

`popup-parser.test.ts`(추가):

- 수정 팝업 → `kind:'modify'`, `changes`에 `즉시할인 15,000원→20,000원`·
  `즉시할인가 24,900원→19,900원` 파싱
- `별도 승인거부 의견`·`수정필요항목` 체크박스 열은 changes에서 제외
- 등록 픽스처는 여전히 `kind:'register'`(회귀)
- `변경 전/후` 헤더만 있고 데이터 행 0 → null(렌더 미완료) → 폴링 지속
- 렌더 완료 후 `waitForScreeningParse`가 두 종류 모두 `ok` 반환

`run-scan.test.ts`(추가):

- 페이크 ports가 modify 파싱 반환 → `kind:'modify'`·`changes` 채워지고 `violations:[]`,
  규칙 평가 호출 안 됨
- 등록·수정 혼합 목록 → 한 스캔에서 종류별로 올바르게 조립
- 수정 팝업이 더는 타임아웃 `failed`로 빠지지 않음(핵심 회귀 방지)

`ScreeningResults.test.tsx`(추가):

- 세그먼트 `수정` → 수정 카드만
- "위반만 보기" ON + 수정 항목 → 여전히 표시(무조건 노출)
- "위반만 보기" ON + 위반 없는 등록 항목 → 숨김(기존 동작 유지)
- 수정 카드가 `변경전 → 변경후` 렌더

전부 기존 vitest/jsdom 패턴 사용.

## 영향 범위

- 변경: `popup-parser.ts`·`types.ts`·`run-scan.ts`·`ScreeningResults.tsx` + 새 픽스처/테스트.
- 무변경: `collect.ts`·`list-harvest.ts`·`rules.ts`·`curation-rules.ts`·`popup-url.ts`·스캔 워커 풀.
- 위험: 낮음. 등록 경로는 동작 보존(회귀 테스트로 고정), 수정 경로는 신규 추가.
- 핵심 효과: 수정 심사 상품 타임아웃 제거 + 변경 내역을 검수 리스트에서 분리 확인.
