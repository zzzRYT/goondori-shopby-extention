import { afterEach, describe, expect, it } from 'vitest';
import { GUIDE_MARKER_ATTR, startCategoryCodeGuide } from './category-code-guide';

afterEach(() => { document.body.innerHTML = ''; });

function makeCodeInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.className = 'display-category-management_input-code__abc';
  document.body.appendChild(input);
  return input;
}

describe('startCategoryCodeGuide', () => {
  it('코드 입력란 옆에 가이드를 1회 주입한다', () => {
    const input = makeCodeInput();
    const stop = startCategoryCodeGuide(document);
    const guide = document.querySelector(`[${GUIDE_MARKER_ATTR}]`);
    expect(guide).not.toBeNull();
    expect(input.nextElementSibling).toBe(guide);
    stop();
  });

  it('중복 주입하지 않는다', () => {
    makeCodeInput();
    const stop = startCategoryCodeGuide(document);
    startCategoryCodeGuide(document)();
    expect(document.querySelectorAll(`[${GUIDE_MARKER_ATTR}]`)).toHaveLength(1);
    stop();
  });

  it('나중에 추가된 코드 입력란도 observer가 잡는다', async () => {
    const stop = startCategoryCodeGuide(document);
    makeCodeInput();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).not.toBeNull();
    stop();
  });
});
