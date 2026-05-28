import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { FieldHint } from './FieldHint';
import type { FieldHintFinder, FieldHintSpec } from './FieldHints';

const HOST_CLASS = 'ext-shopby-hint';

type Handle = {
  root: Root;
  host: HTMLElement;
  specKey: string;
};

type HintManagerOptions = {
  // 메인/띠 모드별로 다른 스펙을 받아 부착한다.
  specs: readonly FieldHintSpec[];
  // shadow DOM 안에 주입할 CSS(SectionAnchor와 동일 스타일시트를 공유).
  styleSheet?: string;
};

// AttachManager와 같은 라이프사이클(MutationObserver + WeakMap)이지만, 위젯이 다르고
// "한 요소에 여러 스펙이 동시에 부착될 수 있다"는 점이 달라 별도 매니저로 둔다.
// 부착 대상은 input에 한정하지 않는다(예: 「구좌 사용 여부」 라디오 영역의 헤더 div).
export class HintManager {
  private readonly handles = new WeakMap<Element, Handle[]>();
  // unmount 시 WeakMap을 순회할 수 없으므로 강참조 Set을 따로 보관.
  private readonly attached = new Set<Element>();
  private observer: MutationObserver | null = null;

  constructor(private readonly options: HintManagerOptions) {}

  start(root: Document): void {
    if (this.observer) return;

    this.scan(root);

    this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));
    this.observer.observe(root.body ?? root.documentElement, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;

    for (const target of [...this.attached]) {
      this.detach(target);
    }
  }

  private scan(root: ParentNode) {
    for (const spec of this.options.specs) {
      for (const target of findAll(root, spec.find)) {
        this.attachSpec(target, spec);
      }
    }
  }

  private handleMutations(mutations: MutationRecord[]) {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        for (const spec of this.options.specs) {
          // node 자체가 매칭될 수도 있고(셀렉터 스펙), 자손이 매칭될 수도 있어 둘 다 본다.
          if (typeof spec.find === 'string' && node.matches(spec.find)) {
            this.attachSpec(node, spec);
          }
          for (const target of findAll(node, spec.find)) {
            this.attachSpec(target, spec);
          }
        }
      });

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (this.handles.has(node)) this.detach(node);
        node.querySelectorAll('*').forEach((descendant) => {
          if (this.handles.has(descendant)) this.detach(descendant);
        });
      });
    }
  }

  private attachSpec(target: Element, spec: FieldHintSpec) {
    const specKey = `${describeFinder(spec.find)}|${spec.message}`;
    const existing = this.handles.get(target) ?? [];
    if (existing.some((handle) => handle.specKey === specKey)) return;

    const anchor = resolveAnchor(target, spec.anchorSelector);
    const ownerDocument = target.ownerDocument;
    const host = ownerDocument.createElement('span');
    host.className = HOST_CLASS;
    // flex 컨테이너 안에서도 강제로 새 줄로 떨어지도록 폭/flex-basis를 100%로.
    host.style.cssText =
      'display:block;width:100%;flex-basis:100%;max-width:100%;box-sizing:border-box;margin-top:6px;';
    anchor.after(host);

    const shadow = host.attachShadow({ mode: 'open' });
    if (this.options.styleSheet) {
      const style = ownerDocument.createElement('style');
      style.textContent = this.options.styleSheet;
      shadow.append(style);
    }

    const mountPoint = ownerDocument.createElement('div');
    shadow.append(mountPoint);

    const root = createRoot(mountPoint);
    root.render(createElement(FieldHint, { tone: spec.tone, message: spec.message }));

    const next: Handle = { root, host, specKey };
    this.handles.set(target, [...existing, next]);
    this.attached.add(target);
  }

  private detach(target: Element) {
    const list = this.handles.get(target);
    if (!list) return;

    for (const handle of list) {
      handle.root.unmount();
      handle.host.remove();
    }

    this.handles.delete(target);
    this.attached.delete(target);
  }
}

function findAll(root: ParentNode, finder: FieldHintFinder): Element[] {
  if (typeof finder === 'string') {
    return Array.from(root.querySelectorAll(finder));
  }
  return finder(root);
}

function describeFinder(finder: FieldHintFinder): string {
  return typeof finder === 'string' ? finder : (finder.name || 'fn');
}

function resolveAnchor(target: Element, anchorSelector?: string): Element {
  if (!anchorSelector) return target;
  return target.closest(anchorSelector) ?? target;
}
