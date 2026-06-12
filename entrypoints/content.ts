import { onMessage, type FillField, type FillResult } from '../lib/messaging';
import { startBannerAnchor } from './content/banner-anchor';
import { openBrandEditor } from '../lib/shopby/brand-editor-open';
import { startExtraInfoGuide } from '../lib/shopby/brand-extra-info-guide';
import { openCategoryEditor } from '../lib/shopby/category-editor-open';
import { startCategoryCodeGuide } from '../lib/shopby/category-code-guide';
import {
  fillDisplayRadios,
  isDisplayRadioKey,
} from '../lib/shopby/display-radios';
import { fillByMap, type FieldMap } from '../lib/shopby/fill';
import { DISPLAY_FIELD_MAP } from '../lib/shopby/selectors';
import { collectScreeningList } from '../lib/shopby/screening/collect';
import { waitForScreeningParse } from '../lib/shopby/screening/popup-parser';

// 진열 값 읽기(readCurrentDisplay)는 background가 scripting.executeScript로 전 프레임을
// 직접 훑는다(docs/recon.md: 폼이 iframe에 있어 메시지 브로드캐스트 레이스로 누락됨). 여기선 처리하지 않는다.

export default defineContentScript({
  // 정찰(docs/recon.md): 어드민 폼은 *.shopby.co.kr 도메인에서 렌더된다.
  // 부모(service.shopby.co.kr)와 iframe(enterprise-remote.shopby.co.kr) 양쪽에 주입해야
  // 어느 origin에 폼이 렌더돼도 닿는다. 실제 부착은 URL 가드(/headless-banners/edit) +
  // 모드 가드(sectionName value의 "띠배너")가 좁혀준다.
  matches: ['https://*.shopby.co.kr/*'],
  allFrames: true,
  main() {
    onMessage('fillDisplay', (message) => fillDisplayFields(message.data));
    onMessage('openBrandEditor', (message) =>
      openBrandEditor(document, message.data),
    );
    onMessage('openCategoryEditor', (message) =>
      openCategoryEditor(document, message.data),
    );
    // 심사 스캔: 사이드패널이 frameId를 지정해 보내므로(그리드 프레임 사전 탐색)
    // 멀티프레임 브로드캐스트 레이스(docs/recon.md) 문제가 없다.
    onMessage('collectScreeningList', () => collectScreeningList(document));
    onMessage('parseScreeningPopup', () => waitForScreeningParse(document));
    startExtraInfoGuide(document);
    startCategoryCodeGuide(document);
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
