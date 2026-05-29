import { useState } from 'react';
import type { TopCategory } from '../../../lib/shopby/display-categories';
import type { DisplayCategoryEntry } from '../../../lib/shopby/api/types';

type Props = { tops: TopCategory[]; onOpen: (entry: DisplayCategoryEntry) => void };

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
        const open = expanded.has(top.categoryNo);
        return (
          <li key={top.categoryNo} className="category-list__group">
            <div className="category-list__row">
              <button type="button" className="category-list__toggle" aria-expanded={open} onClick={() => toggle(top.categoryNo)}>
                <span className="category-list__chevron" data-open={open}>▸</span>
                <code className="category-list__code">{top.managementCode}</code>
                <span className="category-list__name">{top.name}</span>
              </button>
              <button type="button" className="category-list__open" aria-label={`어드민에서 열기: ${top.name}`} onClick={() => onOpen(top)}>
                ›
              </button>
            </div>
            {open && top.children.length > 0 && (
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
