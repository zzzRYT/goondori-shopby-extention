import type { BrandEnv } from '../../../lib/shopby/brand-extra-info';

type EnvToggleProps = {
  value: BrandEnv;
  onChange: (next: BrandEnv) => void;
};

const OPTIONS: { value: BrandEnv; label: string }[] = [
  { value: 'prod', label: '운영(prod)' },
  { value: 'dev', label: '개발(dev)' },
];

// prod/dev 환경 토글. read-only viewer가 어떤 토큰(c_/ct_)을 보여줄지 결정한다.
export function EnvToggle({ value, onChange }: EnvToggleProps) {
  return (
    <div className="env-toggle" role="group" aria-label="브랜드 노출 환경">
      {OPTIONS.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            type="button"
            key={option.value}
            className="env-toggle__button"
            aria-pressed={pressed}
            onClick={() => {
              if (!pressed) onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
