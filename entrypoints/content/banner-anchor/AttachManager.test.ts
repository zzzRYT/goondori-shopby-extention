import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SectionEntry } from '../../../lib/shopby/api/types';
import { AttachManager } from './AttachManager';
import { resetSectionsCache } from './sectionsCache';

const SAMPLE: SectionEntry[] = [
  { sectionNo: 1, sectionId: 'ct_3_s_b_43215615', sectionName: 'OO 매대' },
];

const ACCOUNT_SELECTOR = 'input[name^="accounts."][name$=".accountName"]';

function makeAccountInput(index: number, value = ''): HTMLInputElement {
  const input = document.createElement('input');
  input.name = `accounts.${index}.accountName`;
  input.value = value;
  return input;
}

function flushMicrotasks() {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}

function nextFrame() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

let manager: AttachManager;

beforeEach(() => {
  resetSectionsCache();
  document.body.innerHTML = '';
});

afterEach(() => {
  manager?.stop();
  document.body.innerHTML = '';
});

describe('AttachManager', () => {
  it('start 시 이미 존재하는 모든 매칭 input에 위젯 앵커를 부착한다', async () => {
    document.body.append(makeAccountInput(0), makeAccountInput(1));
    manager = new AttachManager({ loadSections: () => Promise.resolve(SAMPLE) });

    manager.start(document);
    await flushMicrotasks();

    expect(document.querySelectorAll('.ext-shopby-anchor')).toHaveLength(2);
  });

  it('새로 추가된 매칭 input에도 부착한다 (MutationObserver)', async () => {
    manager = new AttachManager({ loadSections: () => Promise.resolve(SAMPLE) });
    manager.start(document);
    await flushMicrotasks();
    expect(document.querySelectorAll('.ext-shopby-anchor')).toHaveLength(0);

    document.body.append(makeAccountInput(0));
    await nextFrame();
    await flushMicrotasks();

    expect(document.querySelectorAll('.ext-shopby-anchor')).toHaveLength(1);
  });

  it('이미 부착된 input은 중복 부착하지 않는다 (재렌더 시뮬레이션)', async () => {
    const input = makeAccountInput(0);
    document.body.append(input);
    manager = new AttachManager({ loadSections: () => Promise.resolve(SAMPLE) });

    manager.start(document);
    await flushMicrotasks();

    document.body.append(makeAccountInput(1));
    await nextFrame();
    await flushMicrotasks();

    document.body.append(makeAccountInput(2));
    await nextFrame();
    await flushMicrotasks();

    expect(document.querySelectorAll('.ext-shopby-anchor')).toHaveLength(3);
    expect(document.querySelectorAll(ACCOUNT_SELECTOR)).toHaveLength(3);
  });

  it('input이 제거되면 해당 앵커도 제거한다', async () => {
    const input = makeAccountInput(0);
    document.body.append(input);
    manager = new AttachManager({ loadSections: () => Promise.resolve(SAMPLE) });
    manager.start(document);
    await flushMicrotasks();
    expect(document.querySelectorAll('.ext-shopby-anchor')).toHaveLength(1);

    input.remove();
    await nextFrame();
    await flushMicrotasks();

    expect(document.querySelectorAll('.ext-shopby-anchor')).toHaveLength(0);
  });

  it('stop()을 호출하면 모든 앵커를 정리하고 옵저버를 끊는다', async () => {
    document.body.append(makeAccountInput(0), makeAccountInput(1));
    manager = new AttachManager({ loadSections: () => Promise.resolve(SAMPLE) });
    manager.start(document);
    await flushMicrotasks();

    manager.stop();

    expect(document.querySelectorAll('.ext-shopby-anchor')).toHaveLength(0);

    document.body.append(makeAccountInput(2));
    await nextFrame();
    await flushMicrotasks();

    // stop 이후엔 새 input도 부착하지 않는다
    expect(document.querySelectorAll('.ext-shopby-anchor')).toHaveLength(0);
  });

  it('매칭되지 않는 input(다른 name)에는 부착하지 않는다', async () => {
    const wrong = document.createElement('input');
    wrong.name = 'accounts.0.width';
    document.body.append(wrong);
    manager = new AttachManager({ loadSections: () => Promise.resolve(SAMPLE) });

    manager.start(document);
    await flushMicrotasks();

    expect(document.querySelectorAll('.ext-shopby-anchor')).toHaveLength(0);
  });
});
