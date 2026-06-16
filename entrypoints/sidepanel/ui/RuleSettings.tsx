import { useState } from 'react';
import { CURATION_META, isCurationRule } from '../../../lib/shopby/screening/curation-rules';
import { FIELD_CATALOG, type CatalogSection } from '../../../lib/shopby/screening/field-catalog';
import type { DerivedRuleKind, ImageRuleKind, Rule, RuleOp } from '../../../lib/shopby/screening/rules';

type Props = { rules: Rule[]; onChange: (rules: Rule[]) => void };

const OP_OPTIONS: Array<{ value: RuleOp; label: string }> = [
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '≠' },
  { value: 'includes', label: '포함' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
];

const IMAGE_KIND_LABELS: Record<ImageRuleKind, string> = {
  mainRequired: '대표이미지 필수',
  listRequired: '리스트이미지 필수',
  detailMin: '상세 이미지 최소 장수',
  detailPositionForbidden: '상세 상단/하단 이미지 금지',
  externalHost: '허용 외 이미지 호스트 경고',
};

const DERIVED_KIND_LABELS: Record<DerivedRuleKind, string> = {
  reverseMargin: '역마진 검사',
  discountRateMax: '할인율 상한',
  displayCategoryMax: '전시카테고리 개수 상한',
  maxLength: '글자수 상한',
};

export function describeRule(rule: Rule): string {
  if (rule.type === 'required') return `${rule.section} · ${rule.field} 필수`;
  if (rule.type === 'empty') return `${rule.section} · ${rule.field} 공란`;
  if (rule.type === 'expected') {
    const op = OP_OPTIONS.find((option) => option.value === rule.op)?.label ?? rule.op;
    return `${rule.section} · ${rule.field} ${op} ${rule.value}`;
  }
  if (rule.type === 'derived') {
    const kindLabel = DERIVED_KIND_LABELS[rule.kind];
    if (rule.kind === 'maxLength') {
      const section = rule.section ?? '기본정보';
      const field = rule.field ?? '상품명';
      return `${section} · ${field} ${kindLabel} ${rule.threshold ?? 30}자`;
    }
    if (rule.kind === 'discountRateMax') {
      return `${kindLabel} ${rule.threshold ?? 70}%`;
    }
    if (rule.kind === 'displayCategoryMax') {
      return `${kindLabel} ${rule.threshold ?? 1}개`;
    }
    return kindLabel; // reverseMargin
  }
  if (rule.type === 'image') {
    return rule.kind === 'detailMin'
      ? `${IMAGE_KIND_LABELS[rule.kind]} ${rule.threshold ?? 1}장`
      : IMAGE_KIND_LABELS[rule.kind];
  }
  return '';
}

export function RuleSettings({ rules, onChange }: Props) {
  const curationRules = rules.filter((rule) => isCurationRule(rule.id));
  const customRules = rules.filter((rule) => !isCurationRule(rule.id));

  function toggle(id: string, enabled: boolean) {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)));
  }

  function remove(id: string) {
    onChange(rules.filter((rule) => rule.id !== id));
  }

  return (
    <div className="rule-settings">
      {curationRules.length > 0 && (
        <section aria-label="기본 큐레이션 규칙">
          <h3 className="rule-settings__heading">기본 큐레이션</h3>
          <ul className="rule-settings__list">
            {curationRules.map((rule) => {
              const meta = CURATION_META[rule.id];
              return (
                <li key={rule.id} className="rule-settings__row">
                  <label className="rule-settings__toggle">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) => toggle(rule.id, event.target.checked)}
                    />
                    <span>
                      {meta.title}
                      <small className="rule-settings__note">{meta.note}</small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="추가 규칙">
        <h3 className="rule-settings__heading">추가 규칙</h3>
        <ul className="rule-settings__list">
          {customRules.map((rule) => (
            <li key={rule.id} className="rule-settings__row">
              <label className="rule-settings__toggle">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => toggle(rule.id, event.target.checked)}
                />
                {describeRule(rule)}
              </label>
              <button
                type="button"
                className="rule-settings__delete"
                aria-label={`규칙 삭제: ${describeRule(rule)}`}
                onClick={() => remove(rule.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <AddRuleForm onAdd={(rule) => onChange([...rules, rule])} />
      </section>
    </div>
  );
}

const SECTIONS = Object.keys(FIELD_CATALOG) as CatalogSection[];

function AddRuleForm({ onAdd }: { onAdd: (rule: Rule) => void }) {
  const [type, setType] = useState<Rule['type']>('required');
  const [section, setSection] = useState<CatalogSection>('기본정보');
  const [field, setField] = useState<string>(FIELD_CATALOG['기본정보'][0]);
  const [op, setOp] = useState<RuleOp>('equals');
  const [value, setValue] = useState('');
  const [kind, setKind] = useState<ImageRuleKind>('mainRequired');
  const [derivedKind, setDerivedKind] = useState<DerivedRuleKind>('reverseMargin');
  const [threshold, setThreshold] = useState('1');

  function pickSection(next: CatalogSection) {
    setSection(next);
    setField(FIELD_CATALOG[next][0]);
  }

  function submit() {
    const id = `rule-${crypto.randomUUID()}`;
    if (type === 'required') {
      onAdd({ id, type: 'required', section, field, enabled: true });
    } else if (type === 'empty') {
      onAdd({ id, type: 'empty', section, field, enabled: true });
    } else if (type === 'expected') {
      onAdd({ id, type: 'expected', section, field, op, value, enabled: true });
    } else if (type === 'derived') {
      onAdd({
        id,
        type: 'derived',
        kind: derivedKind,
        threshold: derivedKind === 'reverseMargin' ? undefined : Number(threshold) || undefined,
        section: derivedKind === 'maxLength' ? section : undefined,
        field: derivedKind === 'maxLength' ? field : undefined,
        enabled: true,
      });
    } else {
      onAdd({
        id,
        type: 'image',
        kind,
        threshold: kind === 'detailMin' ? Number(threshold) || 1 : undefined,
        enabled: true,
      });
    }
  }

  return (
    <div className="rule-settings__add">
      <label>
        검사 유형
        <select value={type} onChange={(event) => setType(event.target.value as Rule['type'])}>
          <option value="required">필수값</option>
          <option value="empty">공란</option>
          <option value="expected">기대값</option>
          <option value="derived">계산 검사</option>
          <option value="image">이미지</option>
        </select>
      </label>

      {type !== 'image' && (type !== 'derived' || (type === 'derived' && derivedKind === 'maxLength')) && (
        <>
          <label>
            섹션
            <select value={section} onChange={(event) => pickSection(event.target.value as CatalogSection)}>
              {SECTIONS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            항목
            <select value={field} onChange={(event) => setField(event.target.value)}>
              {FIELD_CATALOG[section].map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {type === 'expected' && (
        <>
          <label>
            비교
            <select value={op} onChange={(event) => setOp(event.target.value as RuleOp)}>
              {OP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            기대값
            <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="예: 15%" />
          </label>
        </>
      )}

      {type === 'derived' && (
        <>
          <label>
            계산 검사
            <select value={derivedKind} onChange={(event) => setDerivedKind(event.target.value as DerivedRuleKind)}>
              {(Object.keys(DERIVED_KIND_LABELS) as DerivedRuleKind[]).map((name) => (
                <option key={name} value={name}>{DERIVED_KIND_LABELS[name]}</option>
              ))}
            </select>
          </label>
          {derivedKind !== 'reverseMargin' && (
            <label>
              상한값
              <input
                type="number"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </label>
          )}
        </>
      )}

      {type === 'image' && (
        <>
          <label>
            이미지 검사
            <select value={kind} onChange={(event) => setKind(event.target.value as ImageRuleKind)}>
              {(Object.keys(IMAGE_KIND_LABELS) as ImageRuleKind[]).map((name) => (
                <option key={name} value={name}>{IMAGE_KIND_LABELS[name]}</option>
              ))}
            </select>
          </label>
          {kind === 'detailMin' && (
            <label>
              최소 장수
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </label>
          )}
        </>
      )}

      <button type="button" onClick={submit}>규칙 추가</button>
    </div>
  );
}
