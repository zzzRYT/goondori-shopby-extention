import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fillByMap } from './fill';
import { BANNER_FIELD_MAP, DISPLAY_FIELD_MAP, bannerFieldKey } from './selectors';

function loadFixture(name: string): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('DISPLAY_FIELD_MAP (admin-display.html 실제 폼 픽스처)', () => {
  it('진열 ID/진열명/색상 필드를 어드민 폼에 채운다', () => {
    const doc = loadFixture('admin-display.html');

    const result = fillByMap(doc, DISPLAY_FIELD_MAP, [
      { key: 'displayId', value: 'c_1_p_t_병' },
      { key: 'title', value: '군인을 위한 꿀템' },
      { key: 'color', value: '군인#008000' },
    ]);

    expect(result.failed).toEqual([]);
    expect(result.filled.map((field) => field.key).sort()).toEqual(['color', 'displayId', 'title']);
    expect((doc.querySelector('input[name="sectionId"]') as HTMLInputElement).value).toBe('c_1_p_t_병');
    expect((doc.querySelector('input[name="title"]') as HTMLInputElement).value).toBe('군인을 위한 꿀템');
    expect((doc.querySelector('input[name="sectionExplain"]') as HTMLInputElement).value).toBe('군인#008000');
  });

  it('매핑된 셀렉터가 모두 픽스처에 존재한다', () => {
    const doc = loadFixture('admin-display.html');

    for (const selector of Object.values(DISPLAY_FIELD_MAP)) {
      expect(doc.querySelector(selector), `셀렉터 미존재: ${selector}`).not.toBeNull();
    }
  });
});

describe('BANNER_FIELD_MAP (admin-banner.html 실제 폼 픽스처)', () => {
  it('선택한 구좌(0)의 구좌명·사이즈·랜딩 URL을 채운다', () => {
    const doc = loadFixture('admin-banner.html');

    const result = fillByMap(doc, BANNER_FIELD_MAP, [
      { key: bannerFieldKey(0, 'accountName'), value: 'c_1_p_t_병부장' },
      { key: bannerFieldKey(0, 'width'), value: '16' },
      { key: bannerFieldKey(0, 'height'), value: '9' },
      { key: bannerFieldKey(0, 'landingUrl'), value: 'https://example.com' },
    ]);

    expect(result.failed).toEqual([]);
    expect((doc.querySelector('input[name="accounts.0.accountName"]') as HTMLInputElement).value).toBe('c_1_p_t_병부장');
    expect((doc.querySelector('input[name="accounts.0.width"]') as HTMLInputElement).value).toBe('16');
    expect((doc.querySelector('input[name="accounts.0.height"]') as HTMLInputElement).value).toBe('9');
    expect(
      (doc.querySelector('input[name="accounts.0.banners.0.landingUrlValue.landingUrl"]') as HTMLInputElement).value,
    ).toBe('https://example.com');
  });

  it('두 번째 구좌(1)도 독립적으로 채운다', () => {
    const doc = loadFixture('admin-banner.html');

    fillByMap(doc, BANNER_FIELD_MAP, [{ key: bannerFieldKey(1, 'accountName'), value: '스토어_메인배너' }]);

    expect((doc.querySelector('input[name="accounts.1.accountName"]') as HTMLInputElement).value).toBe('스토어_메인배너');
    expect((doc.querySelector('input[name="accounts.0.accountName"]') as HTMLInputElement).value).toBe('');
  });
});
