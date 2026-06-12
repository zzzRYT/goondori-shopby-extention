import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIELD_CATALOG, type CatalogSection } from './field-catalog';
import { parseScreeningDocument } from './popup-parser';
import { screeningPopupUrl } from './popup-url';
import { SEED_RULES } from './seed-rules';

function loadProduct() {
  const html = readFileSync(
    resolve(process.cwd(), 'tests/fixtures', 'admin-screening-popup.html'),
    'utf-8',
  );
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return parseScreeningDocument(doc)!;
}

describe('FIELD_CATALOG', () => {
  it('카탈로그의 모든 항목이 팝업 픽스처 파싱 결과에 존재한다', () => {
    const product = loadProduct();

    for (const [section, fieldNames] of Object.entries(FIELD_CATALOG)) {
      for (const field of fieldNames) {
        expect(
          product.fields[section as CatalogSection]?.[field],
          `픽스처에 없는 카탈로그 항목: ${section} · ${field}`,
        ).toBeDefined();
      }
    }
  });
});

describe('SEED_RULES', () => {
  it('시드 규칙은 전부 OFF(선택 안함)로 제공한다', () => {
    expect(SEED_RULES.length).toBeGreaterThan(0);
    expect(SEED_RULES.every((rule) => rule.enabled === false)).toBe(true);
  });

  it('시드 규칙의 field는 카탈로그에 존재한다', () => {
    for (const rule of SEED_RULES) {
      if (rule.type === 'image') continue;
      expect(
        FIELD_CATALOG[rule.section as CatalogSection],
        `카탈로그에 없는 섹션: ${rule.section}`,
      ).toContain(rule.field);
    }
  });
});

describe('screeningPopupUrl', () => {
  it('상품번호로 심사 팝업 URL을 만든다', () => {
    expect(screeningPopupUrl('133770595')).toBe(
      'https://enterprise-remote.shopby.co.kr/popup/product-screening?globalProductNo=0&mallProductNo=133770595',
    );
  });
});
