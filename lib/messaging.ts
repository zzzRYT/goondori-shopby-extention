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

interface Protocol {
  fillDisplay(fields: FillField[]): FillResult;
  fillBanner(fields: FillField[]): FillResult;
  // 노출 설정 팝업(popup-remote.shopby.co.kr)의 노출 방식 라디오 설정.
  fillExposure(fields: FillField[]): FillResult;
  readCurrentDisplay(): Record<string, string>;
  // 브랜드 탭 row 클릭 → 관리자 탭의 브랜드 트리에서 해당 브랜드 선택.
  openBrandEditor(request: OpenBrandEditorRequest): OpenBrandEditorResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Protocol>();
