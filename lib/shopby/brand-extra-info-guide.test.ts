import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GUIDE_MARKER_ATTR, startExtraInfoGuide } from './brand-extra-info-guide';

// 실제 어드민 DOM: input[name="brandInfo.extraInfo"] 가 .input-field 래퍼 안에 있음.
const EXTRA_INFO_HTML =
  '<span class="input-field"><input name="brandInfo.extraInfo" type="text" value="" /></span>';

function makeExtraInfoInput(): HTMLInputElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'input-field';
  const input = document.createElement('input');
  input.setAttribute('name', 'brandInfo.extraInfo');
  input.type = 'text';
  wrapper.appendChild(input);
  document.body.appendChild(wrapper);
  return input;
}

describe('startExtraInfoGuide', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('input이 이미 있으면 즉시 가이드를 inject한다', () => {
    document.body.innerHTML = EXTRA_INFO_HTML;

    cleanup = startExtraInfoGuide(document);

    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).not.toBeNull();
  });

  it('가이드는 .input-field 래퍼 바깥(행 아래)에 붙는다', () => {
    document.body.innerHTML = EXTRA_INFO_HTML;

    cleanup = startExtraInfoGuide(document);

    const guide = document.querySelector(`[${GUIDE_MARKER_ATTR}]`);
    const wrapper = document.querySelector('.input-field');
    // 래퍼 안쪽이 아니라 형제로 바로 뒤에 와야 한다.
    expect(wrapper?.contains(guide ?? null)).toBe(false);
    expect(wrapper?.nextElementSibling).toBe(guide);
  });

  it('이미 inject된 input엔 다시 inject하지 않는다(멱등)', () => {
    document.body.innerHTML = EXTRA_INFO_HTML;

    cleanup = startExtraInfoGuide(document);
    cleanup();
    cleanup = startExtraInfoGuide(document);

    expect(document.querySelectorAll(`[${GUIDE_MARKER_ATTR}]`)).toHaveLength(1);
  });

  it('나중에 input이 등장해도 MutationObserver로 잡아 inject한다', async () => {
    cleanup = startExtraInfoGuide(document);

    makeExtraInfoInput();

    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).not.toBeNull();
  });

  it('cleanup 호출 시 observer가 해제된다', async () => {
    cleanup = startExtraInfoGuide(document);
    cleanup();
    cleanup = undefined;

    makeExtraInfoInput();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).toBeNull();
  });
});
