import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FieldHintSpec } from './FieldHints';
import { HintManager } from './HintManager';

const SAMPLE_SPECS: readonly FieldHintSpec[] = [
  {
    find: 'input[name^="accounts."][name$=".accountName"]',
    anchorSelector: '.input-container',
    tone: 'warn',
    message: 'TEST 구좌명 가이드',
  },
  {
    find: 'input[name^="accounts."][name$=".width"]',
    anchorSelector: '.flex-wrap',
    tone: 'info',
    message: 'TEST 사이즈 가이드',
  },
];

function buildAccountRow(index: number) {
  // 어드민 fixture 일부를 모사. .input-container 안에 accountName, 같은 .flex-wrap 안에 width/height.
  const wrap = document.createElement('div');
  wrap.className = 'flex-wrap';

  const container = document.createElement('div');
  container.className = 'input-container';
  const accountInput = document.createElement('input');
  accountInput.name = `accounts.${index}.accountName`;
  container.append(accountInput);
  wrap.append(container);

  const widthInput = document.createElement('input');
  widthInput.name = `accounts.${index}.width`;
  const heightInput = document.createElement('input');
  heightInput.name = `accounts.${index}.height`;
  wrap.append(widthInput, heightInput);

  return { wrap, accountInput, widthInput, heightInput };
}

function buildAccountToggleHeader(index: number) {
  // <div class="...top..."><h3>구좌 N</h3>...<span class="radio-group">...</span></div>
  const top = document.createElement('div');
  top.className = 'headless-banners-registration_top__abc';
  const h3 = document.createElement('h3');
  h3.textContent = `구좌 ${index}`;
  const radioGroup = document.createElement('span');
  radioGroup.className = 'radio-group';
  top.append(h3, radioGroup);
  return top;
}

function nextFrame() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function flushMicrotasks() {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}

let manager: HintManager;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  manager?.stop();
  document.body.innerHTML = '';
});

describe('HintManager', () => {
  it('start 시 매칭되는 모든 input 옆에 가이드 호스트를 부착한다', async () => {
    const { wrap } = buildAccountRow(0);
    document.body.append(wrap);

    manager = new HintManager({ specs: SAMPLE_SPECS });
    manager.start(document);
    await flushMicrotasks();

    // accountName 1개 + width 1개 = 호스트 2개
    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(2);
  });

  it('가이드는 지정된 anchorSelector 다음 sibling 위치에 들어간다', async () => {
    const { wrap } = buildAccountRow(0);
    document.body.append(wrap);

    manager = new HintManager({ specs: SAMPLE_SPECS });
    manager.start(document);
    await flushMicrotasks();

    const container = wrap.querySelector('.input-container')!;
    expect(container.nextElementSibling?.classList.contains('ext-shopby-hint')).toBe(true);

    // width 가이드는 .flex-wrap 의 next sibling (전체 row 아래)
    expect(wrap.nextElementSibling?.classList.contains('ext-shopby-hint')).toBe(true);
  });

  it('새로 추가된 input에도 부착한다 (MutationObserver)', async () => {
    manager = new HintManager({ specs: SAMPLE_SPECS });
    manager.start(document);
    await flushMicrotasks();
    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(0);

    const { wrap } = buildAccountRow(0);
    document.body.append(wrap);
    await nextFrame();
    await flushMicrotasks();

    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(2);
  });

  it('같은 input에 같은 스펙을 중복 부착하지 않는다', async () => {
    const { wrap } = buildAccountRow(0);
    document.body.append(wrap);

    manager = new HintManager({ specs: SAMPLE_SPECS });
    manager.start(document);
    await flushMicrotasks();

    // MutationObserver가 같은 input을 다시 본 척, 다른 row를 붙여 트리거.
    document.body.append(buildAccountRow(1).wrap);
    await nextFrame();
    await flushMicrotasks();

    // 2 row × (account + width) = 4
    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(4);
  });

  it('input이 제거되면 부착된 가이드도 제거한다', async () => {
    const { wrap, accountInput } = buildAccountRow(0);
    document.body.append(wrap);

    manager = new HintManager({ specs: SAMPLE_SPECS });
    manager.start(document);
    await flushMicrotasks();
    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(2);

    accountInput.remove();
    await nextFrame();
    await flushMicrotasks();

    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(1);
  });

  it('stop()을 호출하면 모든 가이드를 정리하고 옵저버를 끊는다', async () => {
    const { wrap } = buildAccountRow(0);
    document.body.append(wrap);

    manager = new HintManager({ specs: SAMPLE_SPECS });
    manager.start(document);
    await flushMicrotasks();

    manager.stop();
    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(0);

    document.body.append(buildAccountRow(1).wrap);
    await nextFrame();
    await flushMicrotasks();

    // stop 이후엔 새 input도 부착하지 않는다
    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(0);
  });

  it('스펙 목록이 비어있으면 아무 것도 부착하지 않는다', async () => {
    const { wrap } = buildAccountRow(0);
    document.body.append(wrap);

    manager = new HintManager({ specs: [] });
    manager.start(document);
    await flushMicrotasks();

    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(0);
  });

  it('함수형 find로 찾은 비-input 요소(예: 구좌 헤더)에도 부착한다', async () => {
    const header0 = buildAccountToggleHeader(1);
    const header1 = buildAccountToggleHeader(2);
    const unrelated = document.createElement('div');
    const unrelatedH3 = document.createElement('h3');
    unrelatedH3.textContent = '쇼핑몰';
    unrelated.append(unrelatedH3);
    document.body.append(header0, header1, unrelated);

    const findHeaders = (root: ParentNode): Element[] =>
      Array.from(root.querySelectorAll('h3'))
        .filter((h3) => /^구좌\s*\d+/.test(h3.textContent?.trim() ?? ''))
        .flatMap((h3) => (h3.parentElement ? [h3.parentElement] : []));

    manager = new HintManager({
      specs: [{ find: findHeaders, tone: 'warn', message: 'TEST 구좌 사용 가이드' }],
    });
    manager.start(document);
    await flushMicrotasks();

    // 구좌 1, 구좌 2 두 헤더에만 부착, "쇼핑몰" h3는 스킵.
    expect(document.querySelectorAll('.ext-shopby-hint')).toHaveLength(2);
    expect(header0.nextElementSibling?.classList.contains('ext-shopby-hint')).toBe(true);
    expect(header1.nextElementSibling?.classList.contains('ext-shopby-hint')).toBe(true);
    expect(unrelated.nextElementSibling).toBeNull();
  });
});
