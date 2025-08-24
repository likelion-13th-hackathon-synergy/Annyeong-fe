import { BASE_URL } from "../common/config.js";

// (선택) 상단 상태바 시간 표시 쓰는 경우
import { startStatusbarClock } from "../assets/js/statusbar-time.js";
if (typeof startStatusbarClock === "function") startStatusbarClock();

// ---- JWT 로그인: /api/token/ (djangorestframework-simplejwt) ----
async function loginWithJWT({ email, password }) {
  const res = await fetch(`${BASE_URL}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ username: email, password }), // username으로 이메일 전달
  });
  const text = await res.text();
  if (!res.ok) {
    // 백엔드 메시지 있으면 그대로 보여주기
    let msg = "이메일 또는 비밀번호가 올바르지 않습니다.";
    try { msg = (JSON.parse(text).detail || msg); } catch (_) {}
    throw new Error(msg);
  }
  const data = JSON.parse(text);
  localStorage.setItem("accessToken", data.access);
  localStorage.setItem("refreshToken", data.refresh);
}

// (선택) 세션 방식일 경우를 위한 헬퍼 (백엔드가 /api/login/ 세션 로그인 제공 시)
// 사용 안 할거면 무시해도 OK.
async function loginWithSession({ email, password }) {
  const res = await fetch(`${BASE_URL}/api/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    credentials: "include", // 세션 쿠키 주고받기
    body: JSON.stringify({ username: email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = "로그인에 실패했어요.";
    try { msg = (JSON.parse(text).error || msg); } catch (_) {}
    throw new Error(msg);
  }
}

function setLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.dataset.originalText ??= btn.textContent;
  btn.textContent = isLoading ? "로그인 중..." : btn.dataset.originalText;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form.form");
  const emailEl = document.getElementById("email");
  const pwEl = document.getElementById("password");
  const submitBtn = form?.querySelector('button[type="submit"]');
  const googleBtn = document.querySelector(".btn-google");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    const password = pwEl.value;

    if (!email || !password) {
      alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(submitBtn, true);
    try {
      // 👉 기본: JWT 로그인
      await loginWithJWT({ email, password });

      // (세션 방식을 쓰고 싶다면 위 줄을 주석 처리하고 아래 줄의 주석을 해제)
      // await loginWithSession({ email, password });

      // 성공 시 홈으로 이동
      location.href = "../home/home.html";
    } catch (err) {
      alert(err.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(submitBtn, false);
    }
  });

  // Google 로그인 버튼 — 백엔드가 allauth/dj-rest-auth 등으로 설정되어 있을 때
  googleBtn?.addEventListener("click", () => {
    // (django-allauth 기준 예시) 백엔드 라우트에 맞게 변경
    // next 파라미터로 로그인 후 돌아올 프론트 경로 지정 가능
    const next = encodeURIComponent("/home/home.html");
    location.href = `${BASE_URL}/accounts/google/login/?process=login&next=${next}`;
    // 만약 REST 기반 소셜(OAuth Proxy)라면 백엔드 문서의 시작 URL로 교체해야 함
  });

  
});
