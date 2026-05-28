type ColorPaletteProps = {
  palette: string[];
  onChange: (palette: string[]) => void;
};

// 새 색 추가 시 기본값. 사용자가 곧바로 피커로 바꾼다.
const NEW_COLOR = '#2563eb';

// 프리셋 색 행. 세션 내에서만 추가·수정·삭제하며 저장하지 않는다(설계 §4).
// 칩은 팔레트 인덱스가 아닌 hex를 들고 있어, 여기서 색을 바꿔도 기존 칩 색은 흔들리지 않는다.
export function ColorPalette({ palette, onChange }: ColorPaletteProps) {
  function updateColor(index: number, hex: string) {
    onChange(palette.map((color, i) => (i === index ? hex : color)));
  }

  function removeColor(index: number) {
    onChange(palette.filter((_, i) => i !== index));
  }

  function addColor() {
    onChange([...palette, NEW_COLOR]);
  }

  return (
    <div className="color-palette">
      <ul className="color-palette__list">
        {palette.map((hex, index) => (
          <li className="color-palette__item" key={`${hex}-${index}`}>
            <input
              aria-label={`팔레트 색 ${index + 1}`}
              className="swatch color-palette__picker"
              onChange={(event) => updateColor(index, event.target.value)}
              type="color"
              value={hex}
            />
            <button
              aria-label={`팔레트 색 ${index + 1} 삭제`}
              className="color-palette__remove"
              onClick={() => removeColor(index)}
              type="button"
            >
              ×
            </button>
          </li>
        ))}
        <li>
          <button className="color-palette__add" onClick={addColor} type="button">
            ＋ 색 추가
          </button>
        </li>
      </ul>
    </div>
  );
}
