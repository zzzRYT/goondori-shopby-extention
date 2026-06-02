import { useState } from 'react';
import type { DisplayCategoryEntry } from '../../../lib/shopby/api/types';

// tops는 상위 카테고리 엔트리 목록. 코드 박힌(전시중) 상위뿐 아니라
// 코드 없는(미설정) 상위도 받을 수 있어 DisplayCategoryEntry[]로 받는다.
// 코드 없는 상위는 하위 트리를 받아오지 않으므로(children=[]) 펼침 없이 점프만 제공한다.
type Props = { tops: DisplayCategoryEntry[]; onOpen: (entry: DisplayCategoryEntry) => void };

export function CategoryList({ tops, onOpen }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(no: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  }

  return (
    <ul className="category-list" aria-label="설정 목록">
      {tops.map((top) => {
        const hasChildren = top.children.length > 0;
        const open = expanded.has(top.categoryNo);
        return (
          <li key={top.categoryNo} className="category-list__group">
            <div className="category-list__row">
              <button
                type="button"
                className="category-list__toggle"
                aria-expanded={hasChildren ? open : undefined}
                onClick={() => (hasChildren ? toggle(top.categoryNo) : onOpen(top))}
              >
                {hasChildren && (
                  <span className="category-list__chevron" data-open={open}>▸</span>
                )}
                {top.managementCode ? (
                  <code className="category-list__code">{top.managementCode}</code>
                ) : (
                  <code className="category-list__code category-list__code--unset">미설정</code>
                )}
                <span className="category-list__name">{top.name}</span>
              </button>
              <button type="button" className="category-list__open" aria-label={`어드민에서 열기: ${top.name}`} onClick={() => onOpen(top)}>
                ›
              </button>
            </div>
            {open && hasChildren && (
              <ul className="category-list__children">
                {top.children.map((child) => (
                  <li key={child.categoryNo}>
                    <button type="button" className="category-list__child" onClick={() => onOpen(child)}>
                      {child.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
