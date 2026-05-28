import type { FieldMap } from './fill';

// 정찰(docs/recon.md): 셀렉터는 enterprise-remote.shopby.co.kr iframe 내부 폼 기준.
// 안정적인 name 속성을 사용한다. CSS 모듈 클래스(Input_input-field__cserq 등)는
// 빌드 해시라 셀렉터로 부적합.
export const DISPLAY_FIELD_MAP: FieldMap = {
  displayId: 'input[name="sectionId"]',
  title: 'input[name="title"]',
  color: 'input[name="sectionExplain"]',
};
