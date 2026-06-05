import {
  buildDisplayId,
  parseColorSpec,
  parseDisplayId,
  recoverChips,
  serializeChips,
  type ColorChip,
  type ColorRule,
  type Display,
  type DisplaySpec,
  type Env,
  type Issue,
  type Method,
  type UserTypeChar,
} from '../../../lib/display-id';

export type DisplayType = DisplaySpec['type'];

// 진열 ID 조립기의 입력 상태. DisplayBuilder는 이 객체를 받아 그리는 표현 컴포넌트가 된다.
export type BuilderState = {
  env: Env;
  onHome: boolean;
  order: number;
  method: Method;
  type: DisplayType;
  userTypes: UserTypeChar[];
  brandNo: string;
  label: string;
  sourceId: string;
};

// 진열명 편집기의 입력 상태. TitleEditor가 받아 그린다.
export type TitleState = {
  title: string;
  chips: ColorChip[];
  previewName: string;
};

export const INITIAL_BUILDER_STATE: BuilderState = {
  env: 'c',
  onHome: true,
  order: 1,
  method: 'p',
  type: 't',
  userTypes: [],
  brandNo: '',
  label: '베스트',
  sourceId: '',
};

export const INITIAL_TITLE_STATE: TitleState = {
  title: '',
  chips: [],
  previewName: '지성현',
};

// 기존 진열 ID 원문 → 조립 상태 복원. 파싱 실패 시 sourceId만 채우고 조립값은 유지한다.
export function restoreBuilder(prev: BuilderState, sourceId: string): BuilderState {
  const base: BuilderState = { ...prev, sourceId };

  const parsed = parseDisplayId(sourceId);
  if (!parsed.ok) return base;

  const value = parsed.value;
  const next: BuilderState = {
    ...base,
    env: value.env,
    onHome: value.display.onHome,
    order: value.display.onHome ? value.display.order : base.order,
    method: value.method,
    type: value.type,
  };

  if (value.type === 't') return { ...next, userTypes: value.userTypes };
  if (value.type === 'b') return { ...next, brandNo: value.brandNo };
  return { ...next, label: value.label };
}

export type LoadedField = 'displayId' | 'title' | 'color';

const LOADED_LABELS: Record<LoadedField, string> = {
  displayId: '진열 ID',
  title: '진열명',
  color: '설명',
};

export function describeLoaded(loaded: LoadedField[]): string {
  if (loaded.length === 0) return '';
  return `${loaded.map((field) => LOADED_LABELS[field]).join('·')} 불러옴`;
}

// 어드민에서 읽어온 값 → 다음 상태. 빈/누락 필드는 건너뛴다(설계 §덮어쓰기 정책).
export function applyAdminValues(
  read: Record<string, string>,
  prev: { builder: BuilderState; title: TitleState },
): { builder: BuilderState; title: TitleState; loaded: LoadedField[] } {
  let builder = prev.builder;
  let title = prev.title;
  const loaded: LoadedField[] = [];

  if ((read.displayId ?? '').trim()) {
    builder = restoreBuilder(builder, read.displayId);
    loaded.push('displayId');
  }

  if ((read.title ?? '').trim()) {
    title = { ...title, title: read.title };
    loaded.push('title');
  }

  if ((read.color ?? '').trim()) {
    title = { ...title, chips: recoverChips(read.color) };
    loaded.push('color');
  }

  return { builder, title, loaded };
}

function builderSpec(state: BuilderState): DisplaySpec {
  const display: Display = state.onHome ? { onHome: true, order: state.order } : { onHome: false };

  if (state.type === 'b') return { env: state.env, display, method: state.method, type: 'b', brandNo: state.brandNo };
  if (state.type === 'n') return { env: state.env, display, method: state.method, type: 'n', label: state.label };
  return { env: state.env, display, method: state.method, type: 't', userTypes: state.userTypes };
}

export type DisplayDerived = {
  displayId: string;
  errors: Issue[];
  warnings: Issue[];
  hasError: boolean;
};

export function deriveDisplay(state: BuilderState): DisplayDerived {
  const displayId = buildDisplayId(builderSpec(state));
  const validation = parseDisplayId(displayId);
  const issues = validation.ok ? [] : validation.issues;
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warn');

  return { displayId, errors, warnings, hasError: errors.length > 0 };
}

export type TitleDerived = {
  title: string;
  color: string;
  rules: ColorRule[];
  errors: Issue[];
  warnings: Issue[];
  hasError: boolean;
};

export function deriveTitle(state: TitleState): TitleDerived {
  const color = serializeChips(state.chips);
  const result = parseColorSpec(color, state.title);
  const rules = result.ok ? result.value : [];
  const issues = result.ok ? [] : result.issues;
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warn');

  return { title: state.title, color, rules, errors, warnings, hasError: errors.length > 0 };
}
