import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { displayRadioKey, fillDisplayRadios, isDisplayRadioKey } from './display-radios';

function loadDisplay(): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures/admin-display.html'), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('isDisplayRadioKey', () => {
  it('display.radio.{name} 형식만 라디오 키로 인식한다', () => {
    expect(isDisplayRadioKey('display.radio.exposureYn')).toBe(true);
    expect(isDisplayRadioKey('display.radio.unknown')).toBe(false);
    expect(isDisplayRadioKey('displayId')).toBe(false);
    expect(isDisplayRadioKey('title')).toBe(false);
  });
});

describe('fillDisplayRadios (admin-display.html 실제 폼)', () => {
  it('노출여부를 N(노출 안 함)으로 체크한다', () => {
    const doc = loadDisplay();

    const result = fillDisplayRadios(doc, [{ key: displayRadioKey('exposureYn'), value: 'N' }]);

    expect(result.failed).toEqual([]);
    expect(result.filled).toEqual([{ key: 'display.radio.exposureYn' }]);
    const radio = doc.querySelector<HTMLInputElement>('input[name="displayYn"][value="N"]')!;
    expect(radio.checked).toBe(true);
  });

  it('노출여부를 Y(노출함)로 체크하면 change 이벤트가 발생한다', () => {
    const doc = loadDisplay();
    const radio = doc.querySelector<HTMLInputElement>('input[name="displayYn"][value="Y"]')!;
    let changed = false;
    radio.addEventListener('change', () => (changed = true));

    fillDisplayRadios(doc, [{ key: displayRadioKey('exposureYn'), value: 'Y' }]);

    expect(radio.checked).toBe(true);
    expect(changed).toBe(true);
  });

  it('알 수 없는 value면 failed로 리포트한다', () => {
    const doc = loadDisplay();

    const result = fillDisplayRadios(doc, [{ key: displayRadioKey('exposureYn'), value: 'X' }]);

    expect(result.filled).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].key).toBe('display.radio.exposureYn');
  });

  it('잘못된 키 형식이면 failed로 리포트한다', () => {
    const doc = loadDisplay();

    const result = fillDisplayRadios(doc, [{ key: 'display.radio.unknown', value: 'Y' }]);

    expect(result.filled).toEqual([]);
    expect(result.failed[0].reason).toBe('invalid display radio key');
  });
});
