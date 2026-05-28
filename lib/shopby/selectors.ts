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

// 브랜드 수정 페이지 "추가 설명"(extraInfo) textarea. 가이드 inject 대상.
export const EXTRA_INFO_TEXTAREA_SELECTOR = 'textarea[name="extraInfo"]';
