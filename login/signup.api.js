// signup.api.js (회원가입 후 자동 로그인 → 프로필 이동)

import { startGoogleConnectFlow } from "./profile.google.js";

/* ===== 환경 =====
 * - Vite 프록시 사용 시: const BASE_URL = "";
 * - 직접 백엔드 호출 시: const BASE_URL = "http://localhost:8000";
 *   (프론트/백엔드 모두 localhost 또는 모두 127.0.0.1로 통일!)
 */
const BASE_URL = ""; // ← 필요에 따라 "" 또는 "http://localhost:8000"로 변경
const PROFILE_PAGE = "../profile/profile.html";

/* ===== 공통 유틸 ===== */
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}
function setMetaCsrf(v) {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) meta.setAttribute("content", v || "");
}
async function ensureCsrf() {
  let t = getCookie("csrftoken");
  if (!t) {
    await fetch(`${BASE_URL}/users/csrf/`, { method: "GET", credentials: "include" });
    t = getCookie("csrftoken");
  }
  setMetaCsrf(t);
  return t;
}
function needsCSRF(m) {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(String(m).toUpperCase());
}
async function httpSession(path, init = {}) {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  if (needsCSRF(method)) {
    const token = getCookie("csrftoken") || (await ensureCsrf());
    headers.set("X-CSRFToken", token);
    // FormData가 아니면 JSON 기본 지정
    if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      (typeof data === "string" && data) ||
      data?.detail ||
      (data && JSON.stringify(data, null, 2)) ||
      `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

/* ===== 소셜 로그인 (옵션) ===== */
async function startGoogleOAuth() {
  const nextAfter = "/login/social-complete.html";
  const res = await fetch(
    `${BASE_URL}/users/auth/google/?next=${encodeURIComponent(nextAfter)}`,
    {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    }
  );
  // 서버가 JSON을 주면 우선 활용
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}

  if (data.redirect) {
    location.href = data.redirect; // 구글 인증 페이지
  } else if (res.redirected) {
    location.href = res.url;
  } else {
    alert("구글 인증 시작 URL을 받지 못했습니다.");
  }
}

document.getElementById("googleLoginBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  startGoogleOAuth().catch((err) => {
    console.error(err);
    alert("구글 인증을 시작할 수 없습니다.");
  });
});

document.getElementById("googleConnectBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  startGoogleConnectFlow({
    onDone: (preview) => {
      // 배지 즉시 반영
      const badge = document.querySelector(".badge-img");
      if (badge) badge.style.display = preview?.google_verified ? "block" : "none";
      alert("구글 인증이 완료되었습니다.");
    },
  });
});

/* ===== 페이지 로직 ===== */
document.addEventListener("DOMContentLoaded", async () => {
  await ensureCsrf();

  const form = document.querySelector(".form");
  const nameEl = document.getElementById("name");
  const nationEl = document.getElementById("nation");
  const emailEl = document.getElementById("email");
  const pwEl = document.getElementById("pw");
  const pw2El = document.getElementById("pw2");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameEl?.value.trim();
    const nationVal = nationEl?.value; // 'kr' | 'foreigner'
    const user_type = nationVal === "kr" ? "korean" : "foreigner";
    const email = emailEl?.value.trim();
    const password1 = pwEl?.value;
    const password2 = pw2El?.value;

    if (!name || !email || !password1 || !password2) {
      alert("모든 필드를 입력해 주세요.");
      return;
    }
    if (password1 !== password2) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      // 1) 회원가입 (명세 준수)
      await httpSession("/users/signup/", {
        method: "POST",
        body: JSON.stringify({
          username: email,
          real_name: name,
          user_type,
          password1,
          password2,
          // 서버가 email 필드를 요구하면 아래 주석 해제
          // email,
        }),
      });

      // 2) 바로 로그인 (세션 생성)
      await httpSession("/users/login/", {
        method: "POST",
        body: JSON.stringify({ username: email, password: password1 }),
      });

      // 3) 세션 확인 (선택)
      await httpSession("/users/profile/");

      // 4) 프로필로 이동
      window.location.replace(PROFILE_PAGE);
    } catch (err) {
      console.error(err);
      alert(`회원가입/로그인 실패:\n${err.message}`);
    }
  });
});
