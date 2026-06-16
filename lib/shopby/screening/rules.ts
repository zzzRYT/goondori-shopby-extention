import type { ParsedScreeningProduct, SectionName } from './types';

export type RuleOp = 'equals' | 'notEquals' | 'includes' | 'gt' | 'gte' | 'lt' | 'lte';
export type ImageRuleKind =
  | 'mainRequired'
  | 'listRequired'
  | 'detailMin'
  | 'detailPositionForbidden'
  | 'externalHost';

export type RequiredRule = {
  id: string;
  type: 'required';
  section: SectionName;
  field: string;
  enabled: boolean;
};

// required의 반대 — 값이 입력되어 있으면 위반 (예: 검색어는 비워서 등록해야 함).
export type EmptyRule = {
  id: string;
  type: 'empty';
  section: SectionName;
  field: string;
  enabled: boolean;
};

export type ExpectedRule = {
  id: string;
  type: 'expected';
  section: SectionName;
  field: string;
  op: RuleOp;
  value: string;
  enabled: boolean;
};

export type ImageRule = {
  id: string;
  type: 'image';
  kind: ImageRuleKind;
  threshold?: number; // detailMin: 최소 장수
  allowHosts?: string[]; // externalHost: 허용 호스트
  enabled: boolean;
};

export type DerivedRuleKind =
  | 'reverseMargin'
  | 'discountRateMax'
  | 'displayCategoryMax'
  | 'maxLength'
  | 'saleEndImminent'
  | 'priceCeiling';

// 단일 필드 비교로 표현 못 하는 계산 검사(가격 교차비교·할인율·글자수·개수·종료일 임박·가격 상한).
// threshold: discountRateMax(기본 70)·displayCategoryMax(기본 1)·maxLength(기본 30)·saleEndImminent(기본 5, 일)·priceCeiling(기본 1,000,000, 원)
// section/field: maxLength에서만 사용(어떤 항목의 글자수를 볼지)
export type DerivedRule = {
  id: string;
  type: 'derived';
  kind: DerivedRuleKind;
  threshold?: number;
  section?: SectionName;
  field?: string;
  enabled: boolean;
};

export type Rule = RequiredRule | EmptyRule | ExpectedRule | ImageRule | DerivedRule;

export type Violation = { ruleId: string; label: string; message: string; actual: string };

export const DEFAULT_ALLOW_HOSTS = ['shopby-images.cdn-nhncommerce.com'];

const OP_LABELS: Record<RuleOp, string> = {
  equals: '=',
  notEquals: '≠',
  includes: '포함',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
};

// "140,000원" → 140000, "상품수수료, 15%" → 15. 첫 번째 숫자 토큰만 본다.
export function parseNumeric(raw: string): number | null {
  const match = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

// "상시 판매, 2026-06-10 00:00:00 ~ 2999-12-31 23:59:59" → 종료일 Date.
// '~' 뒤(종료일시)에서 첫 날짜를 읽는다. 시각은 선택, 날짜만 있어도 된다. 없으면 null.
export function parseSaleEndDate(raw: string): Date | null {
  const afterTilde = raw.includes('~') ? raw.slice(raw.indexOf('~') + 1) : raw;
  const m = afterTilde.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh = '0', mm = '0', ss = '0'] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
}

// 두 시점의 '캘린더 날짜' 차이(일). 시각은 버려 "오늘 기준 N일"을 날짜 단위로 본다.
export function daysUntil(now: Date, end: Date): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(end) - startOfDay(now)) / 86_400_000);
}

function formatYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 1000000 → "1,000,000". 환경별 toLocaleString ICU 의존 없이 결정적으로 천 단위 콤마.
export function formatThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function imageHost(src: string): string | null {
  const normalized = src.startsWith('//') ? `https:${src}` : src;
  if (!/^https?:\/\//.test(normalized)) return null; // 상대경로는 어드민 자체 자원
  try {
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

// now는 날짜 기반 검사(saleEndImminent)의 기준 시점 — 테스트에서 고정값을 주입할 수 있게 인자로 받는다.
export function evaluate(product: ParsedScreeningProduct, rules: Rule[], now: Date = new Date()): Violation[] {
  const violations: Violation[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const violation =
      rule.type === 'image' ? checkImage(product, rule)
      : rule.type === 'derived' ? checkDerived(product, rule, now)
      : checkField(product, rule);
    if (violation) violations.push(violation);
  }
  return violations;
}

function checkField(
  product: ParsedScreeningProduct,
  rule: RequiredRule | EmptyRule | ExpectedRule,
): Violation | null {
  const value = product.fields[rule.section]?.[rule.field];
  const label = `${rule.section} · ${rule.field}`;

  // 항목 자체가 없으면 카탈로그와 화면 구조가 어긋난 것 — 조용히 통과시키지 않는다.
  if (value === undefined) {
    return { ruleId: rule.id, label, message: '항목을 찾지 못함(화면 구조 변경 가능성)', actual: '' };
  }

  if (rule.type === 'required') {
    return value === ''
      ? { ruleId: rule.id, label, message: '필수 항목 공란', actual: '' }
      : null;
  }

  if (rule.type === 'empty') {
    return value === ''
      ? null
      : { ruleId: rule.id, label, message: '공란이어야 하는 항목에 값이 있음', actual: value };
  }

  return checkExpected(rule, value, label);
}

function checkExpected(rule: ExpectedRule, value: string, label: string): Violation | null {
  const expectedText = `${OP_LABELS[rule.op]} ${rule.value}`;
  const fail = (message: string): Violation => ({ ruleId: rule.id, label, message, actual: value });

  if (rule.op === 'includes') {
    return value.includes(rule.value) ? null : fail(`기대값 불일치 (기대 ${expectedText})`);
  }

  if (rule.op === 'equals' || rule.op === 'notEquals') {
    // 문자열 우선 비교, 다르면 숫자 동치로 한 번 더 본다 ("상품수수료, 15%" = "15%").
    const stringMatch = value.trim() === rule.value.trim();
    const left = parseNumeric(value);
    const right = parseNumeric(rule.value);
    const numericMatch = left != null && right != null && left === right;
    const matched = stringMatch || numericMatch;
    const pass = rule.op === 'equals' ? matched : !matched;
    return pass ? null : fail(`기대값 불일치 (기대 ${expectedText})`);
  }

  const actual = parseNumeric(value);
  const expected = parseNumeric(rule.value);
  if (actual == null || expected == null) {
    return fail(`숫자 비교 불가 (기대 ${expectedText})`);
  }

  const pass =
    rule.op === 'gt' ? actual > expected
    : rule.op === 'gte' ? actual >= expected
    : rule.op === 'lt' ? actual < expected
    : actual <= expected;
  return pass ? null : fail(`기대값 불일치 (기대 ${expectedText})`);
}

function checkImage(product: ParsedScreeningProduct, rule: ImageRule): Violation | null {
  const { images } = product;
  const v = (label: string, message: string, actual: string): Violation => ({
    ruleId: rule.id,
    label,
    message,
    actual,
  });

  if (rule.kind === 'mainRequired') {
    return images.main.length === 0 ? v('이미지 · 상품이미지', '대표이미지 없음', '') : null;
  }
  if (rule.kind === 'listRequired') {
    return images.list.length === 0 ? v('이미지 · 리스트이미지', '리스트이미지 없음', '') : null;
  }
  if (rule.kind === 'detailMin') {
    const min = rule.threshold ?? 1;
    return images.detail.length < min
      ? v('이미지 · 상품 상세', `상세 이미지 ${min}장 미만`, `${images.detail.length}장`)
      : null;
  }
  if (rule.kind === 'detailPositionForbidden') {
    const top = images.detailTop.length;
    const bottom = images.detailBottom.length;
    return top + bottom > 0
      ? v('이미지 · 상품 상세(상단/하단)', '상단/하단 상세 이미지 사용(앱에서 표현 안 됨)', `상단 ${top}장 · 하단 ${bottom}장`)
      : null;
  }

  const allow = rule.allowHosts?.length ? rule.allowHosts : DEFAULT_ALLOW_HOSTS;
  const all = [...images.main, ...images.list, ...images.detail, ...images.detailTop, ...images.detailBottom];
  const offending = [
    ...new Set(
      all
        .map(imageHost)
        .filter((host): host is string => host != null && !allow.includes(host)),
    ),
  ];
  return offending.length
    ? v('이미지 · 호스트', '허용 외 이미지 호스트 사용', offending.join(', '))
    : null;
}

function checkDerived(product: ParsedScreeningProduct, rule: DerivedRule, now: Date): Violation | null {
  const sales = product.fields['판매정보'] ?? {};
  const basic = product.fields['기본정보'] ?? {};
  const v = (label: string, message: string, actual: string): Violation => ({
    ruleId: rule.id,
    label,
    message,
    actual,
  });

  if (rule.kind === 'reverseMargin') {
    // 실판매가 = 즉시할인가(고객 실결제가) 우선, 없으면 판매가. 공급가가 그보다 크면 역마진.
    const supplyRaw = sales['공급가'];
    const saleRaw = sales['즉시할인가'] || sales['판매가'];
    const supply = parseNumeric(supplyRaw ?? '');
    const sale = parseNumeric(saleRaw ?? '');
    if (supply == null || sale == null) {
      return v('판매정보 · 공급가', '역마진 비교 불가(가격 항목 없음)', '');
    }
    return supply > sale
      ? v('판매정보 · 공급가', '역마진(공급가 > 판매가)', `공급가 ${supplyRaw} > 판매 ${saleRaw}`)
      : null;
  }

  if (rule.kind === 'discountRateMax') {
    const threshold = rule.threshold ?? 70;
    const list = parseNumeric(sales['판매가'] ?? '');
    if (list == null || list === 0) {
      return v('판매정보 · 즉시할인', '할인율 계산 불가(판매가 없음)', sales['판매가'] ?? '');
    }
    // 할인율 = (판매가 - 즉시할인가)/판매가. 즉시할인가가 없으면 즉시할인(할인금액)/판매가. 둘 다 없으면 0%.
    const finalPrice = parseNumeric(sales['즉시할인가'] ?? '');
    const discountAmt = parseNumeric(sales['즉시할인'] ?? '');
    const rate =
      finalPrice != null ? ((list - finalPrice) / list) * 100
      : discountAmt != null ? (discountAmt / list) * 100
      : 0;
    return rate >= threshold
      ? v('판매정보 · 즉시할인', `할인율 ${threshold}% 이상`, `${rate.toFixed(1)}%`)
      : null;
  }

  if (rule.kind === 'displayCategoryMax') {
    const threshold = rule.threshold ?? 1;
    const raw = basic['전시카테고리'];
    if (raw === undefined) {
      return v('기본정보 · 전시카테고리', '항목을 찾지 못함(화면 구조 변경 가능성)', '');
    }
    // 전시카테고리 다중 등록 구분자는 실측 샘플이 1개뿐이라 미확정 — 쉼표/줄바꿈으로 분리(추후 실제 멀티 샘플로 조정).
    const count = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).length;
    return count > threshold
      ? v('기본정보 · 전시카테고리', `전시카테고리 ${threshold}개 초과`, `${count}개: ${raw}`)
      : null;
  }

  if (rule.kind === 'priceCeiling') {
    // 판매가/즉시할인가가 상한을 넘으면 오기입(0 더 붙음 등) 의심. 할인율이 작아 '할인율 이상치'가
    // 못 잡는 사각지대(가격 자체가 비정상적으로 큰 경우)를 절대 상한으로 잡는다.
    const threshold = rule.threshold ?? 1_000_000;
    const listRaw = sales['판매가'];
    if (listRaw === undefined) {
      return v('판매정보 · 판매가', '항목을 찾지 못함(화면 구조 변경 가능성)', '');
    }
    const over = ([['판매가', listRaw], ['즉시할인가', sales['즉시할인가']]] as const)
      .map(([name, raw]) => ({ name, raw: raw ?? '', num: parseNumeric(raw ?? '') }))
      .filter((c) => c.num != null && c.num > threshold);
    if (over.length === 0) return null;
    return v(
      '판매정보 · 판매가',
      `가격 상한 ${formatThousands(threshold)}원 초과(오기입 의심)`,
      over.map((c) => `${c.name} ${c.raw}`).join(', '),
    );
  }

  if (rule.kind === 'saleEndImminent') {
    const threshold = rule.threshold ?? 5;
    const raw = sales['판매기간'];
    if (raw === undefined) {
      return v('판매정보 · 판매기간', '항목을 찾지 못함(화면 구조 변경 가능성)', '');
    }
    const end = parseSaleEndDate(raw);
    if (end == null) {
      return v('판매정보 · 판매기간', '종료일을 읽지 못함', raw);
    }
    const days = daysUntil(now, end);
    if (days > threshold) return null;
    const when = days < 0 ? '이미 종료' : days === 0 ? '오늘 종료' : `${days}일 후 종료`;
    return v('판매정보 · 판매기간', `판매 종료 임박(${threshold}일 이내)`, `${formatYmd(end)} · ${when}`);
  }

  // maxLength
  const section = rule.section ?? '기본정보';
  const field = rule.field ?? '상품명';
  const threshold = rule.threshold ?? 30;
  const value = product.fields[section]?.[field];
  const label = `${section} · ${field}`;
  if (value === undefined) {
    return v(label, '항목을 찾지 못함(화면 구조 변경 가능성)', '');
  }
  return value.length > threshold
    ? v(label, `글자수 ${threshold}자 초과`, `${value.length}자`)
    : null;
}
