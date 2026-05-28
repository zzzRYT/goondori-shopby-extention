// 샵바이 Shop(프론트) API 고정 설정 — docs.shopby.co.kr `display`/`product` shop 스펙 기준.
//
// clientId는 몰별로 발급되는 "쇼핑몰 클라이언트 아이디"(공개 키)다. 스토어프론트 모든
// 페이지에 노출되는 값이라 비밀값이 아니며, 사람이 바꿀 일이 거의 없어 소스에 상수로 둔다.
// 다른 몰에 쓰려면 이 한 줄만 교체하면 된다.
export const SHOP_API_BASE = 'https://shop-api.e-ncp.com';

// TODO(군도리): 실제 몰 clientId로 교체. 비어 있으면 API 호출이 즉시 에러를 던진다.
export const SHOPBY_CLIENT_ID = 'rRCeQkusRvuVCGbrdbF3iA==';

export const SHOPBY_PLATFORM = 'PC';
export const SHOPBY_API_VERSION = '1.0';
