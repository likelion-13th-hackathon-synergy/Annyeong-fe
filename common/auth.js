// common/auth.js
import { API_BASE, TEST_USER } from "./config.js";

// 브라우저 쿠키에서 csrftoken 읽기
function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
}

// CSRF 쿠키를 브라우저에 심기 (서버는 ensure_csrf_cookie로 설정)
export async function seedCsrf(baseUrl = API_BASE) {
  const res = await fetch(`${baseUrl}/users/csrf/`, {
    method: "GET",
    credentials: "include", // 쿠키 저장
  });
  // 장고는 보통 Set-Cookie로 내려줌. 헤더가 아니라 쿠키에서 읽어야 함.
  const token = getCookie("csrftoken");
  if (!res.ok || !token) throw new Error("CSRF 시드 실패 (csrftoken 없음)");
  return token;
}

// 세션 로그인 (기본: TEST_USER 사용)
export async function loginWithSession(
  username = TEST_USER.username,
  password = TEST_USER.password,
  baseUrl = API_BASE
) {
  // 1) 먼저 csrftoken 쿠키 심기
  let csrftoken = getCookie("csrftoken");
  if (!csrftoken) {
    csrftoken = await seedCsrf(baseUrl);
  }

  // 2) 로그인 POST
  const res = await fetch(`${baseUrl}/users/login/`, {
    method: "POST",
    credentials: "include", // 세션/쿠키 저장·전송
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrftoken,
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`로그인 실패: ${res.status} ${t}`);
  }
  return res.json().catch(() => ({}));
}

// 인증 포함 fetch (unsafe 메서드면 CSRF 헤더 자동 추가)
export async function authedFetch(path, options = {}, baseUrl = API_BASE) {
  const method = (options.method || "GET").toUpperCase();
  const opts = {
    credentials: "include",
    ...options,
    headers: { ...(options.headers || {}) },
  };

  // POST/PUT/PATCH/DELETE 등에는 CSRF 헤더 필요
  const unsafe = !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  if (unsafe) {
    let token = getCookie("csrftoken");
    if (!token) token = await seedCsrf(baseUrl);
    opts.headers["X-CSRFToken"] = token;
  }

  return fetch(`${baseUrl}${path}`, opts);
}
