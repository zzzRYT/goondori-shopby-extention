import type { Rule } from './rules';

// MD 큐레이션 체크리스트(상품 승인 단계). 기본 ON·삭제 불가, 토글만 가능 — 로드 시 병합으로 항상 복원.
export const CURATION_RULES: Rule[] = [
  {
    id: 'curation-reverse-margin',
    type: 'derived',
    kind: 'reverseMargin',
    enabled: true,
  },
  {
    id: 'curation-zero-commission',
    type: 'derived',
    kind: 'zeroCommission',
    enabled: true,
  },
  {
    id: 'curation-discount-rate',
    type: 'derived',
    kind: 'discountRateMax',
    threshold: 70,
    enabled: true,
  },
  {
    id: 'curation-main-image',
    type: 'image',
    kind: 'mainRequired',
    enabled: true,
  },
  {
    id: 'curation-detail-position',
    type: 'image',
    kind: 'detailPositionForbidden',
    enabled: true,
  },
  {
    id: 'curation-name-length',
    type: 'derived',
    kind: 'maxLength',
    section: '기본정보',
    field: '상품명',
    threshold: 30,
    enabled: true,
  },
  {
    id: 'curation-service-group',
    type: 'expected',
    section: '배송정보',
    field: '배송구분',
    op: 'notEquals',
    value: '쇼핑몰 배송',
    enabled: true,
  },
  {
    id: 'curation-zero-stock',
    type: 'expected',
    section: '판매정보',
    field: '재고수량',
    op: 'gt',
    value: '0',
    enabled: true,
  },
  {
    id: 'curation-display-category',
    type: 'derived',
    kind: 'displayCategoryMax',
    threshold: 1,
    enabled: true,
  },
  {
    id: 'curation-sale-end-imminent',
    type: 'derived',
    kind: 'saleEndImminent',
    threshold: 5,
    enabled: true,
  },
  {
    id: 'curation-price-ceiling',
    type: 'derived',
    kind: 'priceCeiling',
    threshold: 1_000_000,
    enabled: true,
  },
];

export type CurationMeta = { title: string; note: string };

export const CURATION_META: Record<string, CurationMeta> = {
  'curation-reverse-margin': {
    title: '역마진 경고',
    note: '공급가가 실판매가(즉시할인가)보다 높으면 위반',
  },
  'curation-zero-commission': {
    title: '수수료 0% 경고',
    note: '판매수수료가 0%이고 공급가도 비어 있으면 위반 — 공급가가 채워져 있으면(엑셀 업로드 등) 통과',
  },
  'curation-discount-rate': {
    title: '할인율 이상치',
    note: '할인율이 기준값(%) 이상이면 위반 — 오기입(0 하나 더 붙음 등) 방지',
  },
  'curation-main-image': {
    title: '대표이미지 누락',
    note: '대표(썸네일) 이미지가 없으면 위반',
  },
  'curation-detail-position': {
    title: '상세(상단/하단) 이미지 사용',
    note: '상품 상세(상단)/(하단)에 이미지가 있으면 위반 — 앱에서 표현되지 않는 영역',
  },
  'curation-name-length': {
    title: '상품명 글자수 초과',
    note: '상품명이 기준 글자수를 넘으면 메인 UI에서 깨질 위험',
  },
  'curation-service-group': {
    title: '서비스상품군 방지',
    note: "배송구분이 '쇼핑몰 배송'이면 서비스상품군추정 — 배송상품군은 '파트너사 배송'",
  },
  'curation-zero-stock': {
    title: '재고 0개 경고',
    note: '재고수량이 0이면 앱에서 품절로 노출',
  },
  'curation-display-category': {
    title: '전시카테고리 중복(1개 초과)',
    note: '전시카테고리가 2개 이상이면 오등록(예: 테크 외 상품의 테크 등록) 가능성',
  },
  'curation-sale-end-imminent': {
    title: '판매 종료 임박',
    note: '판매기간 종료일이 오늘 기준 기준값(일) 이내면 위반 — 곧 품절/내려갈 상품',
  },
  'curation-price-ceiling': {
    title: '가격 상한 초과(오기입 방지)',
    note: '판매가·즉시할인가가 기준값(원)을 넘으면 위반 — 0 더 붙는 등 가격 오기입 방지',
  },
};

export function isCurationRule(id: string): boolean {
  return id in CURATION_META;
}

// 기본 큐레이션 중 MD가 임계값을 직접 편집할 수 있는 규칙의 단위 표기.
export const CURATION_THRESHOLD_UNITS: Record<string, string> = {
  'curation-discount-rate': '%',
  'curation-name-length': '자',
  'curation-sale-end-imminent': '일',
  'curation-price-ceiling': '원',
};

// 코드가 정의한 기본 임계값(빈 입력 시 적용). CURATION_RULES에서 파생 — 중복 상수 방지.
const CURATION_THRESHOLD_DEFAULTS = new Map<string, number>(
  CURATION_RULES.flatMap((rule) =>
    rule.type === 'derived' && rule.threshold !== undefined
      ? [[rule.id, rule.threshold] as const]
      : [],
  ),
);

export function curationThresholdDefault(id: string): number | undefined {
  return CURATION_THRESHOLD_DEFAULTS.get(id);
}

// 파생 규칙의 threshold와 enabled은 사용자 소유 — 저장본을 우선 적용하고, 비었으면 코드 기본값.
// 비-큐레이션(시드·커스텀)만 순서 그대로 뒤에 유지한다.
// curation- 접두인데 현재 메타에 없는 ID(구버전 기본 규칙)는 제거 — 옛 저장본을 자동 마이그레이션한다.
// 변경이 없으면 원본 배열 참조를 그대로 돌려준다(불필요한 storage 쓰기 방지).
export function mergeCurationRules(saved: Rule[]): Rule[] {
  const savedById = new Map(saved.map((rule) => [rule.id, rule]));
  const reconciledCuration = CURATION_RULES.map((codeRule) => {
    const savedRule = savedById.get(codeRule.id);
    if (!savedRule) return codeRule;
    // 파생 규칙의 threshold는 enabled과 함께 사용자 소유 — 저장본 우선, 비었으면 코드 기본값.
    if (
      codeRule.type === 'derived' &&
      savedRule.type === 'derived' &&
      codeRule.threshold !== undefined
    ) {
      return {
        ...codeRule,
        enabled: savedRule.enabled,
        threshold: savedRule.threshold ?? codeRule.threshold,
      };
    }
    return { ...codeRule, enabled: savedRule.enabled };
  });
  const rest = saved.filter((rule) => !rule.id.startsWith('curation-'));
  const next = [...reconciledCuration, ...rest];
  return JSON.stringify(next) === JSON.stringify(saved) ? saved : next;
}
