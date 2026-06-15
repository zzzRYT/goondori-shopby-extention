import type { Rule } from './rules';

// 운영팀의 '알려진 큐레이션' 체크리스트. 시드 규칙(전부 OFF, 삭제 가능)과 달리
// 기본 ON으로 제공하고 목록에서 삭제할 수 없다 — 로드 시 병합으로 항상 복원. 켜고 끄기만 가능.
export const CURATION_RULES: Rule[] = [
  { id: 'curation-brand', type: 'required', section: '기본정보', field: '브랜드', enabled: true },
  { id: 'curation-detail-position', type: 'image', kind: 'detailPositionForbidden', enabled: true },
  { id: 'curation-search-keyword', type: 'required', section: '기본정보', field: '검색어', enabled: true },
  { id: 'curation-deliverable-only', type: 'required', section: '배송정보', field: '배송구분', enabled: true },
  {
    id: 'curation-partner-delivery',
    type: 'expected',
    section: '배송정보',
    field: '배송구분',
    op: 'equals',
    value: '파트너사 배송',
    enabled: true,
  },
  { id: 'curation-partner-product', type: 'required', section: '기본정보', field: '파트너사', enabled: true },
];

export type CurationMeta = { title: string; note: string };

export const CURATION_META: Record<string, CurationMeta> = {
  'curation-brand': { title: '브랜드 검수', note: '브랜드가 지정되어 있는지 확인' },
  'curation-detail-position': {
    title: '상세 상단/하단 이미지 금지',
    note: '상품 상세(상단)/(하단)은 앱에서 표현되지 않음',
  },
  'curation-search-keyword': { title: '검색어 입력 확인', note: '검색어가 비어 있으면 위반' },
  'curation-deliverable-only': {
    title: '서비스 상품 금지(배송상품만)',
    note: '배송구분이 비어 있으면 배송상품이 아닐 가능성',
  },
  'curation-partner-delivery': {
    title: '쇼핑몰 배송 금지',
    note: '배송구분은 파트너사 배송이어야 함',
  },
  'curation-partner-product': {
    title: '쇼핑몰 자체 상품 금지',
    note: '파트너사가 비어 있으면 쇼핑몰 상품',
  },
};

export function isCurationRule(id: string): boolean {
  return id in CURATION_META;
}

// 큐레이션 규칙의 '정의'(type·section·field·op·kind 등)는 코드가 정답이다.
// 저장본에서 가져오는 건 MD가 끈 상태(enabled)뿐 — 코드에서 규칙 정의를 바꾸면
// 기존 사용자의 storage도 다음 로드에서 자동 교정된다(예: 검색어 empty→required 전환).
// 비-큐레이션(시드·커스텀) 규칙은 순서 그대로 뒤에 유지한다.
// 변경이 없으면 원본 배열 참조를 그대로 돌려준다 — 불필요한 storage 쓰기 방지.
export function mergeCurationRules(saved: Rule[]): Rule[] {
  const enabledById = new Map(saved.map((rule) => [rule.id, rule.enabled]));
  const reconciledCuration = CURATION_RULES.map((rule) => {
    const enabled = enabledById.get(rule.id);
    return enabled === undefined ? rule : { ...rule, enabled };
  });
  const rest = saved.filter((rule) => !isCurationRule(rule.id));
  const next = [...reconciledCuration, ...rest];
  return JSON.stringify(next) === JSON.stringify(saved) ? saved : next;
}
