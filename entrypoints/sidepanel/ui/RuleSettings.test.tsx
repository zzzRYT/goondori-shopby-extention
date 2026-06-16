import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CURATION_RULES } from '../../../lib/shopby/screening/curation-rules';
import type { Rule } from '../../../lib/shopby/screening/rules';
import { RuleSettings } from './RuleSettings';

const RULES: Rule[] = [
  { id: 'r1', type: 'required', section: '기본정보', field: '제조사명', enabled: false },
  { id: 'r2', type: 'expected', section: '판매정보', field: '판매수수료', op: 'equals', value: '15%', enabled: true },
  { id: 'r3', type: 'image', kind: 'mainRequired', enabled: true },
];

describe('RuleSettings', () => {
  it('규칙을 설명 문구와 토글로 보여준다', () => {
    render(<RuleSettings rules={RULES} onChange={vi.fn()} />);

    expect(screen.getByText(/기본정보 · 제조사명 필수/)).toBeInTheDocument();
    expect(screen.getByText(/판매정보 · 판매수수료 = 15%/)).toBeInTheDocument();
    expect(screen.getByText(/대표이미지 필수/)).toBeInTheDocument();
  });

  it('토글하면 enabled만 바뀐 새 배열로 onChange', async () => {
    const onChange = vi.fn();
    render(<RuleSettings rules={RULES} onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox', { name: /제조사명 필수/ }));

    expect(onChange).toHaveBeenCalledWith([
      { ...RULES[0], enabled: true },
      RULES[1],
      RULES[2],
    ]);
  });

  it('삭제 버튼이 해당 규칙을 제거한다', async () => {
    const onChange = vi.fn();
    render(<RuleSettings rules={RULES} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /규칙 삭제: 기본정보 · 제조사명 필수/ }));

    expect(onChange).toHaveBeenCalledWith([RULES[1], RULES[2]]);
  });

  it('큐레이션 규칙은 제목·설명으로 별도 그룹에 표시된다', () => {
    render(<RuleSettings rules={[...CURATION_RULES, ...RULES]} onChange={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '기본 큐레이션' })).toBeInTheDocument();
    expect(screen.getByText('역마진 경고')).toBeInTheDocument();
    expect(screen.getByText('수수료 0% 경고')).toBeInTheDocument();
    expect(screen.getByText('할인율 이상치(70% 이상)')).toBeInTheDocument();
    expect(screen.getByText('대표이미지 누락')).toBeInTheDocument();
    expect(screen.getByText('상품명 글자수 초과(30자)')).toBeInTheDocument();
    expect(screen.getByText('서비스상품군 방지')).toBeInTheDocument();
    expect(screen.getByText('재고 0개 경고')).toBeInTheDocument();
    expect(screen.getByText('전시카테고리 중복(1개 초과)')).toBeInTheDocument();
  });

  it('큐레이션 규칙은 삭제 버튼이 없고 토글만 가능하다', async () => {
    const onChange = vi.fn();
    render(<RuleSettings rules={[...CURATION_RULES, ...RULES]} onChange={onChange} />);

    expect(screen.queryByRole('button', { name: /규칙 삭제: 역마진 경고/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: /역마진 경고/ }));

    const next = onChange.mock.calls[0][0] as Rule[];
    expect(next.find((rule) => rule.id === 'curation-reverse-margin')?.enabled).toBe(false);
    expect(next).toHaveLength(CURATION_RULES.length + RULES.length);
  });

  it('필수값 규칙을 추가할 수 있다 (필드는 카탈로그 드롭다운)', async () => {
    const onChange = vi.fn();
    render(<RuleSettings rules={[]} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('검사 유형'), 'required');
    await userEvent.selectOptions(screen.getByLabelText('섹션'), '배송정보');
    await userEvent.selectOptions(screen.getByLabelText('항목'), '상품 중량');
    await userEvent.click(screen.getByRole('button', { name: '규칙 추가' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0][0][0];
    expect(added).toMatchObject({ type: 'required', section: '배송정보', field: '상품 중량', enabled: true });
  });

  it('공란 규칙을 추가할 수 있다', async () => {
    const onChange = vi.fn();
    render(<RuleSettings rules={[]} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('검사 유형'), 'empty');
    await userEvent.selectOptions(screen.getByLabelText('섹션'), '기본정보');
    await userEvent.selectOptions(screen.getByLabelText('항목'), '검색어');
    await userEvent.click(screen.getByRole('button', { name: '규칙 추가' }));

    const added = onChange.mock.calls[0][0][0];
    expect(added).toMatchObject({ type: 'empty', section: '기본정보', field: '검색어', enabled: true });
  });

  it('derived 규칙을 추가 규칙 목록에서 사람이 읽을 수 있게 표시한다', () => {
    const rules: Rule[] = [
      { id: 'rule-1', type: 'derived', kind: 'maxLength', section: '기본정보', field: '영문상품명', threshold: 50, enabled: true },
    ];
    render(<RuleSettings rules={rules} onChange={vi.fn()} />);

    expect(screen.getByText(/기본정보 · 영문상품명 글자수 상한 50자/)).toBeInTheDocument();
  });
});
