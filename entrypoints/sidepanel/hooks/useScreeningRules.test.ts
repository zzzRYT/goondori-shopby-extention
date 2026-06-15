import { renderHook, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CURATION_RULES } from '../../../lib/shopby/screening/curation-rules';
import { SEED_RULES } from '../../../lib/shopby/screening/seed-rules';
import type { Rule } from '../../../lib/shopby/screening/rules';
import { useScreeningRules } from './useScreeningRules';

const INITIAL_RULES = [...CURATION_RULES, ...SEED_RULES];

describe('useScreeningRules', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('저장된 규칙이 없으면 큐레이션 규칙(ON) + 시드 규칙(OFF)을 깔고 저장한다', async () => {
    const { result } = renderHook(() => useScreeningRules());

    await waitFor(() => expect(result.current.rules).not.toBeNull());

    expect(result.current.rules).toEqual(INITIAL_RULES);
    const stored = await fakeBrowser.storage.local.get('screeningRules');
    expect(stored.screeningRules).toEqual(INITIAL_RULES);
  });

  it('저장된 규칙에 빠진 큐레이션 규칙을 병합해 노출·저장한다', async () => {
    const saved: Rule[] = [
      { id: 'custom', type: 'required', section: '기본정보', field: '브랜드', enabled: true },
    ];
    await fakeBrowser.storage.local.set({ screeningRules: saved });

    const { result } = renderHook(() => useScreeningRules());

    await waitFor(() => expect(result.current.rules).toEqual([...CURATION_RULES, ...saved]));
    const stored = await fakeBrowser.storage.local.get('screeningRules');
    expect(stored.screeningRules).toEqual([...CURATION_RULES, ...saved]);
  });

  it('큐레이션 규칙이 모두 있으면 저장본을 그대로 사용한다 (꺼둔 상태 보존)', async () => {
    const saved: Rule[] = [
      { ...CURATION_RULES[0], enabled: false } as Rule,
      ...CURATION_RULES.slice(1),
    ];
    await fakeBrowser.storage.local.set({ screeningRules: saved });

    const { result } = renderHook(() => useScreeningRules());

    await waitFor(() => expect(result.current.rules).toEqual(saved));
  });

  it('save가 상태와 storage를 함께 갱신한다', async () => {
    const { result } = renderHook(() => useScreeningRules());
    await waitFor(() => expect(result.current.rules).not.toBeNull());

    const next: Rule[] = [{ ...INITIAL_RULES[0], enabled: false } as Rule];
    result.current.save(next);

    await waitFor(async () => {
      const stored = await fakeBrowser.storage.local.get('screeningRules');
      expect(stored.screeningRules).toEqual(next);
    });
  });
});
