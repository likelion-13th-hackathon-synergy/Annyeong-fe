// home.js — same-origin(proxy) 버전: BASE는 "", 모든 요청 credentials: "include", CSRF 자동 부착

/* ================= 공통 ================= */
const API_BASE = ""; // 프록시이므로 같은 오리진 사용: "" => "/users/..." , "/api/..." 형식

const $ = (sel) => document.querySelector(sel);
const req = (sel, name) => {
  const el = $(sel);
  if (!el) console.error(`❌ 필수 요소 누락: ${name} selector="${sel}"`);
  return el;
};
function info(html) {
  const box = req("#card-container", "카드 컨테이너");
  if (box) box.innerHTML = `<div style="padding:16px;line-height:1.5">${html}</div>`;
}

/* ================= 세션 가드 ================= */
async function assertLoggedInOrRedirect() {
  try {
    const r = await fetch(`${API_BASE}/users/profile/`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw 0;
    return true;
  } catch {
    const next = location.pathname + location.search;
    location.replace(`/Annyeong-fe/login/login.html?next=${encodeURIComponent(next)}`);
    return false;
  }
}

/* ================= CSRF 유틸 ================= */
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}
async function ensureCsrf() {
  let t = getCookie("csrftoken");
  if (!t) {
    await fetch(`${API_BASE}/users/csrf/`, { method: "GET", credentials: "include" });
    t = getCookie("csrftoken");
  }
  return t;
}
function needsCSRF(m) {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(String(m).toUpperCase());
}
async function apiFetch(path, init = {}) {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (needsCSRF(method)) {
    const token = getCookie("csrftoken") || (await ensureCsrf());
    if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("X-CSRFToken", token);
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });
}

/* ================= 매칭 API ================= */
async function getMatchPreference() {
  const r = await apiFetch(`/api/match/preference/`);
  if (!r.ok) throw new Error(`mode 조회 실패: ${r.status}`);
  return r.json(); // {mode}
}
async function setMatchPreference(mode) {
  const r = await apiFetch(`/api/match/preference/`, {
    method: "PUT",
    body: JSON.stringify({ mode }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.mode?.[0] || j?.detail || `mode 저장 실패: ${r.status}`);
  }
  return r.json();
}
async function getRandomUser() {
  const r = await apiFetch(`/api/match/random-user/`);
  if (r.status === 400) {
    const j = await r.json().catch(() => ({}));
    const err = new Error(j?.detail || "모드가 설정되어 있지 않습니다.");
    err.code = 400;
    throw err;
  }
  if (!r.ok) throw new Error(`추천 실패: ${r.status}`);
  const j = await r.json();
  if (j?.detail) return null; // "추천할 사용자가 존재하지 않습니다."
  return j;
}
async function likeUser(userId) {
  const r = await apiFetch(`/api/match/like/${userId}/`, { method: "POST" });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.detail || `호감 실패: ${r.status}`);
  }
  return r.json(); // { detail, chatroom_id? }
}
async function dislikeUser(userId) {
  const r = await apiFetch(`/api/match/dislike/${userId}/`, { method: "POST" });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.detail || `생략 실패: ${r.status}`);
  }
  return r.json();
}

/* ================= 카드/스와이프 ================= */
let currentUser = null;

function makeOverlay() {
  const appWrapper = $(".app-wrapper");
  let overlay = appWrapper?.querySelector("#swipe-overlay");
  if (!overlay && appWrapper) {
    overlay = document.createElement("div");
    overlay.id = "swipe-overlay";
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      zIndex: "100",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity 0.1s ease-in-out",
      backgroundRepeat: "no-repeat",
      backgroundSize: "70px 100%",
    });
    appWrapper.appendChild(overlay);
  }
  return overlay;
}

function updateProfileCard(profile, cardEl) {
  const img = cardEl.querySelector(".profile-image");
  const nameEl = cardEl.querySelector(".profile-name");
  const locEl = cardEl.querySelector(".profile-location");
  const descEl = cardEl.querySelector(".profile-description");
  const badge = cardEl.querySelector(".badge");

  if (img) img.src = profile.profile_image || "../assets/images/home/type-1.svg";
  if (nameEl)
    nameEl.innerHTML = `${(profile.real_name || profile.username) ?? ""}${
      profile.age != null ? " " + profile.age : ""
    } <span class="badge"></span>`;
  if (locEl)
    locEl.textContent =
      [profile.city, profile.nationality].filter(Boolean).join(" | ") ||
      "위치 정보 없음";
  if (descEl) descEl.textContent = profile.introduction || "소개글 없음.";

  if (badge) {
    badge.innerHTML = "";
    const v =
      profile.google_verified === true ||
      profile.google_verified === 1 ||
      profile.google_verified === "1";
    if (v) {
      const i = document.createElement("img");
      i.src = "../assets/images/home/check.svg";
      i.alt = "인증";
      i.className = "google-badge";
      badge.appendChild(i);
    }
  }
}

function attachSwipe(cardWrapper) {
  if (!cardWrapper) return;
  const overlay = makeOverlay();
  let startX = 0,
    currentX = 0,
    dragging = false;

  function moveTo(x) {
    currentX = x - startX;
    cardWrapper.style.transform = `translateX(${currentX}px)`;
    if (overlay) {
      overlay.style.opacity = String(Math.min(Math.abs(currentX) / 50, 1));
      if (currentX > 0) {
        overlay.style.backgroundImage =
          "linear-gradient(to right, rgba(0,255,0,0) 0px, rgba(0,255,0,0.8))";
        overlay.style.backgroundPosition = "right";
      } else {
        overlay.style.backgroundImage =
          "linear-gradient(to left, rgba(255,0,0,0) 0px, rgba(255,0,0,0.8))";
        overlay.style.backgroundPosition = "left";
      }
    }
  }
  async function end() {
    dragging = false;
    if (Math.abs(currentX) > 100) {
      cardWrapper.style.transition = "transform .3s ease";
      cardWrapper.style.transform = `translateX(${currentX > 0 ? 1000 : -1000}px)`;

      try {
        if (currentX > 0 && currentUser?.id) {
          await likeUser(currentUser.id);
        } else if (currentX < 0 && currentUser?.id) {
          await dislikeUser(currentUser.id);
        }
      } catch (e) {
        console.warn("스와이프 액션 실패:", e?.message || e);
      }

      setTimeout(() => {
        if (overlay) overlay.style.opacity = "0";
        loadNextProfile();
      }, 280);
    } else {
      cardWrapper.style.transition = "transform .3s ease";
      cardWrapper.style.transform = "translateX(0)";
      setTimeout(() => {
        cardWrapper.style.transition = "";
        if (overlay) overlay.style.opacity = "0";
      }, 300);
    }
  }

  // mouse
  cardWrapper.addEventListener("mousedown", (e) => {
    startX = e.clientX;
    dragging = true;
    cardWrapper.style.transition = "";
  });
  cardWrapper.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    moveTo(e.clientX);
  });
  cardWrapper.addEventListener("mouseup", () => dragging && end());
  cardWrapper.addEventListener("mouseleave", () => dragging && end());

  // touch
  cardWrapper.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      startX = t.clientX;
      dragging = true;
      cardWrapper.style.transition = "";
    },
    { passive: true }
  );
  cardWrapper.addEventListener(
    "touchmove",
    (e) => {
      if (!dragging) return;
      const t = e.touches?.[0];
      if (!t) return;
      moveTo(t.clientX);
    },
    { passive: true }
  );
  cardWrapper.addEventListener("touchend", () => dragging && end());
}

/* ================= 드롭다운 ================= */
const MODE_TEXT = { 1: "구인구직", 2: "통역", 3: "버디", 4: "연애/데이팅", 5: "서포터즈" };
const MODE_MAP = { "구인구직": 1, "통역": 2, "버디": 3, "연애/데이팅": 4, "서포터즈": 5 };
let __dropdownCtl = null;

async function initDropdown() {
  const dropdownMenu = req(".dropdown-menu", "드롭다운 메뉴");
  const selectedText = req(".selected-text", "선택 텍스트");
  const dropdownArrow = req(".dropdown-arrow", "드롭다운 화살표");
  const subMenuLinks = document.querySelectorAll(".sub-menu a");
  if (!dropdownMenu || !selectedText || !dropdownArrow) return;

  function toggleArrow() {
    dropdownArrow.src = dropdownMenu.classList.contains("active")
      ? "../assets/images/home/dropdown-after.svg"
      : "../assets/images/home/dropdown-before.svg";
  }

  try {
    const data = await getMatchPreference();
    const modeText = MODE_TEXT[Number(data?.mode)] || "서포터즈";
    selectedText.textContent = modeText;
    subMenuLinks.forEach((a) => {
      a.parentElement.style.display = a.textContent.trim() === modeText ? "none" : "block";
    });
  } catch {
    selectedText.textContent = "서포터즈";
    subMenuLinks.forEach((a) => {
      a.parentElement.style.display = a.textContent.trim() === "서포터즈" ? "none" : "block";
    });
  }

  dropdownMenu.addEventListener("click", (e) => {
    if (!e.target.closest(".sub-menu")) {
      dropdownMenu.classList.toggle("active");
      toggleArrow();
    }
  });
  document.addEventListener("click", (e) => {
    if (!dropdownMenu.contains(e.target) && dropdownMenu.classList.contains("active")) {
      dropdownMenu.classList.remove("active");
      toggleArrow();
    }
  });

  subMenuLinks.forEach((link) => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      const newText = link.textContent.trim();
      const mode = MODE_MAP[newText];
      if (!mode) return;
      try {
        await setMatchPreference(mode);
        selectedText.textContent = newText;
        subMenuLinks.forEach((a) => {
          a.parentElement.style.display = a.textContent.trim() === newText ? "none" : "block";
        });
        dropdownMenu.classList.remove("active");
        toggleArrow();
        await loadNextProfile();
      } catch (err) {
        alert(err?.message || "매칭 모드 저장 실패");
      }
    });
  });

  __dropdownCtl = {
    open: () => {
      dropdownMenu.classList.add("active");
      toggleArrow();
    },
  };
}

/* ================= 카드 로드 ================= */
async function loadNextProfile() {
  const container = req("#card-container", "카드 컨테이너");
  if (!container) return;
  container.innerHTML = `<div style="padding:16px">불러오는 중...</div>`;

  try {
    const user = await getRandomUser();
    if (!user) {
      info("추천할 사용자가 없습니다.");
      currentUser = null;
      disableYN(true);
      return;
    }
    currentUser = user;
    container.innerHTML = `
      <div class="card-wrapper" style="touch-action: pan-y;">
        <div class="image-container">
          <img class="profile-image type" src="${user.profile_image || "../assets/images/home/type-1.svg"}" alt="">
          <div class="card">
            <h1 class="profile-name">${(user.real_name || user.username) ?? ""}${
              user.age != null ? " " + user.age : ""
            } <span class="badge"></span></h1>
            <p class="profile-location">${[user.city, user.nationality].filter(Boolean).join(" | ") || "위치 정보 없음"}</p>
            <p class="profile-description">${user.introduction || "소개글 없음."}</p>
          </div>
          <a href="../review/review-view.html"><img src="../assets/images/home/review.svg" class="review" alt="리뷰 이동"></a>
        </div>
      </div>
    `;
    const cardWrapper = container.querySelector(".card-wrapper");
    updateProfileCard(user, cardWrapper);
    attachSwipe(cardWrapper);
    disableYN(false);
  } catch (e) {
    if (e?.code === 400 || /모드가 설정되어/.test(e?.message || "")) {
      info(`매칭 모드가 설정되어 있지 않습니다.<br>상단 드롭다운에서 모드를 선택해 주세요.`);
      __dropdownCtl?.open?.();
    } else {
      info(`카드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`);
    }
    currentUser = null;
    disableYN(true);
  }
}

/* ================= 버튼 ================= */
function disableYN(on) {
  const yesBtn = req("#yes-button", "예 버튼");
  const noBtn = req("#no-button", "아니오 버튼");
  if (yesBtn) yesBtn.disabled = on;
  if (noBtn) noBtn.disabled = on;
}
async function onYes() {
  if (!currentUser?.id) return;
  try {
    await likeUser(currentUser.id);
  } catch (e) {
    alert(e?.message || "호감 표시 실패");
  }
  await loadNextProfile();
}
async function onNo() {
  if (!currentUser?.id) return;
  try {
    await dislikeUser(currentUser.id);
  } catch (e) {
    alert(e?.message || "생략 실패");
  }
  await loadNextProfile();
}

/* ================= 초기화 ================= */
document.addEventListener("DOMContentLoaded", async () => {
  const ok = await assertLoggedInOrRedirect();
  if (!ok) return;

  // CSRF 토큰 선발급(POST 대비)
  await ensureCsrf();

  const yesBtn = req("#yes-button", "예 버튼");
  const noBtn = req("#no-button", "아니오 버튼");
  yesBtn?.addEventListener("click", onYes);
  noBtn?.addEventListener("click", onNo);
  disableYN(true);

  await initDropdown();
  await loadNextProfile();
});
