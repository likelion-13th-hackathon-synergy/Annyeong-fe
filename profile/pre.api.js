// pre.api.js

import { httpJWT } from "../common/http-jwt.js";
import { startStatusbarClock } from "../assets/js/statusbar-time.js";

// 상태바 시계
if (typeof startStatusbarClock === "function") startStatusbarClock();

// ---- JWT 토큰 리프레시 & API 래퍼 ----
async function refreshToken() {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) throw new Error("401");
  const res = await fetch(`${API_BASE}/api/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) throw new Error("refresh failed");
  const data = await res.json();
  localStorage.setItem("accessToken", data.access);
}

async function api(path, init) {
  try {
    return await httpJWT(path, init);         // Authorization: Bearer 자동 처리
  } catch (e) {
    if (String(e.message || e).includes("401")) {
      await refreshToken();
      return await httpJWT(path, init);       // 1회 재시도
    }
    throw e;
  }
}

// ---- 상수/유틸 ----
const PROFILE_URL = "/users/profile/";       // BASE_URL은 httpJWT 안에서 결합됨
const LANG_LABEL = { ko:"한국어", en:"영어", ja:"일본어", zh:"중국어", vi:"베트남어", th:"태국어", ru:"러시아어" };

const $ = (s) => document.querySelector(s);

// ISO 2글자 → 국기 이모지
function countryToEmoji(cc) {
  if (!cc) return "";
  const code = cc.toUpperCase();
  if (code.length !== 2) return "";
  const BASE = 127397; // regional indicator base
  return String.fromCodePoint(...[...code].map(c => BASE + c.charCodeAt(0)));
}

// 백엔드/캐시를 미리보기 포맷으로 정규화
const toPreviewShape = (d) => ({
  real_name: d.real_name ?? "",
  age: d.age ? String(d.age) : "",
  nationality: d.nationality ?? "",
  city: d.city ?? "",
  service_language: d.service_language ?? "",
  translation_category: d.translation_category ?? "",
  service_language_label: d.service_language_label ?? LANG_LABEL[d.service_language] ?? "",
  translation_category_label: d.translation_category_label ?? LANG_LABEL[d.translation_category] ?? "",
  introduction: d.introduction ?? "",
  google_verified: !!d.google_verified,
});

// 렌더링
function render(d) {
  const flagEl = $("#pvFlag");
  const nameEl = $("#pvName");
  const ageEl  = $("#pvAge");
  const metaEl = $("#pvMeta");
  const quoteEl= $("#pvQuote");
  const verEl  = $("#pvVerified");

  nameEl.textContent = d.real_name || "이름 미입력";
  ageEl.textContent  = d.age || "";

  const pair = [d.service_language_label, d.translation_category_label].filter(Boolean).join(" • ");
  metaEl.textContent = [d.city || "", pair].filter(Boolean).join(" | ");

  quoteEl.textContent = d.introduction ? `"${d.introduction}"` : "";
  flagEl.textContent = countryToEmoji(d.nationality);          // ✅ 국기 이모지
  verEl.style.display = d.google_verified ? "block" : "none";  // 인증 뱃지
}

// 캐시
const cacheSet = (d) => localStorage.setItem("profile_cache", JSON.stringify(d));
const cacheGet = (raw) => { try { return JSON.parse(raw || "null"); } catch { return null; } };

// 초기화: 세션 프리뷰 → 로컬 캐시 → 서버 최신
(async function init() {
  // 1) 방금 입력값(세션)
  let d = cacheGet(sessionStorage.getItem("preview_profile"));
  if (d) { d = toPreviewShape(d); render(d); cacheSet(d); }
  else {
    // 2) 로컬 캐시
    d = cacheGet(localStorage.getItem("profile_cache"));
    if (d) render(d);

    // 3) 서버 호출(JWT)
    try {
      const me = await api(PROFILE_URL);           // GET /users/profile/
      const shaped = toPreviewShape(me);
      render(shaped);
      cacheSet(shaped);
    } catch (e) {
      if (String(e.message || e).includes("401")) {
        location.href = "../login/login.html";
        return;
      }
      console.warn("profile fetch failed:", e);
    }
  }

  // 즐겨찾기/완료
  const favBtn = $("#favBtn");
  favBtn?.addEventListener("click", () => favBtn.classList.toggle("active"));
  $("#finishBtn")?.addEventListener("click", () => (location.href = "../home/home.html"));
})();
