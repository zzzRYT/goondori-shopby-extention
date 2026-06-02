import { parseDisplayId } from '../../../lib/display-id/parse';
import type { SectionEntry } from '../../../lib/shopby/api/types';

// 저장 직전에 돌리는 검증 함수 모음. DOM 의존성을 빼서 단위 테스트가 단순해지도록 분리.
// 검증 결과는 `ValidationIssue` 한 줄로 표준화해 SaveToast가 그대로 렌더한다.

export type ValidationIssue = {
  field: string;
  reason: string;
  // 토스트 항목 클릭 시 해당 필드로 스크롤·포커스하기 위한 콜백.
  // pure validators는 DOM을 모르므로 채우지 않고, DOM 컨텍스트가 있는 ValidateButton의
  // collector에서 부여한다. 클릭 시점에 요소가 detach 됐을 수 있으니 호출하는 쪽에서 `isConnected`로 확인.
  focusTarget?: () => HTMLElement | null;
};

const TARGET_RATIOS = [
  { name: '16:9', value: 16 / 9 },
  { name: '3:2', value: 3 / 2 },
] as const;
// 입력값 변환 오차(예: 1920/1080)와 사람이 손으로 친 근사치를 살짝 흡수.
const RATIO_TOLERANCE = 0.01;

// 띠배너 accountName: 진열 ID 형식 + 실제 진열 목록에 존재하는지.
// 비어 있으면 검증 안 함(아직 미설정 구좌이거나 사용 안 함 구좌).
export function validateStripAccountName(
  accountIndex: number,
  rawValue: string,
  sections: readonly SectionEntry[],
): ValidationIssue | null {
  const value = rawValue.trim();
  if (!value) return null;

  const parsed = parseDisplayId(value);
  if (!parsed.ok) {
    const firstError = parsed.issues.find((issue) => issue.severity === 'error');
    return {
      field: `구좌 ${accountIndex + 1} 진열 ID`,
      reason: `「${value}」 진열 ID 형식이 아닙니다 (${firstError?.message ?? '알 수 없는 오류'}).`,
    };
  }

  const exists = sections.some((section) => section.sectionId === value);
  if (!exists) {
    return {
      field: `구좌 ${accountIndex + 1} 진열 ID`,
      reason: `「${value}」 — 진열 목록에서 찾을 수 없는 ID입니다. 진열이 삭제됐거나 오타가 있을 수 있어요.`,
    };
  }

  return null;
}

// 띠배너 세로(높이): 앱 레이아웃 규격상 84 또는 104 두 값만 허용.
// 가로(16)는 시스템 고정이라 검증 대상이 아니고, 비율 설정 자체가 무시되므로
// 실제로 다르게 표시되는 건 세로뿐이다. 강제는 불가능해도 다른 값이면 의도치 않은
// 표시가 되므로 경고로 잡는다. 비어 있으면 검증 안 함(기본값/미설정 구좌).
const STRIP_ALLOWED_HEIGHTS: readonly number[] = [84, 104];

export function validateStripHeight(accountIndex: number, heightRaw: string): ValidationIssue | null {
  const height = heightRaw.trim();
  if (!height) return null;

  const h = Number(height);
  if (!Number.isFinite(h) || !STRIP_ALLOWED_HEIGHTS.includes(h)) {
    return {
      field: `구좌 ${accountIndex + 1} 세로(높이)`,
      reason: `세로는 ${STRIP_ALLOWED_HEIGHTS.join(' 또는 ')}만 허용됩니다 (입력값 ${height}).`,
    };
  }

  return null;
}

// 배너 이미지 미설정 검사. 이미지 업로드는 DOM 위젯이라 값이 input에 담기지 않아
// (imageName 텍스트 input은 이미지가 있어도 비어 있음), 호출부(ValidateButton)에서
// 미리보기 <img> 존재 여부를 boolean으로 판정해 넘긴다. 「사용 중인 구좌」인데
// 이미지가 없을 때만 경고하도록 호출부에서 게이팅한다.
export function validateBannerImage(accountIndex: number, hasImage: boolean): ValidationIssue | null {
  if (hasImage) return null;
  return {
    field: `구좌 ${accountIndex + 1} 배너 이미지`,
    reason: '배너 이미지가 설정되지 않았습니다. 이미지를 업로드한 뒤 저장하세요.',
  };
}

// 메인배너 사이즈: 16:9 또는 3:2 비율인지.
// 둘 다 비어 있으면 검증 안 함(사용 안 함 구좌). 한쪽만 비어 있으면 에러.
export function validateMainSize(
  accountIndex: number,
  widthRaw: string,
  heightRaw: string,
): ValidationIssue | null {
  const width = widthRaw.trim();
  const height = heightRaw.trim();
  if (!width && !height) return null;

  if (!width || !height) {
    return {
      field: `구좌 ${accountIndex + 1} 사이즈`,
      reason: '가로·세로 둘 다 입력해야 합니다.',
    };
  }

  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return {
      field: `구좌 ${accountIndex + 1} 사이즈`,
      reason: `가로·세로는 0보다 큰 숫자여야 합니다 (입력값 ${width}×${height}).`,
    };
  }

  const ratio = w / h;
  const ok = TARGET_RATIOS.some((target) => Math.abs(ratio - target.value) / target.value <= RATIO_TOLERANCE);
  if (!ok) {
    return {
      field: `구좌 ${accountIndex + 1} 사이즈`,
      reason: `16:9 또는 3:2 비율이 아닙니다 (입력값 ${width}×${height} ≈ ${ratio.toFixed(2)}:1).`,
    };
  }

  return null;
}

// 메인배너 「사용=Y」 구좌가 정확히 1개인지.
// shopby-display.md 3-3: "16:9 1개 + 3:2 1개 중 하나만" 규칙.
export function validateActiveAccountCount(activeCount: number): ValidationIssue | null {
  if (activeCount === 1) return null;
  if (activeCount === 0) {
    return {
      field: '메인배너 사용 구좌',
      reason: '사용 중인 구좌가 없습니다. 16:9 또는 3:2 중 하나의 구좌를 「사용」으로 설정하세요.',
    };
  }
  return {
    field: '메인배너 사용 구좌',
    reason: `사용 중인 구좌가 ${activeCount}개입니다. 16:9 / 3:2 중 정확히 1개만 「사용」으로 설정하세요.`,
  };
}
