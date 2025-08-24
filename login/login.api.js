// login.api.js
const BASE_URL = "http://localhost:8000"; // 장고 서버 주소

// ----- CSRF 헬퍼들 -----
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function setMetaCsrf(value) {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) meta.setAttribute("content", value || "");
}

async function ensureCsrf() {
  // 브라우저에 csrftoken 쿠키가 없으면 백엔드에서 받아오기
  let token = getCookie("csrftoken");
  if (!token) {
    await fetch(`${BASE_URL}/api/csrf/`, {
      method: "GET",
      credentials: "include", // 쿠키 주고받기
    });
    token = getCookie("csrftoken");
  }
  setMetaCsrf(token);
  return token;
}

function needsCSRF(method) {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(String(method).toUpperCase());
}

async function httpSession(path, init = {}) {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  // POST/PUT/PATCH/DELETE => X-CSRFToken 헤더 넣기
  if (needsCSRF(method)) {
    const token = getCookie("csrftoken") || (await ensureCsrf());
    headers.set("X-CSRFToken", token);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include", // ★ 세션 쿠키 포함
  });

  // JSON 응답 시도
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = (data && (data.error || data.detail)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ----- 로그인 폼 바인딩 -----
document.addEventListener("DOMContentLoaded", async () => {
  // 1) 페이지 진입 시 CSRF 먼저 확보(쿠키+메타)
  await ensureCsrf();

  const form = document.querySelector(".form");
  const emailEl = document.getElementById("email");
  const pwEl = document.getElementById("password");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl?.value.trim();
    const password = pwEl?.value;

    if (!email || !password) {
      alert("이메일/비밀번호를 입력해 주세요.");
      return;
    }

    try {
      // 2) 세션 로그인 호출 (JSON)
      await httpSession("/api/session-login/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      // 3) 로그인 성공 → 상태 확인 후 원하는 페이지로 이동
      const me = await httpSession("/api/me/");
      console.log("Logged in as:", me);

      // 프로필 화면 등으로 이동 (프로젝트 경로에 맞게 수정)
      window.location.href = "/Annyeong-fe/profile/profile.html";
    } catch (err) {
      console.error(err);
      alert(`로그인 실패: ${err.message}`);
    }
  });
});
