// review-view.js (세션 인증 버전, 자동로그인 제거)
// - 필수 쿼리: user_id (없으면 안내 후 뒤로/홈)
// - 세션 체크: /users/profile/ (credentials: 'include') → 없으면 로그인으로 리다이렉트(?next 유지)
// - 상단 이름: 응답 username > 쿼리 name > 숫자 user_id
// - strong-text = total_personality_selections, gray-text = total_reviews
// - 리스트 항목 i18n 키를 data-i18n-key로 붙여서 동적 번역 재적용

import { API_BASE } from "../common/config.js";
import { authedFetch } from "../common/auth.js";
import { getLang, setLanguage } from "/assets/js/i18n.js";

const qs = new URLSearchParams(location.search);
const TARGET_USER_ID = Number(qs.get("user_id"));   // 필수
const ROOM_ID = qs.get("roomId");                   // 선택(뒤로가기 구성 등)
const PRESET_NAME = decodeURIComponent(qs.get("name") || "");

/* ---------------- 세션 가드 ---------------- */
async function getMe() {
  const base = API_BASE || "";
  const res = await fetch(`${base}/users/profile/`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
async function assertLoggedInOrRedirect() {
  try {
    const me = await getMe();
    window.__ME__ = me;
    return true;
  } catch {
    const next = location.pathname + location.search;
    location.replace(`/Annyeong-fe/login/login.html?next=${encodeURIComponent(next)}`);
    return false;
  }
}

/* ---------------- i18n 매핑 ---------------- */
const KEY_TO_I18N = {
  personalities_1: "good_listener",
  personalities_2: "good_humor",
  personalities_3: "fun_talk",
  personalities_4: "positive_mindset",
  personalities_5: "friendly_warm",
  personalities_6: "thoughtful_caring",
  personalities_7: "knowledgeable",
  personalities_8: "curious",
  personalities_9: "understanding",
  personalities_10: "honest_sincere",
  personalities_11: "active_energetic",
  personalities_12: "trustworthy",
};

/* ---------------- UI 주입 헬퍼 ---------------- */
function setName(usernameLike) {
  const nameSlot =
    document.querySelector(".review-w-title #strong-text") ||
    document.querySelector(".review-w-title .strong-text-name");
  if (nameSlot) nameSlot.textContent = `‘ ${usernameLike} ’`;
}

function renderHeaderCounts({ total_reviews = 0, total_personality_selections = 0 }) {
  // (버그 수정) .selected-num 앞에 점 누락돼 있던 부분 보정
  const timesSpan = document.querySelector(".selected-num .times");
  const gray = document.querySelector(".selected-num .gray-text");
if (timesSpan) {
    // 숫자 + "회" (times 요소 안에 넣음)
    timesSpan.textContent = `✔ ${Number(total_personality_selections)}회`;
  }

  if (gray) gray.textContent = ` ${Number(total_reviews)}참여`;
}

function normalizeItems(data) {
  const src = Array.isArray(data?.reviews) ? data.reviews : [];
  return src.map((row) => {
    const key = Object.keys(row).find((k) => k.startsWith("personalities_"));
    const label = key ? row[key] : "";
    const count = Number(row.count || 0);
    return { key, label, count };
  });
}

function renderList(items) {
  const listEl = document.getElementById("reviewList");
  if (!listEl) return;
  listEl.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "표시할 리뷰가 없습니다.";
    listEl.appendChild(li);
    return;
  }

  const max = Math.max(...items.map((i) => i.count), 1);

  items.forEach((it) => {
    const li = document.createElement("li");

    // 번역 텍스트
    const labelSpan = document.createElement("span");
    labelSpan.className = "review-label";
    const i18nKey = KEY_TO_I18N[it.key] || null;
    if (i18nKey) {
      labelSpan.setAttribute("data-i18n-key", i18nKey);
      // 기본 텍스트(원문 라벨)를 넣고, 아래 setLanguage로 DOM 번역 재적용
      labelSpan.textContent = `"${it.label}"`;
    } else {
      labelSpan.textContent = `"${it.label}"`;
    }

    const countSpan = document.createElement("span");
    countSpan.className = "review-count";
    countSpan.textContent = it.count;

    const pct = (it.count / max) * 85; // 막대 길이
    li.style.setProperty("--w", pct + "%");

    li.appendChild(document.createTextNode(" "));
    li.appendChild(labelSpan);
    li.appendChild(countSpan);
    listEl.appendChild(li);
  });

  // 동적 DOM 번역 재적용
  setLanguage(getLang(), { persist: false });
}

/* ---------------- 초기화 ---------------- */
async function init() {
  try {
    // 0) 필수 파라미터 체크
    if (!Number.isFinite(TARGET_USER_ID) || TARGET_USER_ID <= 0) {
      alert("유효하지 않은 접근입니다. (user_id 누락)");
      history.length > 1 ? history.back() : (location.href = "../home/home.html");
      return;
    }

    // 1) 세션 체크
    const ok = await assertLoggedInOrRedirect();
    if (!ok) return;

    // 2) 사용자 리뷰 요약 로드
    const res = await authedFetch(
      `/reviews/user/${TARGET_USER_ID}/`,
      { method: "GET", headers: { "Content-Type": "application/json" } },
      API_BASE
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`데이터 로드 실패: ${res.status} ${t}`);
    }
    const data = await res.json();

    // 3) 상단 이름: 응답 username > 쿼리 name > 숫자 id
    const uname = data?.username || PRESET_NAME || String(TARGET_USER_ID);
    setName(uname);

    // 4) 카운터 렌더
    renderHeaderCounts({
      total_reviews: data.total_reviews,
      total_personality_selections: data.total_personality_selections,
    });

    // 5) 리스트 렌더
    const items = normalizeItems(data);
    renderList(items);
  } catch (e) {
    console.error(e);
    alert("페이지 로드 중 오류가 발생했습니다.");
  }
}

/* ---------------- 뒤로가기 ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.querySelector(".back-btn");
  if (!backBtn) return;

  backBtn.addEventListener("click", () => {
    const url = new URL(location.href);
    const from = url.searchParams.get("from");       // 'write' 면 리뷰쓰기 경유
    const roomId = url.searchParams.get("roomId");   // fallback 용
    const name = url.searchParams.get("name") || "";
    const backUrl = sessionStorage.getItem("REVIEW_BACK_URL");

    // 1) 리뷰쓰기 경유 or 저장된 복귀 URL → 채팅방으로
    if (from === "write" && backUrl) {
      sessionStorage.removeItem("REVIEW_BACK_URL");
      location.href = backUrl;
      return;
    }
    if (backUrl) {
      sessionStorage.removeItem("REVIEW_BACK_URL");
      location.href = backUrl;
      return;
    }

    // 2) referrer가 review-write가 아니면 그리로
    if (document.referrer && !/review-write\.html/i.test(document.referrer)) {
      location.href = document.referrer;
      return;
    }

    // 3) roomId 있으면 채팅방으로
    if (roomId) {
      location.href = `../chat/chat-room.html?roomId=${roomId}&name=${encodeURIComponent(name)}`;
      return;
    }

    // 4) 마지막: 채팅 리스트
    location.href = `../chat/chat-list.html`;
  });
});

/* ---------------- 시작 ---------------- */
document.addEventListener("DOMContentLoaded", init);
