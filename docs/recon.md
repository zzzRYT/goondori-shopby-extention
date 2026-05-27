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

- **content script는 `enterprise-remote.shopby.co.kr`에 `all_frames: true`로 주입**해야
  iframe 내부 폼에 닿는다. 부모 페이지(`*.shopby.co.kr`)에 주입해도 cross-origin이라
  iframe DOM에 접근 불가.
- 사이드패널 → 채우기 메시지는 **iframe 프레임의 content script**로 전달돼야 한다
  (탭 전체 브로드캐스트 또는 frameId 지정).
- `host_permissions` / content `matches`에 `https://enterprise-remote.shopby.co.kr/*` 필요.

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

### 배너 수정 (`/appearance/custom/headless-banners/edit`) — 미확정

- `name` 속성은 `groupNo` 1개뿐. 구좌("구좌 1")·콘텐츠("배너 콘텐츠 1") 반복 블록.
- 핵심 필드: 구좌명(`구좌명을 입력 해주세요` placeholder), 사이즈(16:9/3:2 토글), 노출 설정,
  노출 기간, 랜딩 URL(`랜딩 URL` th). 라벨/placeholder 기준 셀렉터 전략 필요. → Stage 6.

### 브랜드 관리 (`/product/categorization/brand`)

- 브랜드 상세 폼: `input[name="brandInfo.mainBrandName"]`, 브랜드 번호는 `<td>43186744</td>` 텍스트.
- 좌측 브랜드 목록(버튼 204개)에 이름+번호 존재 → API 없어도 `AdminPageBrandSource`(HTML 파싱) 가능.
- 단, 더 안정적인 API가 있는지 Network 탭 확인 필요(미답).

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
