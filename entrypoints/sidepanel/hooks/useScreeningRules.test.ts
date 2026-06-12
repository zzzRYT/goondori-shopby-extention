import { renderHook, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_RULES } from '../../../lib/shopby/screening/seed-rules';
import type { Rule } from '../../../lib/shopby/screening/rules';
import { useScreeningRules } from './useScreeningRules';

describe('useScreeningRules', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('저장된 규칙이 없으면 시드 규칙(전부 OFF)을 깔고 저장한다', async () => {
    const { result } = renderHook(() => useScreeningRules());

    await waitFor(() => expect(result.current.rules).not.toBeNull());

    expect(result.current.rules).toEqual(SEED_RULES);
    const stored = await fakeBrowser.storage.local.get('screeningRules');
    expect(stored.screeningRules).toEqual(SEED_RULES);
  });

  it('저장된 규칙이 있으면 그대로 사용한다', async () => {
    const saved: Rule[] = [
      { id: 'custom', type: 'required', section: '기본정보', field: '브랜드', enabled: true },
    ];
    await fakeBrowser.storage.local.set({ screeningRules: saved });

    const { result } = renderHook(() => useScreeningRules());

    await waitFor(() => expect(result.current.rules).toEqual(saved));
  });

  it('save가 상태와 storage를 함께 갱신한다', async () => {
    const { result } = renderHook(() => useScreeningRules());
    await waitFor(() => expect(result.current.rules).not.toBeNull());

    const next: Rule[] = [{ ...SEED_RULES[0], enabled: true } as Rule];
    result.current.save(next);

    await waitFor(async () => {
      const stored = await fakeBrowser.storage.local.get('screeningRules');
      expect(stored.screeningRules).toEqual(next);
    });
  });
});
