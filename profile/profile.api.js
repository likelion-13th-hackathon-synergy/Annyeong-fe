// profile.api.js
// 세션 인증 + 프로필 로드/저장 + 이미지 변경 + 구글 인증(팝업 폴링) + 배너 닫기

import { startStatusbarClock } from "../assets/js/statusbar-time.js";
if (typeof startStatusbarClock === "function") {
  startStatusbarClock({ selector: ".sb-time", hour12: false, locale: "ko-KR" });
}

const BASE_URL = "";             // Vite 프록시 사용 시 빈 문자열 권장
const LOGIN = "/login/login.html";
const HOME  = "/home/home.html";

// ---------- 공통 유틸 ----------
const $ = (sel) => document.querySelector(sel);

function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}
function needsCSRF(method) {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(String(method).toUpperCase());
}
function setMetaCsrf(v) {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) meta.setAttribute("content", v || "");
}
async function ensureCsrf() {
  let token = getCookie("csrftoken");
  if (!token) {
    await fetch(`/users/csrf/`, { credentials: "include" });
    token = getCookie("csrftoken");
  }
  setMetaCsrf(token);
  return token;
}
async function httpSession(path, init = {}) {
  const method  = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const isFormData = init.body instanceof FormData;
  if (needsCSRF(method)) {
    const token = getCookie("csrftoken") || (await ensureCsrf());
    headers.set("X-CSRFToken", token);
    if (!isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const res  = await fetch(`${BASE_URL}${path}`, { ...init, method, headers, credentials: "include" });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = (typeof data === "string" && data) || data?.detail || JSON.stringify(data) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

// ---------- 세션 가드 ----------
async function assertLoggedInOrRedirect() {
  try {
    await httpSession("/users/profile/");
    return true;
  } catch {
    const here = location.pathname + location.search;
    location.replace(`${LOGIN}?next=${encodeURIComponent(here)}`);
    return false;
  }
}

// ---------- DOM 참조 ----------
const $name    = $("#real_name");
const $age     = $("#age");
const $country = $("#country");
const $sido    = $("#sido");
const $lang    = $("#lang");
const $trans   = $("#trans");
const $bio     = $("#bio");

const $avatarImg = document.querySelector(".avatar img[alt='프로필 이미지']");
const $badgeImg  = document.querySelector(".badge-img");       // 아바타의 인증 뱃지
const $editPhoto = document.querySelector(".edit-photo");

const $verifyBanner = document.querySelector(".verify-banner");
const $bannerClose  = document.querySelector(".verify-banner .vb-close");
const $badgeCheck   = document.querySelector(".verify-banner .vb-badge");

const $previewBtn = $("#previewBtn");
const $submitBtn  = $("#submitBtn");
const $gBtn       = $("#googleConnectBtn");

let selectedImageFile = null;

// ---------- 배너 표시/숨김 ----------
function updateVerifyBanner(verified) {
  if (!$verifyBanner) return;
  if (verified === true) {
    // 인증 완료 → 아예 숨김
    $verifyBanner.style.display = "none";
    $bannerClose.style.display = "none";
  } else {
    // 인증 안 됨 → 보이도록
    $verifyBanner.style.display = "";
    $bannerClose.style.display = "";
  }
}

// ---------- 프로필 로드 ----------
async function loadProfile() {
  try {
    const me = await httpSession("/users/profile/");
    if ($name)    $name.value = me.real_name ?? "";
    if ($age)     $age.value  = me.age ?? "";
    if ($country && me.nationality) $country.value = me.nationality;
    if ($sido && me.city)           $sido.value    = me.city;
    if ($lang && me.service_language) $lang.value  = me.service_language;
    if ($trans && me.translation_category) $trans.value = me.translation_category;
    if ($bio)     $bio.value   = me.introduction ?? "";

    if ($avatarImg && me.profile_image) {
      $avatarImg.src = me.profile_image;
    }
    if ($badgeImg) {
      $badgeImg.style.display = me.google_verified ? "block" : "none";
    }
    updateVerifyBanner(me.google_verified);
  } catch (err) {
    console.warn("프로필 불러오기 실패:", err);
  }
}

// ---------- 폼데이터 ----------
function buildProfileFormData(includeImage = true) {
  const fd = new FormData();
  fd.append("real_name", ($name?.value || "").trim());
  fd.append("age", $age?.value ? String($age.value) : "");
  fd.append("nationality", $country?.value || "");
  fd.append("city", $sido?.value || "");
  fd.append("introduction", ($bio?.value || "").trim());
  fd.append("service_language", $lang?.value || "");
  fd.append("translation_category", $trans?.value || "");
  if (includeImage && selectedImageFile instanceof File) {
    fd.append("profile_image", selectedImageFile);
  }
  return fd;
}

// ---------- 저장(완료) ----------
async function saveProfile(includeImage = true) {
  const fd = buildProfileFormData(includeImage);
  return httpSession("/users/profile/", { method: "PUT", body: fd });
}

// ---------- 이미지 변경 ----------
function createHiddenFileInput() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  document.body.appendChild(input);
  return input;
}
function validateImage(file) {
  if (!file) return "이미지 파일을 선택해 주세요.";
  if (!/^image\//.test(file.type)) return "유효한 이미지 파일을 선택해 주세요.";
  if (file.size > 10 * 1024 * 1024) return "이미지 크기는 10MB 이하만 가능합니다.";
  return null;
}
async function handleEditPhotoClick(e) {
  e.preventDefault();
  const picker = createHiddenFileInput();

  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    picker.remove();

    const err = validateImage(file);
    if (err) { alert(err); return; }

    selectedImageFile = file;
    if ($avatarImg) {
      $avatarImg.src = URL.createObjectURL(file);
    }

    try {
      const res = await saveProfile(true);
      if ($avatarImg && res?.profile_image) {
        $avatarImg.src = res.profile_image;
      }
      alert("프로필 이미지가 업데이트되었습니다.");
    } catch (e) {
      console.error(e);
      alert(`이미지 업로드 실패: ${e.message || e}`);
      selectedImageFile = null;
      await loadProfile();
    }
  });

  picker.click();
}

// ---------- 구글 인증 ----------
function openCenteredPopup(url, name = "google_oauth", w = 520, h = 700) {
  const dualLeft = window.screenLeft ?? screen.left;
  const dualTop  = window.screenTop  ?? screen.top;
  const width    = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const height   = window.innerHeight|| document.documentElement.clientHeight|| screen.height;
  const systemZoom = width / window.screen.availWidth;
  const left = (width - w) / 2 / systemZoom + dualLeft;
  const top  = (height - h) / 2 / systemZoom + dualTop;
  const features = `noopener,noreferrer,scrollbars=yes,width=${w/systemZoom},height=${h/systemZoom},top=${top},left=${left}`;
  return window.open(url, name, features);
}
async function waitForGoogleVerify({ intervalMs = 1200, timeoutMs = 120000 } = {}) {
  const started = Date.now();
  while (true) {
    if (Date.now() - started > timeoutMs) throw new Error("구글 인증 시간이 초과되었습니다.");
    try {
      const data = await httpSession("/users/profile/preview/");
      if (data?.google_verified === true) return data;
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
async function startGoogleConnect() {
  try {
    const start = await httpSession("/users/auth/google/");
    const redirectUrl = start?.redirect_url || start?.redirect;
    if (!redirectUrl) { alert("구글 인증 시작 URL을 받지 못했습니다."); return; }

    const popup = openCenteredPopup(redirectUrl);
    let preview;
    try { preview = await waitForGoogleVerify({}); }
    finally { try { popup && !popup.closed && popup.close(); } catch {} }

    if ($badgeImg) $badgeImg.style.display = preview?.google_verified ? "block" : "none";
    updateVerifyBanner(true); // 인증 완료 → 배너 숨김
    alert("구글 인증이 완료되었습니다.");
  } catch (err) {
    console.error(err);
    alert(err.message || "구글 인증 중 오류");
  }
}

// ---------- 이벤트 바인딩 ----------
document.addEventListener("DOMContentLoaded", async () => {
  await ensureCsrf();
  const ok = await assertLoggedInOrRedirect();
  if (!ok) return;

  await loadProfile();
});

$editPhoto?.addEventListener("click", handleEditPhotoClick);

$previewBtn?.addEventListener("click", async () => {
  try {
    const data = await httpSession("/users/profile/preview/");
    sessionStorage.setItem("preview_profile", JSON.stringify(data));
    location.href = "pre.html";
  } catch {
    alert("미리보기를 불러올 수 없습니다.");
  }
});

$submitBtn?.addEventListener("click", async () => {
  try {
    await saveProfile(true);
    location.href = HOME;
  } catch (e) {
    alert("저장 실패: " + (e.message || e));
  }
});

$gBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  startGoogleConnect();
});

//  배너 닫기 버튼 → 일시 숨김
$bannerClose?.addEventListener("click", () => {
  if ($verifyBanner) {
    $verifyBanner.style.display = "none";
    $bannerClose.style.display = "none";

  }
});
