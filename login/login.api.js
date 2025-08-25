import { startStatusbarClock } from "../assets/js/statusbar-time.js";
import { API_BASE, BASE_URL } from "../common/config.js";

if (typeof startStatusbarClock === "function") {
  startStatusbarClock({ selector: ".sb-time", hour12: false, locale: "ko-KR" });
}


const HOME = `${BASE_URL}/home/home.html`;  // 홈 경로 고정

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
    await fetch(`${API_BASE}/users/csrf/`, { method: "GET", credentials: "include" });
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
    if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }
  const res = await fetch(`${API_BASE}${path}`, {
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
      JSON.stringify(data, null, 2) ||
      `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

document.addEventListener("DOMContentLoaded", async () => {
  await ensureCsrf();

  const qs = new URLSearchParams(location.search);
  const next = qs.get("next") || HOME;

  try {
    // 이미 로그인된 세션이면 바로 홈으로
    await httpSession("/users/profile/");
    location.replace(next);
    return;
  } catch (_) {
    /* 미로그인 → 폼 표시 */
  }

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
      await httpSession("/users/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        credentials: "include",
        body: JSON.stringify({ username: email, password }),
      });

      history.replaceState(null, "", location.pathname);

      // 로그인 성공 시 홈으로 이동
      location.replace(HOME);
    } catch (err) {
      console.error(err);
      alert(`로그인 실패:\n${err.message}`);
    }
  });
});
