import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '군도리 샵바이 진열·배너 관리',
    permissions: ['sidePanel', 'storage', 'activeTab', 'scripting'],
    // 정찰(docs/recon.md): 편집 폼은 enterprise-remote.shopby.co.kr iframe 안에 렌더된다.
    // 부모 셸(*.shopby.co.kr)에서 사이드패널을 열고, 채우기는 remote iframe의 content script가 수행.
    // shop-api.e-ncp.com: 진열·브랜드 목록을 사이드패널에서 직접 조회(Shop API). host_permission으로 권한 부여.
    host_permissions: ['https://*.shopby.co.kr/*', 'https://shop-api.e-ncp.com/*'],
    side_panel: { default_path: 'sidepanel.html' },
    action: {},
  },
});
