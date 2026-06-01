// 배열에서 from 위치 원소를 to 위치로 옮긴 새 배열을 반환한다(불변).
// 범위를 벗어나면 원본을 그대로 반환.
export function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
