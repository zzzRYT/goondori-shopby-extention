import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessage, type FillField } from '../../../lib/messaging';
import { displayRadioKey } from '../../../lib/shopby/display-radios';
import {
  applyAdminValues,
  deriveDisplay,
  deriveTitle,
  describeLoaded,
  INITIAL_BUILDER_STATE,
  INITIAL_TITLE_STATE,
  type BuilderState,
  type TitleState,
} from './display-state';
import { DisplayBuilder } from './DisplayBuilder';
import { FillButton } from './FillButton';
import { TitleEditor } from './TitleEditor';

type ExposureYn = '' | 'Y' | 'N';

type LoadStatus =
  | { kind: 'idle' }
  | { kind: 'loaded'; text: string }
  | { kind: 'empty' }
  | { kind: 'error' };

const EMPTY_GUIDE = '어드민에서 진열 수정 화면을 연 뒤 다시 눌러주세요';
const ERROR_GUIDE = '어드민 값을 불러오지 못했어요';

export function DisplayWorkspace() {
  const [builder, setBuilder] = useState<BuilderState>(INITIAL_BUILDER_STATE);
  const [title, setTitle] = useState<TitleState>(INITIAL_TITLE_STATE);
  const [exposureYn, setExposureYn] = useState<ExposureYn>('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<LoadStatus>({ kind: 'idle' });

  // loadFromAdmin을 안정적으로 유지하면서 최신 상태를 읽기 위한 ref.
  const stateRef = useRef({ builder, title });
  stateRef.current = { builder, title };

  const loadFromAdmin = useCallback(async (trigger: 'auto' | 'manual') => {
    setIsLoading(true);

    try {
      const read = (await sendMessage('readCurrentDisplay', undefined)) ?? {};
      const result = applyAdminValues(read, stateRef.current);

      setBuilder(result.builder);
      setTitle(result.title);

      if (result.loaded.length > 0) {
        setStatus({ kind: 'loaded', text: describeLoaded(result.loaded) });
      } else {
        // 자동 1회가 빈손이면 에러처럼 보이지 않게 조용히 둔다.
        setStatus(trigger === 'manual' ? { kind: 'empty' } : { kind: 'idle' });
      }
    } catch {
      setStatus({ kind: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 진열 탭 진입(마운트) 시 1회 자동 조회.
  useEffect(() => {
    void loadFromAdmin('auto');
  }, [loadFromAdmin]);

  const derivedDisplay = deriveDisplay(builder);
  const derivedTitle = deriveTitle(title);

  // 빈 진열명/색상/노출여부는 보내지 않는다 — 어드민의 기존 값을 공백/기본값으로 덮어쓰지 않기 위함.
  const fields: FillField[] = [
    { key: 'displayId', value: derivedDisplay.displayId },
    ...(derivedTitle.title.trim() ? [{ key: 'title', value: derivedTitle.title }] : []),
    ...(derivedTitle.color.trim() ? [{ key: 'color', value: derivedTitle.color }] : []),
    ...(exposureYn ? [{ key: displayRadioKey('exposureYn'), value: exposureYn }] : []),
  ];

  const disabled = derivedDisplay.hasError || derivedTitle.hasError;

  return (
    <div className="display-workspace">
      <div className="load-bar">
        <button
          className="secondary-button"
          disabled={isLoading}
          onClick={() => void loadFromAdmin('manual')}
          type="button"
        >
          {isLoading ? '불러오는 중…' : '↻ 현재 어드민 값 불러오기'}
        </button>
        <span aria-live="polite" className="load-bar__status">
          {statusText(status, isLoading)}
        </span>
      </div>

      <DisplayBuilder value={builder} onChange={setBuilder} />
      <TitleEditor value={title} onChange={setTitle} />

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

function statusText(status: LoadStatus, isLoading: boolean): string {
  if (isLoading) return '불러오는 중…';
  if (status.kind === 'loaded') return status.text;
  if (status.kind === 'empty') return EMPTY_GUIDE;
  if (status.kind === 'error') return ERROR_GUIDE;
  return '';
}
