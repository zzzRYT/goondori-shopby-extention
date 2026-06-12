import type { Rule } from './rules';

// 설계 결정: 시드 규칙은 전부 OFF(선택 안함)로 제공한다. MD가 필요한 것만 켜서 사용.
export const SEED_RULES: Rule[] = [
  { id: 'seed-manufacturer', type: 'required', section: '기본정보', field: '제조사명', enabled: false },
  { id: 'seed-model-name', type: 'required', section: '기본정보', field: '제품모델명', enabled: false },
  { id: 'seed-weight', type: 'expected', section: '배송정보', field: '상품 중량', op: 'gt', value: '0', enabled: false },
  { id: 'seed-main-image', type: 'image', kind: 'mainRequired', enabled: false },
  { id: 'seed-detail-images', type: 'image', kind: 'detailMin', threshold: 1, enabled: false },
];
