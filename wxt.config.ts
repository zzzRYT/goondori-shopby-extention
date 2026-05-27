import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '군도리 샵바이 진열·배너 관리',
    permissions: ['sidePanel', 'storage', 'activeTab', 'scripting'],
    // TODO(정찰): 실제 샵바이 어드민 origin 으로 교체
    host_permissions: ['https://*.shopby.co.kr/*', 'https://*.e-ncp.com/*'],
    side_panel: { default_path: 'sidepanel.html' },
    action: {},
  },
});
