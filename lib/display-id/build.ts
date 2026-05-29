import type { Display, DisplaySpec } from './types';

// 전시 토큰 직렬화: 홈 전시면 `d{n}`, 비노출이면 `nd`.
export function buildDisplayToken(display: Display): string {
  return display.onHome ? `d${display.order}` : 'nd';
}

export function buildDisplayId(spec: DisplaySpec): string {
  const head = `${spec.env}_${buildDisplayToken(spec.display)}_${spec.method}`;

  switch (spec.type) {
    case 't':
      return `${head}_t_${spec.userTypes.join('')}`;
    case 'b':
      return `${head}_b_${spec.brandNo}`;
    case 'n':
      return `${head}_n_${spec.label}`;
  }
}
