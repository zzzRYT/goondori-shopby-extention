import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SectionEntry } from '../../../lib/shopby/api/types';
import { ValidationToast } from './ValidationToast';
import { getCachedSections } from './sectionsCache';
import {
  validateActiveAccountCount,
  validateBannerImage,
  validateMainSize,
  validateStripAccountName,
  validateStripHeight,
  type ValidationIssue,
} from './validators';

const BUTTON_CLASS = 'ext-shopby-validate-btn';
const TOAST_HOST_CLASS = 'ext-shopby-validate-toast';
const TOAST_FAIL_DISMISS_MS = 15_000;
const TOAST_PASS_DISMISS_MS = 3_000;
const SAVE_BUTTON_TEXT = '저장';

type Mode = 'strip' | 'main';
type SectionsLoader = () => Promise<SectionEntry[]>;

type ValidateButtonOptions = {
  // 현재 페이지의 배너 모드. 검증 항목이 모드별로 다르다.
  mode: Mode;
  // shadow DOM 안에 주입할 CSS(다른 위젯과 동일 스타일시트 공유).
  styleSheet?: string;
  // 진열 목록 로더. 기본은 sectionsCache의 캐시 헬퍼이며 테스트에서 주입 가능.
  loadSections?: SectionsLoader;
};

// 어드민 하단 바의 「저장」 버튼 앞에 「🔍 검증」 버튼을 인젝션한다.
// 저장 버튼을 가로채면 폼 라이프사이클이 흔들리고, 가로채지 않으면 검증 결과가
// 저장 후에 나와 의미가 없어 사용자 의도로 분리된 ad-hoc 트리거를 둔다.
// 버튼은 페이지의 `.btn .white` 스타일을 그대로 빌려 시각 일관성을 확보한다.
export class ValidateButton {
  private root: Document | null = null;
  private observer: MutationObserver | null = null;
  private toastHost: HTMLElement | null = null;
  private toastRoot: Root | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: ValidateButtonOptions) {}

  start(root: Document): void {
    if (this.observer) return;
    this.root = root;
    this.scan(root);
    this.observer = new MutationObserver(() => this.scan(root));
    this.observer.observe(root.body ?? root.documentElement, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    // 인젝션된 버튼 일괄 제거. WeakMap 대신 클래스 기준으로 청소해 stale state를 피한다.
    this.root?.querySelectorAll(`.${BUTTON_CLASS}`).forEach((btn) => btn.remove());
    this.removeToast();
    this.root = null;
  }

  private scan(root: Document) {
    const buttons = root.querySelectorAll<HTMLButtonElement>('button[type="submit"]');
    buttons.forEach((btn) => {
      if (btn.textContent?.trim() !== SAVE_BUTTON_TEXT) return;
      // 이미 바로 앞에 검증 버튼이 있으면 스킵(중복 인젝션 방지).
      if (btn.previousElementSibling?.classList.contains(BUTTON_CLASS)) return;
      this.install(btn);
    });
  }

  private install(saveButton: HTMLButtonElement) {
    const doc = saveButton.ownerDocument;
    const validateBtn = doc.createElement('button');
    validateBtn.type = 'button';
    validateBtn.textContent = '🔍 검증';
    validateBtn.className = `btn white ${BUTTON_CLASS}`;
    validateBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.runValidation();
    });
    saveButton.before(validateBtn);
  }

  private async runValidation() {
    const root = this.root;
    if (!root) return;
    const issues =
      this.options.mode === 'strip'
        ? await collectStripIssues(root, this.options.loadSections ?? getCachedSections)
        : collectMainIssues(root);
    this.showToast(issues);
  }

  private showToast(issues: ValidationIssue[]) {
    this.removeToast();
    const doc = this.root;
    if (!doc?.body) return;

    const host = doc.createElement('div');
    host.className = TOAST_HOST_CLASS;
    host.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:calc(100vw - 40px);';
    doc.body.append(host);

    const shadow = host.attachShadow({ mode: 'open' });
    if (this.options.styleSheet) {
      const style = doc.createElement('style');
      style.textContent = this.options.styleSheet;
      shadow.append(style);
    }

    const mountPoint = doc.createElement('div');
    shadow.append(mountPoint);

    const toastRoot = createRoot(mountPoint);
    toastRoot.render(createElement(ValidationToast, { issues, onClose: () => this.removeToast() }));

    this.toastHost = host;
    this.toastRoot = toastRoot;
    // 통과는 짧게, 실패는 읽을 시간이 필요해 길게.
    const duration = issues.length === 0 ? TOAST_PASS_DISMISS_MS : TOAST_FAIL_DISMISS_MS;
    this.toastTimeout = setTimeout(() => this.removeToast(), duration);
  }

  private removeToast() {
    if (this.toastTimeout !== null) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
    this.toastRoot?.unmount();
    this.toastRoot = null;
    this.toastHost?.remove();
    this.toastHost = null;
  }
}

async function collectStripIssues(root: Document, loadSections: SectionsLoader): Promise<ValidationIssue[]> {
  const sections = await loadSections().catch((): SectionEntry[] => []);
  const inputs = root.querySelectorAll<HTMLInputElement>('input[name^="accounts."][name$=".accountName"]');
  const issues: ValidationIssue[] = [];
  inputs.forEach((input, index) => {
    const issue = validateStripAccountName(index, input.value, sections);
    if (issue) issues.push({ ...issue, focusTarget: () => input });

    // 진열 ID가 입력된(사용 중) 구좌는 배너 이미지도 있어야 한다.
    if (input.value.trim()) {
      const accountIndex = accountIndexOf(input.name) ?? index;
      const imageInput = findImageNameInput(root, accountIndex);
      const imageIssue = validateBannerImage(index, accountHasImage(imageInput));
      if (imageIssue) issues.push({ ...imageIssue, focusTarget: () => imageInput ?? input });
    }
  });

  // 세로(높이)는 84/104 두 값만 허용. 가로(16)는 시스템 고정이라 검증 대상이 아니다.
  const heightInputs = root.querySelectorAll<HTMLInputElement>('input[name^="accounts."][name$=".height"]');
  heightInputs.forEach((heightInput, index) => {
    const issue = validateStripHeight(index, heightInput.value);
    if (issue) issues.push({ ...issue, focusTarget: () => heightInput });
  });

  return issues;
}

function collectMainIssues(root: Document): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const widthInputs = root.querySelectorAll<HTMLInputElement>('input[name^="accounts."][name$=".width"]');
  widthInputs.forEach((widthInput, index) => {
    const heightName = widthInput.name.replace(/\.width$/, '.height');
    const heightInput = root.querySelector<HTMLInputElement>(
      `input[name="${heightName.replace(/"/g, '\\"')}"]`,
    );
    const sizeIssue = validateMainSize(index, widthInput.value, heightInput?.value ?? '');
    if (sizeIssue) issues.push({ ...sizeIssue, focusTarget: () => widthInput });
  });

  const activeIssue = validateActiveAccountCount(countActiveAccounts(root));
  if (activeIssue) {
    const firstYRadio = findFirstAccountYRadio(root);
    issues.push({ ...activeIssue, focusTarget: firstYRadio ? () => firstYRadio : undefined });
  }

  // 사용(Y) 구좌는 배너 이미지가 있어야 한다. 미사용 구좌는 이미지가 없어도 무방.
  for (const toggle of readAccountToggles(root)) {
    if (!toggle.active) continue;
    const imageInput = findImageNameInput(root, toggle.index);
    const imageIssue = validateBannerImage(toggle.index, accountHasImage(imageInput));
    if (imageIssue) issues.push({ ...imageIssue, focusTarget: imageInput ? () => imageInput : undefined });
  }

  return issues;
}

type AccountToggle = { index: number; active: boolean };

// "구좌 N" 헤더의 형제 라디오 그룹에서 사용 여부(value="Y" checked)를 읽어,
// 헤더 텍스트의 N으로 accounts.{N-1} 인덱스를 매핑한다.
// FieldHints의 findAccountToggleHeader와 같은 시그널을 사용.
function readAccountToggles(root: Document): AccountToggle[] {
  const toggles: AccountToggle[] = [];
  for (const h3 of Array.from(root.querySelectorAll('h3'))) {
    const match = /^구좌\s*(\d+)/.exec(h3.textContent?.trim() ?? '');
    if (!match) continue;
    const yRadio = h3.parentElement?.querySelector<HTMLInputElement>('input.radio[value="Y"]');
    toggles.push({ index: Number(match[1]) - 1, active: yRadio?.checked ?? false });
  }
  return toggles;
}

function countActiveAccounts(root: Document): number {
  return readAccountToggles(root).filter((toggle) => toggle.active).length;
}

// accounts.{i}.… name에서 구좌 인덱스 i를 추출.
function accountIndexOf(name: string): number | null {
  const match = /^accounts\.(\d+)\./.exec(name);
  return match ? Number(match[1]) : null;
}

const IMAGE_NAME_SUFFIX = '.banners.0.imageInfo.imageName';

function findImageNameInput(root: Document, index: number): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>(`input[name="accounts.${index}${IMAGE_NAME_SUFFIX}"]`);
}

// 배너 이미지는 입력값이 아니라 미리보기 <img alt="banner_image">로만 드러난다.
// (imageName 텍스트 input은 이미지가 있어도 비어 있어 신뢰 불가.)
// imageName input과 미리보기 <img>는 같은 <td> 안에 있어 그 셀 범위에서 찾는다.
function accountHasImage(imageNameInput: HTMLInputElement | null): boolean {
  const cell = imageNameInput?.closest('td');
  const preview = cell?.querySelector<HTMLImageElement>('img[alt="banner_image"]');
  return (preview?.getAttribute('src')?.trim().length ?? 0) > 0;
}

// 사용 구좌 개수 위반 시 토스트 클릭으로 이동할 첫 번째 구좌의 Y 라디오를 찾는다.
// 사용자가 토글할 후보 위치를 직접 보여주는 역할.
function findFirstAccountYRadio(root: Document): HTMLInputElement | null {
  for (const h3 of Array.from(root.querySelectorAll('h3'))) {
    const text = h3.textContent?.trim() ?? '';
    if (!/^구좌\s*\d+/.test(text)) continue;
    const yRadio = h3.parentElement?.querySelector<HTMLInputElement>('input.radio[value="Y"]');
    if (yRadio) return yRadio;
  }
  return null;
}
