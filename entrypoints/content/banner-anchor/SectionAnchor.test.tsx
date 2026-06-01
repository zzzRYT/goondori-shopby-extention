import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SectionEntry } from '../../../lib/shopby/api/types';
import { SectionAnchor } from './SectionAnchor';
import { resetSectionsCache } from './sectionsCache';

const SAMPLE: SectionEntry[] = [
  { sectionNo: 1, sectionId: 'ct_d3_s_b_43215615', sectionName: 'OO 매대' },
  { sectionNo: 2, sectionId: 'ct_d3_s_b_43215621', sectionName: 'XX 매대' },
  { sectionNo: 3, sectionId: 'ct_d3_s_b_43215684', sectionName: '병부장 매대' },
];

function mountInput(initialValue = ''): HTMLInputElement {
  const input = document.createElement('input');
  input.name = 'accounts.0.accountName';
  input.value = initialValue;
  document.body.append(input);
  return input;
}

afterEach(() => {
  resetSectionsCache();
  document.body.innerHTML = '';
});

beforeEach(() => {
  resetSectionsCache();
});

describe('SectionAnchor', () => {
  it('버튼은 진열 선택 트리거 역할을 하고, 클릭 전에는 팝오버가 닫혀 있다', async () => {
    const input = mountInput();
    render(<SectionAnchor input={input} loadSections={() => Promise.resolve(SAMPLE)} />);

    const trigger = await screen.findByRole('button', { name: /진열 선택/ });
    expect(trigger).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('버튼 클릭 시 팝오버가 열려 진열 콤보박스가 보인다', async () => {
    const input = mountInput();
    render(<SectionAnchor input={input} loadSections={() => Promise.resolve(SAMPLE)} />);

    fireEvent.click(await screen.findByRole('button', { name: /진열 선택/ }));

    expect(await screen.findByRole('combobox')).toBeTruthy();
  });

  it('항목을 선택하면 input.value가 채워지고 input/change 이벤트가 발생한 뒤 팝오버가 닫힌다', async () => {
    const input = mountInput();
    const inputListener = vi.fn();
    const changeListener = vi.fn();
    input.addEventListener('input', inputListener);
    input.addEventListener('change', changeListener);

    render(<SectionAnchor input={input} loadSections={() => Promise.resolve(SAMPLE)} />);

    fireEvent.click(await screen.findByRole('button', { name: /진열 선택/ }));
    const combo = await screen.findByRole('combobox');
    fireEvent.focus(combo);
    fireEvent.change(combo, { target: { value: '병부장' } });
    fireEvent.click(screen.getByRole('option', { name: /병부장 매대/ }));

    expect(input.value).toBe('ct_d3_s_b_43215684');
    expect(inputListener).toHaveBeenCalled();
    expect(changeListener).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
  });

  it('input value와 일치하는 진열이 있으면 진열명을 라벨로 보여준다', async () => {
    const input = mountInput('ct_d3_s_b_43215615');
    render(<SectionAnchor input={input} loadSections={() => Promise.resolve(SAMPLE)} />);

    expect(await screen.findByText('OO 매대')).toBeTruthy();
  });

  it('잘못된 ID가 들어있으면 경고 톤의 라벨을 보여준다', async () => {
    const input = mountInput('nonexistent_id');
    render(<SectionAnchor input={input} loadSections={() => Promise.resolve(SAMPLE)} />);

    const label = await screen.findByText(/일치하는 진열 없음/);
    expect(label.getAttribute('data-tone')).toBe('warn');
  });

  it('input value가 비어 있으면 라벨을 숨긴다', async () => {
    const input = mountInput('');
    render(<SectionAnchor input={input} loadSections={() => Promise.resolve(SAMPLE)} />);

    await screen.findByRole('button', { name: /진열 선택/ });
    expect(screen.queryByText(/매대/)).toBeNull();
    expect(screen.queryByText(/일치하는 진열 없음/)).toBeNull();
  });

  it('외부에서 input value를 바꾸고 input 이벤트가 발생하면 라벨이 갱신된다', async () => {
    const input = mountInput('');
    render(<SectionAnchor input={input} loadSections={() => Promise.resolve(SAMPLE)} />);
    await screen.findByRole('button', { name: /진열 선택/ });

    input.value = 'ct_d3_s_b_43215621';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(await screen.findByText('XX 매대')).toBeTruthy();
  });

  it('진열 로딩이 실패하면 팝오버 안에서 다시 시도할 수 있다', async () => {
    const input = mountInput();
    const loadSections = vi
      .fn<() => Promise<SectionEntry[]>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(SAMPLE);

    render(<SectionAnchor input={input} loadSections={loadSections} />);
    fireEvent.click(await screen.findByRole('button', { name: /진열 선택/ }));

    const retry = await screen.findByRole('button', { name: /다시 시도/ });
    fireEvent.click(retry);

    expect(await screen.findByRole('combobox')).toBeTruthy();
    expect(loadSections).toHaveBeenCalledTimes(2);
  });
});
