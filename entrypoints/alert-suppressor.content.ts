import { installAlertSuppressor } from '../lib/shopby/alert-suppressor';

// MAIN world 주입: 페이지(어드민 폼 iframe 포함)의 window.alert/confirm을 래핑한다.
// 평소엔 원본 그대로 동작하고, isolated 콘텐츠 스크립트가 reorder 배치 동안만
// documentElement의 자동확인 플래그를 켜면 그때만 자동 통과 + 메시지 캡처한다.
// (네이티브 다이얼로그는 isolated world에서 닫을 수 없어 MAIN world 선주입이 필요)
export default defineContentScript({
  matches: ['https://*.shopby.co.kr/*'],
  allFrames: true,
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installAlertSuppressor(window);
  },
});
