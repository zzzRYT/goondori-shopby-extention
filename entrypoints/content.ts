import { onMessage, type FillField, type FillResult } from '../lib/messaging';
import { startBannerAnchor } from './content/banner-anchor';
import { openBrandEditor } from '../lib/shopby/brand-editor-open';
import { startExtraInfoGuide } from '../lib/shopby/brand-extra-info-guide';
import {
  fillDisplayRadios,
  isDisplayRadioKey,
} from '../lib/shopby/display-radios';
import { fillByMap, type FieldMap } from '../lib/shopby/fill';
import { DISPLAY_FIELD_MAP } from '../lib/shopby/selectors';

export default defineContentScript({
  // 정찰(docs/recon.md): 어드민 폼은 *.shopby.co.kr 도메인에서 렌더된다.
  // 부모(service.shopby.co.kr)와 iframe(enterprise-remote.shopby.co.kr) 양쪽에 주입해야
  // 어느 origin에 폼이 렌더돼도 닿는다. 실제 부착은 URL 가드(/headless-banners/edit) +
  // 모드 가드(sectionName value의 "띠배너")가 좁혀준다.
  matches: ['https://*.shopby.co.kr/*'],
  allFrames: true,
  main() {
    onMessage('fillDisplay', (message) => fillDisplayFields(message.data));
    onMessage('readCurrentDisplay', () => readByMap(DISPLAY_FIELD_MAP));
    onMessage('openBrandEditor', (message) =>
      openBrandEditor(document, message.data),
    );
    startExtraInfoGuide(document);
    startBannerAnchor();
  },
});

function fillDisplayFields(fields: FillField[]): FillResult {
  if (!isShopbyAdminHost(location.hostname)) {
    return adminHostError(fields);
  }

  // 노출여부는 라디오(별도 채움 경로), 그 외는 텍스트 input 셀렉터 맵.
  const radioFields = fields.filter((field) => isDisplayRadioKey(field.key));
  const textFields = fields.filter((field) => !isDisplayRadioKey(field.key));

  const textResult = fillByMap(document, DISPLAY_FIELD_MAP, textFields);
  highlightResult(DISPLAY_FIELD_MAP, textResult);
  const radioResult = fillDisplayRadios(document, radioFields);

  return {
    filled: [...textResult.filled, ...radioResult.filled],
    failed: [...textResult.failed, ...radioResult.failed],
  };
}

function adminHostError(fields: FillField[]): FillResult {
  return {
    filled: [],
    failed: fields.map((field) => ({
      key: field.key,
      reason: '어드민 페이지에서 열어주세요',
    })),
  };
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

function isReadableElement(
  element: Element | null,
): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}
