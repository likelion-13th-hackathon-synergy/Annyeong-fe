// signup.api.js
const BASE_URL = "http://localhost:8000"; // 장고 서버 주소로 바꿔도 됨

// --- CSRF 유틸 ---
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}
function setMetaCsrf(value) {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) meta.setAttribute("content", value || "");
}
async function ensureCsrf() {
  let token = getCookie("csrftoken");
  if (!token) {
    await fetch(`${BASE_URL}/api/csrf/`, { method: "GET", credentials: "include" });
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

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = (data && (data.error || data.detail)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// --- 페이지 로직 ---
document.addEventListener("DOMContentLoaded", async () => {
  // 1) 최초 진입 시 CSRF 쿠키 확보 + 메타 채우기
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
    const nation = nationEl?.value; // 'kr' | 'foreigner'
    const email = emailEl?.value.trim();
    const password = pwEl?.value;
    const password2 = pw2El?.value;

    // 프론트 유효성(이미 하고 있지만 한번 더 방어)
    if (!name || !email || !password || !password2) {
      alert("모든 필드를 입력해 주세요.");
      return;
    }
    if (password !== password2) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      // 2) 회원가입 (서버가 JSON 받도록 구현)
      await httpSession("/api/session-signup/", {
        method: "POST",
        body: JSON.stringify({ name, nation, email, password }),
      });

      // 3) 바로 로그인된 상태로 me 확인(선택)
      const me = await httpSession("/api/me/");
      console.log("Signed up:", me);

      // 4) 다음 화면으로 이동
      window.location.href = "/Annyeong-fe/profile/profile.html";
    } catch (err) {
      console.error(err);
      alert(`회원가입 실패: ${err.message}`);
    }
  });
});
