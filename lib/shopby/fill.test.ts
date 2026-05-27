import { describe, expect, it } from 'vitest';
import { fillByMap, setFieldValue } from './fill';

describe('setFieldValue', () => {
  it('값을 바꾸고 input/change 이벤트를 1번씩 발생시킨다', () => {
    const input = document.createElement('input');
    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));

    setFieldValue(input, 'c_1_p_t_병');

    expect(input.value).toBe('c_1_p_t_병');
    expect(events).toEqual(['input', 'change']);
  });
});

describe('fillByMap', () => {
  it('필드맵에 따라 값을 채우고 없는 셀렉터는 실패로 리포트한다', () => {
    document.body.innerHTML = '<input name="displayId" />';

    const result = fillByMap(
      document,
      { displayId: 'input[name="displayId"]', title: 'input[name="title"]' },
      [
        { key: 'displayId', value: 'c_1_p_t_병' },
        { key: 'title', value: '군인을 위한 꿀템' },
      ],
    );

    expect((document.querySelector('input[name="displayId"]') as HTMLInputElement).value).toBe('c_1_p_t_병');
    expect(result).toEqual({
      filled: [{ key: 'displayId' }],
      failed: [{ key: 'title', reason: 'selector not found: input[name="title"]' }],
    });
  });
});
