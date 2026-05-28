import { EXTRA_INFO_TEXTAREA_SELECTOR } from './selectors';

export const GUIDE_MARKER_ATTR = 'data-goondori-guide';
const GUIDE_VALUE = 'extra-info';

function buildGuide(doc: Document): HTMLElement {
  const aside = doc.createElement('aside');
  aside.setAttribute(GUIDE_MARKER_ATTR, GUIDE_VALUE);
  aside.style.cssText = [
    'margin: 8px 0',
    'padding: 10px 12px',
    'background: #f4f6fb',
    'border-left: 3px solid #1d4ed8',
    'border-radius: 6px',
    'font-size: 12px',
    'color: #1d2939',
    'line-height: 1.5',
  ].join(';');

  aside.innerHTML = `
    <p style="margin:0 0 6px;font-weight:600">군돌이 브랜드 노출 가이드</p>
    <ul style="margin:0 0 6px 18px;padding:0">
      <li><code>c_&lt;순번&gt;</code> — 운영(prod) 환경 노출 슬롯 (예: <code>c_1</code>, <code>c_2</code>)</li>
      <li><code>ct_&lt;순번&gt;</code> — 개발(dev) 환경 노출 슬롯 (예: <code>ct_1</code>, <code>ct_2</code>)</li>
    </ul>
    <p style="margin:0">콤마·공백·세미콜론으로 구분. 두 환경 동시 지정 가능.</p>
    <p style="margin:6px 0 0">익스텐션의 <strong>브랜드</strong> 탭에서 실제 노출 모습을 미리 볼 수 있어요.</p>
  `;

  return aside;
}

function injectGuideBelow(textarea: HTMLTextAreaElement) {
  const doc = textarea.ownerDocument;
  if (textarea.dataset.goondoriGuideAttached === '1') return;
  textarea.dataset.goondoriGuideAttached = '1';

  const guide = buildGuide(doc);
  textarea.insertAdjacentElement('afterend', guide);
}

function scan(root: Document | Element) {
  const matches = root.querySelectorAll<HTMLTextAreaElement>(EXTRA_INFO_TEXTAREA_SELECTOR);
  matches.forEach(injectGuideBelow);
}

// 브랜드 수정 페이지의 extraInfo textarea를 감지해 토큰 가이드를 inject한다.
// SPA 라우팅·iframe 재렌더에도 대응하도록 MutationObserver로 지속 감시.
// 반환된 cleanup으로 observer를 해제할 수 있다.
export function startExtraInfoGuide(doc: Document): () => void {
  scan(doc);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(EXTRA_INFO_TEXTAREA_SELECTOR) && node instanceof HTMLTextAreaElement) {
          injectGuideBelow(node);
        } else {
          scan(node);
        }
      }
    }
  });

  observer.observe(doc.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}
