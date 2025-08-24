import { BASE_URL } from "../common/config.js";
import { httpJWT } from "/Annyeong-fe/common/http-jwt.js"; // 앞서 만든 로그인용 유틸 재사용
import { startStatusbarClock } from "/Annyeong-fe/assets/js/statusbar-time.js";

// 상태바 시계 시작(있을 때만)
if (typeof startStatusbarClock === "function") startStatusbarClock();

// --- JWT 토큰 갱신 ---
async function refreshToken() {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) throw new Error("No refresh token");
  const res = await fetch(`${BASE_URL}/api/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) throw new Error("Refresh failed");
  const data = await res.json();
  localStorage.setItem("accessToken", data.access);
}

async function api(path, init) {
  try {
    return await httpJWT(path, init); // 내부에서 BASE_URL 붙여서 호출
  } catch (e) {
    // 401이면 1회 refresh 후 재시도
    if (String(e).includes("401")) {
      await refreshToken();
      return await httpJWT(path, init);
    }
    throw e;
  }
}

// --- DOM 헬퍼 ---
const $ = (sel) => document.querySelector(sel);
const optText = (sel) => (sel?.options?.[sel.selectedIndex] || {}).text || "";

// --- 필드 참조 ---
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

// --- 프리뷰 데이터 ---
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

// --- 프로필 불러오기 ---
async function loadProfile() {
  try {
    const me = await api("/users/profile/"); // GET
    // 값 주입 (옵션에 없는 값이면 기본 유지)
    if ($name) $name.value = me.real_name ?? "";
    if ($age) $age.value = me.age ?? "";
    if ($country && me.nationality) $country.value = me.nationality;
    if ($sido && me.city) $sido.value = me.city;
    if ($lang && me.service_language) $lang.value = me.service_language;
    if ($trans && me.translation_category) $trans.value = me.translation_category;
    if ($bio) $bio.value = me.introduction ?? "";

    if ($badge) $badge.style.display = me.google_verified ? "block" : "none";
  } catch (err) {
    // 미로그인 → 로그인 페이지로
    if (String(err).includes("401")) {
      location.href = "../login/login.html";
      return;
    }
    console.warn("프로필 불러오기 실패:", err);
  }
}

// --- 저장하기 ---
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

  const res = await api("/users/profile/", { method: "PUT", body });
  // 성공 시 프리뷰 캐시
  const draft = collectPreviewData();
  sessionStorage.setItem("preview_profile", JSON.stringify(draft));
  localStorage.setItem("profile_cache", JSON.stringify(draft));
  return res;
}

// --- 이벤트 바인딩 ---
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

// Google 계정 연결 (allauth 기준 예시)
$googleBtn?.addEventListener("click", async () => {
    console.log("[google] connect click");
    try {
      // httpJWT는 Authorization: Bearer <access> 붙여 줌
      const { redirect_url } = await api("/users/auth/google/", { method: "GET" });
      console.log("[google] redirect to:", redirect_url);
      window.location.href = redirect_url; // 구글 인증 페이지로 이동
    } catch (e) {
      console.error("[google] error:", e);
      if (String(e).includes("401")) {
        alert("로그인이 필요합니다. 먼저 로그인해 주세요.");
        location.href = "../login/login.html";
      } else {
        alert("구글 연결 실패: " + (e.message || e));
      }
    }
  });

// --- 초기화 ---
loadProfile();
