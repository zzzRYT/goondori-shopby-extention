import { USER_TYPE_CHARS, type DisplaySpec, type Issue, type Result, type UserTypeChar } from './types';

const ENVS = ['c', 'ct'];
const METHODS = ['p', 's'];
const TYPES = ['t', 'b', 'n'];

export function parseDisplayId(id: string): Result<DisplaySpec> {
  const issues: Issue[] = [];
  const [env, orderStr, method, type, ...rest] = id.split('_');
  const detail = rest.join('_');

  if (!ENVS.includes(env)) {
    issues.push({
      field: 'env',
      severity: 'error',
      message: `환경 접미사는 c 또는 ct 여야 합니다 (받음: ${env ?? '없음'})`,
    });
  }

  const order = Number(orderStr);
  if (!Number.isInteger(order) || order < 1) {
    issues.push({
      field: 'order',
      severity: 'error',
      message: `진열 순서는 1 이상 정수여야 합니다 (받음: ${orderStr ?? '없음'})`,
    });
  }

  if (!METHODS.includes(method)) {
    issues.push({
      field: 'method',
      severity: 'error',
      message: `표시 방법은 p 또는 s 여야 합니다 (받음: ${method ?? '없음'})`,
    });
  }

  if (!TYPES.includes(type)) {
    issues.push({
      field: 'type',
      severity: 'error',
      message: `진열 타입은 t/b/n 여야 합니다 (받음: ${type ?? '없음'})`,
    });
  }

  if (type === 't') {
    const chars = [...detail];
    const invalid = chars.filter((char) => !USER_TYPE_CHARS.includes(char as UserTypeChar));

    if (chars.length === 0) {
      issues.push({ field: 'detail', severity: 'error', message: '사용자 유형 문자가 비어 있습니다' });
    }
    if (invalid.length > 0) {
      issues.push({
        field: 'detail',
        severity: 'error',
        message: `허용되지 않은 사용자 유형 문자: ${invalid.join(', ')}`,
      });
    }
    if (issues.length > 0) return { ok: false, issues };

    return {
      ok: true,
      value: {
        env: env as 'c' | 'ct',
        order,
        method: method as 'p' | 's',
        type: 't',
        userTypes: chars as UserTypeChar[],
      },
    };
  }

  if (type === 'b') {
    if (!/^\d+$/.test(detail)) {
      issues.push({
        field: 'detail',
        severity: 'error',
        message: `브랜드 번호는 숫자여야 합니다 (받음: ${detail || '없음'})`,
      });
    }
    if (issues.length > 0) return { ok: false, issues };

    return {
      ok: true,
      value: { env: env as 'c' | 'ct', order, method: method as 'p' | 's', type: 'b', brandNo: detail },
    };
  }

  if (type === 'n') {
    if (issues.length > 0) return { ok: false, issues };

    return {
      ok: true,
      value: { env: env as 'c' | 'ct', order, method: method as 'p' | 's', type: 'n', label: detail },
    };
  }

  return { ok: false, issues };
}
