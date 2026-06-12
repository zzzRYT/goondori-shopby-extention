import { useState } from 'react';
import { FIELD_CATALOG, type CatalogSection } from '../../../lib/shopby/screening/field-catalog';
import type { ImageRuleKind, Rule, RuleOp } from '../../../lib/shopby/screening/rules';

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
  externalHost: '허용 외 이미지 호스트 경고',
};

export function describeRule(rule: Rule): string {
  if (rule.type === 'required') return `${rule.section} · ${rule.field} 필수`;
  if (rule.type === 'expected') {
    const op = OP_OPTIONS.find((option) => option.value === rule.op)?.label ?? rule.op;
    return `${rule.section} · ${rule.field} ${op} ${rule.value}`;
  }
  return rule.kind === 'detailMin'
    ? `${IMAGE_KIND_LABELS[rule.kind]} ${rule.threshold ?? 1}장`
    : IMAGE_KIND_LABELS[rule.kind];
}

export function RuleSettings({ rules, onChange }: Props) {
  function toggle(id: string, enabled: boolean) {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)));
  }

  function remove(id: string) {
    onChange(rules.filter((rule) => rule.id !== id));
  }

  return (
    <div className="rule-settings">
      <ul className="rule-settings__list">
        {rules.map((rule) => (
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
  const [threshold, setThreshold] = useState('1');

  function pickSection(next: CatalogSection) {
    setSection(next);
    setField(FIELD_CATALOG[next][0]);
  }

  function submit() {
    const id = `rule-${crypto.randomUUID()}`;
    if (type === 'required') {
      onAdd({ id, type: 'required', section, field, enabled: true });
    } else if (type === 'expected') {
      onAdd({ id, type: 'expected', section, field, op, value, enabled: true });
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
          <option value="expected">기대값</option>
          <option value="image">이미지</option>
        </select>
      </label>

      {type !== 'image' && (
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
