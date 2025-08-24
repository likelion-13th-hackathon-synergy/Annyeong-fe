// common/auth.js
import { API_BASE, TEST_USER } from "../common/config.js";

// 브라우저 쿠키에서 csrftoken 읽기
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[2]) : null;
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
export async function authedFetch(path, init = {}, base) {
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const method = (init.method || "GET").toUpperCase();
  const needsCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headers = new Headers(init.headers || {});
  if (needsCsrf && !headers.has("X-CSRFToken")) {
    const token = getCookie("csrftoken") || "";
    headers.set("X-CSRFToken", token);
  }
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    // JSON이 아니라면 굳이 Content-Type 안 넣습니다 (FormData면 자동)
    // headers.set("Content-Type", "application/json");
  }

  console.log("[authedFetch] →", method, url); //최종 URL/메서드 확인용

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  // 응답 로깅
  console.log("[authedFetch] ←", res.status, res.statusText, url);
  return res;
}

export async function fetchMe(apiBase) {
  const res = await fetch(`${apiBase}/users/profile/`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error("not authed");
  return await res.json(); // { id, username, ... }
}

// 이미 로그인되어 있으면 그 세션을 사용, 아니면 TEST_USER로 로그인
export async function ensureAuth(testUser, apiBase) {
  try {
    const me = await fetchMe(apiBase);
    return me; // 기존 세션 유지
  } catch {
    // 세션 없을 때만 테스트 계정 로그인
    await loginWithSession(testUser.username, testUser.password, apiBase);
    return await fetchMe(apiBase);
  }
}