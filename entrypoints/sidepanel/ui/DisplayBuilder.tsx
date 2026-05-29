import { useEffect, useMemo, useState } from 'react';
import {
  buildDisplayId,
  parseDisplayId,
  type Display,
  type DisplaySpec,
  type Env,
  type Method,
  type UserTypeChar,
} from '../../../lib/display-id';
import { BrandPicker } from './BrandPicker';
import { UserTypeChips } from './UserTypeChips';

type DisplayType = DisplaySpec['type'];

export type DisplayResult = { displayId: string; hasError: boolean };

type DisplayBuilderProps = {
  onChange: (result: DisplayResult) => void;
};

export function DisplayBuilder({ onChange }: DisplayBuilderProps) {
  const [env, setEnv] = useState<Env>('c');
  const [onHome, setOnHome] = useState(true);
  const [order, setOrder] = useState(1);
  const [method, setMethod] = useState<Method>('p');
  const [type, setType] = useState<DisplayType>('t');
  const [userTypes, setUserTypes] = useState<UserTypeChar[]>([]);
  const [brandNo, setBrandNo] = useState('');
  const [label, setLabel] = useState('베스트');
  const [sourceId, setSourceId] = useState('');

  // 전시 토큰: 홈 전시면 순서를 가진 d{n}, 비노출이면 nd.
  const display = useMemo<Display>(
    () => (onHome ? { onHome: true, order } : { onHome: false }),
    [onHome, order],
  );

  const spec = useMemo<DisplaySpec>(() => {
    if (type === 'b') return { env, display, method, type, brandNo };
    if (type === 'n') return { env, display, method, type, label };
    return { env, display, method, type, userTypes };
  }, [brandNo, display, env, label, method, type, userTypes]);

  const preview = buildDisplayId(spec);
  const validation = parseDisplayId(preview);
  const errorIssues = validation.ok ? [] : validation.issues.filter((issue) => issue.severity === 'error');
  const warnIssues = validation.ok ? [] : validation.issues.filter((issue) => issue.severity === 'warn');
  const hasError = errorIssues.length > 0;

  useEffect(() => {
    onChange({ displayId: preview, hasError });
  }, [preview, hasError, onChange]);

  function restoreFromId(nextSourceId: string) {
    setSourceId(nextSourceId);

    const parsed = parseDisplayId(nextSourceId);
    if (!parsed.ok) return;

    setEnv(parsed.value.env);
    setOnHome(parsed.value.display.onHome);
    if (parsed.value.display.onHome) setOrder(parsed.value.display.order);
    setMethod(parsed.value.method);
    setType(parsed.value.type);

    if (parsed.value.type === 't') {
      setUserTypes(parsed.value.userTypes);
    } else if (parsed.value.type === 'b') {
      setBrandNo(parsed.value.brandNo);
    } else {
      setLabel(parsed.value.label);
    }
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
          <input onChange={(event) => restoreFromId(event.target.value)} value={sourceId} />
        </label>

        <fieldset className="field-group">
          <legend>환경</legend>
          <div className="segmented">
            <button
              className="segmented__button"
              data-active={env === 'c'}
              onClick={() => setEnv('c')}
              type="button"
            >
              운영 c
            </button>
            <button
              className="segmented__button"
              data-active={env === 'ct'}
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
              aria-pressed={onHome}
              className="segmented__button"
              data-active={onHome}
              onClick={() => setOnHome(true)}
              type="button"
            >
              전시 d
            </button>
            <button
              aria-pressed={!onHome}
              className="segmented__button"
              data-active={!onHome}
              onClick={() => setOnHome(false)}
              type="button"
            >
              비노출 nd
            </button>
          </div>
        </fieldset>

        {onHome ? (
          <label className="field">
            <span>순서</span>
            <input
              min={1}
              onChange={(event) => setOrder(Number(event.target.value))}
              type="number"
              value={order}
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
              data-active={method === 'p'}
              onClick={() => setMethod('p')}
              type="button"
            >
              페이징 p
            </button>
            <button
              className="segmented__button"
              data-active={method === 's'}
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
              data-active={type === 't'}
              onClick={() => setType('t')}
              type="button"
            >
              사용자 t
            </button>
            <button
              className="segmented__button"
              data-active={type === 'b'}
              onClick={() => setType('b')}
              type="button"
            >
              브랜드 b
            </button>
            <button
              className="segmented__button"
              data-active={type === 'n'}
              onClick={() => setType('n')}
              type="button"
            >
              일반 n
            </button>
          </div>
        </fieldset>

        {type === 't' && (
          <fieldset className="field-group field-group--wide">
            <legend>사용자유형</legend>
            <UserTypeChips selected={userTypes} onChange={setUserTypes} />
          </fieldset>
        )}

        {type === 'b' && (
          <div className="field field--wide">
            <span>브랜드</span>
            <BrandPicker onChange={setBrandNo} value={brandNo} />
          </div>
        )}

        {type === 'n' && (
          <label className="field field--wide">
            <span>라벨</span>
            <input onChange={(event) => setLabel(event.target.value)} value={label} />
          </label>
        )}
      </div>

      <div className="preview-bar">
        <div>
          <span className="preview-bar__label">미리보기</span>
          <code>{preview}</code>
        </div>
        <ValidationBadge errors={errorIssues.length} warnings={warnIssues.length} />
      </div>

      {(errorIssues.length > 0 || warnIssues.length > 0) && (
        <ul className="issue-list" aria-label="검증 결과">
          {[...errorIssues, ...warnIssues].map((issue) => (
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
