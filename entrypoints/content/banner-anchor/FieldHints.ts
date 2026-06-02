// `shopby-display.md` 3-3 / 3-4 「설정 필드」 표를 가져와, 헤드리스 배너 페이지 안의
// 각 input 옆/아래에 띄울 한 줄 가이드 스펙. MD가 필드명만 보고 자주 헷갈리는 지점을
// 입력 시점에서 바로 잡아주는 게 목적이라, 무게가 다른 톤 두 가지만 둔다.
//
// - `info`: 단순 안내(앱에 노출 안 됨, 자유 입력 가능 등).
// - `warn`: 실수가 잦거나 후속 비용이 큰 항목(랜딩 URL, 비율 규칙, 진열 ID 등).

export type HintTone = 'info' | 'warn';

// 가이드를 붙일 대상 요소를 찾는 방식.
// - CSS 셀렉터 문자열: input[name=...] 처럼 안정 셀렉터가 있는 경우.
// - 함수: name 속성이 없고 컨테이너 클래스가 빌드 해시인 경우(예: h3 텍스트로 식별).
export type FieldHintFinder = string | ((root: ParentNode) => Element[]);

export type FieldHintSpec = {
  // 부착 대상을 찾는 셀렉터/함수.
  find: FieldHintFinder;
  // 힌트 박스를 둘 위치. target.closest(anchorSelector)의 다음 sibling에 둔다.
  // 미지정 시 target 자체의 next sibling. flex 셀이나 좁은 input 옆엔 어색해서
  // 한 줄 아래로 빼는 용도로 사용한다.
  anchorSelector?: string;
  tone: HintTone;
  message: string;
};

// "구좌 N" 헤더 컨테이너(라디오 그룹을 포함한 상단 박스)를 찾는다.
// 클래스가 CSS module 해시(`headless-banners-registration_top__Nm8LY`)라 불안정하므로,
// 안정 시그널인 h3 텍스트를 기준으로 부모 div를 잡는다. 결과 요소의 다음 sibling에
// 힌트가 들어가므로 라디오 바로 아래, 구좌명/사이즈 위에 떨어진다.
function findAccountToggleHeader(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll('h3')).flatMap((h3) => {
    const text = h3.textContent?.trim() ?? '';
    if (!/^구좌\s*\d+/.test(text)) return [];
    return h3.parentElement ? [h3.parentElement] : [];
  });
}

// shopby-display.md 3-4 「띠 배너 설정」.
// 띠배너만의 핵심 규칙: 구좌명에는 진열 ID, 비율은 무시(가로 16 고정·세로만 84/104).
export const STRIP_BANNER_HINTS: readonly FieldHintSpec[] = [
  {
    find: 'input[name^="accounts."][name$=".accountName"]',
    anchorSelector: '.input-container',
    tone: 'warn',
    message:
      '구좌명이 아니라 「연결할 진열 ID」를 그대로 입력하세요. (자유 입력 금지)',
  },
  {
    find: 'input[name^="accounts."][name$=".width"]',
    anchorSelector: '.flex-wrap',
    tone: 'info',
    message: '띠배너는 가로 16 고정 · 세로만 84 또는 104로 입력하세요.',
  },
  {
    find: 'input[name^="accounts."][name$=".banners.0.bannerName"]',
    anchorSelector: 'td',
    tone: 'info',
    message: 'MD 식별용 필드입니다 — 앱에는 표시되지 않습니다.',
  },
  {
    find: 'input[name^="accounts."][name$=".banners.0.landingUrlValue.landingUrl"]',
    anchorSelector: 'td',
    tone: 'warn',
    message: '랜딩 URL은 앱 개발자와 사전 협의 후 입력하세요.',
  },
];

// shopby-display.md 3-3 「메인 배너 설정」.
// 메인배너만의 핵심 규칙: 16:9 또는 3:2 한 구좌만 「사용」, 구좌명은 자유 입력.
// "두 구좌 중 하나만 사용" 규칙은 사이즈 input이 아니라 「구좌 사용 여부」 라디오 옆에 띄운다.
export const MAIN_BANNER_HINTS: readonly FieldHintSpec[] = [
  {
    find: findAccountToggleHeader,
    tone: 'warn',
    message:
      '16:9 / 3:2 두 구좌 중 「하나만」 「사용」으로, 나머지는 「사용 안 함」으로 설정하세요.',
  },
  {
    find: 'input[name^="accounts."][name$=".accountName"]',
    anchorSelector: '.input-container',
    tone: 'info',
    message:
      'MD가 자유롭게 사용하는 식별 필드입니다 — 앱에는 노출되지 않습니다.',
  },
  {
    find: 'input[name^="accounts."][name$=".width"]',
    anchorSelector: '.flex-wrap',
    tone: 'warn',
    message:
      '사이즈는 16:9 또는 3:2 만 입력하세요. (그 외 입력 시 기본값 16:9 적용)',
  },
  {
    find: 'input[name^="accounts."][name$=".banners.0.bannerName"]',
    anchorSelector: 'td',
    tone: 'info',
    message: 'MD 식별용 필드입니다 — 앱에는 표시되지 않습니다.',
  },
  {
    find: 'input[name^="accounts."][name$=".banners.0.landingUrlValue.landingUrl"]',
    anchorSelector: 'td',
    tone: 'warn',
    message: '랜딩 URL은 앱 개발자와 사전 협의 후 입력하세요.',
  },
];
