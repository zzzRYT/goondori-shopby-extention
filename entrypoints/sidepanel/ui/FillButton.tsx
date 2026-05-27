import { useState } from 'react';
import { sendMessage, type FillField, type FillResult } from '../../../lib/messaging';
import { FillReport } from './FillReport';

type FillButtonProps = {
  disabled: boolean;
  fields: FillField[];
};

export function FillButton({ disabled, fields }: FillButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FillResult | null>(null);

  async function fillDisplay() {
    setLoading(true);

    try {
      setResult(await sendMessage('fillDisplay', fields));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'content script 응답 없음';
      setResult({
        filled: [],
        failed: fields.map((field) => ({ key: field.key, reason })),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fill-action">
      <button className="primary-button" disabled={disabled || loading} onClick={fillDisplay} type="button">
        {loading ? '채우는 중' : '어드민에 채우기'}
      </button>
      <FillReport result={result} />
    </div>
  );
}
