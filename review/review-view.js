// review/review-view.js
// - 페이지 진입 시 자동 로그인(TEST_USER) → /reviews/user/:id 호출 → 화면 반영
// - 명세: { user_id, total_reviews, total_personality_selections, reviews: [{ personalities_X: "라벨", count }] }

import { API_BASE, DEFAULT_USER_ID, TEST_USER } from "../common/config.js";
import { loginWithSession, authedFetch } from "../common/auth.js";

// 공개 디버그용
window.__REVIEW_RAW__ = null;   // 원본 JSON
window.__REVIEW_ITEMS__ = [];   // {label, count} 정규화 배열

// 뒤로가기
document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.querySelector(".back-btn");
  const before = document.referrer;
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = before || "/";
    });
  }
});

// API 응답 → {label, count} 배열로 변환
function normalizeReviews(apiData) {
  const arr = Array.isArray(apiData?.reviews) ? apiData.reviews : [];
  return arr.map((row) => {
    // personalities_* 키 찾기
    const labelKey = Object.keys(row).find((k) => k !== "count");
    const label = row[labelKey] ?? "";
    const count = Number(row.count ?? 0);
    return { label: String(label), count: Number.isFinite(count) ? count : 0 };
  });
}

// 리스트 렌더
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
    labelSpan.textContent = it.label;

    const countSpan = document.createElement("span");
    countSpan.className = "review-count";
    countSpan.textContent = it.count;

    li.appendChild(labelSpan);
    li.appendChild(countSpan);

    // CSS 막대 폭 (최대 85%)
    const pct = (it.count / max) * 85;
    li.style.setProperty("--w", pct + "%");

    listEl.appendChild(li);
  });
}

// 상단 타이틀/합계 반영
function renderHeaderCounts({ user_id, total_reviews, total_personality_selections }) {
  // HTML 구조상 .strong-text가 2개 있음: [ "'Sonya'님", "✔ 574회" ]
  const strongs = document.querySelectorAll(".strong-text");
  const nameStrong = strongs[0];   // "'Sonya'님" 위치
  const totalSelStrong = strongs[1]; // "✔ 574회" 위치
  const gray = document.querySelector(".gray-text"); // "403회 참여"

  if (nameStrong) {
    nameStrong.textContent = `'${user_id}'님`;
  }
  if (totalSelStrong) {
    totalSelStrong.textContent = `✔ ${Number(total_personality_selections || 0)}회`;
  }
  if (gray) {
    gray.textContent = ` ${Number(total_reviews || 0)}회 참여`;
  }
}

// 페이지 진입: 자동 로그인 → 데이터 로드 → 렌더
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1) 자동 로그인
    await loginWithSession(TEST_USER.username, TEST_USER.password, API_BASE);

    // 2) 데이터 GET
    const userId = DEFAULT_USER_ID; // 필요 시 쿼리스트링 등으로 교체
    const res = await authedFetch(`/reviews/user/${encodeURIComponent(userId)}/`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }, API_BASE);

    if (res.status === 404) {
      const msg = (await res.json().catch(() => null))?.detail || "해당 사용자를 찾을 수 없습니다.";
      throw new Error(msg);
    }
    if (!res.ok) throw new Error(`서버 응답 오류: ${res.status}`);

    const data = await res.json();
    window.__REVIEW_RAW__ = data;

    // 헤더(이름/합계) 갱신
    renderHeaderCounts({
      user_id: data.user_id,
      total_reviews: data.total_reviews,
      total_personality_selections: data.total_personality_selections,
    });

    // 리스트 렌더
    window.__REVIEW_ITEMS__ = normalizeReviews(data);
    renderList(window.__REVIEW_ITEMS__);
  } catch (err) {
    console.error("리뷰 페이지 로드 실패:", err);
    // 화면에도 간단히 표시
    const listEl = document.getElementById("reviewList");
    if (listEl) {
      listEl.innerHTML = "";
      const li = document.createElement("li");
      li.textContent = err?.message || "리뷰 데이터를 불러오지 못했습니다.";
      listEl.appendChild(li);
    }
  }
});
