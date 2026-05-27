import { defineExtensionMessaging } from '@webext-core/messaging';

export type FillField = { key: string; value: string };

export type FillResult = {
  filled: { key: string }[];
  failed: { key: string; reason: string }[];
};

interface Protocol {
  fillDisplay(fields: FillField[]): FillResult;
  fillBanner(fields: FillField[]): FillResult;
  // 노출 설정 팝업(popup-remote.shopby.co.kr)의 노출 방식 라디오 설정.
  fillExposure(fields: FillField[]): FillResult;
  readCurrentDisplay(): Record<string, string>;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Protocol>();
