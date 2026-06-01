import { describe, expect, it } from 'vitest';
import {
  planReorder,
  planReorderFromDraft,
  type OrderedCategory,
  type ReorderItem,
} from './category-reorder';

// 가독성을 위한 헬퍼: 각 스텝을 "name:newCode" 로 직렬화.
function trace(items: ReorderItem[], env: 'c' | 'ct' = 'c'): string[] {
  return planReorder(env, items).map((s) => `${s.name}:${s.newCode}`);
}

describe('planReorder', () => {
  it('제자리(현재==목표)만 있으면 저장 스텝이 없다', () => {
    const items: ReorderItem[] = [
      { categoryNo: 1, name: 'A', currentOrder: 1, targetOrder: 1 },
      { categoryNo: 2, name: 'B', currentOrder: 2, targetOrder: 2 },
    ];
    expect(planReorder('c', items)).toEqual([]);
  });

  it('2-사이클 swap은 임시코드 경유 3스텝(사용자 예시 c_1↔c_2)', () => {
    const items: ReorderItem[] = [
      { categoryNo: 1, name: 'A', currentOrder: 1, targetOrder: 2 },
      { categoryNo: 2, name: 'B', currentOrder: 2, targetOrder: 1 },
    ];
    // max order=2 → 임시 order=3
    expect(trace(items)).toEqual(['A:c_3', 'B:c_1', 'A:c_2']);
  });

  it('3-사이클은 4스텝이고 어느 순간에도 코드 중복이 없다', () => {
    const items: ReorderItem[] = [
      { categoryNo: 1, name: 'A', currentOrder: 1, targetOrder: 2 },
      { categoryNo: 2, name: 'B', currentOrder: 2, targetOrder: 3 },
      { categoryNo: 3, name: 'C', currentOrder: 3, targetOrder: 1 },
    ];
    // 임시 order=4. A 파킹 → 나머지 역순 이동 → A 최종.
    expect(trace(items)).toEqual(['A:c_4', 'C:c_1', 'B:c_3', 'A:c_2']);
    assertNoCollision(items, planReorder('c', items));
  });

  it('여러 사이클이면 각 사이클을 독립 처리하고 임시코드를 재사용한다', () => {
    const items: ReorderItem[] = [
      { categoryNo: 1, name: 'A', currentOrder: 1, targetOrder: 2 },
      { categoryNo: 2, name: 'B', currentOrder: 2, targetOrder: 1 },
      { categoryNo: 3, name: 'C', currentOrder: 3, targetOrder: 3 }, // 고정점
      { categoryNo: 4, name: 'D', currentOrder: 4, targetOrder: 5 },
      { categoryNo: 5, name: 'E', currentOrder: 5, targetOrder: 4 },
    ];
    // max=5 → 임시=6, 두 2-사이클 모두 6 재사용. 고정점 C는 스텝 없음.
    expect(trace(items)).toEqual([
      'A:c_6', 'B:c_1', 'A:c_2',
      'D:c_6', 'E:c_4', 'D:c_5',
    ]);
    assertNoCollision(items, planReorder('c', items));
  });

  it('순번이 비연속이어도 임시코드는 미사용 최대값+1이라 충돌하지 않는다', () => {
    const items: ReorderItem[] = [
      { categoryNo: 1, name: 'A', currentOrder: 1, targetOrder: 5 },
      { categoryNo: 5, name: 'B', currentOrder: 5, targetOrder: 1 },
      { categoryNo: 3, name: 'C', currentOrder: 3, targetOrder: 3 },
    ];
    // max=5 → 임시=6
    expect(trace(items)).toEqual(['A:c_6', 'B:c_1', 'A:c_5']);
    assertNoCollision(items, planReorder('c', items));
  });

  it('ct 환경이면 ct_ 접두사로 코드를 만든다', () => {
    const items: ReorderItem[] = [
      { categoryNo: 1, name: 'A', currentOrder: 1, targetOrder: 2 },
      { categoryNo: 2, name: 'B', currentOrder: 2, targetOrder: 1 },
    ];
    expect(trace(items, 'ct')).toEqual(['A:ct_3', 'B:ct_1', 'A:ct_2']);
  });
});

describe('planReorderFromDraft', () => {
  const original: OrderedCategory[] = [
    { categoryNo: 10, name: 'A', order: 1 },
    { categoryNo: 20, name: 'B', order: 2 },
    { categoryNo: 30, name: 'C', order: 3 },
  ];

  it('순서 변경이 없으면 빈 시퀀스', () => {
    expect(planReorderFromDraft('c', original, original)).toEqual([]);
  });

  it('맨 끝을 맨 앞으로 옮기면 해당 회전을 최소 시퀀스로 만든다', () => {
    // draft: C, A, B  → C는 order1, A는 order2, B는 order3 목표
    const draft: OrderedCategory[] = [original[2], original[0], original[1]];
    const steps = planReorderFromDraft('c', original, draft);
    // 3-회전: head(C) 파킹 c_4 → 역순 이동 → C 최종 c_1
    expect(steps.map((s) => `${s.name}:${s.newCode}`)).toEqual([
      'C:c_4', 'B:c_3', 'A:c_2', 'C:c_1',
    ]);
  });

  it('인접 두 개를 맞바꾸면 임시 경유 3스텝', () => {
    const draft: OrderedCategory[] = [original[1], original[0], original[2]];
    const steps = planReorderFromDraft('c', original, draft);
    expect(steps.map((s) => `${s.name}:${s.newCode}`)).toEqual(['B:c_4', 'A:c_2', 'B:c_1']);
  });
});

// 시퀀스를 슬롯 시뮬레이션해 "어느 순간에도 동일 order 중복 없음 + 최종 목표 도달"을 검증.
function assertNoCollision(
  items: ReorderItem[],
  steps: { categoryNo: number; newCode: string }[],
): void {
  // 현재 각 카테고리가 점유한 order
  const held = new Map<number, number>(items.map((i) => [i.categoryNo, i.currentOrder]));
  for (const step of steps) {
    const order = Number(step.newCode.split('_')[1]);
    // 쓰려는 order를 다른 카테고리가 점유 중이면 충돌
    for (const [no, o] of held) {
      if (no !== step.categoryNo && o === order) {
        throw new Error(`collision: order ${order} already held by ${no}`);
      }
    }
    held.set(step.categoryNo, order);
  }
  for (const item of items) {
    expect(held.get(item.categoryNo)).toBe(item.targetOrder);
  }
}
