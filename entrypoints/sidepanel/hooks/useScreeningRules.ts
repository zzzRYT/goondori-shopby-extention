import { useCallback, useEffect, useState } from 'react';
import type { Rule } from '../../../lib/shopby/screening/rules';
import { SEED_RULES } from '../../../lib/shopby/screening/seed-rules';

const STORAGE_KEY = 'screeningRules';

// 규칙은 chrome.storage.local에 저장. 최초 진입 시 시드 규칙(전부 OFF)을 깔아준다.
export function useScreeningRules() {
  const [rules, setRules] = useState<Rule[] | null>(null);

  useEffect(() => {
    let alive = true;

    void browser.storage.local.get(STORAGE_KEY).then((stored) => {
      if (!alive) return;
      const saved = stored[STORAGE_KEY] as Rule[] | undefined;
      if (Array.isArray(saved)) {
        setRules(saved);
      } else {
        setRules(SEED_RULES);
        void browser.storage.local.set({ [STORAGE_KEY]: SEED_RULES });
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
