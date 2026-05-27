import { defineExtensionMessaging } from '@webext-core/messaging';

export type FillField = { key: string; value: string };

export type FillResult = {
  filled: { key: string }[];
  failed: { key: string; reason: string }[];
};

interface Protocol {
  fillDisplay(fields: FillField[]): FillResult;
  fillBanner(fields: FillField[]): FillResult;
  readCurrentDisplay(): Record<string, string>;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Protocol>();
