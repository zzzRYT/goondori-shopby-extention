import { onMessage, sendMessage, type FillField, type FillResult } from '../lib/messaging';

export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id == null) return;
    await browser.sidePanel.open({ tabId: tab.id });
  });

  onMessage('fillDisplay', async (message) => sendToActiveTab('fillDisplay', message.data));
  onMessage('readCurrentDisplay', async () => sendToActiveTab('readCurrentDisplay', undefined));
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
