import { useCallback, useEffect, useState } from 'react';

export type RemoteStatus = 'loading' | 'ready' | 'error';

export type RemoteList<T> = {
  items: T[];
  status: RemoteStatus;
  error: string;
  reload: () => void;
};

// 마운트 시 한 번 불러오고, reload로 다시 시도할 수 있는 읽기 전용 원격 목록 훅.
// load는 안정적인 참조여야 한다(모듈 레벨 함수 권장) — 아니면 매 렌더 재호출된다.
export function useRemoteList<T>(load: () => Promise<T[]>): RemoteList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<RemoteStatus>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');

    load()
      .then((next) => {
        if (!active) return;
        setItems(next);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : '목록을 불러오지 못했습니다.');
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [load, attempt]);

  return { items, status, error, reload };
}
