import type { HintTone } from './FieldHints';

type FieldHintProps = {
  tone: HintTone;
  message: string;
};

// 한 줄짜리 가이드 칩. shadow DOM 안에서만 사용되므로 style.css의 .banner-guide* 클래스에
// 시각 규칙을 위임한다.
export function FieldHint({ tone, message }: FieldHintProps) {
  return (
    <span className="banner-guide" data-tone={tone} role="note">
      <span className="banner-guide__icon" aria-hidden="true">
        {tone === 'warn' ? '⚠️' : 'ℹ️'}
      </span>
      <span className="banner-guide__text">{message}</span>
    </span>
  );
}
