import {
  onMessage,
  sendMessage,
  type FillField,
  type FillResult,
  type OpenBrandEditorRequest,
  type OpenBrandEditorResult,
  type OpenCategoryEditorRequest,
  type OpenCategoryEditorResult,
} from '../lib/messaging';
import { DISPLAY_FIELD_MAP } from '../lib/shopby/selectors';

export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id == null) return;
    await browser.sidePanel.open({ tabId: tab.id });
  });

  onMessage('fillDisplay', async (message) => sendToActiveTab('fillDisplay', message.data));
  onMessage('readCurrentDisplay', async () => readActiveTabDisplay());
  onMessage('openBrandEditor', async (message) => relayOpenBrandEditor(message.data));
  onMessage('openCategoryEditor', async (message) => relayOpenCategoryEditor(message.data));
});

async function sendToActiveTab(type: 'fillDisplay', fields: FillField[]): Promise<FillResult> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id == null) {
    return { filled: [], failed: fields.map((field) => ({ key: field.key, reason: 'active tab not found' })) };
  }

  return sendMessage(type, fields, activeTab.id);
}

// 진열 수정 폼은 enterprise-remote.shopby.co.kr iframe 안에 렌더되는데(docs/recon.md),
// tabs.sendMessage는 frameId를 주지 않으면 모든 프레임에 뿌리고 "가장 먼저 응답한" 프레임의
// 결과만 돌려준다 → 폼 없는 최상위 셸이 빈 객체로 레이스를 이기면 실제 값이 버려진다.
// 채우기는 DOM을 바꾸는 부수효과라 레이스를 이겨도 iframe이 채워지지만, 읽기는 응답 자체가
// 결과라 누락된다. 그래서 읽기는 scripting으로 전 프레임을 훑어 폼이 있는 프레임을 고른다.
async function readActiveTabDisplay(): Promise<Record<string, string>> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id == null) return {};

  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: readFieldsFromFrame,
      args: [DISPLAY_FIELD_MAP],
    });

    // 입력 필드가 실제로 존재하는(키가 하나라도 있는) 프레임의 결과를 채택한다.
    for (const injection of results) {
      const value = injection.result;
      if (value && Object.keys(value).length > 0) return value;
    }

    return {};
  } catch {
    return {};
  }
}

// 각 프레임에 주입되어 실행된다. 바깥 스코프를 참조하면 안 되므로 셀렉터 맵을 인자로 받는다.
function readFieldsFromFrame(fieldMap: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, selector] of Object.entries(fieldMap)) {
    const element = document.querySelector(selector);
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      out[key] = element.value;
    }
  }

  return out;
}

async function relayOpenBrandEditor(request: OpenBrandEditorRequest): Promise<OpenBrandEditorResult> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id == null) {
    return { status: 'wrong-host', message: '활성 탭을 찾지 못했어요' };
  }

  try {
    return await sendMessage('openBrandEditor', request, activeTab.id);
  } catch (error) {
    return { status: 'wrong-host', message: error instanceof Error ? error.message : '관리자 탭이 아니에요' };
  }
}

// 사이드패널 → background → 활성(어드민) 탭 content script로 릴레이.
// @webext-core/messaging의 sendMessage는 확장 페이지에서 background로만 가므로
// background가 tabId를 붙여 다시 보내야 content script에 닿는다.
async function relayOpenCategoryEditor(
  request: OpenCategoryEditorRequest,
): Promise<OpenCategoryEditorResult> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id == null) {
    return { status: 'wrong-host', message: '활성 탭을 찾지 못했어요' };
  }

  try {
    return await sendMessage('openCategoryEditor', request, activeTab.id);
  } catch (error) {
    return { status: 'wrong-host', message: error instanceof Error ? error.message : '관리자 탭이 아니에요' };
  }
}
