import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bannerRadioKey, fillBannerRadios, isBannerRadioKey } from './banner-radios';

function loadBanner(): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures/admin-banner.html'), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
}

function contentScope(doc: Document, accountIndex: number): HTMLElement {
  const anchor = doc.querySelector(`input[name="accounts.${accountIndex}.banners.0.bannerName"]`);
  return anchor!.closest('table') as HTMLElement;
}

function radioByLabel(scope: HTMLElement, label: string, value: string): HTMLInputElement {
  const th = Array.from(scope.querySelectorAll('th')).find((el) => el.textContent?.trim() === label);
  return th!.closest('tr')!.querySelector(`input[type="radio"][value="${value}"]`) as HTMLInputElement;
}

describe('isBannerRadioKey', () => {
  it('account{i}.radio.{name} 형식만 라디오 키로 인식한다', () => {
    expect(isBannerRadioKey('account0.radio.use')).toBe(true);
    expect(isBannerRadioKey('account3.radio.periodMode')).toBe(true);
    expect(isBannerRadioKey('account0.accountName')).toBe(false);
    expect(isBannerRadioKey('account0.radio.unknown')).toBe(false);
  });
});

describe('fillBannerRadios (admin-banner.html 실제 폼)', () => {
  it('사용 여부를 N(사용 안 함)으로 체크한다', () => {
    const doc = loadBanner();

    const result = fillBannerRadios(doc, [{ key: bannerRadioKey(0, 'use'), value: 'N' }]);

    expect(result.failed).toEqual([]);
    expect(result.filled).toEqual([{ key: 'account0.radio.use' }]);
    const scope = contentScope(doc, 0);
    expect(radioByLabel(scope, '사용 여부', 'N').checked).toBe(true);
  });

  it('노출 기간을 PERIOD(기간 노출)로 체크하고 change 이벤트를 발생시킨다', () => {
    const doc = loadBanner();
    const scope = contentScope(doc, 0);
    const period = radioByLabel(scope, '노출 기간', 'PERIOD');
    let changed = false;
    period.addEventListener('change', () => (changed = true));

    fillBannerRadios(doc, [{ key: bannerRadioKey(0, 'periodMode'), value: 'PERIOD' }]);

    // name 없는 라디오는 네이티브 그룹이 아니라 정적 DOM에선 형제가 자동 해제되지 않는다.
    // 실제 앱은 change 이벤트로 Vue가 상태를 갱신하므로, 대상 체크 + change 발생만 검증.
    expect(period.checked).toBe(true);
    expect(changed).toBe(true);
  });

  it('구좌 인덱스별로 독립적으로 체크한다', () => {
    const doc = loadBanner();

    fillBannerRadios(doc, [{ key: bannerRadioKey(1, 'use'), value: 'N' }]);

    expect(radioByLabel(contentScope(doc, 1), '사용 여부', 'N').checked).toBe(true);
    expect(radioByLabel(contentScope(doc, 0), '사용 여부', 'N').checked).toBe(false);
  });

  it('앵커를 찾지 못하면 failed로 리포트한다', () => {
    const doc = loadBanner();

    const result = fillBannerRadios(doc, [{ key: bannerRadioKey(9, 'use'), value: 'Y' }]);

    expect(result.filled).toEqual([]);
    expect(result.failed[0].key).toBe('account9.radio.use');
  });
});
