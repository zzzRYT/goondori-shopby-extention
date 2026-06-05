import { describe, expect, it } from 'vitest';
import {
  INITIAL_BUILDER_STATE,
  INITIAL_TITLE_STATE,
  applyAdminValues,
  deriveDisplay,
  deriveTitle,
  describeLoaded,
  restoreBuilder,
} from './display-state';

describe('restoreBuilder', () => {
  it('파싱 가능한 진열 ID로 조립값과 sourceId를 복원한다', () => {
    const next = restoreBuilder(INITIAL_BUILDER_STATE, 'c_d2_p_t_병부장');

    expect(next.sourceId).toBe('c_d2_p_t_병부장');
    expect(next.type).toBe('t');
    expect(next.order).toBe(2);
    expect(next.userTypes).toEqual(['병', '부', '장']);
  });

  it('nd 진열 ID는 홈 비노출로 복원한다', () => {
    const next = restoreBuilder(INITIAL_BUILDER_STATE, 'c_nd_s_b_43215615');

    expect(next.onHome).toBe(false);
    expect(next.type).toBe('b');
    expect(next.brandNo).toBe('43215615');
  });

  it('파싱 실패 시 sourceId만 세팅하고 조립값은 유지한다', () => {
    const next = restoreBuilder(INITIAL_BUILDER_STATE, '엉터리값');

    expect(next.sourceId).toBe('엉터리값');
    expect(next.type).toBe(INITIAL_BUILDER_STATE.type);
    expect(next.env).toBe(INITIAL_BUILDER_STATE.env);
  });
});

describe('applyAdminValues', () => {
  const prev = { builder: INITIAL_BUILDER_STATE, title: INITIAL_TITLE_STATE };

  it('채워진 필드만 반영하고 loaded에 기록한다', () => {
    const result = applyAdminValues(
      { displayId: 'c_d1_p_t_병', title: '군인을 위한 꿀템', color: '군인#008000' },
      prev,
    );

    expect(result.loaded).toEqual(['displayId', 'title', 'color']);
    expect(result.builder.userTypes).toEqual(['병']);
    expect(result.title.title).toBe('군인을 위한 꿀템');
    expect(result.title.chips).toEqual([{ word: '군인', hex: '#008000' }]);
  });

  it('빈 필드는 건너뛰고 기존 상태를 그대로 둔다', () => {
    const result = applyAdminValues({ displayId: '', title: '   ', color: '' }, prev);

    expect(result.loaded).toEqual([]);
    expect(result.builder).toBe(prev.builder);
    expect(result.title).toBe(prev.title);
  });

  it('누락된 키(undefined)도 건너뛴다', () => {
    const result = applyAdminValues({ title: '베스트' }, prev);

    expect(result.loaded).toEqual(['title']);
    expect(result.title.title).toBe('베스트');
    expect(result.builder).toBe(prev.builder);
  });

  it('진열 ID 파싱 실패면 sourceId만 채우되 displayId는 loaded에 남긴다', () => {
    const result = applyAdminValues({ displayId: '엉터리' }, prev);

    expect(result.loaded).toEqual(['displayId']);
    expect(result.builder.sourceId).toBe('엉터리');
    expect(result.builder.type).toBe(prev.builder.type);
  });
});

describe('deriveDisplay', () => {
  it('조립값에서 진열 ID와 오류 여부를 도출한다', () => {
    const derived = deriveDisplay({ ...INITIAL_BUILDER_STATE, userTypes: ['병'] });

    expect(derived.displayId).toBe('c_d1_p_t_병');
    expect(derived.hasError).toBe(false);
  });

  it('사용자유형 미선택이면 오류로 표시한다', () => {
    const derived = deriveDisplay(INITIAL_BUILDER_STATE);

    expect(derived.hasError).toBe(true);
  });
});

describe('deriveTitle', () => {
  it('칩을 직렬화해 색상 문자열을 만든다', () => {
    const derived = deriveTitle({
      ...INITIAL_TITLE_STATE,
      title: '군인을 위한 꿀템',
      chips: [{ word: '군인', hex: '#008000' }],
    });

    expect(derived.color).toBe('군인#008000');
    expect(derived.hasError).toBe(false);
  });
});

describe('describeLoaded', () => {
  it('불러온 필드를 한국어 라벨로 잇는다', () => {
    expect(describeLoaded(['displayId', 'title', 'color'])).toBe('진열 ID·진열명·설명 불러옴');
  });

  it('빈 배열이면 빈 문자열', () => {
    expect(describeLoaded([])).toBe('');
  });
});
