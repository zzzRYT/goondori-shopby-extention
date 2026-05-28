import { useCallback, useState } from 'react';
import type { FillField } from '../../../lib/messaging';
import { displayRadioKey } from '../../../lib/shopby/display-radios';
import { DisplayBuilder, type DisplayResult } from './DisplayBuilder';
import { FillButton } from './FillButton';
import { TitleEditor, type TitleResult } from './TitleEditor';

const EMPTY_DISPLAY: DisplayResult = { displayId: '', hasError: true };
const EMPTY_TITLE: TitleResult = { title: '', color: '', hasError: false };

type ExposureYn = '' | 'Y' | 'N';

export function DisplayWorkspace() {
  const [display, setDisplay] = useState<DisplayResult>(EMPTY_DISPLAY);
  const [titleData, setTitleData] = useState<TitleResult>(EMPTY_TITLE);
  const [exposureYn, setExposureYn] = useState<ExposureYn>('');

  // useState setter는 안정적이지만, 자식 useEffect 의존성으로 쓰이므로 명시적으로 고정.
  const handleDisplayChange = useCallback((result: DisplayResult) => setDisplay(result), []);
  const handleTitleChange = useCallback((result: TitleResult) => setTitleData(result), []);

  // 빈 진열명/색상/노출여부는 보내지 않는다 — 어드민의 기존 값을 공백/기본값으로 덮어쓰지 않기 위함.
  const fields: FillField[] = [
    { key: 'displayId', value: display.displayId },
    ...(titleData.title.trim() ? [{ key: 'title', value: titleData.title }] : []),
    ...(titleData.color.trim() ? [{ key: 'color', value: titleData.color }] : []),
    ...(exposureYn ? [{ key: displayRadioKey('exposureYn'), value: exposureYn }] : []),
  ];

  const disabled = display.hasError || titleData.hasError;

  return (
    <div className="display-workspace">
      <DisplayBuilder onChange={handleDisplayChange} />
      <TitleEditor onChange={handleTitleChange} />

      <fieldset className="field-group">
        <legend>노출여부</legend>
        <small className="field-hint">선택하지 않으면 어드민의 기존 값을 유지합니다. 다시 누르면 선택 해제.</small>
        <div className="segmented">
          <button
            aria-pressed={exposureYn === 'Y'}
            className="segmented__button"
            data-active={exposureYn === 'Y'}
            onClick={() => setExposureYn((current) => (current === 'Y' ? '' : 'Y'))}
            type="button"
          >
            노출
          </button>
          <button
            aria-pressed={exposureYn === 'N'}
            className="segmented__button"
            data-active={exposureYn === 'N'}
            onClick={() => setExposureYn((current) => (current === 'N' ? '' : 'N'))}
            type="button"
          >
            비노출
          </button>
        </div>
      </fieldset>

      <FillButton disabled={disabled} fields={fields} />
    </div>
  );
}
