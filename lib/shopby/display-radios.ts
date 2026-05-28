import type { FillField, FillResult } from '../messaging';

// 진열 폼의 라벨 라디오(name 있는 안정 셀렉터). 텍스트 input과 채움 경로가 달라 별도 모듈로 분리.
export type DisplayRadioName = 'exposureYn';

const RADIO_KEY_RE = /^display\.radio\.(exposureYn)$/;

const RADIO_INPUT_NAME: Record<DisplayRadioName, string> = {
  exposureYn: 'displayYn',
};

export function displayRadioKey(name: DisplayRadioName): string {
  return `display.radio.${name}`;
}

export function isDisplayRadioKey(key: string): boolean {
  return RADIO_KEY_RE.test(key);
}

export function fillDisplayRadios(doc: Document, fields: FillField[]): FillResult {
  const result: FillResult = { filled: [], failed: [] };

  for (const field of fields) {
    const match = RADIO_KEY_RE.exec(field.key);
    if (!match) {
      result.failed.push({ key: field.key, reason: 'invalid display radio key' });
      continue;
    }

    const inputName = RADIO_INPUT_NAME[match[1] as DisplayRadioName];
    const radio = doc.querySelector<HTMLInputElement>(
      `input[type="radio"][name="${inputName}"][value="${field.value}"]`,
    );

    if (!radio) {
      result.failed.push({ key: field.key, reason: `radio not found: ${inputName}=${field.value}` });
      continue;
    }

    // click()으로 checked + change 이벤트를 함께 발생시켜 프레임워크 상태에 반영.
    radio.click();
    result.filled.push({ key: field.key });
  }

  return result;
}
