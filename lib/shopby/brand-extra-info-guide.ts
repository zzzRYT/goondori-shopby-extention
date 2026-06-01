import { EXTRA_INFO_INPUT_SELECTOR } from './selectors';

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
    <p style="margin:6px 0 0;padding:6px 8px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;color:#b91c1c;font-weight:600">🔴 노출 빼기(삭제): 슬롯 토큰 <code>c_1</code>·<code>ct_1</code> 등의 값을 <code>''</code>(빈 값)으로 바꿔 저장하면 진열에서 제외됩니다.</p>
    <p style="margin:6px 0 0">익스텐션의 <strong>브랜드</strong> 탭에서 실제 노출 모습을 미리 볼 수 있어요.</p>
  `;

  return aside;
}

function injectGuideBelow(input: HTMLInputElement) {
  const doc = input.ownerDocument;
  if (input.dataset.goondoriGuideAttached === '1') return;
  input.dataset.goondoriGuideAttached = '1';

  const guide = buildGuide(doc);
  // input은 .input-field 래퍼(+ 글자수 카운트) 안에 들어 있다. 가이드가 래퍼
  // 안쪽이 아니라 행 아래에 깔리도록, 래퍼가 있으면 그 뒤에 붙인다.
  const anchor = input.closest('.input-field') ?? input;
  anchor.insertAdjacentElement('afterend', guide);
}

function scan(root: Document | Element) {
  const matches = root.querySelectorAll<HTMLInputElement>(EXTRA_INFO_INPUT_SELECTOR);
  matches.forEach(injectGuideBelow);
}

// 브랜드 수정 페이지의 extraInfo input을 감지해 토큰 가이드를 inject한다.
// SPA 라우팅·iframe 재렌더에도 대응하도록 MutationObserver로 지속 감시.
// 반환된 cleanup으로 observer를 해제할 수 있다.
export function startExtraInfoGuide(doc: Document): () => void {
  scan(doc);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(EXTRA_INFO_INPUT_SELECTOR) && node instanceof HTMLInputElement) {
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
