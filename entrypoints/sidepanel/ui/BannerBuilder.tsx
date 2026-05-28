import { useState } from 'react';
import type { FillField } from '../../../lib/messaging';
import { bannerRadioKey } from '../../../lib/shopby/banner-radios';
import { EXPOSURE_METHOD_KEY } from '../../../lib/shopby/exposure';
import { bannerFieldKey } from '../../../lib/shopby/selectors';
import { FillButton } from './FillButton';
import { SectionPicker } from './SectionPicker';

type BannerMode = 'main' | 'strip';
type UseValue = '' | 'Y' | 'N';
type PeriodValue = '' | 'REGULAR' | 'PERIOD';
type ExposureValue = '' | 'RANDOM' | 'SEQUENTIAL';

const SIZE_PRESETS: { label: string; width: string; height: string }[] = [
  { label: '16:9', width: '16', height: '9' },
  { label: '3:2', width: '3', height: '2' },
];

export function BannerBuilder() {
  const [mode, setMode] = useState<BannerMode>('main');
  const [accountNo, setAccountNo] = useState(1);
  const [accountName, setAccountName] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [landingUrl, setLandingUrl] = useState('');
  const [use, setUse] = useState<UseValue>('');
  const [periodMode, setPeriodMode] = useState<PeriodValue>('');
  const [exposureMethod, setExposureMethod] = useState<ExposureValue>('');

  const index = Math.max(0, accountNo - 1);

  const fields: FillField[] = [
    ...(accountName.trim() ? [{ key: bannerFieldKey(index, 'accountName'), value: accountName }] : []),
    ...(use ? [{ key: bannerRadioKey(index, 'use'), value: use }] : []),
    ...(mode === 'main' && width.trim() ? [{ key: bannerFieldKey(index, 'width'), value: width }] : []),
    ...(mode === 'main' && height.trim() ? [{ key: bannerFieldKey(index, 'height'), value: height }] : []),
    ...(periodMode ? [{ key: bannerRadioKey(index, 'periodMode'), value: periodMode }] : []),
    ...(landingUrl.trim() ? [{ key: bannerFieldKey(index, 'landingUrl'), value: landingUrl }] : []),
  ];

  const disabled = fields.length === 0;

  function applyPreset(preset: (typeof SIZE_PRESETS)[number]) {
    setWidth(preset.width);
    setHeight(preset.height);
  }

  return (
    <section className="banner-builder" aria-labelledby="banner-builder-title">
      <div className="section-heading">
        <div>
          <h2 id="banner-builder-title">배너</h2>
          <p>구좌를 골라 값을 채웁니다. 이미지·노출기간·사용여부는 어드민에서 직접 설정하세요.</p>
        </div>
      </div>

      <div className="form-grid">
        <fieldset className="field-group">
          <legend>배너 종류</legend>
          <div className="segmented">
            <button className="segmented__button" data-active={mode === 'main'} onClick={() => setMode('main')} type="button">
              메인
            </button>
            <button className="segmented__button" data-active={mode === 'strip'} onClick={() => setMode('strip')} type="button">
              띠
            </button>
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="banner-account-no">구좌 번호</label>
          <small className="field-hint" id="banner-account-no-hint">
            채울 구좌 순번. 메인은 1·2, 띠는 1~20.
          </small>
          <input
            aria-describedby="banner-account-no-hint"
            id="banner-account-no"
            min={1}
            onChange={(event) => setAccountNo(Number(event.target.value))}
            type="number"
            value={accountNo}
          />
        </div>

        <div className="field field--wide">
          {mode === 'strip' ? (
            <>
              <span>연결할 진열</span>
              <small className="field-hint">
                연결할 <strong>진열</strong>을 선택하세요. 해당 진열 하단에 배너가 노출됩니다.
              </small>
              <SectionPicker onChange={setAccountName} value={accountName} />
            </>
          ) : (
            <>
              <label htmlFor="banner-account-name">구좌명</label>
              <small className="field-hint" id="banner-account-name-hint">
                MD 식별용 이름(앱 미사용). 예: 스토어_메인배너
              </small>
              <input
                aria-describedby="banner-account-name-hint"
                id="banner-account-name"
                onChange={(event) => setAccountName(event.target.value)}
                value={accountName}
              />
            </>
          )}
        </div>

        <fieldset className="field-group field-group--wide">
          <legend>사용 여부</legend>
          <div className="segmented segmented--three">
            <button className="segmented__button" data-active={use === ''} onClick={() => setUse('')} type="button">
              변경 안 함
            </button>
            <button className="segmented__button" data-active={use === 'Y'} onClick={() => setUse('Y')} type="button">
              사용
            </button>
            <button className="segmented__button" data-active={use === 'N'} onClick={() => setUse('N')} type="button">
              사용 안 함
            </button>
          </div>
        </fieldset>

        {mode === 'main' && (
          <fieldset className="field-group field-group--wide">
            <legend>사이즈</legend>
            <div className="segmented">
              {SIZE_PRESETS.map((preset) => (
                <button
                  className="segmented__button"
                  data-active={width === preset.width && height === preset.height}
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="size-inputs">
              <label className="field" htmlFor="banner-width">
                <span>가로</span>
                <input id="banner-width" inputMode="numeric" onChange={(event) => setWidth(event.target.value)} value={width} />
              </label>
              <label className="field" htmlFor="banner-height">
                <span>세로</span>
                <input id="banner-height" inputMode="numeric" onChange={(event) => setHeight(event.target.value)} value={height} />
              </label>
            </div>
          </fieldset>
        )}

        {mode === 'strip' && (
          <p className="banner-note" role="note">
            띠 배너는 이미지 비율 설정이 무시됩니다(가로·세로 입력해도 적용 안 됨).
          </p>
        )}

        <fieldset className="field-group field-group--wide">
          <legend>노출 기간</legend>
          <div className="segmented segmented--three">
            <button
              className="segmented__button"
              data-active={periodMode === ''}
              onClick={() => setPeriodMode('')}
              type="button"
            >
              변경 안 함
            </button>
            <button
              className="segmented__button"
              data-active={periodMode === 'REGULAR'}
              onClick={() => setPeriodMode('REGULAR')}
              type="button"
            >
              상시 노출
            </button>
            <button
              className="segmented__button"
              data-active={periodMode === 'PERIOD'}
              onClick={() => setPeriodMode('PERIOD')}
              type="button"
            >
              기간 노출
            </button>
          </div>
          {periodMode === 'PERIOD' && (
            <small className="field-hint">
              기간 노출은 시작·종료 날짜를 어드민 데이트피커에서 직접 입력하세요(자동 입력 안 됨).
            </small>
          )}
        </fieldset>

        <div className="field field--wide">
          <label htmlFor="banner-landing">랜딩 URL</label>
          <small className="field-hint" id="banner-landing-hint">
            배너 클릭 시 이동할 URL. 앱 개발자와 사전 협의가 필요합니다.
          </small>
          <input
            aria-describedby="banner-landing-hint"
            id="banner-landing"
            onChange={(event) => setLandingUrl(event.target.value)}
            placeholder="https://"
            value={landingUrl}
          />
        </div>
      </div>

      <FillButton disabled={disabled} fields={fields} message="fillBanner" />

      <div className="exposure-section">
        <div className="section-heading">
          <div>
            <h3>노출 방식 (노출 설정 팝업)</h3>
            <p>
              어드민에서 <strong>노출 설정</strong> 버튼을 눌러 팝업을 연 뒤 적용하세요. 콘텐츠가 여러 개일 때의 노출
              순서입니다.
            </p>
          </div>
        </div>

        <fieldset className="field-group field-group--wide">
          <legend>노출 방식</legend>
          <div className="segmented segmented--three">
            <button
              className="segmented__button"
              data-active={exposureMethod === ''}
              onClick={() => setExposureMethod('')}
              type="button"
            >
              변경 안 함
            </button>
            <button
              className="segmented__button"
              data-active={exposureMethod === 'RANDOM'}
              onClick={() => setExposureMethod('RANDOM')}
              type="button"
            >
              랜덤
            </button>
            <button
              className="segmented__button"
              data-active={exposureMethod === 'SEQUENTIAL'}
              onClick={() => setExposureMethod('SEQUENTIAL')}
              type="button"
            >
              순차
            </button>
          </div>
        </fieldset>

        <FillButton
          disabled={exposureMethod === ''}
          fields={exposureMethod ? [{ key: EXPOSURE_METHOD_KEY, value: exposureMethod }] : []}
          label="노출 설정 팝업에 적용"
          message="fillExposure"
        />
      </div>
    </section>
  );
}
