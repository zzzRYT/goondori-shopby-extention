import { beforeEach, describe, expect, it } from 'vitest';
import {
  installAlertSuppressor,
  readAlertMessage,
  readAlertSeq,
  setAutoConfirm,
} from './alert-suppressor';

describe('alert-suppressor', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-gnd-auto-confirm');
    document.documentElement.removeAttribute('data-gnd-alert-seq');
    document.documentElement.removeAttribute('data-gnd-alert-message');
  });

  it('플래그가 꺼져 있으면 원본 alert/confirm을 호출한다', () => {
    const calls: string[] = [];
    const win = {
      document,
      alert: (m?: unknown) => calls.push(`alert:${m}`),
      confirm: (_m?: unknown) => { calls.push('confirm'); return false; },
    } as unknown as Window;
    installAlertSuppressor(win);

    win.alert('저장되었습니다');
    const result = win.confirm('진행?');

    expect(calls).toEqual(['alert:저장되었습니다', 'confirm']);
    expect(result).toBe(false);
    expect(readAlertSeq(document)).toBe(0);
  });

  it('플래그가 켜져 있으면 alert을 삼키고 메시지를 캡처한다', () => {
    let original = 0;
    const win = {
      document,
      alert: () => { original += 1; },
      confirm: () => { original += 1; return false; },
    } as unknown as Window;
    installAlertSuppressor(win);
    setAutoConfirm(document, true);

    win.alert('저장되었습니다');

    expect(original).toBe(0);
    expect(readAlertSeq(document)).toBe(1);
    expect(readAlertMessage(document)).toBe('저장되었습니다');
  });

  it('플래그가 켜져 있으면 confirm은 true를 반환하고 캡처한다', () => {
    const win = {
      document,
      alert: () => {},
      confirm: () => false,
    } as unknown as Window;
    installAlertSuppressor(win);
    setAutoConfirm(document, true);

    const result = win.confirm('저장하시겠습니까?');

    expect(result).toBe(true);
    expect(readAlertSeq(document)).toBe(1);
    expect(readAlertMessage(document)).toBe('저장하시겠습니까?');
  });

  it('연속 캡처는 seq가 증가한다', () => {
    const win = { document, alert: () => {}, confirm: () => false } as unknown as Window;
    installAlertSuppressor(win);
    setAutoConfirm(document, true);

    win.alert('1');
    win.alert('2');

    expect(readAlertSeq(document)).toBe(2);
    expect(readAlertMessage(document)).toBe('2');
  });

  it('setAutoConfirm(false)면 다시 원본으로 통과', () => {
    let original = 0;
    const win = { document, alert: () => { original += 1; }, confirm: () => false } as unknown as Window;
    installAlertSuppressor(win);
    setAutoConfirm(document, true);
    win.alert('x');
    setAutoConfirm(document, false);
    win.alert('y');

    expect(original).toBe(1);
    expect(readAlertSeq(document)).toBe(1);
  });
});
