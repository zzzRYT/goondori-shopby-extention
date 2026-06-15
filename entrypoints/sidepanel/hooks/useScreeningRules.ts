import { useCallback, useEffect, useState } from 'react';
import { CURATION_RULES, mergeCurationRules } from '../../../lib/shopby/screening/curation-rules';
import type { Rule } from '../../../lib/shopby/screening/rules';
import { SEED_RULES } from '../../../lib/shopby/screening/seed-rules';

const STORAGE_KEY = 'screeningRules';

// 규칙은 chrome.storage.local에 저장. 최초 진입 시 큐레이션 규칙(전부 ON) + 시드 규칙(전부 OFF)을 깔아준다.
// 기존 저장본에는 빠진 큐레이션 규칙을 병합해 항상 노출되게 한다.
export function useScreeningRules() {
  const [rules, setRules] = useState<Rule[] | null>(null);

  useEffect(() => {
    let alive = true;

    void browser.storage.local.get(STORAGE_KEY).then((stored) => {
      if (!alive) return;
      const saved = stored[STORAGE_KEY] as Rule[] | undefined;
      if (Array.isArray(saved)) {
        const merged = mergeCurationRules(saved);
        setRules(merged);
        if (merged !== saved) void browser.storage.local.set({ [STORAGE_KEY]: merged });
      } else {
        const initial = [...CURATION_RULES, ...SEED_RULES];
        setRules(initial);
        void browser.storage.local.set({ [STORAGE_KEY]: initial });
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback((next: Rule[]) => {
    setRules(next);
    void browser.storage.local.set({ [STORAGE_KEY]: next });
  }, []);

  return { rules, save };
}
