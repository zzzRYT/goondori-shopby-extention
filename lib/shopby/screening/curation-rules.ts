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

// 저장된 규칙에 없는 큐레이션 규칙을 앞쪽에 복원한다(삭제됐거나 새 버전에서 추가된 규칙).
// 이미 있는 규칙은 저장본 우선 — MD가 끈 상태(enabled=false)를 보존한다.
export function mergeCurationRules(saved: Rule[]): Rule[] {
  const existing = new Set(saved.map((rule) => rule.id));
  const missing = CURATION_RULES.filter((rule) => !existing.has(rule.id));
  return missing.length ? [...missing, ...saved] : saved;
}
