// auth.js
import { BASE_URL } from "./config.js";

const TOKEN_KEY = "access_token";
const USER_ID_KEY = "user_id";

// 로컬 저장/조회
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch {} }
export function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch {} }
export function getUserId() { try { return Number(localStorage.getItem(USER_ID_KEY) || 0); } catch { return 0; } }
export function setUserId(id) { try { localStorage.setItem(USER_ID_KEY, String(id)); } catch {} }

// Notion 명세: POST /users/login/  { username, password }
// 응답 예: { "detail": "로그인 성공", "user_id": 3, "access_token": "..." }  (access_token 키명은 팀 표준에 맞춰주세요)
export async function login({ username, password }) {
  const res = await fetch(`${BASE_URL}/users/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 서버가 username/password를 요구하는 것으로 보임(캡처 기준)
    body: JSON.stringify({ username, password }),
    // 쿠키 기반이라면 credentials 옵션을 열어야 할 수도 있습니다.
    // credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`로그인 실패 (${res.status}) ${text}`);
  }

  const data = await res.json();

  // ⚠️ 백엔드 응답 스키마에 맞춰서 수정해 주세요.
  // 아래는 access_token이 온다고 가정한 예시입니다.
  if (data.access_token) setToken(data.access_token);
  if (typeof data.user_id !== "undefined") setUserId(data.user_id);

  return data;
}

export function logout() {
  clearToken();
  try { localStorage.removeItem("user_id"); } catch {}
}
