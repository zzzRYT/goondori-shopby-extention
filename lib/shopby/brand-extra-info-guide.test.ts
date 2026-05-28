import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GUIDE_MARKER_ATTR, startExtraInfoGuide } from './brand-extra-info-guide';

describe('startExtraInfoGuide', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('textarea가 이미 있으면 즉시 가이드를 inject한다', () => {
    document.body.innerHTML = '<textarea name="extraInfo"></textarea>';

    cleanup = startExtraInfoGuide(document);

    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).not.toBeNull();
  });

  it('이미 inject된 textarea엔 다시 inject하지 않는다(멱등)', () => {
    document.body.innerHTML = '<textarea name="extraInfo"></textarea>';

    cleanup = startExtraInfoGuide(document);
    cleanup();
    cleanup = startExtraInfoGuide(document);

    expect(document.querySelectorAll(`[${GUIDE_MARKER_ATTR}]`)).toHaveLength(1);
  });

  it('나중에 textarea가 등장해도 MutationObserver로 잡아 inject한다', async () => {
    cleanup = startExtraInfoGuide(document);

    const ta = document.createElement('textarea');
    ta.setAttribute('name', 'extraInfo');
    document.body.appendChild(ta);

    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).not.toBeNull();
  });

  it('cleanup 호출 시 observer가 해제된다', async () => {
    cleanup = startExtraInfoGuide(document);
    cleanup();
    cleanup = undefined;

    const ta = document.createElement('textarea');
    ta.setAttribute('name', 'extraInfo');
    document.body.appendChild(ta);
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector(`[${GUIDE_MARKER_ATTR}]`)).toBeNull();
  });
});
