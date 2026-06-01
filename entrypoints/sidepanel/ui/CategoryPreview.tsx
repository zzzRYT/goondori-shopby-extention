import type { TopCategory } from '../../../lib/shopby/display-categories';
import type { DisplayCategoryEntry } from '../../../lib/shopby/api/types';

type Props = {
  tops: TopCategory[];
  selectedNo: number | null;
  onSelect: (categoryNo: number) => void;
  onOpen: (entry: DisplayCategoryEntry) => void;
};

export function CategoryPreview({ tops, selectedNo, onSelect, onOpen }: Props) {
  const selected = tops.find((t) => t.categoryNo === selectedNo) ?? tops[0] ?? null;
  const children = selected?.children ?? [];

  return (
    <div className="category-preview" aria-label="스토어프론트 미리보기">
      <div className="category-preview__tabs" role="tablist">
        {tops.map((top) => (
          <button
            key={top.categoryNo}
            type="button"
            role="tab"
            aria-selected={top.categoryNo === selected?.categoryNo}
            className="category-preview__tab"
            data-active={top.categoryNo === selected?.categoryNo}
            onClick={() => onSelect(top.categoryNo)}
            onDoubleClick={() => onOpen(top)}
          >
            {top.name}
          </button>
        ))}
      </div>

      {children.length > 0 && (
        <div className="category-preview__chips" data-testid="category-chip-row">
          {children.map((child, i) => (
            <button
              key={child.categoryNo}
              type="button"
              className="category-preview__chip"
              data-active={i === 0}
              onClick={() => onOpen(child)}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
