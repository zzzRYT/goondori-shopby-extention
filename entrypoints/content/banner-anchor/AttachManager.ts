import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { SectionAnchor } from './SectionAnchor';
import { getCachedSections, type SectionsLoader } from './sectionsCache';

const ACCOUNT_SELECTOR = 'input[name^="accounts."][name$=".accountName"]';
const ANCHOR_CLASS = 'ext-shopby-anchor';

type AttachManagerOptions = {
  // 테스트에서 진열 로더를 주입할 수 있도록 외부 의존성으로 분리.
  loadSections?: SectionsLoader;
  // shadow DOM 안에 주입할 CSS(전역 스타일과 격리). content script가 import 한 CSS 문자열을 전달한다.
  styleSheet?: string;
};

type AnchorHandle = {
  root: Root;
  host: HTMLElement;
};

// 어드민 띠 배너 페이지의 input[name$=".accountName"] 옆에 위젯을 부착·언부착하는 매니저.
// 페이지 가드는 호출 측(index.ts)에서 처리한다. 이 클래스는 부착 로직만 책임진다.
export class AttachManager {
  private readonly anchors = new WeakMap<HTMLInputElement, AnchorHandle>();
  private readonly attached = new Set<HTMLInputElement>();
  private readonly options: AttachManagerOptions;
  private observer: MutationObserver | null = null;
  private root: Document | null = null;

  constructor(options: AttachManagerOptions = {}) {
    this.options = options;
  }

  start(root: Document): void {
    if (this.observer) return;
    this.root = root;

    root.querySelectorAll<HTMLInputElement>(ACCOUNT_SELECTOR).forEach((input) => this.attach(input));

    this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));
    this.observer.observe(root.body ?? root.documentElement, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;

    for (const input of [...this.attached]) {
      this.detach(input);
    }

    this.root = null;
  }

  private handleMutations(mutations: MutationRecord[]) {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(ACCOUNT_SELECTOR) && node instanceof HTMLInputElement) {
          this.attach(node);
        }
        node.querySelectorAll<HTMLInputElement>(ACCOUNT_SELECTOR).forEach((input) => this.attach(input));
      });

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node instanceof HTMLInputElement && this.anchors.has(node)) {
          this.detach(node);
        }
        node.querySelectorAll<HTMLInputElement>(ACCOUNT_SELECTOR).forEach((input) => {
          if (this.anchors.has(input)) this.detach(input);
        });
      });
    }
  }

  private attach(input: HTMLInputElement) {
    if (this.anchors.has(input)) return;

    const host = input.ownerDocument.createElement('span');
    host.className = ANCHOR_CLASS;
    input.after(host);

    const shadow = host.attachShadow({ mode: 'open' });

    if (this.options.styleSheet) {
      const style = input.ownerDocument.createElement('style');
      style.textContent = this.options.styleSheet;
      shadow.append(style);
    }

    const mountPoint = input.ownerDocument.createElement('div');
    shadow.append(mountPoint);

    const root = createRoot(mountPoint);
    root.render(createElement(SectionAnchor, { input, loadSections: this.options.loadSections ?? getCachedSections }));

    this.anchors.set(input, { root, host });
    this.attached.add(input);
  }

  private detach(input: HTMLInputElement) {
    const handle = this.anchors.get(input);
    if (!handle) return;

    handle.root.unmount();
    handle.host.remove();

    this.anchors.delete(input);
    this.attached.delete(input);
  }
}
