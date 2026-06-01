import type { CategoryReorderStep } from '../messaging';
import type { Env } from '../display-id/types';
import { buildCategoryCode } from './category-code';

// 한 env(c/ct) 안 상위 카테고리 하나의 현재/목표 순번.
// currentOrder/targetOrder는 같은 집합의 치환(permutation)이어야 한다.
export type ReorderItem = {
  categoryNo: number;
  name: string;
  currentOrder: number;
  targetOrder: number;
};

export type { CategoryReorderStep };

// 관리코드 유일성("어느 순간에도 코드 중복 불가") 제약 하에서, 현재 순번 배치를
// 목표 순번 배치로 바꾸는 최소 저장 시퀀스를 만든다.
//
// 순열을 사이클로 분해하고, 각 사이클은 임시 순번(미사용 최대값+1)을 1칸 빌려:
//   1) 사이클 첫 카테고리를 임시로 파킹(자리 비움)
//   2) 나머지를 역순으로 각자 목표로 이동(직전에 비워진 슬롯이 곧 자기 목표)
//   3) 파킹한 카테고리를 최종 목표로 이동
// 사이클당 (길이 k)+1 저장. 임시 슬롯은 사이클이 끝나면 비므로 다음 사이클에서 재사용.
export function planReorder(env: Env, items: ReorderItem[]): CategoryReorderStep[] {
  const moving = items.filter((i) => i.currentOrder !== i.targetOrder);
  if (moving.length === 0) return [];

  // 임시 순번: 전체(고정점 포함) 순번 중 미사용 최대값 + 1 → 어떤 목표와도 충돌하지 않음.
  const maxOrder = Math.max(...items.flatMap((i) => [i.currentOrder, i.targetOrder]));
  const tempOrder = maxOrder + 1;

  // 현재 슬롯(order) → 그 슬롯을 점유한 카테고리.
  const holderOfSlot = new Map<number, ReorderItem>();
  for (const item of moving) holderOfSlot.set(item.currentOrder, item);

  const steps: CategoryReorderStep[] = [];
  const visited = new Set<number>();

  for (const start of moving) {
    if (visited.has(start.categoryNo)) continue;

    // start에서 "내 목표 슬롯을 현재 점유한 카테고리"를 따라가며 사이클 수집.
    const cycle: ReorderItem[] = [];
    let node: ReorderItem | undefined = start;
    while (node && !visited.has(node.categoryNo)) {
      visited.add(node.categoryNo);
      cycle.push(node);
      node = holderOfSlot.get(node.targetOrder);
    }

    const head = cycle[0];
    // 1) head 파킹
    steps.push(step(env, head, tempOrder));
    // 2) 나머지를 역순으로 각자 목표로 (직전에 비워진 슬롯 = 자기 목표)
    for (let i = cycle.length - 1; i >= 1; i -= 1) {
      steps.push(step(env, cycle[i], cycle[i].targetOrder));
    }
    // 3) head를 최종 목표로
    steps.push(step(env, head, head.targetOrder));
  }

  return steps;
}

function step(env: Env, item: ReorderItem, order: number): CategoryReorderStep {
  return { categoryNo: item.categoryNo, name: item.name, newCode: buildCategoryCode(env, order) };
}

// 순번을 가진 카테고리(상위). TopCategory와 구조 호환.
export type OrderedCategory = { categoryNo: number; name: string; order: number };

// 원본(순번 오름차순)과 사용자가 재배열한 draft를 받아 저장 시퀀스를 만든다.
// 핵심: 순번 "값"의 집합은 그대로 두고 위치만 재배치한다 — draft i번째 카테고리는
// 원본 i번째의 순번 값을 목표로 갖는다(비연속 순번도 보존).
export function planReorderFromDraft(
  env: Env,
  original: OrderedCategory[],
  draft: OrderedCategory[],
): CategoryReorderStep[] {
  const items: ReorderItem[] = draft.map((cat, i) => ({
    categoryNo: cat.categoryNo,
    name: cat.name,
    currentOrder: cat.order,
    targetOrder: original[i].order,
  }));
  return planReorder(env, items);
}
