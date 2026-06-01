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

export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id == null) return;
    await browser.sidePanel.open({ tabId: tab.id });
  });

  onMessage('fillDisplay', async (message) => sendToActiveTab('fillDisplay', message.data));
  onMessage('readCurrentDisplay', async () => sendToActiveTab('readCurrentDisplay', undefined));
  onMessage('openBrandEditor', async (message) => relayOpenBrandEditor(message.data));
  onMessage('openCategoryEditor', async (message) => relayOpenCategoryEditor(message.data));
});

async function sendToActiveTab(type: 'fillDisplay', fields: FillField[]): Promise<FillResult>;
async function sendToActiveTab(type: 'readCurrentDisplay', fields: undefined): Promise<Record<string, string>>;
async function sendToActiveTab(
  type: 'fillDisplay' | 'readCurrentDisplay',
  fields: FillField[] | undefined,
) {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id == null) {
    if (type === 'readCurrentDisplay') return {};
    return { filled: [], failed: fields?.map((field) => ({ key: field.key, reason: 'active tab not found' })) ?? [] };
  }

  if (type === 'readCurrentDisplay') {
    return sendMessage(type, undefined, activeTab.id);
  }

  return sendMessage(type, fields ?? [], activeTab.id);
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
