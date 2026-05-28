import { useEffect, useMemo, useState } from 'react';
import { SearchableSelect, type SelectOption } from '../../sidepanel/ui/SearchableSelect';
import type { SectionEntry } from '../../../lib/shopby/api/types';
import { setFieldValue } from '../../../lib/shopby/fill';
import { getCachedSections, type SectionsLoader } from './sectionsCache';

type SectionAnchorProps = {
  input: HTMLInputElement;
  loadSections?: SectionsLoader;
};

type Status = 'loading' | 'ready' | 'error';

// 어드민 띠 배너 페이지에서 input[name$=".accountName"] 옆에 부착되는 위젯.
// 진열 선택 팝오버 트리거와, 현재 input value의 검증 라벨을 함께 보여준다.
export function SectionAnchor({ input, loadSections = getCachedSections }: SectionAnchorProps) {
  const [sections, setSections] = useState<SectionEntry[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(input.value);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');

    loadSections()
      .then((next) => {
        if (!active) return;
        setSections(next);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : '진열을 불러오지 못했습니다.');
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [loadSections, attempt]);

  useEffect(() => {
    const handler = () => setValue(input.value);
    input.addEventListener('input', handler);
    return () => input.removeEventListener('input', handler);
  }, [input]);

  const options = useMemo<SelectOption[]>(
    () => sections.map((section) => ({ value: section.sectionId, label: section.sectionName, hint: section.sectionId })),
    [sections],
  );

  const matched = sections.find((section) => section.sectionId === value);
  const showLabel = value.length > 0 && status === 'ready';

  function reload() {
    setAttempt((count) => count + 1);
  }

  function commit(sectionId: string) {
    setFieldValue(input, sectionId);
    setValue(sectionId);
    setOpen(false);
  }

  return (
    <span className="section-anchor">
      <button
        aria-expanded={open}
        className="section-anchor__trigger"
        disabled={input.disabled}
        onClick={() => setOpen((next) => !next)}
        type="button"
      >
        🔍 진열 선택
      </button>

      {showLabel && (
        <span
          className="section-anchor__label"
          data-tone={matched ? 'ok' : 'warn'}
        >
          {matched ? matched.sectionName : '일치하는 진열 없음'}
        </span>
      )}

      {open && (
        <div className="section-anchor__popover" role="dialog">
          <SearchableSelect
            emptyLabel="진열이 없습니다."
            error={error}
            label="연결할 진열"
            onChange={commit}
            onReload={reload}
            options={options}
            placeholder="진열명·진열 ID로 검색"
            status={status}
            value={value}
          />
        </div>
      )}
    </span>
  );
}
