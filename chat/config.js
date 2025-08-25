export const BASE_HTTP = "";      // REST API 베이스
export function buildWsUrl(roomId, token) {
  const http = new URL(BASE_HTTP);
  const proto = http.protocol === "https:" ? "wss:" : "ws:";
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${proto}//${http.host}/ws/chat/${encodeURIComponent(roomId)}/${qs}`;
}

// 편의 REST 엔드포인트
export const API = {
  chatrooms:      (q="") => `/chatrooms/${q}`,
  messages:       (q="") => `/messages/${q}`,
  translate:            `/translate/`,
  accept:   (chatId) => `/chatrooms/${chatId}/accept/`,
  decline:  (chatId) => `/chatrooms/${chatId}/decline/`,
  markRead: (chatId) => `/chatrooms/${chatId}/mark_read/`,
  upload:          `/upload-image/`,
};
