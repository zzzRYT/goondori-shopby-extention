import { describe, expect, it } from 'vitest';
import { arrayMove } from './array-move';

describe('arrayMove', () => {
  it('원소를 한 칸 위로 옮긴다', () => {
    expect(arrayMove(['a', 'b', 'c'], 1, 0)).toEqual(['b', 'a', 'c']);
  });

  it('원소를 한 칸 아래로 옮긴다', () => {
    expect(arrayMove(['a', 'b', 'c'], 1, 2)).toEqual(['a', 'c', 'b']);
  });

  it('원본을 변형하지 않는다(불변)', () => {
    const source = ['a', 'b', 'c'];
    arrayMove(source, 0, 2);
    expect(source).toEqual(['a', 'b', 'c']);
  });

  it('범위를 벗어나면 복사본을 그대로 돌려준다', () => {
    expect(arrayMove(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(arrayMove(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
  });
});
