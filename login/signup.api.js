import { BASE_URL } from "../common/config.js";

// 1) 회원가입 요청
async function register(payload) {
  const res = await fetch(`${BASE_URL}/api/signup/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `회원가입 실패 (HTTP ${res.status})`);
  }
  return res.json().catch(() => ({}));
}

// 2) 로그인 토큰 발급 (SimpleJWT)
async function loginAndStore({ email, password }) {
  // 백엔드에서 username 필드로 이메일을 받는 설정(아래 뷰 코드) 기준
  const res = await fetch(`${BASE_URL}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `토큰 발급 실패 (HTTP ${res.status})`);
  }
  const data = await res.json();
  localStorage.setItem("accessToken", data.access);
  localStorage.setItem("refreshToken", data.refresh);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form.form");
  const nameEl = document.getElementById("name");
  const nationEl = document.getElementById("nation");
  const emailEl = document.getElementById("email");
  const pwEl = document.getElementById("pw");
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();                 // 기본 제출 막기 (페이지 이동 방지)
    if (submitBtn.disabled) return;     // 유효성 통과 안 했으면 중단

    const payload = {
      name: nameEl.value.trim(),
      nation: nationEl.value,           // "kr" | "foreigner"
      email: emailEl.value.trim(),
      password: pwEl.value,
    };

    try {
      await register(payload);                           // 1) 회원 생성
      try {                                             // 2) 자동 로그인(토큰 저장)
        await loginAndStore({ email: payload.email, password: payload.password });
      } catch (_) { /* 토큰 발급 실패해도 가입은 됐으니 넘어가도 됨 */ }

      // 3) 프로필 페이지로 이동
      location.href = "../profile/profile.html";
    } catch (err) {
      alert(`회원가입 실패: ${err.message}`);
    }
  });
});
