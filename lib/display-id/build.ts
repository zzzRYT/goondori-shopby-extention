import type { DisplaySpec } from './types';

export function buildDisplayId(spec: DisplaySpec): string {
  const head = `${spec.env}_${spec.order}_${spec.method}`;

  switch (spec.type) {
    case 't':
      return `${head}_t_${spec.userTypes.join('')}`;
    case 'b':
      return `${head}_b_${spec.brandNo}`;
    case 'n':
      return `${head}_n_${spec.label}`;
  }
}
