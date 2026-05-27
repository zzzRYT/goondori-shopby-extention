import { useCallback, useState } from 'react';
import type { FillField } from '../../../lib/messaging';
import { DisplayBuilder, type DisplayResult } from './DisplayBuilder';
import { FillButton } from './FillButton';
import { TitleEditor, type TitleResult } from './TitleEditor';

const EMPTY_DISPLAY: DisplayResult = { displayId: '', hasError: true };
const EMPTY_TITLE: TitleResult = { title: '', color: '', hasError: false };

export function DisplayWorkspace() {
  const [display, setDisplay] = useState<DisplayResult>(EMPTY_DISPLAY);
  const [titleData, setTitleData] = useState<TitleResult>(EMPTY_TITLE);

  // useState setter는 안정적이지만, 자식 useEffect 의존성으로 쓰이므로 명시적으로 고정.
  const handleDisplayChange = useCallback((result: DisplayResult) => setDisplay(result), []);
  const handleTitleChange = useCallback((result: TitleResult) => setTitleData(result), []);

  // 빈 진열명/색상은 보내지 않는다 — 어드민의 기존 값을 공백으로 덮어쓰지 않기 위함.
  const fields: FillField[] = [
    { key: 'displayId', value: display.displayId },
    ...(titleData.title.trim() ? [{ key: 'title', value: titleData.title }] : []),
    ...(titleData.color.trim() ? [{ key: 'color', value: titleData.color }] : []),
  ];

  const disabled = display.hasError || titleData.hasError;

  return (
    <div className="display-workspace">
      <DisplayBuilder onChange={handleDisplayChange} />
      <TitleEditor onChange={handleTitleChange} />
      <FillButton disabled={disabled} fields={fields} />
    </div>
  );
}
