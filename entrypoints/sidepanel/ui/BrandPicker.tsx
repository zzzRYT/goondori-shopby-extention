import { useMemo } from 'react';
import { fetchBrands } from '../../../lib/shopby/api/brands';
import { useRemoteList } from '../hooks/useRemoteList';
import { SearchableSelect, type SelectOption } from './SearchableSelect';

type BrandPickerProps = {
  value: string;
  onChange: (brandNo: string) => void;
};

// 진열 ID(브랜드 타입)용 브랜드 선택기. 선택 값은 브랜드 번호(brandNo) 문자열.
export function BrandPicker({ value, onChange }: BrandPickerProps) {
  const { items, status, error, reload } = useRemoteList(fetchBrands);

  const options = useMemo<SelectOption[]>(
    () => items.map((brand) => ({ value: String(brand.brandNo), label: brand.name, hint: `#${brand.brandNo}` })),
    [items],
  );

  return (
    <SearchableSelect
      emptyLabel="브랜드가 없습니다."
      error={error}
      label="브랜드"
      onChange={onChange}
      onReload={reload}
      options={options}
      placeholder="브랜드명·번호로 검색"
      status={status}
      value={value}
    />
  );
}
