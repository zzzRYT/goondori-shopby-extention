import { DISPLAY_CATEGORY_CODE_INPUT_SELECTOR } from './selectors';

export const GUIDE_MARKER_ATTR = 'data-goondori-category-guide';
const GUIDE_VALUE = 'category-code';

function buildGuide(doc: Document): HTMLElement {
  const aside = doc.createElement('aside');
  aside.setAttribute(GUIDE_MARKER_ATTR, GUIDE_VALUE);
  aside.style.cssText = [
    'margin: 8px 0', 'padding: 10px 12px', 'background: #f4f6fb',
    'border-left: 3px solid #3fb382', 'border-radius: 6px',
    'font-size: 12px', 'color: #1d2939', 'line-height: 1.5',
  ].join(';');
  aside.innerHTML = `
    <p style="margin:0 0 6px;font-weight:600">군돌이 전시카테고리 코드 가이드</p>
    <ul style="margin:0 0 6px 18px;padding:0">
      <li><code>c_&lt;순번&gt;</code> — 운영(prod) 상위 카테고리 (예: <code>c_1</code>, <code>c_2</code>)</li>
      <li><code>ct_&lt;순번&gt;</code> — 개발(dev) 상위 카테고리 (예: <code>ct_1</code>, <code>ct_2</code>)</li>
    </ul>
    <p style="margin:0">하위 카테고리는 관리코드를 쓰지 않습니다.</p>
    <p style="margin:6px 0 0;padding:6px 8px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;color:#b91c1c;font-weight:600">🔴 노출 빼기(삭제): 상위 관리코드 <code>c_1</code>·<code>ct_1</code> 등의 값을 <code>''</code>(빈 값)으로 바꿔 저장하면 코드순 목록에서 제외됩니다.</p>
    <p style="margin:6px 0 0">익스텐션의 <strong>전시카테고리</strong> 탭에서 노출 모습을 미리 볼 수 있어요.</p>
  `;
  return aside;
}

function injectGuideBelow(input: HTMLInputElement) {
  if (input.dataset.goondoriCategoryGuideAttached === '1') return;
  input.dataset.goondoriCategoryGuideAttached = '1';
  input.insertAdjacentElement('afterend', buildGuide(input.ownerDocument));
}

function scan(root: Document | Element) {
  root.querySelectorAll<HTMLInputElement>(DISPLAY_CATEGORY_CODE_INPUT_SELECTOR).forEach(injectGuideBelow);
}

// 전시카테고리 편집 폼의 코드 입력란을 감지해 c_/ct_ 가이드를 주입. SPA 재렌더 대응.
export function startCategoryCodeGuide(doc: Document): () => void {
  scan(doc);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(DISPLAY_CATEGORY_CODE_INPUT_SELECTOR) && node instanceof HTMLInputElement) {
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
