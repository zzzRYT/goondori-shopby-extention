// Shop API 응답을 UI가 쓰기 좋게 정규화한 엔트리. 원본 응답에는 필드가 더 많지만
// 진열 ID 조립(브랜드 번호)·띠배너 연결(진열 ID)에 필요한 값만 추린다.
export type BrandEntry = {
  brandNo: number;
  name: string;
};

export type SectionEntry = {
  sectionNo: number;
  sectionId: string;
  sectionName: string;
};

// extraInfo + 썸네일을 포함한 진열 미리보기용 브랜드 엔트리.
// /display/brands/search-by-nos 응답을 UI에 쓰기 좋게 정규화한 형태.
export type ShowcaseBrand = {
  brandNo: number;
  name: string;
  extraInfo: string;
  imageUrl: string;
};
