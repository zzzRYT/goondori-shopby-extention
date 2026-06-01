import { defineExtensionMessaging } from '@webext-core/messaging';

export type FillField = { key: string; value: string };

export type FillResult = {
  filled: { key: string }[];
  failed: { key: string; reason: string }[];
};

export type OpenBrandEditorRequest = {
  name: string;
  brandNo: number;
};

export type OpenBrandEditorStatus = 'opened' | 'not-found' | 'wrong-host';

export type OpenBrandEditorResult = {
  status: OpenBrandEditorStatus;
  message?: string;
};

export type OpenCategoryEditorRequest = {
  name: string;
  categoryNo: number;
  depth: number;
};

export type OpenCategoryEditorStatus = 'opened' | 'not-found' | 'wrong-host';

export type OpenCategoryEditorResult = {
  status: OpenCategoryEditorStatus;
  message?: string;
};

// 한 단계 = 어드민 폼에서 이 카테고리의 관리코드를 newCode로 바꿔 저장.
export type CategoryReorderStep = {
  categoryNo: number;
  name: string;
  newCode: string;
};

export type ApplyCategoryReorderRequest = {
  env: 'c' | 'ct';
  steps: CategoryReorderStep[];
};

export type ApplyCategoryReorderStatus = 'done' | 'partial' | 'wrong-host' | 'aborted';

export type ApplyCategoryReorderResult = {
  status: ApplyCategoryReorderStatus;
  // 성공적으로 저장된 단계 수.
  applied: number;
  // 중단된 경우 멈춘 단계 정보.
  failedAt?: { index: number; name: string; reason: string };
};

interface Protocol {
  fillDisplay(fields: FillField[]): FillResult;
  readCurrentDisplay(): Record<string, string>;
  // 브랜드 탭 row 클릭 → 관리자 탭의 브랜드 트리에서 해당 브랜드 선택.
  openBrandEditor(request: OpenBrandEditorRequest): OpenBrandEditorResult;
  // 전시카테고리 탭 row 클릭 → 관리자 탭의 카테고리 트리에서 해당 카테고리 선택.
  openCategoryEditor(request: OpenCategoryEditorRequest): OpenCategoryEditorResult;
  // 전시카테고리 순서 변경 시퀀스를 어드민 폼에 단계별로 적용(코드 변경 + 저장 반복).
  applyCategoryReorder(request: ApplyCategoryReorderRequest): ApplyCategoryReorderResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Protocol>();
