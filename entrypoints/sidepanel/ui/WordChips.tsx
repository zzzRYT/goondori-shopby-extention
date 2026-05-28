import { useState } from 'react';
import { DEFAULT_PALETTE, isValidHex, type ColorChip } from '../../../lib/display-id';

type WordChipsProps = {
  chips: ColorChip[];
  palette: string[];
  onChange: (chips: ColorChip[]) => void;
};

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

// 강조 단어 칩 목록 + 새 단어 입력. 각 칩은 색 스와치 + 단어 + × 삭제.
// 스와치를 누르면 팔레트 팝오버가 열려 그 칩만 색을 바꾼다(프리셋·직접 hex·색 없음).
export function WordChips({ chips, palette, onChange }: WordChipsProps) {
  const [draft, setDraft] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [customHex, setCustomHex] = useState('');

  // 팔레트가 비면 자동 배정은 기본 팔레트로 폴백한다(설계 §5).
  const paletteSource = palette.length > 0 ? palette : DEFAULT_PALETTE;

  function addWord() {
    const word = draft.trim();
    if (!word) return;
    // 추가하는 순간에만 라운드로빈으로 색을 배정한다 — 기존 칩 색은 건드리지 않는다.
    const autoHex = paletteSource[chips.length % paletteSource.length];
    onChange([...chips, { word, hex: autoHex }]);
    setDraft('');
  }

  function removeChip(index: number) {
    onChange(chips.filter((_, i) => i !== index));
    setOpenIndex(null);
  }

  function setChipColor(index: number, hex: string | null) {
    onChange(chips.map((chip, i) => (i === index ? { ...chip, hex } : chip)));
  }

  function togglePopover(index: number) {
    if (openIndex === index) {
      setOpenIndex(null);
      return;
    }
    setOpenIndex(index);
    setCustomHex(chips[index]?.hex ?? '');
  }

  function handleCustomHex(index: number, value: string) {
    setCustomHex(value);
    const normalized = normalizeHex(value);
    if (isValidHex(normalized)) setChipColor(index, normalized);
  }

  return (
    <div className="word-chips">
      <ul className="word-chips__list">
        {chips.map((chip, index) => (
          <li className="word-chip" key={`${chip.word}-${index}`}>
            <button
              aria-label={`${chip.word} 색 변경`}
              className="swatch word-chip__swatch"
              data-empty={chip.hex === null}
              onClick={() => togglePopover(index)}
              style={chip.hex ? { backgroundColor: chip.hex } : undefined}
              type="button"
            />
            <span className="word-chip__word">{chip.word}</span>
            <button
              aria-label={`${chip.word} 삭제`}
              className="word-chip__remove"
              onClick={() => removeChip(index)}
              type="button"
            >
              ×
            </button>

            {openIndex === index && (
              <div aria-label={`${chip.word} 색 선택`} className="color-popover" role="dialog">
                <div className="color-popover__swatches">
                  {paletteSource.map((hex) => (
                    <button
                      aria-label={`색 ${hex}`}
                      className="swatch"
                      data-selected={chip.hex === hex}
                      key={hex}
                      onClick={() => {
                        setChipColor(index, hex);
                        setOpenIndex(null);
                      }}
                      style={{ backgroundColor: hex }}
                      type="button"
                    />
                  ))}
                </div>
                <label className="color-popover__custom">
                  <span>직접 지정</span>
                  <input
                    aria-label="직접 색 지정"
                    onChange={(event) => handleCustomHex(index, event.target.value)}
                    placeholder="#008000"
                    value={customHex}
                  />
                </label>
                <button
                  className="color-popover__clear"
                  onClick={() => {
                    setChipColor(index, null);
                    setOpenIndex(null);
                  }}
                  type="button"
                >
                  색 없음
                </button>
              </div>
            )}
          </li>
        ))}

        <li className="word-chips__add">
          <input
            aria-label="강조 단어 추가"
            className="word-chips__input"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addWord();
              }
            }}
            placeholder="단어 입력 후 Enter"
            value={draft}
          />
        </li>
      </ul>
    </div>
  );
}
