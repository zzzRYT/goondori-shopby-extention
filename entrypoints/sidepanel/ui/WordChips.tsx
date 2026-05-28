import { useState } from 'react';
import { DEFAULT_PALETTE, type ColorChip } from '../../../lib/display-id';

type WordChipsProps = {
  chips: ColorChip[];
  onChange: (chips: ColorChip[]) => void;
};

// 강조 단어 칩 + 칩별 네이티브 컬러 피커.
// 단어를 추가하면 DEFAULT_PALETTE에서 라운드로빈으로 색을 자동 배정하고,
// 사용자는 칩 옆 동그라미(<input type="color">)를 눌러 OS 컬러 피커로 색을 바꾼다.
export function WordChips({ chips, onChange }: WordChipsProps) {
  const [draft, setDraft] = useState('');

  function addWord() {
    const word = draft.trim();
    if (!word) return;
    // 추가하는 순간에만 라운드로빈으로 색을 배정한다 — 기존 칩 색은 건드리지 않는다.
    const autoHex = DEFAULT_PALETTE[chips.length % DEFAULT_PALETTE.length];
    onChange([...chips, { word, hex: autoHex }]);
    setDraft('');
  }

  function removeChip(index: number) {
    onChange(chips.filter((_, i) => i !== index));
  }

  function setChipColor(index: number, hex: string) {
    onChange(chips.map((chip, i) => (i === index ? { ...chip, hex } : chip)));
  }

  return (
    <div className="word-chips">
      <ul className="word-chips__list">
        {chips.map((chip, index) => {
          const hex = chip.hex ?? DEFAULT_PALETTE[0];
          return (
          <li className="word-chip" key={`${chip.word}-${index}`}>
            {/* 라벨이 동그라미(현재 색)로 보이고, 안의 <input type="color">는 투명하게 덮어 클릭 영역만 제공한다. */}
            <label className="swatch word-chip__swatch" style={{ backgroundColor: hex }}>
              <span className="visually-hidden">{`${chip.word} 색 변경`}</span>
              <input
                aria-label={`${chip.word} 색 변경`}
                className="swatch__input"
                onChange={(event) => setChipColor(index, event.target.value)}
                type="color"
                value={hex}
              />
            </label>
            <span className="word-chip__word">{chip.word}</span>
            <button
              aria-label={`${chip.word} 삭제`}
              className="word-chip__remove"
              onClick={() => removeChip(index)}
              type="button"
            >
              ×
            </button>
          </li>
          );
        })}

        <li className="word-chips__add">
          <input
            aria-label="강조 단어 추가"
            className="word-chips__input"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              // 한글 IME 조합 중 Enter는 마지막 글자가 한 번 더 입력되는 버그를 만든다.
              // composing 상태에서는 무시하고, 사용자가 조합을 끝낸 뒤 다시 Enter 치게 한다.
              if (event.nativeEvent.isComposing) return;
              event.preventDefault();
              addWord();
            }}
            placeholder="단어 입력 후 Enter"
            value={draft}
          />
        </li>
      </ul>
    </div>
  );
}
