// review-view.js
// - 자동 로그인 → /reviews/user/:id 로드
// - 상단 이름: 응답 username, 없으면 쿼리 name, 없으면 숫자 user_id
// - strong-text = total_personality_selections, gray-text = total_reviews

import { API_BASE, TEST_USER } from "../common/config.js";
import { loginWithSession, authedFetch } from "../common/auth.js";

const qs = new URLSearchParams(location.search);
const TARGET_USER_ID = Number(qs.get("user_id"));     // 필수
const ROOM_ID = qs.get("roomId");                     // 선택(되돌아가기 등에 사용)
const PRESET_NAME = decodeURIComponent(qs.get("name") || "");

const EMOJI = {
  personalities_1: "👂",
  personalities_2: "🤩",
  personalities_3: "😆",
  personalities_4: "🌟",
  personalities_5: "🤗",
  personalities_6: "😇",
  personalities_7: "🎓",
  personalities_8: "🧐",
  personalities_9: "🤭",
  personalities_10: "✅",
  personalities_11: "🏃",
  personalities_12: "🔒",
};

function setName(usernameLike) {
  const nameSlot =
    document.querySelector(".review-w-title .who-name") ||
    document.querySelector(".review-w-title .strong-text-name") ||
    document.querySelector(".review-w-title .strong-text");
  if (nameSlot) nameSlot.textContent = `‘ ${usernameLike} ’님`;
}

function renderHeaderCounts({ total_reviews = 0, total_personality_selections = 0 }) {
  const strongs = document.querySelectorAll(".strong-text");
  const strongCount = strongs[1] || strongs[0]; // 안전장치
  const gray = document.querySelector(".gray-text");

  if (strongCount) strongCount.textContent = `✔ ${Number(total_personality_selections)}회`;
  if (gray) gray.textContent = ` ${Number(total_reviews)}회 참여`;
}

function normalizeItems(data) {
  const src = Array.isArray(data?.reviews) ? data.reviews : [];
  return src.map((row) => {
    const key = Object.keys(row).find((k) => k.startsWith("personalities_"));
    const label = key ? row[key] : "";
    const count = Number(row.count || 0);
    return { key, label, count, emoji: EMOJI[key] || "✨" };
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
    const labelSpan = document.createElement("span");
    labelSpan.className = "review-label";
    labelSpan.textContent = `${it.emoji} "${it.label}"`;

    const countSpan = document.createElement("span");
    countSpan.className = "review-count";
    countSpan.textContent = it.count;

    const pct = (it.count / max) * 85;
    li.style.setProperty("--w", pct + "%");

    li.appendChild(labelSpan);
    li.appendChild(countSpan);
    listEl.appendChild(li);
  });
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
  backBtn?.addEventListener("click", () => {
    if (document.referrer) location.href = document.referrer;
    else history.back();
  });
});

document.addEventListener("DOMContentLoaded", init);
