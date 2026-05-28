import { AttachManager } from './AttachManager';
import shadowStyles from './style.css?inline';

const PATH_GUARD = '/headless-banners/edit';
const SECTION_NAME_SELECTOR = 'input[name="sectionName"]';
const STRIP_NAME_TOKEN = '띠배너';

// 어드민 띠 배너 페이지(`/headless-banners/edit`)에서만 인라인 위젯을 띄운다.
// 메인 배너와 띠 배너는 URL이 동일하므로(recon.md), 상단 `sectionName` input의 value에
// "띠배너"가 포함됐을 때만 부착한다.
export function startBannerAnchor(rootDoc: Document = document): () => void {
  if (!rootDoc.location.pathname.includes(PATH_GUARD)) {
    return () => {};
  }

  const manager = new AttachManager({ styleSheet: shadowStyles });
  let attached = false;

  function isStripMode(): boolean {
    const sectionName = rootDoc.querySelector<HTMLInputElement>(SECTION_NAME_SELECTOR);
    return sectionName?.value.includes(STRIP_NAME_TOKEN) ?? false;
  }

  function sync() {
    if (isStripMode()) {
      if (!attached) {
        manager.start(rootDoc);
        attached = true;
      }
    } else if (attached) {
      manager.stop();
      attached = false;
    }
  }

  sync();

  // SPA가 sectionName을 비동기로 렌더하거나 다른 배너로 라우팅할 수 있으므로
  // DOM mutation + input value 변경을 함께 감시한다.
  const observer = new MutationObserver(sync);
  observer.observe(rootDoc.body ?? rootDoc.documentElement, { childList: true, subtree: true });

  const valueHandler = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.name === 'sectionName') sync();
  };
  rootDoc.addEventListener('input', valueHandler, true);

  return function stop() {
    observer.disconnect();
    rootDoc.removeEventListener('input', valueHandler, true);
    if (attached) manager.stop();
    attached = false;
  };
}
