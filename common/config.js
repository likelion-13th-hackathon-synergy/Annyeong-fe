// common/config.js

// 백엔드 주소 (로컬/배포 중 하나로 설정)
export const API_BASE = "http://127.0.0.1:8000";
// export const API_BASE = "https://annyeong-be.onrender.com";

// 테스트 계정 (자동 로그인용)
export const TEST_USER = {
  username: "testuser3",
  password: "testpassword",
};

// 리뷰 보기 기본 대상 user_id (원하면 쿼리스트링으로 대체 가능)
export const DEFAULT_USER_ID = 3;

// WebSocket 기본 주소
export function buildWsUrl(roomId, token) {
  const http = new URL(BASE_HTTP);
  const proto = http.protocol === "https:" ? "wss:" : "ws:";
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${proto}//${http.host}/ws/chat/${encodeURIComponent(roomId)}/${qs}`;
}
