import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SectionEntry } from '../../../lib/shopby/api/types';
import { getCachedSections, resetSectionsCache } from './sectionsCache';

const SAMPLE: SectionEntry[] = [
  { sectionNo: 1, sectionId: 'ct_3_s_b_43215615', sectionName: 'OO 매대' },
  { sectionNo: 2, sectionId: 'ct_3_s_b_43215621', sectionName: 'XX 매대' },
];

afterEach(() => {
  resetSectionsCache();
});

describe('sectionsCache', () => {
  it('첫 호출 시 loader를 1회 실행하고 결과를 반환한다', async () => {
    const loader = vi.fn().mockResolvedValue(SAMPLE);

    const result = await getCachedSections(loader);

    expect(result).toEqual(SAMPLE);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('두 번째 호출은 loader를 다시 호출하지 않고 캐시 값을 반환한다', async () => {
    const loader = vi.fn().mockResolvedValue(SAMPLE);

    await getCachedSections(loader);
    const second = await getCachedSections(loader);

    expect(second).toEqual(SAMPLE);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('첫 호출이 미해결인 동안 추가 호출이 와도 loader는 1회만 실행한다', async () => {
    let resolveLoader: (value: SectionEntry[]) => void = () => {};
    const loader = vi.fn(
      () =>
        new Promise<SectionEntry[]>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const first = getCachedSections(loader);
    const second = getCachedSections(loader);

    resolveLoader(SAMPLE);

    expect(await first).toEqual(SAMPLE);
    expect(await second).toEqual(SAMPLE);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('loader가 실패하면 캐시를 비워 다음 호출에서 재시도할 수 있다', async () => {
    const failing = vi.fn().mockRejectedValueOnce(new Error('boom'));
    const succeeding = vi.fn().mockResolvedValue(SAMPLE);

    await expect(getCachedSections(failing)).rejects.toThrow('boom');
    const retry = await getCachedSections(succeeding);

    expect(retry).toEqual(SAMPLE);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });

  it('resetSectionsCache 후에는 loader를 다시 실행한다', async () => {
    const loader = vi.fn().mockResolvedValue(SAMPLE);

    await getCachedSections(loader);
    resetSectionsCache();
    await getCachedSections(loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
