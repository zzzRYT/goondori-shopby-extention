// 전시카테고리 순서 변경 방법 안내(정보성). 접이식으로 항상 노출.
// 카테고리 코드 중복 불가 → 한쪽을 '' 빈 값으로 비워 코드를 푼 뒤 옮김 + 사이사이 중복확인·저장이 필수임을 설명.
export function CategoryGuide() {
  return (
    <details className="category-guide">
      <summary className="category-guide__summary">전시 순서 변경 방법</summary>
      <div className="category-guide__body">
        <ul className="category-guide__list">
          <li>전시 카테고리 순서는 관리코드(c_1, c_2 / ct_1, ct_2 …)로 정해집니다.</li>
          <li>
            관리코드는 <strong>중복이 허용되지 않으므로</strong>, 순서를 바꾸려면 한쪽 코드를
            먼저 <strong>‘’(빈 값)으로 비워</strong> 그 자리를 풀어 줘야 합니다.
          </li>
          <li>
            각 변경 사이에 <strong>“중복 확인”과 “저장”이 필수</strong>입니다.
          </li>
          <li>그래야 다음 코드를 바꿀 때 중복이 생기지 않아 shopby에서 오류 없이 적용됩니다.</li>
        </ul>
        <p className="category-guide__example-label">예) c_1 ↔ c_2 자리 바꾸기</p>
        <ol className="category-guide__steps">
          <li>c_1 → ‘’(빈 값) 으로 변경 → 중복 확인 → 저장</li>
          <li>c_2 → c_1 으로 변경 → 중복 확인 → 저장</li>
          <li>비워 둔 항목 → c_2 으로 변경 → 중복 확인 → 저장</li>
        </ol>
      </div>
    </details>
  );
}
