import type { ParsedScreeningProduct, SectionName } from './types';

export type RuleOp = 'equals' | 'notEquals' | 'includes' | 'gt' | 'gte' | 'lt' | 'lte';
export type ImageRuleKind = 'mainRequired' | 'listRequired' | 'detailMin' | 'externalHost';

export type RequiredRule = {
  id: string;
  type: 'required';
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

export type Rule = RequiredRule | ExpectedRule | ImageRule;

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

export function imageHost(src: string): string | null {
  const normalized = src.startsWith('//') ? `https:${src}` : src;
  if (!/^https?:\/\//.test(normalized)) return null; // 상대경로는 어드민 자체 자원
  try {
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

export function evaluate(product: ParsedScreeningProduct, rules: Rule[]): Violation[] {
  const violations: Violation[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const violation = rule.type === 'image' ? checkImage(product, rule) : checkField(product, rule);
    if (violation) violations.push(violation);
  }
  return violations;
}

function checkField(
  product: ParsedScreeningProduct,
  rule: RequiredRule | ExpectedRule,
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

  const allow = rule.allowHosts?.length ? rule.allowHosts : DEFAULT_ALLOW_HOSTS;
  const all = [...images.main, ...images.list, ...images.detail];
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
