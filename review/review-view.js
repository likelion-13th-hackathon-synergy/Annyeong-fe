// - 자동 로그인 → /reviews/user/:id 로드
// - 상단 이름: 응답 username, 없으면 쿼리 name, 없으면 숫자 user_id
// - strong-text = total_personality_selections, gray-text = total_reviews

import { API_BASE, TEST_USER } from "../common/config.js";
import { loginWithSession, authedFetch } from "../common/auth.js";
import { getLang, setLanguage } from "/assets/js/i18n.js";

const qs = new URLSearchParams(location.search);
const TARGET_USER_ID = Number(qs.get("user_id"));     // 필수
const ROOM_ID = qs.get("roomId");                     // 선택(되돌아가기 등에 사용)
const PRESET_NAME = decodeURIComponent(qs.get("name") || "");


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
  personalities_10:"honest_sincere",
  personalities_11:"active_energetic",
  personalities_12:"trustworthy",
};
function setName(usernameLike) {
  const nameSlot =
    document.querySelector(".review-w-title #strong-text") ||
    document.querySelector(".review-w-title .strong-text-name");
  if (nameSlot) nameSlot.textContent = `‘ ${usernameLike} ’`;
}

function renderHeaderCounts({ total_reviews = 0, total_personality_selections = 0 }) {
  const strongs = document.querySelectorAll("selected-num .strong-text");
  const strongCount = strongs[1] || strongs[0]; // 안전장치
  const gray = document.querySelector(".selected-num .gray-text");

  if (strongCount) strongCount.textContent = `✔ ${Number(total_personality_selections)}`;
  if (gray) gray.textContent = ` ${Number(total_reviews)}`;
}

function normalizeItems(data) {
  const src = Array.isArray(data?.reviews) ? data.reviews : [];
  return src.map((row) => {
    const key = Object.keys(row).find((k) => k.startsWith("personalities_"));
    const label = key ? row[key] : "";
    const count = Number(row.count || 0);
    return { key, label, count};
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
      // 기본 텍스트(한국어)를 넣어두고, 아래에서 언어 재적용 시 교체됨
      labelSpan.textContent = `"${it.label}"`;
    } else {
      // 키 없으면 그대로 출력
      labelSpan.textContent = `"${it.label}"`;
    }

    const countSpan = document.createElement("span");
    countSpan.className = "review-count";
    countSpan.textContent = it.count;

    const pct = (it.count / max) * 85;
    li.style.setProperty("--w", pct + "%");

    li.appendChild(document.createTextNode(" "));
    li.appendChild(labelSpan);
    li.appendChild(countSpan);
    listEl.appendChild(li);
  });

  // 동적 DOM에 번역 다시 적용
  setLanguage(getLang(), { persist: false });
}

async function init() {
  try {
    if (!Number.isFinite(TARGET_USER_ID) || TARGET_USER_ID <= 0) {
      alert("유효하지 않은 접근입니다. (user_id 누락)");
      history.length > 1 ? history.back() : (location.href = "../home/home");
      return;
    }

    await loginWithSession(TEST_USER.username, TEST_USER.password, API_BASE);

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

    // 이름 주입 (응답 username > 쿼리 name > 숫자 id)
    const uname = data?.username || PRESET_NAME || String(TARGET_USER_ID);
    setName(uname);

    renderHeaderCounts({
      total_reviews: data.total_reviews,
      total_personality_selections: data.total_personality_selections,
    });

    const items = normalizeItems(data);
    renderList(items);
  } catch (e) {
    console.error(e);
    alert("페이지 로드 중 오류가 발생했습니다.");
  }
}

// 뒤로가기
document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.querySelector(".back-btn");
  if (!backBtn) return;

  backBtn.addEventListener("click", () => {
    const url = new URL(location.href);
    const from   = url.searchParams.get("from");        // 'write' 면 리뷰쓰기 경유
    const roomId = url.searchParams.get("roomId");      // fallback 용
    const name   = url.searchParams.get("name") || "";
    const backUrl = sessionStorage.getItem("REVIEW_BACK_URL");

    // 1) 리뷰쓰기 경유거나, 저장해둔 복귀 URL이 있으면 → 채팅방으로
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

    // 2) 일반 케이스: review-write가 아닌 referrer가 있으면 그리로
    if (document.referrer && !/review-write\.html/i.test(document.referrer)) {
      location.href = document.referrer;
      return;
    }

    // 3) roomId만 있는 경우: 채팅방으로 구성해서 이동
    if (roomId) {
      location.href = `../chat/chat-room.html?roomId=${roomId}&name=${encodeURIComponent(name)}`;
      return;
    }

    // 4) 마지막 fallback: 채팅 리스트
    location.href = `../chat/chat-list.html`;
  });
});



document.addEventListener("DOMContentLoaded", init);
