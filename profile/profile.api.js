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

        const next = encodeURIComponent(location.pathname);
        location.href = `../login/login.html?next=${next}`;
      return;
    }
    console.warn("프로필 불러오기 실패:", err);
  }
}


async function saveProfile() {
    const payload = {
        real_name: $name.value || "",
        age: String($age.value || ""),
        nationality: $country.value || null,
        city: $sido.value || "",
        service_language: $lang.value || null,
        translation_category: $trans.value || null,
        introduction: $bio.value || "",
      };

  const res = await httpSession("/users/profile/", {
    method: "PUT",
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
    const next = encodeURIComponent(location.pathname);
    try {
      const res = await fetch(`${BASE_URL}/users/auth/google/?next=${next}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) {
        // 서버가 인증 필요하다고 하면 로그인 페이지로 보냄
        location.href = `../login/login.html?next=${decodeURIComponent(next)}`;
        return;
      }
      const data = await res.json();
      if (data.redirect_url) {
        location.href = data.redirect_url; // 구글 인증 페이지로 이동
      } else {
        alert("구글 인증 시작 URL을 받지 못했습니다.");
      }
    } catch (e) {
      alert("구글 인증 시작 중 오류가 발생했습니다.");
    }
  });
  

// --- 초기화 ---
document.addEventListener("DOMContentLoaded", async () => {
  await ensureCsrf();
  await loadProfile();
});
