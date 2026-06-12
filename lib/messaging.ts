import { defineExtensionMessaging } from '@webext-core/messaging';
import type {
  CollectScreeningListResult,
  ScreeningPopupResult,
} from './shopby/screening/types';

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
  // 심사 탭: 목록 페이지(그리드가 있는 프레임)에서 상품번호 전체 수집.
  collectScreeningList(): CollectScreeningListResult;
  // 심사 탭: 심사 팝업 탭에서 렌더 대기 후 상품 정보 파싱.
  parseScreeningPopup(): ScreeningPopupResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Protocol>();
