import { beforeEach, describe, expect, it } from 'vitest';
import { applyCategoryReorder } from './category-reorder-apply';
import { installAlertSuppressor } from './alert-suppressor';
import type { CategoryReorderStep } from '../messaging';

installAlertSuppressor(window);

const HOST = { hostname: 'service.shopby.co.kr', waitMs: 1, alertTimeoutMs: 200 };

type Wiring = {
  savedCodes: string[];
  // 저장 시 띄울 메시지를 단계별로 결정(없으면 성공 문구).
  alertFor?: (saveIndex: number, code: string) => string;
};

// 카테고리 이름 목록으로 가짜 어드민 폼 DOM을 만들고, 저장 버튼이 confirm+alert을
// 부르도록 배선한다(실제 저장 흐름 모사).
function buildAdmin(names: string[], wiring: Wiring): void {
  const rows = names
    .map(
      (n) =>
        `<div class="TreeV2_item-label__l"><div class="display-category-management_category-name-wrap__w"><span>${n}</span></div></div>`,
    )
    .join('');
  document.body.innerHTML = `
    <button class="display-category-management_right-btn__a"><span>전체 열기</span></button>
    <div class="display-category-management_category-tree__t">${rows}</div>
    <input class="display-category-management_input-code__c" />
    <div class="bottom-bar"><button type="submit">저장</button></div>`;

  let saveIndex = 0;
  const button = document.querySelector('.bottom-bar button')!;
  const input = document.querySelector<HTMLInputElement>('.display-category-management_input-code__c')!;
  button.addEventListener('click', () => {
    const code = input.value;
    wiring.savedCodes.push(code);
    const ok = window.confirm('저장하시겠습니까?');
    if (!ok) return;
    const msg = wiring.alertFor?.(saveIndex, code) ?? '저장되었습니다.';
    saveIndex += 1;
    window.alert(msg);
  });
}

describe('applyCategoryReorder', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-gnd-auto-confirm');
    document.documentElement.removeAttribute('data-gnd-alert-seq');
    document.documentElement.removeAttribute('data-gnd-alert-message');
  });

  it('어드민 호스트가 아니면 wrong-host', async () => {
    const steps: CategoryReorderStep[] = [{ categoryNo: 1, name: 'A', newCode: 'c_2' }];
    const result = await applyCategoryReorder(document, { env: 'c', steps }, { hostname: 'example.com' });
    expect(result.status).toBe('wrong-host');
    expect(result.applied).toBe(0);
  });

  it('모든 단계가 성공하면 done, 코드가 순서대로 저장된다', async () => {
    const wiring: Wiring = { savedCodes: [] };
    buildAdmin(['A', 'B'], wiring);
    const steps: CategoryReorderStep[] = [
      { categoryNo: 1, name: 'A', newCode: 'c_3' },
      { categoryNo: 2, name: 'B', newCode: 'c_1' },
      { categoryNo: 1, name: 'A', newCode: 'c_2' },
    ];

    const result = await applyCategoryReorder(document, { env: 'c', steps }, HOST);

    expect(result.status).toBe('done');
    expect(result.applied).toBe(3);
    expect(wiring.savedCodes).toEqual(['c_3', 'c_1', 'c_2']);
  });

  it('저장 후 에러 문구가 나오면 그 단계에서 중단(partial)하고 위치를 보고한다', async () => {
    const wiring: Wiring = {
      savedCodes: [],
      alertFor: (i) => (i === 1 ? '이미 사용 중인 관리코드입니다.' : '저장되었습니다.'),
    };
    buildAdmin(['A', 'B'], wiring);
    const steps: CategoryReorderStep[] = [
      { categoryNo: 1, name: 'A', newCode: 'c_3' },
      { categoryNo: 2, name: 'B', newCode: 'c_1' },
      { categoryNo: 1, name: 'A', newCode: 'c_2' },
    ];

    const result = await applyCategoryReorder(document, { env: 'c', steps }, HOST);

    expect(result.status).toBe('partial');
    expect(result.applied).toBe(1);
    expect(result.failedAt?.index).toBe(1);
    expect(result.failedAt?.name).toBe('B');
  });

  it('트리에서 카테고리를 못 찾으면 중단(첫 단계면 aborted)', async () => {
    const wiring: Wiring = { savedCodes: [] };
    buildAdmin(['A'], wiring); // B 없음
    const steps: CategoryReorderStep[] = [{ categoryNo: 2, name: 'B', newCode: 'c_1' }];

    const result = await applyCategoryReorder(document, { env: 'c', steps }, HOST);

    expect(result.status).toBe('aborted');
    expect(result.applied).toBe(0);
    expect(result.failedAt?.index).toBe(0);
  });

  it('완료 후 자동확인 플래그를 해제한다', async () => {
    const wiring: Wiring = { savedCodes: [] };
    buildAdmin(['A'], wiring);
    const steps: CategoryReorderStep[] = [{ categoryNo: 1, name: 'A', newCode: 'c_2' }];

    await applyCategoryReorder(document, { env: 'c', steps }, HOST);

    expect(document.documentElement.getAttribute('data-gnd-auto-confirm')).toBeNull();
  });
});
