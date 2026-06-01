# 샵바이 어드민 정찰 메모 (Task 4.0)

> 최초 작성: 2026-05-27. 어드민 페이지 DOM/네트워크 구조를 기록해 Stage 4~6 셀렉터·브랜드 소스 구현의 근거로 삼는다.

## ⚠️ 핵심 발견: 편집 폼은 cross-origin iframe 안에 있다

샵바이 엔터프라이즈 어드민은 **껍데기 셸(부모 페이지)** 안에 실제 편집 UI를
**다른 origin의 iframe**으로 띄운다. 즉 우리가 채워야 할 입력 필드는 부모 문서가
아니라 iframe 문서 안에 있다.

```
부모 페이지 (*.shopby.co.kr 셸)
└─ #content > .iframe-wrap > iframe.remote
   └─ https://enterprise-remote.shopby.co.kr/...  ← 실제 폼이 여기 렌더됨
```

| 관리 페이지 | iframe src (실제 폼 origin: `enterprise-remote.shopby.co.kr`) |
|---|---|
| 상품 진열 수정 | `/appearance/custom/product-main/edit?sectionNo={진열번호}&mallNo={몰번호}&serviceType=PREMIUM` |
| 헤드리스 배너 수정 | `/appearance/custom/headless-banners/edit?bannerNo={배너번호}&mallNo={몰번호}&serviceType=PREMIUM` |
| 브랜드 관리 | `/product/categorization/brand?serviceType=PREMIUM` |

> 부모 셸 상단에도 width/height 0짜리 인증용 iframe(`enterprise-remote.shopby.co.kr?serviceType=PREMIUM`)이 있다.

### 아키텍처 영향 (중요)

- 정찰 당시 폼은 `enterprise-remote.shopby.co.kr` iframe에서 렌더됐지만, 라이브 환경에선
  부모 셸인 `service.shopby.co.kr/appearance/custom/headless-banners/edit`에서 폼이 직접
  렌더되는 경우가 확인됐다(2026-05-28). 어느 origin에 떨어져도 위젯이 닿도록 content
  script `matches`는 `https://*.shopby.co.kr/*` + `allFrames: true`로 잡는다.
- 사이드패널 → 채우기 메시지는 폼이 위치한 프레임의 content script로 전달돼야 한다
  (탭 전체 브로드캐스트 또는 frameId 지정).
- `host_permissions`도 `https://*.shopby.co.kr/*`로 동일 범위.

## 캡처 현황

`tests/fixtures/`의 3개 HTML 덤프는 **iframe 내부 폼(enterprise-remote)** 으로 재캡처 완료.
실제 입력 필드가 모두 들어 있어 셀렉터 추출 가능.

- [x] 어드민이 iframe 아키텍처임을 확인
- [x] 3개 페이지의 iframe URL·쿼리 파라미터 확보
- [x] iframe 내부 폼 HTML (상품 진열 / 배너 / 브랜드) 확보
- [x] 진열 페이지 셀렉터 확정 (아래)
- [ ] 부모 어드민 origin 확정 (주소창 URL) — content script는 remote origin 기준이라 채우기엔 불필요. 사이드패널 트리거 가드용으로만 선택적.
- [ ] 배너 페이지 셀렉터 — 구좌/콘텐츠 반복 구조, 안정 `name` 거의 없음(라벨 기반 필요). Stage 6.
- [ ] 브랜드 목록 XHR 존재 여부 (Network 탭) — Stage 5 분기 결정

## 확정 셀렉터

### 진열 수정 (`/appearance/custom/product-main/edit`)

안정적인 `name` 속성 사용. CSS 모듈 클래스(`Input_input-field__cserq` 등)는
빌드 해시라 셀렉터로 부적합.

| 필드 | 셀렉터 | 비고 |
|---|---|---|
| 진열 ID | `input[name="sectionId"]` | placeholder "ID 입력", maxlength 20. 예: `ct_3_s_b_43215615` |
| 진열명 | `input[name="title"]` | placeholder "진열명을 입력해주세요", maxlength 50 |
| 진열 상세설명(색상) | `input[name="sectionExplain"]` | placeholder "진열 상세설명을…", maxlength 100 |

> 노출여부/진열순서는 라디오·수동진열 UI라 자동 채움 대상에서 제외(사람이 설정).

### 배너 수정 (`/appearance/custom/headless-banners/edit`)

> 정정: 초기에 "안정 name 없음"으로 봤으나 **오판**이었다. `<input>`과 `name=`이
> 여러 줄로 나뉘어 단일 줄 grep이 놓쳤을 뿐, 실제로는 인덱스 dotted `name`이 있다.

구좌(account) 0/1 두 개, 각 구좌에 콘텐츠(banners.0)가 달린 구조.

| 레벨 | 필드 | 셀렉터 (`i` = 구좌 인덱스 0·1) |
|---|---|---|
| 구좌 | 구좌명 | `input[name="accounts.{i}.accountName"]` |
| 구좌 | 사이즈 가로/세로 | `input[name="accounts.{i}.width"]` / `.height` |
| 콘텐츠 | 콘텐츠명 | `input[name="accounts.{i}.banners.0.bannerName"]` |
| 콘텐츠 | 랜딩 URL | `input[name="accounts.{i}.banners.0.landingUrlValue.landingUrl"]` |
| 콘텐츠 | 동영상 URL | `input[name="accounts.{i}.banners.0.videoUrl"]` |
| 콘텐츠 | 추가입력항목 | `input[name="accounts.{i}.banners.0.extraInfo"]` |

- 사용 여부(구좌별 라디오 Y/N), 노출 설정(랜덤/순차 버튼), 노출 기간(날짜+요일),
  이미지 업로드는 단순 텍스트 채움 대상 아님 → 사람이 설정.
- 메인 배너: 16:9 1개 + 3:2 1개 중 **하나만** 사용(구좌 인덱스 선택 필요).
- 띠 배너: `accountName`에 **연결할 진열 ID**를 넣음(자유입력 아님). 비율 무시.
- 사용 여부(Y/N)·노출 기간(상시/기간)은 name 없는 라디오 → 콘텐츠 테이블(bannerName 앵커)
  + th 라벨로 탐색해 클릭. 날짜(데이트피커)는 자동화 제외(사람이 입력).

#### 띠 / 메인 모드 판별 (Phase 1 정찰 결과)

- URL은 메인·띠 동일(`/appearance/custom/headless-banners/edit?bannerNo=…`).
  쿼리 `bannerNo`만 다르며 타입을 명시하는 쿼리는 없다.
- 폼 상단의 **배너명 input**으로 판별:
  - 셀렉터: `input[name="sectionName"]` (placeholder `"배너명을 입력해주세요."`, maxlength 20)
  - 띠 모드: value에 `"띠배너"` 포함 (예: `스토어_띠배너`, `스토어_띠배너_테스트`)
  - 메인 모드: value에 `"메인배너"` 포함 (예: `스토어_메인배너`, `스토어_메인배너_테스트`)
- 인라인 진열 선택기는 **띠 모드일 때만** 부착한다(메인 배너의 `accountName`은 자유입력 구좌명이라 부착하면 안 됨).
- SPA가 비동기로 폼을 렌더하므로 `sectionName` 등장과 value 채워짐을 MutationObserver로 함께 감시해야 한다.

### 노출 설정 팝업 (`popup-remote.shopby.co.kr`) — 또 다른 origin

배너 구좌의 **"노출 설정" 버튼**을 누르면 `popup-remote.shopby.co.kr`에 별도 페이지가
뜬다(enterprise-remote와 다른 origin → content script가 이 origin도 매칭해야 함).

- 노출 방식 라디오: `랜덤(RANDOM)` / `순차(SEQUENTIAL)` — name 없음, `th "노출 방식"` 앵커로 탐색.
- 그 외 플랫폼 구분/회원등급·그룹 노출 설정 라디오도 있으나 v1 범위 밖.
- 저장 버튼(`[data-testid="submit-button-group-confirm"]`)은 **누르지 않는다**(사람이 저장).
- ⚠️ 라우팅 리스크: 이 팝업이 새 탭/창/모달 iframe 중 무엇인지에 따라 background의
  active-tab 메시지가 닿는 방식이 달라진다 → 실동작 검증 필요.

### 브랜드 관리 (`/product/categorization/brand`)

- 브랜드 상세 폼: `input[name="brandInfo.mainBrandName"]`, 브랜드 번호는 `<td>43186744</td>` 텍스트.
- 좌측 브랜드 목록(버튼 204개)에 이름+번호 존재 → API 없어도 `AdminPageBrandSource`(HTML 파싱) 가능.
- 단, 더 안정적인 API가 있는지 Network 탭 확인 필요(미답).
- 브랜드 수정 페이지 "추가 설명"(extraInfo) 입력란: `input[name="brandInfo.extraInfo"]` (2026-06 실제 DOM 확인 — textarea가 아니라 input, `.input-field` 래퍼 안에 있음). 군돌이 토큰 가이드 inject 대상.

## 브랜드 소스 (Stage 5 분기) — 미확정

브랜드 관리 페이지(`/product/categorization/brand`)에서 브랜드 목록을 불러오는
XHR/fetch가 있는지 확인 필요. enterprise-remote SPA이므로 API 호출 가능성이 높다.

- API 있음 → `ShopbyApiBrandSource` (응답 JSON 정규화)
- API 없음(HTML 박힘) → `AdminPageBrandSource` (브랜드 iframe HTML 파싱)

## 재캡처 방법 (iframe 내부)

DevTools에서 iframe **내부** 문서를 떠야 한다:
1. 폼이 화면에 완전히 보일 때까지 기다린다.
2. iframe 폼 영역 안에서 우클릭 → **검사(Inspect)** → Elements 탭이 iframe 문서로 진입.
3. 그 문서의 최상위 `<html>` 우클릭 → Copy → **Copy outerHTML**.
4. 또는 Console에서 컨텍스트 드롭다운을 `enterprise-remote.shopby.co.kr`(iframe)로
   바꾼 뒤 `copy(document.documentElement.outerHTML)` 실행.
