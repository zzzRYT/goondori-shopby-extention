import { fetchSections } from '../../../lib/shopby/api/sections';
import type { SectionEntry } from '../../../lib/shopby/api/types';

export type SectionsLoader = () => Promise<SectionEntry[]>;

// content script 페이지 수명 동안만 살아 있는 진열 캐시.
// 같은 페이지의 모든 위젯이 첫 fetch를 공유하고, 실패 시 다음 호출에서 재시도할 수 있게 캐시를 비운다.
let pending: Promise<SectionEntry[]> | null = null;
let cached: SectionEntry[] | null = null;

export async function getCachedSections(loader: SectionsLoader = fetchSections): Promise<SectionEntry[]> {
  if (cached) return cached;
  if (pending) return pending;

  pending = loader()
    .then((result) => {
      cached = result;
      return result;
    })
    .catch((cause: unknown) => {
      throw cause;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}

export function resetSectionsCache(): void {
  pending = null;
  cached = null;
}
