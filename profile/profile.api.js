const BASE_URL = "http://localhost:8000"; 


import { startStatusbarClock } from "/Annyeong-fe/assets/js/statusbar-time.js";
if (typeof startStatusbarClock === "function") {
  startStatusbarClock({ selector: ".sb-time", hour12: false, locale: "ko-KR" });
}

const $ = (sel) => document.querySelector(sel);
const optText = (sel) => (sel?.options?.[sel.selectedIndex] || {}).text || "";

function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}
function needsCSRF(method) {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(String(method).toUpperCase());
}
async function ensureCsrf() {
  let token = getCookie("csrftoken");
  if (!token) {

    await fetch(`${BASE_URL}/users/csrf/`, { credentials: "include" });
    token = getCookie("csrftoken");
  }
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) meta.setAttribute("content", token || "");
  return token;
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
    credentials: "include",
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error((data && (data.error || data.detail)) || `HTTP ${res.status}`);
  return data;
}


const $name = $("#real_name");
const $age = $("#age");
const $country = $("#country");
const $sido = $("#sido");
const $lang = $("#lang");
const $trans = $("#trans");
const $bio = $("#bio");
const $badge = document.querySelector(".badge-img");
const $previewBtn = $("#previewBtn");
const $submitBtn = $("#submitBtn");
const $googleBtn = $("#googleConnectBtn");


function collectPreviewData() {
  return {
    real_name: $name.value.trim(),
    age: $age.value.trim(),
    nationality: $country.value,
    nationality_label: optText($country),
    city: $sido.value,
    service_language: $lang.value,
    service_language_label: optText($lang),
    translation_category: $trans.value,
    translation_category_label: optText($trans),
    introduction: $bio.value.trim(),
    google_verified: $badge && getComputedStyle($badge).display !== "none",
  };
}


async function loadProfile() {
  try {

    const me = await httpSession("/users/profile/");
    if ($name) $name.value = me.real_name ?? "";
    if ($age) $age.value = me.age ?? "";
    if ($country && me.nationality) $country.value = me.nationality;
    if ($sido && me.city) $sido.value = me.city;
    if ($lang && me.service_language) $lang.value = me.service_language;
    if ($trans && me.translation_category) $trans.value = me.translation_category;
    if ($bio) $bio.value = me.introduction ?? "";
    if ($badge) $badge.style.display = me.google_verified ? "block" : "none";
  } catch (err) {
    if (String(err).includes("401")) {

      location.href = "../login/login.html";
      return;
    }
    console.warn("프로필 불러오기 실패:", err);
  }
}


async function saveProfile() {
  const body = {
    real_name: $name.value || "",
    age: String($age.value || ""),
    nationality: $country.value || null,
    city: $sido.value || "",
    service_language: $lang.value || null,
    translation_category: $trans.value || null,
    introduction: $bio.value || "",
  };

  const res = await httpSession("/users/profile/edit", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const draft = collectPreviewData();
  sessionStorage.setItem("preview_profile", JSON.stringify(draft));
  localStorage.setItem("profile_cache", JSON.stringify(draft));
  return res;
}


$previewBtn?.addEventListener("click", () => {
  const draft = collectPreviewData();
  sessionStorage.setItem("preview_profile", JSON.stringify(draft));
  location.href = "pre.html";
});

$submitBtn?.addEventListener("click", async () => {
  try {
    await saveProfile();
    location.href = "../home/home.html";
  } catch (e) {
    alert("저장 실패: " + (e.message || e));
  }
});

$googleBtn?.addEventListener("click", async () => {
    // 1) 먼저 로그인 여부 확인
    try {
      await httpSession("/users/profile/"); // 세션 있으면 200, 없으면 throw(401)
    } catch (e) {
      // 미로그인 → 로그인 화면으로 (끝나면 다시 돌아오게 next 붙임)
      const next = encodeURIComponent(location.pathname);
      location.href = `../login/login.html?next=${next}`;
      return;
    }
  
    // 2) 로그인 상태면 구글 OAuth 시작 URL 받아서 이동
    try {
      const res = await fetch(`${BASE_URL}/users/auth/google/`, { credentials: "include" });
      if (res.status === 401) {
        const next = encodeURIComponent(location.pathname);
        location.href = `../login/login.html?next=${next}`;
        return;
      }
      const data = await res.json();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        alert("구글 인증 시작 URL을 받지 못했습니다.");
      }
    } catch (e) {
      alert("구글 인증을 시작할 수 없습니다. 네트워크/서버 상태를 확인해 주세요.");
    }
  });
  

// --- 초기화 ---
document.addEventListener("DOMContentLoaded", async () => {
  await ensureCsrf();
  await loadProfile();
});
