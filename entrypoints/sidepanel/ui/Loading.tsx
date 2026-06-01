interface LoadingProps {
  // 테스트/접근성 식별용. 섹션별로 구분 가능하게 받는다.
  testId?: string;
  label?: string;
}

// 스켈레톤 대신 쓰는 단순 로딩 인디케이터.
// 실제 콘텐츠 레이아웃을 흉내 내지 않아 새로고침 시 layout shift를 만들지 않는다.
export function Loading({ testId, label = '불러오는 중…' }: LoadingProps) {
  return (
    <div className="loading" data-testid={testId} role="status" aria-busy="true">
      <span className="loading__spinner" aria-hidden="true" />
      <span className="loading__label">{label}</span>
    </div>
  );
}
