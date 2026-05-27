import { onMessage, type FillField, type FillResult } from '../lib/messaging';
import { fillByMap, type FieldMap } from '../lib/shopby/fill';
import { BANNER_FIELD_MAP, DISPLAY_FIELD_MAP } from '../lib/shopby/selectors';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    onMessage('fillDisplay', (message) => fillShopbyFields(DISPLAY_FIELD_MAP, message.data));
    onMessage('fillBanner', (message) => fillShopbyFields(BANNER_FIELD_MAP, message.data));
    onMessage('readCurrentDisplay', () => readByMap(DISPLAY_FIELD_MAP));
  },
});

function fillShopbyFields(fieldMap: FieldMap, fields: FillField[]): FillResult {
  if (!isShopbyAdminHost(location.hostname)) {
    return {
      filled: [],
      failed: fields.map((field) => ({ key: field.key, reason: '어드민 페이지에서 열어주세요' })),
    };
  }

  const result = fillByMap(document, fieldMap, fields);
  highlightResult(fieldMap, result);
  return result;
}

function readByMap(fieldMap: FieldMap): Record<string, string> {
  if (!isShopbyAdminHost(location.hostname)) return {};

  return Object.fromEntries(
    Object.entries(fieldMap).flatMap(([key, selector]) => {
      const element = document.querySelector(selector);
      if (!isReadableElement(element)) return [];
      return [[key, element.value]];
    }),
  );
}

function highlightResult(fieldMap: FieldMap, result: FillResult) {
  for (const item of result.filled) {
    const element = document.querySelector(fieldMap[item.key]);
    if (element instanceof HTMLElement) flashElement(element, '#12b76a');
  }

  for (const item of result.failed) {
    const selector = fieldMap[item.key];
    const element = selector ? document.querySelector(selector) : null;
    if (element instanceof HTMLElement) flashElement(element, '#f04438');
  }
}

function flashElement(element: HTMLElement, color: string) {
  const previousOutline = element.style.outline;
  const previousOutlineOffset = element.style.outlineOffset;

  element.style.outline = `2px solid ${color}`;
  element.style.outlineOffset = '2px';

  window.setTimeout(() => {
    element.style.outline = previousOutline;
    element.style.outlineOffset = previousOutlineOffset;
  }, 1400);
}

function isShopbyAdminHost(hostname: string) {
  return hostname.endsWith('.shopby.co.kr') || hostname.endsWith('.e-ncp.com');
}

function isReadableElement(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}
