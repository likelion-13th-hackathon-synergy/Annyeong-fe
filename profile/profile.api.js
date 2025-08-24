import { BASE_URL } from "../common/config.js";
import { httpJWT } from "../common/http-jwt.js";
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
const googleBtn = document.getElementById("googleConnectBtn");
googleBtn?.addEventListener("click", () => {
  // 로그인 완료 후 백엔드의 성공 페이지에서 FE로 다시 보내기
  // (백엔드에 /oauth/success/ 뷰를 만들었거나 LOGIN_REDIRECT_URL로 설정했다는 가정)
  const next = encodeURIComponent("/oauth/success/");
  // 세션 로그인 여부와 무관하게 가장 안전한 건 'login'
  const process = "login"; // (세션이 이미 있다면 'connect'도 가능)
  window.location.assign(
    `${BASE_URL}/accounts/google/login/?process=${process}&next=${next}`
  );
});

// --- 초기화 ---
loadProfile();

