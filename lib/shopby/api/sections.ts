import { shopApiGet } from './client';
import { SHOPBY_CLIENT_ID } from './config';
import type { SectionEntry } from './types';

type RawSection = {
  sectionNo: number;
  sectionId?: string | null;
  sectionName?: string | null;
};

type SectionsResponse = { sections?: RawSection[] | null };

// GET /display/sections — 상품 진열 리스트.
// 띠배너는 "연결할 진열 ID"가 필요하므로 sectionId가 비어 있는 진열은 연결 대상이 못 된다 → 제외.
// clientId 인자는 테스트 주입용. 기본값은 고정 설정을 쓴다.
export async function fetchSections(clientId: string = SHOPBY_CLIENT_ID): Promise<SectionEntry[]> {
  const data = await shopApiGet<SectionsResponse>('/display/sections', {}, clientId);

  return (data.sections ?? []).flatMap((section) => {
    const sectionId = section.sectionId?.trim();
    if (!sectionId) return [];

    return [
      {
        sectionNo: section.sectionNo,
        sectionId,
        sectionName: section.sectionName?.trim() || sectionId,
      },
    ];
  });
}
