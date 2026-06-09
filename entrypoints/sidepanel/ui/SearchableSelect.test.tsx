import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchableSelect, type SelectOption } from './SearchableSelect';

const OPTIONS: SelectOption[] = [
  { value: '1', label: '베스트', hint: '#1' },
  { value: '2', label: '신상품', hint: '#2' },
  { value: '3', label: '세일', hint: '#3' },
];

function setup(overrides: Partial<React.ComponentProps<typeof SearchableSelect>> = {}) {
  const onChange = vi.fn();
  const onReload = vi.fn();
  render(
    <SearchableSelect
      label="진열"
      onChange={onChange}
      onReload={onReload}
      options={OPTIONS}
      status="ready"
      value=""
      {...overrides}
    />,
  );
  return { onChange, onReload };
}

describe('SearchableSelect', () => {
  it('포커스하면 전체 옵션을 보여주고 입력으로 필터링한다', () => {
    setup();
    const combo = screen.getByRole('combobox', { name: '진열' });

    fireEvent.focus(combo);
    expect(screen.getAllByRole('option')).toHaveLength(3);

    fireEvent.change(combo, { target: { value: '신상' } });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('신상품');
  });

  it('옵션을 클릭하면 그 value로 onChange를 호출한다', () => {
    const { onChange } = setup();

    fireEvent.focus(screen.getByRole('combobox', { name: '진열' }));
    fireEvent.click(screen.getByRole('option', { name: /세일/ }));

    expect(onChange).toHaveBeenCalledWith('3');
  });

  it('키보드 ArrowDown+Enter로 선택한다', () => {
    const { onChange } = setup();
    const combo = screen.getByRole('combobox', { name: '진열' });

    fireEvent.focus(combo);
    fireEvent.keyDown(combo, { key: 'ArrowDown' }); // index 0 -> 1
    fireEvent.keyDown(combo, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('선택된 value의 라벨을 닫힌 입력에 표시한다', () => {
    setup({ value: '1' });

    expect(screen.getByRole('combobox', { name: '진열' })).toHaveProperty('value', '베스트');
  });

  it('목록에 없는 value는 원본 값을 그대로 보여준다', () => {
    setup({ value: 'c_d9_p_t_복원됨' });

    expect(screen.getByRole('combobox', { name: '진열' })).toHaveProperty('value', 'c_d9_p_t_복원됨');
  });

  it('로딩 중에는 콤보박스 대신 안내를 보여준다', () => {
    setup({ status: 'loading' });

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(/불러오는 중/)).toBeTruthy();
  });

  it('준비 상태에서 새로고침 버튼을 보여주고 클릭 시 onReload', () => {
    const { onReload } = setup();

    fireEvent.click(screen.getByRole('button', { name: '진열 새로고침' }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('에러 상태에서 메시지와 다시 시도 버튼을 보여주고 클릭 시 onReload', () => {
    const { onReload } = setup({ status: 'error', error: '연결 실패' });

    expect(screen.getByText('연결 실패')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onReload).toHaveBeenCalledOnce();
  });
});
