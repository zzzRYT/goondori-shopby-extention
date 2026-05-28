import {
  onMessage,
  sendMessage,
  type FillField,
  type FillResult,
  type OpenBrandEditorRequest,
  type OpenBrandEditorResult,
} from '../lib/messaging';

export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id == null) return;
    await browser.sidePanel.open({ tabId: tab.id });
  });

  onMessage('fillDisplay', async (message) => sendToActiveTab('fillDisplay', message.data));
  onMessage('readCurrentDisplay', async () => sendToActiveTab('readCurrentDisplay', undefined));
  onMessage('openBrandEditor', async (message) => relayOpenBrandEditor(message.data));
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
