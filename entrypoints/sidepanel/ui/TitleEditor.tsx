import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { parseColorSpec, previewTitle, type ColorRule } from '../../../lib/display-id';

export type TitleResult = { title: string; color: string; hasError: boolean };

type TitleEditorProps = {
  onChange: (result: TitleResult) => void;
};

export function TitleEditor({ onChange }: TitleEditorProps) {
  const [title, setTitle] = useState('');
  const [colorSpec, setColorSpec] = useState('');
  const [previewName, setPreviewName] = useState('지성현');

  const colorResult = useMemo(() => parseColorSpec(colorSpec, title), [colorSpec, title]);
  const rules = colorResult.ok ? colorResult.value : [];
  const issues = colorResult.ok ? [] : colorResult.issues;
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warn');
  const preview = previewTitle(title, previewName);
  const hasError = errors.length > 0;

  useEffect(() => {
    // 진열 상세설명(sectionExplain) 필드에는 색상 규칙 원문을 그대로 채운다.
    onChange({ title, color: colorSpec, hasError });
  }, [title, colorSpec, hasError, onChange]);

  return (
    <section className="title-editor" aria-labelledby="title-editor-title">
      <div className="section-heading">
        <div>
          <h2 id="title-editor-title">진열명 편집</h2>
          <p>저장값과 색상 프리뷰를 함께 확인합니다.</p>
        </div>
      </div>

      <div className="form-grid">
        <div className="field field--wide">
          <label htmlFor="title-editor-name">진열명</label>
          <small className="field-hint" id="title-editor-name-hint">
            앱에 그대로 노출됩니다. <code>{'{이름}'}</code> 예약어는 로그인 사용자 이름으로 치환돼요.
          </small>
          <input
            aria-describedby="title-editor-name-hint"
            id="title-editor-name"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </div>

        <div className="field field--wide">
          <label htmlFor="title-editor-color">색상 규칙</label>
          <small className="field-hint" id="title-editor-color-hint">
            <code>단어#HEX</code> 형식, 쉼표로 여러 개. 진열명에 있는 단어만 색칠됩니다. 예: <code>군인#008000, 꿀템#FFFF00</code>
          </small>
          <input
            aria-describedby="title-editor-color-hint"
            id="title-editor-color"
            onChange={(event) => setColorSpec(event.target.value)}
            placeholder="군인#008000, 꿀템#FFFF00"
            value={colorSpec}
          />
        </div>

        <div className="field field--wide">
          <label htmlFor="title-editor-preview-name">미리보기 이름</label>
          <small className="field-hint" id="title-editor-preview-name-hint">
            <code>{'{이름}'}</code> 치환 결과를 미리 보기 위한 값입니다. 저장값엔 영향 없어요.
          </small>
          <input
            aria-describedby="title-editor-preview-name-hint"
            id="title-editor-preview-name"
            onChange={(event) => setPreviewName(event.target.value)}
            value={previewName}
          />
        </div>
      </div>

      <div className="title-preview">
        <div className="title-preview__meta">
          <span>프리뷰</span>
          <ValidationBadge errors={errors.length} warnings={warnings.length} />
        </div>
        <p>{renderColoredPreview(preview, rules)}</p>
      </div>

      {issues.length > 0 && (
        <ul className="issue-list" aria-label="진열명 검증 결과">
          {issues.map((issue) => (
            <li data-severity={issue.severity} key={`${issue.field}-${issue.message}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function renderColoredPreview(preview: string, rules: ColorRule[]) {
  if (rules.length === 0) return preview || ' ';

  const segments: ReactNode[] = [];
  let cursor = 0;

  while (cursor < preview.length) {
    const next = findNextRule(preview, rules, cursor);
    if (!next) {
      segments.push(preview.slice(cursor));
      break;
    }

    if (next.index > cursor) {
      segments.push(preview.slice(cursor, next.index));
    }

    segments.push(
      <span
        key={`${next.rule.word}-${next.index}`}
        style={{ '--title-color': next.rule.hex, color: 'var(--title-color)' } as CSSProperties}
      >
        {next.rule.word}
      </span>,
    );
    cursor = next.index + next.rule.word.length;
  }

  return segments;
}

function findNextRule(preview: string, rules: ColorRule[], cursor: number) {
  let match: { index: number; rule: ColorRule } | undefined;

  for (const rule of rules) {
    const index = preview.indexOf(rule.word, cursor);
    if (index < 0) continue;
    if (!match || index < match.index) match = { index, rule };
  }

  return match;
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
