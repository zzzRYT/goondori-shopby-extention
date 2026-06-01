import type { FieldMap } from './fill';

// 정찰(docs/recon.md): 셀렉터는 enterprise-remote.shopby.co.kr iframe 내부 폼 기준.
// 안정적인 name 속성을 사용한다. CSS 모듈 클래스(Input_input-field__cserq 등)는
// 빌드 해시라 셀렉터로 부적합.
export const DISPLAY_FIELD_MAP: FieldMap = {
  displayId: 'input[name="sectionId"]',
  title: 'input[name="title"]',
  color: 'input[name="sectionExplain"]',
};

// 배너 폼은 구좌(account) 단위로 name이 인덱싱돼 있다: accounts.{i}.*
// 메인 배너는 구좌 최대 2개, 띠 배너는 최대 20개라 0~19까지 매핑한다.
export type BannerFieldName =
  | 'accountName'
  | 'width'
  | 'height'
  | 'landingUrl'
  | 'bannerName';

const BANNER_MAX_ACCOUNTS = 20;

export function bannerFieldKey(
  accountIndex: number,
  field: BannerFieldName,
): string {
  return `account${accountIndex}.${field}`;
}

function accountSelectors(i: number): FieldMap {
  return {
    [bannerFieldKey(i, 'accountName')]:
      `input[name="accounts.${i}.accountName"]`,
    [bannerFieldKey(i, 'width')]: `input[name="accounts.${i}.width"]`,
    [bannerFieldKey(i, 'height')]: `input[name="accounts.${i}.height"]`,
    [bannerFieldKey(i, 'landingUrl')]:
      `input[name="accounts.${i}.banners.0.landingUrlValue.landingUrl"]`,
    [bannerFieldKey(i, 'bannerName')]:
      `input[name="accounts.${i}.banners.0.bannerName"]`,
  };
}

export const BANNER_FIELD_MAP: FieldMap = Object.assign(
  {},
  ...Array.from({ length: BANNER_MAX_ACCOUNTS }, (_, i) => accountSelectors(i)),
);

// 브랜드 수정 페이지 "추가 설명"(extraInfo) input. 가이드 inject 대상.
// 실제 DOM은 textarea가 아니라 input이고 name이 "brandInfo.extraInfo"다(2026-06 확인).
export const EXTRA_INFO_INPUT_SELECTOR = 'input[name="brandInfo.extraInfo"]';

// 브랜드 관리 페이지 좌측 트리(TreeV2). 클래스명 suffix(예: __HFKaJ)는
// CSS 모듈 빌드 해시라 변경 가능성이 있어 prefix 기반 substring 매칭을 쓴다.
// 클릭 타깃은 item-label(드래그 가능, selected 상태 마커가 붙는 곳).
export const BRAND_TREE_CONTAINER_SELECTOR = '[class*="TreeV2_tree__"]';
export const BRAND_TREE_ITEM_LABEL_SELECTOR = '[class*="TreeV2_item-label__"]';
export const BRAND_TREE_CONTENT_SELECTOR = '[class*="TreeV2_content__"]';

// 전시카테고리 편집 페이지. name 속성이 없어 CSS 모듈 클래스 prefix(substring) 매칭.
// suffix(__0-V7R 등)는 빌드 해시라 변동 가능.
export const DISPLAY_CATEGORY_CODE_INPUT_SELECTOR =
  '[class*="display-category-management_input-code__"]';
export const DISPLAY_CATEGORY_NAME_INPUT_SELECTOR =
  '[class*="display-category-management_input-name__"]';
export const DISPLAY_CATEGORY_TREE_SELECTOR =
  '[class*="display-category-management_category-tree__"]';
export const DISPLAY_CATEGORY_NAME_WRAP_SELECTOR =
  '[class*="display-category-management_category-name-wrap__"]';
// 전시카테고리 트리도 브랜드와 동일한 TreeV2 컴포넌트(중첩 계층)다. 클릭 타깃은 item-label.
export const DISPLAY_CATEGORY_ITEM_LABEL_SELECTOR = '[class*="TreeV2_item-label__"]';
// 트리 상단 "전체 열기"/"전체 닫기" 버튼(같은 클래스) — 텍스트로 구분해 "전체 열기"만 클릭.
export const DISPLAY_CATEGORY_TREE_TOOL_BUTTON_SELECTOR =
  '[class*="display-category-management_right-btn__"]';
