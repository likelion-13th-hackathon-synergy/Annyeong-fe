// 백엔드 주소 (로컬/배포 중 하나로 설정)
export const API_BASE = "https://annyeong-be.onrender.com";
// export const API_BASE = "https://annyeong-be.onrender.com";
export const BASE_URL = "https://annyeong-fe.onrender.com";

// 테스트 계정 (자동 로그인용)
/*export const TEST_USER = {
  username: "testuser3",
  password: "testpassword",
};*/

// 테스트 계정 2개(이름/비번은 실제 서버에 만든 계정으로 바꿔주세요)-------
export const TEST_USERS = {
  a: { username: "testuser3", password: "testpassword" },
  b: { username: "testuser4", password: "testpassword" },
};
export const TEST_ACCOUNTS = {
  a: { username: "testuser3", password: "testpassword" },
  b: { username: "testuser4", password: "testpassword" },
};

// 현재 페이지 URL에서 ?as=a 또는 ?as=b 읽기 (기본값 a)
const as = new URLSearchParams(location.search).get("as") || "a";

export const TEST_USER = TEST_USERS[as] ?? TEST_USERS.a;

// 다른 곳에서 필요하면 현재 선택 키도 쓸 수 있게
export const TEST_AS = as;
//-------------------------------------------------------------
// 리뷰 보기 기본 대상 user_id (원하면 쿼리스트링으로 대체 가능)
export const DEFAULT_USER_ID = 3;
export const DEFAULT_PROFILE_IMG = "../assets/images/default-profile.png"; // 기본 아바타
// WebSocket 기본 주소
export function buildWsUrl(roomId, token) {
  const http = new URL(BASE_HTTP);
  const proto = http.protocol === "https:" ? "wss:" : "ws:";
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${proto}//${http.host}/ws/chat/${encodeURIComponent(roomId)}/${qs}`;
}
