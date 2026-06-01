import { useEffect, useMemo, useState } from 'react';
import {
  sendMessage,
  type ApplyCategoryReorderResult,
} from '../../../lib/messaging';
import type { Env } from '../../../lib/display-id/types';
import type { TopCategory } from '../../../lib/shopby/display-categories';
import { planReorderFromDraft } from '../../../lib/shopby/category-reorder';
import { arrayMove } from '../../../lib/array-move';

type Props = {
  env: Env;
  tops: TopCategory[];
  // 저장 완료 후 원격 목록을 다시 불러와 draft를 동기화하기 위함.
  onApplied: () => void;
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'confirm' }
  | { kind: 'applying' }
  | { kind: 'result'; result: ApplyCategoryReorderResult }
  | { kind: 'error'; message: string };

// 상위 카테고리 순서를 ▲▼로 재배열하고, 확인 후 어드민 폼에 자동 반영한다.
export function CategoryReorder({ env, tops, onApplied }: Props) {
  const [draft, setDraft] = useState<TopCategory[]>(tops);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  // 원본(env/목록)이 바뀌면 draft를 리셋.
  useEffect(() => {
    setDraft(tops);
    setPhase({ kind: 'idle' });
  }, [tops, env]);

  const changed = draft.some((cat, i) => cat.categoryNo !== tops[i]?.categoryNo);
  const steps = useMemo(() => planReorderFromDraft(env, tops, draft), [env, tops, draft]);
  const applying = phase.kind === 'applying';

  function move(index: number, direction: -1 | 1) {
    if (applying) return;
    setDraft((prev) => arrayMove(prev, index, index + direction));
    setPhase({ kind: 'idle' });
  }

  function reset() {
    setDraft(tops);
    setPhase({ kind: 'idle' });
  }

  async function confirmApply() {
    setPhase({ kind: 'applying' });
    try {
      const result = await sendMessage('applyCategoryReorder', { env, steps });
      setPhase({ kind: 'result', result });
      if (result.status === 'done') onApplied();
    } catch (error) {
      setPhase({
        kind: 'error',
        message: error instanceof Error ? error.message : '관리자 탭과 통신할 수 없어요',
      });
    }
  }

  if (tops.length < 2) return null;

  return (
    <section className="category-reorder" aria-label="전시카테고리 순서 변경">
      <ol className="category-reorder__list">
        {draft.map((cat, index) => (
          <li key={cat.categoryNo} className="category-reorder__row">
            <span className="category-reorder__pos">{index + 1}</span>
            <code className="category-reorder__code">{cat.managementCode}</code>
            <span className="category-reorder__name" title={cat.name}>
              {cat.name}
            </span>
            <span className="category-reorder__moves">
              <button
                type="button"
                className="category-reorder__move"
                aria-label={`${cat.name} 위로 이동`}
                disabled={index === 0 || applying}
                onClick={() => move(index, -1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="category-reorder__move"
                aria-label={`${cat.name} 아래로 이동`}
                disabled={index === draft.length - 1 || applying}
                onClick={() => move(index, 1)}
              >
                ▼
              </button>
            </span>
          </li>
        ))}
      </ol>

      <div className="category-reorder__actions">
        <button
          type="button"
          className="category-reorder__apply"
          disabled={!changed || applying}
          onClick={() => setPhase({ kind: 'confirm' })}
        >
          순서 적용
        </button>
        {changed && !applying && (
          <button type="button" className="category-reorder__cancel" onClick={reset}>
            되돌리기
          </button>
        )}
      </div>

      {phase.kind === 'confirm' && (
        <div className="category-reorder__dialog" role="dialog" aria-label="순서 적용 확인">
          <p className="category-reorder__warn">
            ⚠ 운영 데이터가 변경됩니다. 어드민 전시카테고리 탭이 열려 있어야 하며, 아래 순서대로
            관리코드가 저장됩니다(중복 방지를 위한 임시코드 경유 포함).
          </p>
          <ol className="category-reorder__plan" data-testid="reorder-plan">
            {steps.map((step, i) => (
              <li key={i}>
                <span className="category-reorder__plan-name">{step.name}</span>
                <span className="category-reorder__plan-code">→ {step.newCode}</span>
              </li>
            ))}
          </ol>
          <p className="category-reorder__plan-count">저장 {steps.length}회</p>
          <div className="category-reorder__dialog-actions">
            <button type="button" className="category-reorder__apply" onClick={confirmApply}>
              저장 진행
            </button>
            <button
              type="button"
              className="category-reorder__cancel"
              onClick={() => setPhase({ kind: 'idle' })}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {applying && (
        <p className="category-reorder__status" role="status">
          저장 중… (총 {steps.length}단계, 어드민 탭을 닫지 마세요)
        </p>
      )}

      {phase.kind === 'result' && (
        <p
          className="category-reorder__status"
          role="status"
          data-status={phase.result.status}
        >
          {resultMessage(phase.result)}
        </p>
      )}

      {phase.kind === 'error' && (
        <p className="category-reorder__status" role="alert" data-status="error">
          {phase.message}
        </p>
      )}
    </section>
  );
}

function resultMessage(result: ApplyCategoryReorderResult): string {
  switch (result.status) {
    case 'done':
      return `순서 변경 완료 (저장 ${result.applied}회).`;
    case 'wrong-host':
      return '어드민 전시카테고리 탭에서 실행해 주세요.';
    case 'partial':
    case 'aborted':
      return `${result.applied}단계까지 적용 후 중단: ${result.failedAt?.name ?? ''} — ${
        result.failedAt?.reason ?? '알 수 없는 오류'
      }`;
    default:
      return '알 수 없는 상태입니다.';
  }
}
