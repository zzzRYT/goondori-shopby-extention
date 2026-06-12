// 목록의 승인상태 클릭 시 열리는 팝업과 동일한 URL. globalProductNo=0 고정(관찰값).
export function screeningPopupUrl(productNo: string): string {
  return `https://enterprise-remote.shopby.co.kr/popup/product-screening?globalProductNo=0&mallProductNo=${encodeURIComponent(productNo)}`;
}
