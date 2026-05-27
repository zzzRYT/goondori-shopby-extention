import type { FillField, FillResult } from '../messaging';

// "노출 설정" 버튼을 누르면 별도 origin(popup-remote.shopby.co.kr) 팝업 페이지가 뜬다.
// 그 페이지의 "노출 방식" 라디오(랜덤 RANDOM / 순차 SEQUENTIAL)만 설정한다.
// 저장은 사람이 직접 누른다(안전 원칙).
export type ExposureMethod = 'RANDOM' | 'SEQUENTIAL';

export const EXPOSURE_METHOD_KEY = 'exposureMethod';

const EXPOSURE_LABEL = '노출 방식';

export function fillExposure(doc: Document, fields: FillField[]): FillResult {
  const result: FillResult = { filled: [], failed: [] };

  for (const field of fields) {
    if (field.key !== EXPOSURE_METHOD_KEY) {
      result.failed.push({ key: field.key, reason: 'unknown exposure field' });
      continue;
    }

    const radio = findExposureRadio(doc, field.value);
    if (!radio) {
      result.failed.push({ key: field.key, reason: `노출 방식 라디오를 찾지 못했습니다 (값: ${field.value})` });
      continue;
    }

    radio.click();
    result.filled.push({ key: field.key });
  }

  return result;
}

function findExposureRadio(doc: Document, value: string): HTMLInputElement | null {
  const th = Array.from(doc.querySelectorAll('th')).find((element) => element.textContent?.trim() === EXPOSURE_LABEL);
  const row = th?.closest('tr');
  if (!row) return null;

  return row.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);
}
