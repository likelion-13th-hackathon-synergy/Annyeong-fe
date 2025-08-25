import { startStatusbarClock } from "../assets/js/statusbar-time.js";

if (typeof startStatusbarClock === "function") {
  startStatusbarClock({ selector: ".sb-time", hour12: false, locale: "ko-KR" });
}

const BASE_URL = "http://localhost:8000";
const APP_ROOT = location.pathname.startsWith("/Annyeong-fe/") ? "/Annyeong-fe" : "";
const HOME = `${APP_ROOT}/home/home.html`;

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
  try { data = text && JSON.parse(text);} catch {} // JSON이면 파싱, 아니면 null 유지
  if (!res.ok) {
    const message =
     data?.detail || data?.message || data?.error ||
         (Array.isArray(data?.non_field_errors) && data.non_field_errors.join(" ")) ||
      text || `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

document.addEventListener("DOMContentLoaded", async () => {
  await ensureCsrf();

  const qs = new URLSearchParams(location.search);                                   // ★ 추가
  const next = qs.get("next") || HOME;                     // ★ 추가 (기본 이동 목적지)
  try {                                                                              // ★ 추가
    await httpSession("/users/profile/");                                            // ★ 추가 (이미 로그인?)
    location.replace(next);                                                          // ★ 추가 (바로 이동)
    return;                                                                          // ★ 추가
  } catch (_) { /* 미로그인 -> 폼 계속 보여줌 */ } 

  const form=document.querySelector(".form");
  const emailEl=document.getElementById("email");
  const pwEl=document.getElementById("password");

  form?.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const email = emailEl?.value.trim();
    const password = pwEl?.value;
    if(!email || !password){
      alert("이메일/비밀번호를 입력해 주세요.");
      return;
    }

    try {
      await httpSession("/users/login/", {
        method: "POST",
        body: JSON.stringify({ username: email, password })
      });

      history.replaceState(null, "", location.pathname);

      location.replace(next || HOME);
    }catch(err){
      console.error(err);
      let msg = err.message || "";
   if (msg.includes("No active account") || msg.includes("password")) {
     msg = "비밀번호가 틀렸습니다.";
   }
   alert(`로그인 실패: ${msg}`);
}
  });
});
