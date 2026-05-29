import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SectionEntry } from '../../../lib/shopby/api/types';
import { resetSectionsCache } from './sectionsCache';
import { ValidateButton } from './ValidateButton';

const SECTIONS: SectionEntry[] = [
  { sectionNo: 1, sectionId: 'c_d1_p_t_병부장', sectionName: '병부장' },
];

function buildBottomBar(saveText = '저장') {
  // 어드민 fixture 하단 바 모사: <div class="right-wrap">목록 + 저장</div>
  const wrap = document.createElement('div');
  wrap.className = 'right-wrap';
  const listBtn = document.createElement('button');
  listBtn.type = 'button';
  listBtn.textContent = '목록';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = saveText;
  wrap.append(listBtn, saveBtn);
  return { wrap, listBtn, saveBtn };
}

function buildAccountSection(opts: {
  index: number;
  width?: string;
  height?: string;
  useY?: boolean;
}) {
  const wrap = document.createElement('div');
  const top = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = `구좌 ${opts.index + 1}`;
  const radioGroup = document.createElement('span');
  radioGroup.className = 'radio-group';
  const radioY = document.createElement('input');
  radioY.type = 'radio';
  radioY.className = 'radio';
  radioY.value = 'Y';
  radioY.checked = opts.useY ?? false;
  radioGroup.append(radioY);
  top.append(h3, radioGroup);
  const widthInput = document.createElement('input');
  widthInput.name = `accounts.${opts.index}.width`;
  widthInput.value = opts.width ?? '';
  const heightInput = document.createElement('input');
  heightInput.name = `accounts.${opts.index}.height`;
  heightInput.value = opts.height ?? '';
  wrap.append(top, widthInput, heightInput);
  return wrap;
}

let validator: ValidateButton;

beforeEach(() => {
  resetSectionsCache();
  document.body.innerHTML = '';
});

afterEach(() => {
  validator?.stop();
  document.body.innerHTML = '';
});

describe('ValidateButton — 인젝션', () => {
  it('start 시 저장 버튼 앞에 "검증" 버튼을 끼워넣는다', () => {
    const { wrap, saveBtn } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    const injected = wrap.querySelector('.ext-shopby-validate-btn');
    expect(injected).toBeTruthy();
    expect(saveBtn.previousElementSibling).toBe(injected);
    expect(injected?.textContent).toMatch(/검증/);
  });

  it('동일 저장 버튼에 중복 부착하지 않는다', async () => {
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    // MutationObserver 재실행 트리거.
    document.body.append(document.createElement('div'));
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(document.querySelectorAll('.ext-shopby-validate-btn')).toHaveLength(1);
  });

  it('나중에 추가된 저장 버튼에도 부착한다 (SPA 비동기 렌더 대응)', async () => {
    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);
    expect(document.querySelectorAll('.ext-shopby-validate-btn')).toHaveLength(0);

    const { wrap } = buildBottomBar();
    document.body.append(wrap);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(document.querySelectorAll('.ext-shopby-validate-btn')).toHaveLength(1);
  });

  it('텍스트가 "저장"이 아닌 submit 버튼에는 부착하지 않는다', () => {
    const wrap = document.createElement('div');
    const otherSubmit = document.createElement('button');
    otherSubmit.type = 'submit';
    otherSubmit.textContent = '제출';
    wrap.append(otherSubmit);
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    expect(document.querySelectorAll('.ext-shopby-validate-btn')).toHaveLength(0);
  });

  it('stop()은 부착된 모든 버튼을 제거한다', () => {
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);
    expect(document.querySelectorAll('.ext-shopby-validate-btn')).toHaveLength(1);

    validator.stop();
    expect(document.querySelectorAll('.ext-shopby-validate-btn')).toHaveLength(0);
  });
});

describe('ValidateButton — 검증 동작 (main mode)', () => {
  it('실패 시 ⚠️ 토스트를 띄운다', async () => {
    // 두 구좌 모두 비활성(0개 사용) → 에러
    document.body.append(buildAccountSection({ index: 0, useY: false }));
    document.body.append(buildAccountSection({ index: 1, useY: false }));
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!.click();

    await vi.waitFor(() => {
      const toast = document.querySelector('.ext-shopby-validate-toast');
      expect(toast?.shadowRoot?.textContent).toMatch(/⚠️ 검증 결과/);
    });
  });

  it('통과 시 ✅ 통과 토스트를 띄운다', async () => {
    document.body.append(buildAccountSection({ index: 0, width: '16', height: '9', useY: true }));
    document.body.append(buildAccountSection({ index: 1, useY: false }));
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!.click();

    await vi.waitFor(() => {
      const toast = document.querySelector('.ext-shopby-validate-toast');
      expect(toast?.shadowRoot?.textContent).toMatch(/검증 통과/);
    });
  });

  it('검증 버튼 클릭이 폼 submit을 트리거하지 않는다 (type=button + preventDefault)', () => {
    const form = document.createElement('form');
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    const { wrap } = buildBottomBar();
    form.append(wrap);
    document.body.append(form);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!.click();
    expect(submitted).toBe(false);
  });

  it('연속 검증 시 이전 토스트를 정리하고 새 결과로 교체한다', async () => {
    document.body.append(buildAccountSection({ index: 0, useY: false }));
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    const btn = document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!;
    btn.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.ext-shopby-validate-toast')).toBeTruthy();
    });

    // 한 구좌 수정 후 재검증 → 같은 토스트 컨테이너 1개만 유지.
    const radioY = document.querySelector<HTMLInputElement>('input.radio[value="Y"]')!;
    radioY.checked = true;
    const widthInput = document.querySelector<HTMLInputElement>('input[name="accounts.0.width"]')!;
    const heightInput = document.querySelector<HTMLInputElement>('input[name="accounts.0.height"]')!;
    widthInput.value = '16';
    heightInput.value = '9';

    btn.click();
    await vi.waitFor(() => {
      const toast = document.querySelector('.ext-shopby-validate-toast');
      expect(toast?.shadowRoot?.textContent).toMatch(/검증 통과/);
    });
    expect(document.querySelectorAll('.ext-shopby-validate-toast')).toHaveLength(1);
  });
});

describe('ValidateButton — 토스트 항목 클릭 → 필드 포커스', () => {
  beforeEach(() => {
    // jsdom은 scrollIntoView 미구현 → stub.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('메인 사이즈 위반 항목 클릭 시 해당 width input에 포커스', async () => {
    document.body.append(buildAccountSection({ index: 0, width: '12', height: '5', useY: true }));
    document.body.append(buildAccountSection({ index: 1, useY: false }));
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!.click();

    let item: HTMLButtonElement | null = null;
    await vi.waitFor(() => {
      const shadow = document.querySelector('.ext-shopby-validate-toast')?.shadowRoot;
      item = shadow?.querySelector<HTMLButtonElement>('.validation-toast__item') ?? null;
      expect(item).toBeTruthy();
    });

    const targetInput = document.querySelector<HTMLInputElement>('input[name="accounts.0.width"]')!;
    item!.click();
    expect(document.activeElement).toBe(targetInput);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('사용 구좌 0개 위반 클릭 시 첫 번째 Y 라디오로 포커스', async () => {
    document.body.append(buildAccountSection({ index: 0, useY: false }));
    document.body.append(buildAccountSection({ index: 1, useY: false }));
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!.click();

    let item: HTMLButtonElement | null = null;
    await vi.waitFor(() => {
      const shadow = document.querySelector('.ext-shopby-validate-toast')?.shadowRoot;
      item = shadow?.querySelector<HTMLButtonElement>('.validation-toast__item') ?? null;
      expect(item).toBeTruthy();
    });

    const firstYRadio = document.querySelector<HTMLInputElement>('input.radio[value="Y"]')!;
    item!.click();
    expect(document.activeElement).toBe(firstYRadio);
  });

  it('띠 진열 ID 형식 위반 항목 클릭 시 해당 accountName input에 포커스', async () => {
    const accountInput = document.createElement('input');
    accountInput.name = 'accounts.0.accountName';
    accountInput.value = '아무거나';
    document.body.append(accountInput);
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({
      mode: 'strip',
      loadSections: () => Promise.resolve(SECTIONS),
    });
    validator.start(document);

    document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!.click();

    let item: HTMLButtonElement | null = null;
    await vi.waitFor(() => {
      const shadow = document.querySelector('.ext-shopby-validate-toast')?.shadowRoot;
      item = shadow?.querySelector<HTMLButtonElement>('.validation-toast__item') ?? null;
      expect(item).toBeTruthy();
    });

    item!.click();
    expect(document.activeElement).toBe(accountInput);
  });

  it('focusTarget이 가리키는 요소가 detach 됐어도 에러 없이 무시', async () => {
    document.body.append(buildAccountSection({ index: 0, width: '12', height: '5', useY: true }));
    document.body.append(buildAccountSection({ index: 1, useY: false }));
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({ mode: 'main' });
    validator.start(document);

    document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!.click();

    let item: HTMLButtonElement | null = null;
    await vi.waitFor(() => {
      const shadow = document.querySelector('.ext-shopby-validate-toast')?.shadowRoot;
      item = shadow?.querySelector<HTMLButtonElement>('.validation-toast__item') ?? null;
      expect(item).toBeTruthy();
    });

    // 클릭 전에 타겟을 DOM에서 떼어냄.
    document.querySelector<HTMLInputElement>('input[name="accounts.0.width"]')!.remove();

    expect(() => item!.click()).not.toThrow();
  });
});

describe('ValidateButton — 검증 동작 (strip mode)', () => {
  it('주입된 loadSections로 진열 ID 형식 위반을 잡는다', async () => {
    const accountInput = document.createElement('input');
    accountInput.name = 'accounts.0.accountName';
    accountInput.value = '아무거나';
    document.body.append(accountInput);
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    const loadSections = vi.fn().mockResolvedValue(SECTIONS);
    validator = new ValidateButton({ mode: 'strip', loadSections });
    validator.start(document);

    document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!.click();

    await vi.waitFor(() => {
      const toast = document.querySelector('.ext-shopby-validate-toast');
      expect(toast?.shadowRoot?.textContent).toMatch(/형식이 아닙니다/);
    });
    expect(loadSections).toHaveBeenCalledTimes(1);
  });

  it('유효한 진열 ID는 통과', async () => {
    const accountInput = document.createElement('input');
    accountInput.name = 'accounts.0.accountName';
    accountInput.value = 'c_d1_p_t_병부장';
    document.body.append(accountInput);
    const { wrap } = buildBottomBar();
    document.body.append(wrap);

    validator = new ValidateButton({
      mode: 'strip',
      loadSections: () => Promise.resolve(SECTIONS),
    });
    validator.start(document);

    document.querySelector<HTMLButtonElement>('.ext-shopby-validate-btn')!.click();

    await vi.waitFor(() => {
      const toast = document.querySelector('.ext-shopby-validate-toast');
      expect(toast?.shadowRoot?.textContent).toMatch(/검증 통과/);
    });
  });
});
