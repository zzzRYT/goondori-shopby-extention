import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXPOSURE_METHOD_KEY, fillExposure } from './exposure';

function loadExposure(): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures/admin-banner-exposure.html'), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
}

function exposureRadio(doc: Document, value: string): HTMLInputElement {
  const th = Array.from(doc.querySelectorAll('th')).find((el) => el.textContent?.trim() === '노출 방식');
  return th!.closest('tr')!.querySelector(`input[type="radio"][value="${value}"]`) as HTMLInputElement;
}

describe('fillExposure (admin-banner-exposure.html 팝업 폼)', () => {
  it('노출 방식을 RANDOM(랜덤)으로 체크하고 change를 발생시킨다', () => {
    const doc = loadExposure();
    const radio = exposureRadio(doc, 'RANDOM');
    let changed = false;
    radio.addEventListener('change', () => (changed = true));

    const result = fillExposure(doc, [{ key: EXPOSURE_METHOD_KEY, value: 'RANDOM' }]);

    expect(result.failed).toEqual([]);
    expect(result.filled).toEqual([{ key: EXPOSURE_METHOD_KEY }]);
    expect(radio.checked).toBe(true);
    expect(changed).toBe(true);
  });

  it('노출 방식을 SEQUENTIAL(순차)로 체크한다', () => {
    const doc = loadExposure();

    fillExposure(doc, [{ key: EXPOSURE_METHOD_KEY, value: 'SEQUENTIAL' }]);

    expect(exposureRadio(doc, 'SEQUENTIAL').checked).toBe(true);
  });

  it('노출 방식 라디오가 없으면(다른 페이지) failed로 리포트한다', () => {
    const doc = new DOMParser().parseFromString('<table></table>', 'text/html');

    const result = fillExposure(doc, [{ key: EXPOSURE_METHOD_KEY, value: 'RANDOM' }]);

    expect(result.filled).toEqual([]);
    expect(result.failed[0].key).toBe(EXPOSURE_METHOD_KEY);
  });

  it('알 수 없는 값은 failed로 리포트한다', () => {
    const doc = loadExposure();

    const result = fillExposure(doc, [{ key: EXPOSURE_METHOD_KEY, value: 'NOPE' }]);

    expect(result.failed[0].key).toBe(EXPOSURE_METHOD_KEY);
  });
});
