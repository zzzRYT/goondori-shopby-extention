import {
  deriveDisplay,
  restoreBuilder,
  type BuilderState,
  type DisplayType,
} from './display-state';
import type { Env, Method } from '../../../lib/display-id';
import { BrandPicker } from './BrandPicker';
import { UserTypeChips } from './UserTypeChips';

type DisplayBuilderProps = {
  value: BuilderState;
  onChange: (next: BuilderState) => void;
};

export function DisplayBuilder({ value, onChange }: DisplayBuilderProps) {
  const { displayId, errors, warnings } = deriveDisplay(value);

  function patch(partial: Partial<BuilderState>) {
    onChange({ ...value, ...partial });
  }

  function setEnv(env: Env) {
    patch({ env });
  }

  function setMethod(method: Method) {
    patch({ method });
  }

  function setType(type: DisplayType) {
    patch({ type });
  }

  return (
    <section className="display-builder" aria-labelledby="display-builder-title">
      <div className="section-heading">
        <div>
          <h2 id="display-builder-title">진열 ID</h2>
          <p>조립값을 확인한 뒤 어드민 필드에 채웁니다.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field field--wide">
          <span>기존 진열 ID</span>
          <input
            onChange={(event) => onChange(restoreBuilder(value, event.target.value))}
            value={value.sourceId}
          />
        </label>

        <fieldset className="field-group">
          <legend>환경</legend>
          <div className="segmented">
            <button
              className="segmented__button"
              data-active={value.env === 'c'}
              onClick={() => setEnv('c')}
              type="button"
            >
              운영 c
            </button>
            <button
              className="segmented__button"
              data-active={value.env === 'ct'}
              onClick={() => setEnv('ct')}
              type="button"
            >
              테스트 ct
            </button>
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend>홈 전시</legend>
          <div className="segmented">
            <button
              aria-pressed={value.onHome}
              className="segmented__button"
              data-active={value.onHome}
              onClick={() => patch({ onHome: true })}
              type="button"
            >
              전시 d
            </button>
            <button
              aria-pressed={!value.onHome}
              className="segmented__button"
              data-active={!value.onHome}
              onClick={() => patch({ onHome: false })}
              type="button"
            >
              비노출 nd
            </button>
          </div>
        </fieldset>

        {value.onHome ? (
          <label className="field">
            <span>순서</span>
            <input
              min={1}
              onChange={(event) => patch({ order: Number(event.target.value) })}
              type="number"
              value={value.order}
            />
          </label>
        ) : (
          <p className="field field--wide field-hint">
            홈에 노출되지 않고 진열 ID 직접 조회로만 진입합니다 (브랜드 페이지 등).
          </p>
        )}

        <fieldset className="field-group">
          <legend>표시 방법</legend>
          <div className="segmented">
            <button
              className="segmented__button"
              data-active={value.method === 'p'}
              onClick={() => setMethod('p')}
              type="button"
            >
              페이징 p
            </button>
            <button
              className="segmented__button"
              data-active={value.method === 's'}
              onClick={() => setMethod('s')}
              type="button"
            >
              스와이프 s
            </button>
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend>타입</legend>
          <div className="segmented segmented--three">
            <button
              className="segmented__button"
              data-active={value.type === 't'}
              onClick={() => setType('t')}
              type="button"
            >
              사용자 t
            </button>
            <button
              className="segmented__button"
              data-active={value.type === 'b'}
              onClick={() => setType('b')}
              type="button"
            >
              브랜드 b
            </button>
            <button
              className="segmented__button"
              data-active={value.type === 'n'}
              onClick={() => setType('n')}
              type="button"
            >
              일반 n
            </button>
          </div>
        </fieldset>

        {value.type === 't' && (
          <fieldset className="field-group field-group--wide">
            <legend>사용자유형</legend>
            <UserTypeChips selected={value.userTypes} onChange={(userTypes) => patch({ userTypes })} />
          </fieldset>
        )}

        {value.type === 'b' && (
          <div className="field field--wide">
            <span>브랜드</span>
            <BrandPicker onChange={(brandNo) => patch({ brandNo })} value={value.brandNo} />
          </div>
        )}

        {value.type === 'n' && (
          <label className="field field--wide">
            <span>라벨</span>
            <input onChange={(event) => patch({ label: event.target.value })} value={value.label} />
          </label>
        )}
      </div>

      <div className="preview-bar">
        <div>
          <span className="preview-bar__label">미리보기</span>
          <code>{displayId}</code>
        </div>
        <ValidationBadge errors={errors.length} warnings={warnings.length} />
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="issue-list" aria-label="검증 결과">
          {[...errors, ...warnings].map((issue) => (
            <li data-severity={issue.severity} key={`${issue.field}-${issue.message}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ValidationBadge({ errors, warnings }: { errors: number; warnings: number }) {
  if (errors > 0) {
    return (
      <span className="badge" data-tone="error">
        오류 {errors}
      </span>
    );
  }

  if (warnings > 0) {
    return (
      <span className="badge" data-tone="warn">
        경고 {warnings}
      </span>
    );
  }

  return (
    <span className="badge" data-tone="ok">
      정상
    </span>
  );
}
