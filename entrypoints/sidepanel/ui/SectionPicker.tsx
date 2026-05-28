import { useMemo } from 'react';
import { fetchSections } from '../../../lib/shopby/api/sections';
import { useRemoteList } from '../hooks/useRemoteList';
import { SearchableSelect, type SelectOption } from './SearchableSelect';

type SectionPickerProps = {
  value: string;
  onChange: (sectionId: string) => void;
};

// 띠배너가 연결할 진열 선택기. 선택 값은 진열 ID(sectionId) 문자열.
export function SectionPicker({ value, onChange }: SectionPickerProps) {
  const { items, status, error, reload } = useRemoteList(fetchSections);

  const options = useMemo<SelectOption[]>(
    () => items.map((section) => ({ value: section.sectionId, label: section.sectionName, hint: section.sectionId })),
    [items],
  );

  return (
    <SearchableSelect
      emptyLabel="진열이 없습니다."
      error={error}
      label="연결할 진열"
      onChange={onChange}
      onReload={reload}
      options={options}
      placeholder="진열명·진열 ID로 검색"
      status={status}
      value={value}
    />
  );
}
