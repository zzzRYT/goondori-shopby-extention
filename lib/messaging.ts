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

interface Protocol {
  fillDisplay(fields: FillField[]): FillResult;
  readCurrentDisplay(): Record<string, string>;
  // 브랜드 탭 row 클릭 → 관리자 탭의 브랜드 트리에서 해당 브랜드 선택.
  openBrandEditor(request: OpenBrandEditorRequest): OpenBrandEditorResult;
  // 전시카테고리 탭 row 클릭 → 관리자 탭의 카테고리 트리에서 해당 카테고리 선택.
  openCategoryEditor(request: OpenCategoryEditorRequest): OpenCategoryEditorResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Protocol>();
