import type { FillField, FillResult } from '../messaging';

// 사용 여부·노출 기간은 name 없는 라디오라 셀렉터로 못 잡는다.
// 구좌의 콘텐츠 테이블(bannerName named input의 closest table)을 스코프로 잡고,
// th 라벨로 행을 찾아 그 안의 value 라디오를 체크한다.
export type BannerRadioName = 'use' | 'periodMode';

const RADIO_KEY_RE = /^account(\d+)\.radio\.(use|periodMode)$/;

const RADIO_LABEL: Record<BannerRadioName, string> = {
  use: '사용 여부',
  periodMode: '노출 기간',
};

export function bannerRadioKey(accountIndex: number, name: BannerRadioName): string {
  return `account${accountIndex}.radio.${name}`;
}

export function isBannerRadioKey(key: string): boolean {
  return RADIO_KEY_RE.test(key);
}

export function fillBannerRadios(doc: Document, fields: FillField[]): FillResult {
  const result: FillResult = { filled: [], failed: [] };

  for (const field of fields) {
    const match = RADIO_KEY_RE.exec(field.key);
    if (!match) {
      result.failed.push({ key: field.key, reason: 'invalid banner radio key' });
      continue;
    }

    const accountIndex = Number(match[1]);
    const label = RADIO_LABEL[match[2] as BannerRadioName];
    const radio = findRadio(doc, accountIndex, label, field.value);

    if (!radio) {
      result.failed.push({ key: field.key, reason: `radio not found: ${label}=${field.value}` });
      continue;
    }

    checkRadio(radio);
    result.filled.push({ key: field.key });
  }

  return result;
}

function findRadio(doc: Document, accountIndex: number, label: string, value: string): HTMLInputElement | null {
  const anchor = doc.querySelector(`input[name="accounts.${accountIndex}.banners.0.bannerName"]`);
  const scope = anchor?.closest('table');
  if (!scope) return null;

  const th = Array.from(scope.querySelectorAll('th')).find((element) => element.textContent?.trim() === label);
  const row = th?.closest('tr');
  if (!row) return null;

  return row.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);
}

function checkRadio(radio: HTMLInputElement) {
  // click()은 checked 설정과 click/change 이벤트를 함께 발생시켜 프레임워크 상태에 반영된다.
  radio.click();
}
