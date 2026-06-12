import { useCallback, useRef, useState } from 'react';
import { sendMessage } from '../../../lib/messaging';
import { screeningPopupUrl } from '../../../lib/shopby/screening/popup-url';
import type { Rule } from '../../../lib/shopby/screening/rules';
import {
  runScan,
  type ScanPhase,
  type ScanPorts,
  type ScreeningResult,
} from '../../../lib/shopby/screening/run-scan';
import type { ScreeningPopupResult } from '../../../lib/shopby/screening/types';

export type ScanState = {
  phase: ScanPhase | 'idle';
  done: number;
  total: number;
  results: ScreeningResult[];
  countMismatch: boolean;
  error: string | null;
};

const INITIAL: ScanState = {
  phase: 'idle',
  done: 0,
  total: 0,
  results: [],
  countMismatch: false,
  error: null,
};

export function useScreeningScan() {
  const [state, setState] = useState<ScanState>(INITIAL);
  const signalRef = useRef({ cancelled: false });

  const cancel = useCallback(() => {
    signalRef.current.cancelled = true;
  }, []);

  const start = useCallback(async (rules: Rule[]) => {
    signalRef.current = { cancelled: false };
    setState({ ...INITIAL, phase: 'collecting' });

    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id == null) {
      setState((prev) => ({ ...prev, phase: 'collect-failed', error: '활성 탭을 찾지 못했어요' }));
      return;
    }

    // 목록 그리드가 있는 프레임을 먼저 찾는다 — 멀티프레임 브로드캐스트 레이스 회피
    // (배경: entrypoints/background.ts:34-38 주석, docs/recon.md).
    const frameId = await findGridFrameId(activeTab.id);
    if (frameId == null) {
      setState((prev) => ({
        ...prev,
        phase: 'collect-failed',
        error: '활성 탭에서 상품심사 그리드를 찾지 못했어요 — 상품심사 목록을 연 상태에서 실행해주세요',
      }));
      return;
    }

    const summary = await runScan(
      makePorts(activeTab.id, frameId),
      rules,
      {
        onPhase: (phase) => setState((prev) => ({ ...prev, phase })),
        onProgress: (done, total) => setState((prev) => ({ ...prev, done, total })),
        onResult: (result) => setState((prev) => ({ ...prev, results: [...prev.results, result] })),
      },
      signalRef.current,
    );

    setState((prev) => ({ ...prev, phase: summary.phase, countMismatch: summary.countMismatch }));
  }, []);

  return { state, start, cancel };
}

async function findGridFrameId(tabId: number): Promise<number | null> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => Boolean(document.querySelector('[data-cy="grid"]')),
    });
    for (const injection of results) {
      if (injection.result) return injection.frameId ?? 0;
    }
  } catch {
    // 호스트 권한 밖 탭 등 — 아래서 null 처리
  }
  return null;
}

function makePorts(tabId: number, frameId: number): ScanPorts {
  return {
    collectList: () => sendMessage('collectScreeningList', undefined, { tabId, frameId }),
    openPopup: async (productNo) => {
      const tab = await browser.tabs.create({ url: screeningPopupUrl(productNo), active: false });
      if (tab.id == null) throw new Error('팝업 탭 생성 실패');
      return tab.id;
    },
    parsePopup: (popupTabId) => parseWithRetry(popupTabId),
    closePopup: async (popupTabId) => {
      await browser.tabs.remove(popupTabId).catch(() => {});
    },
  };
}

// content script 주입 전의 메시지는 "Could not establish connection"으로 실패한다 → 폴링 재시도.
// 주입 이후의 렌더 대기는 content script 쪽 waitForScreeningParse가 담당(자체 15초 타임아웃).
async function parseWithRetry(tabId: number): Promise<ScreeningPopupResult> {
  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await sendMessage('parseScreeningPopup', undefined, { tabId, frameId: 0 });
    } catch {
      await sleep(300);
    }
  }
  throw new Error('팝업 content script 응답 없음');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
