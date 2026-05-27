import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fillByMap } from './fill';
import { DISPLAY_FIELD_MAP } from './selectors';

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
