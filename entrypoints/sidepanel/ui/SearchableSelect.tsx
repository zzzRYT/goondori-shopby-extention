import { useId, useMemo, useRef, useState } from 'react';
import type { RemoteStatus } from '../hooks/useRemoteList';

export type SelectOption = { value: string; label: string; hint?: string };

type SearchableSelectProps = {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  status: RemoteStatus;
  error?: string;
  onReload: () => void;
  placeholder?: string;
  emptyLabel?: string;
};

// 원격 목록을 검색·선택하는 콤보박스. 로딩·에러·빈 상태를 직접 표시한다.
// 선택만 허용(자유 입력 없음)하되, value가 목록에 없으면(예: 복원된 값) 그 값을 그대로 보여준다.
export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  status,
  error,
  onReload,
  placeholder = '검색해서 선택',
  emptyLabel = '항목이 없습니다.',
}: SearchableSelectProps) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.value === value);
  // 선택된 값이 목록에 없어도 사용자가 잃어버리지 않도록 라벨을 만든다.
  const selectedLabel = selected?.label ?? (value ? value : '');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  // 닫혀 있으면 선택 라벨을, 열려 있으면 사용자가 입력 중인 검색어를 보여준다.
  const inputValue = open ? query : selectedLabel;

  function openList() {
    if (status !== 'ready') return;
    setOpen(true);
    setQuery('');
    setActiveIndex(0);
  }

  function commit(option: SelectOption) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const option = filtered[activeIndex];
        if (option) commit(option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
    }
  }

  if (status === 'loading') {
    return (
      <div className="combobox" data-state="loading">
        <span className="field-hint">{label} 불러오는 중…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="combobox" data-state="error">
        <p className="combobox__error" role="alert">
          {error || `${label}을(를) 불러오지 못했습니다.`}
        </p>
        <button className="combobox__retry" onClick={onReload} type="button">
          다시 시도
        </button>
      </div>
    );
  }

  const activeOptionId = open && filtered[activeIndex] ? `${baseId}-opt-${activeIndex}` : undefined;

  return (
    <div className="combobox" data-open={open}>
      <div className="combobox__field">
        <input
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-label={label}
          autoComplete="off"
          className="combobox__input"
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={openList}
          onKeyDown={handleKeyDown}
          placeholder={options.length === 0 ? emptyLabel : placeholder}
          ref={inputRef}
          role="combobox"
          type="text"
          value={inputValue}
        />
        {/* 목록을 다시 불러온다. 새로 생성한 항목을 반영할 때 사용.
            input이 포커스 중이어도 blur로 목록이 닫히지 않도록 onMouseDown에서 기본 동작을 막는다. */}
        <button
          aria-label={`${label} 새로고침`}
          className="combobox__refresh"
          onClick={onReload}
          onMouseDown={(event) => event.preventDefault()}
          title="새로고침"
          type="button"
        >
          ↻
        </button>
      </div>

      {open && (
        <ul className="combobox__list" id={listId} role="listbox">
          {filtered.length === 0 ? (
            <li className="combobox__empty" role="presentation">
              일치하는 항목이 없습니다.
            </li>
          ) : (
            filtered.map((option, index) => (
              <li
                aria-selected={option.value === value}
                className="combobox__option"
                data-active={index === activeIndex}
                id={`${baseId}-opt-${index}`}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(option)}
                role="option"
              >
                <span className="combobox__option-label">{option.label}</span>
                {option.hint && <span className="combobox__option-hint">{option.hint}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
