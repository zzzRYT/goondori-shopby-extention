import { AttachManager } from './AttachManager';
import { HintManager } from './HintManager';
import { ValidateButton } from './ValidateButton';
import { MAIN_BANNER_HINTS, STRIP_BANNER_HINTS } from './FieldHints';
import shadowStyles from './style.css?inline';

const PATH_GUARD = '/headless-banners/edit';
const SECTION_NAME_SELECTOR = 'input[name="sectionName"]';
const STRIP_NAME_TOKEN = '띠배너';
const MAIN_NAME_TOKEN = '메인배너';

type Mode = 'main' | 'strip' | null;

// 어드민 헤드리스 배너 페이지(`/headless-banners/edit`)에서만 가이드를 띄운다.
// 메인/띠는 URL이 같아 상단 `sectionName` input의 value로 판별한다.
// - 띠배너 → 진열 선택기(SectionAnchor) + 띠배너 전용 필드 가이드
// - 메인배너 → 메인배너 전용 필드 가이드 (진열 선택기는 부착 안 함)
export function startBannerAnchor(rootDoc: Document = document): () => void {
  if (!rootDoc.location.pathname.includes(PATH_GUARD)) {
    return () => {};
  }

  const sectionAnchorManager = new AttachManager({ styleSheet: shadowStyles });
  const stripHintManager = new HintManager({ specs: STRIP_BANNER_HINTS, styleSheet: shadowStyles });
  const mainHintManager = new HintManager({ specs: MAIN_BANNER_HINTS, styleSheet: shadowStyles });
  const stripValidateButton = new ValidateButton({ mode: 'strip', styleSheet: shadowStyles });
  const mainValidateButton = new ValidateButton({ mode: 'main', styleSheet: shadowStyles });

  let activeMode: Mode = null;

  function detectMode(): Mode {
    const value = rootDoc.querySelector<HTMLInputElement>(SECTION_NAME_SELECTOR)?.value ?? '';
    if (value.includes(STRIP_NAME_TOKEN)) return 'strip';
    if (value.includes(MAIN_NAME_TOKEN)) return 'main';
    return null;
  }

  function applyMode(next: Mode) {
    if (next === activeMode) return;

    // 모드 전환 시 이전 매니저는 모두 정리 후 새 모드 매니저만 시작.
    sectionAnchorManager.stop();
    stripHintManager.stop();
    mainHintManager.stop();
    stripValidateButton.stop();
    mainValidateButton.stop();

    if (next === 'strip') {
      sectionAnchorManager.start(rootDoc);
      stripHintManager.start(rootDoc);
      stripValidateButton.start(rootDoc);
    } else if (next === 'main') {
      mainHintManager.start(rootDoc);
      mainValidateButton.start(rootDoc);
    }

    activeMode = next;
  }

  function sync() {
    applyMode(detectMode());
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
    sectionAnchorManager.stop();
    stripHintManager.stop();
    mainHintManager.stop();
    stripValidateButton.stop();
    mainValidateButton.stop();
    activeMode = null;
  };
}
