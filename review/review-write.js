// review-write.js (세션 인증 버전, 자동로그인 제거)
// - 필수 쿼리: roomId (없으면 안내 후 뒤로가기/홈)
// - 세션 가드: /users/profile/ 로 체크 → 미로그인 시 로그인 페이지로 이동(?next=복귀)
// - can-write로 상대 정보/중복 여부 확인 → 이미 작성 시 리뷰보기로 이동
// - 선택항목 최대 5개 → 백엔드 요구 형식(라벨 문자열 배열)으로 POST
// - 성공 후 상대 리뷰보기로 이동 (user_id, roomId, name 전달)

import { API_BASE } from "../common/config.js";
import { authedFetch } from "../common/auth.js";

/* ------------------ 쿼리 파라미터 ------------------ */
const qs = new URLSearchParams(location.search);
const ROOM_ID = Number(qs.get("roomId"));     // ★ 필수
const PRESET_USER_ID = qs.get("userId");      // 선택 (없어도 can-write에서 제공)
const PRESET_NAME = decodeURIComponent(qs.get("name") || "");

/* ------------------ DOM ------------------ */
const $options = document.querySelectorAll("#options .opt");
const $counter = document.querySelector(".selCounter");
const $done = document.getElementById("review-send-btn");
const MAX = 5;
const selected = new Set();

/* ------------------ 세션 가드 ------------------ */
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

/* ------------------ 표시 이름 ------------------ */
function setDisplayName(name) {
  const line = document.querySelector("#review-w-title .strong-text");
  if (line) line.textContent = `‘ ${name}’ `;
}

/* ------------------ 라벨 매핑 ------------------ */
// 옵션 id -> 백엔드 라벨(따옴표/이모지 제거된 순수 한국어 문구)
const LABEL_MAP = {
  1: "이야기를 잘 들어줘요",
  2: "유머 감각이 뛰어나요",
  3: "대화가 재미있어요",
  4: "긍정적인 마인드예요",
  5: "친근하고 따뜻해요",
  6: "배려심이 깊어요",
  7: "지식이 풍부해요",
  8: "호기심이 많아요",
  9: "이해심이 많아요",
  10: "정직하고 솔직해요",
  11: "적극적이고 활발해요",
  12: "신뢰할 수 있어요",
};

/* ------------------ UI 제어 ------------------ */
function updateCounter() {
  if ($counter) $counter.textContent = String(selected.size);
  if ($done) $done.disabled = selected.size === 0;
}
$options.forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = Number(btn.dataset.id);
    const willSelect = !selected.has(id);

    if (willSelect && selected.size >= MAX) {
      btn.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 200 }
      );
      return;
    }

    if (willSelect) {
      selected.add(id);
      btn.dataset.checked = "true";
    } else {
      selected.delete(id);
      btn.dataset.checked = "false";
    }
    updateCounter();
  });
});

/* ------------------ 네비 ------------------ */
function goReviewView({ userId, roomId, name }) {
  const url = new URL("../review/review-view.html", location.href);
  url.searchParams.set("user_id", String(userId));
  if (roomId != null) url.searchParams.set("roomId", String(roomId));
  if (name) url.searchParams.set("name", name);
  location.href = url.toString();
}

/* ------------------ 초기화 ------------------ */
async function init() {
  try {
    // 0) 필수 파라미터
    if (!Number.isFinite(ROOM_ID) || ROOM_ID <= 0) {
      alert("유효하지 않은 접근입니다. (roomId 누락)");
      history.length > 1 ? history.back() : (location.href = "../home/home.html");
      return;
    }

    // 1) 세션 체크 (미로그인 → 로그인으로 이동)
    const ok = await assertLoggedInOrRedirect();
    if (!ok) return;

    // 2) can-write 사전 조회 (상대정보/중복여부)
    const r = await authedFetch(
      `/reviews/can-write/${ROOM_ID}/`,
      { method: "GET" },
      API_BASE
    );

    // 인증 만료/미로그인 방어
    if (r.status === 401 || r.status === 403) {
      const next = location.pathname + location.search;
      location.replace(`/Annyeong-fe/login/login.html?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      throw new Error(`사전 조회 실패: ${r.status} ${msg}`);
    }

    const info = await r.json(); // { other_user_id, other_user_name, already_reviewed, ... }

    // 3) 대상 이름 표시
    const displayName =
      (PRESET_NAME && PRESET_NAME.trim()) || info.other_user_name || "상대";
    setDisplayName(displayName);

    // 4) 이미 작성했으면 바로 리뷰보기
    if (info.already_reviewed) {
      alert("이미 후기를 작성했습니다. 리뷰보기로 이동합니다.");
      goReviewView({
        userId: info.other_user_id,
        roomId: ROOM_ID,
        name: info.other_user_name || displayName,
      });
      return;
    }

    // 5) 저장 버튼
    $done?.addEventListener("click", async () => {
      try {
        if (selected.size === 0) {
          alert("최소 1개 이상 선택해 주세요.");
          return;
        }

        // 선택 id → 라벨 문자열 배열
        const labels = Array.from(selected)
          .filter((n) => LABEL_MAP[n])
          .map((n) => LABEL_MAP[n]);

        // POST
        const res = await authedFetch(
          `/reviews/create/${ROOM_ID}/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personalities: labels }),
          },
          API_BASE
        );

        if (res.status === 401 || res.status === 403) {
          const next = location.pathname + location.search;
          location.replace(`/Annyeong-fe/login/login.html?next=${encodeURIComponent(next)}`);
          return;
        }

        if (res.status === 400) {
          // 이미 작성한 케이스 등
          const j = await res.json().catch(() => ({}));
          if (j?.already_reviewed) {
            alert("이미 후기를 작성하셨습니다. 리뷰보기로 이동합니다.");
            goReviewView({
              userId: info.other_user_id,
              roomId: ROOM_ID,
              name: info.other_user_name || displayName,
            });
            return;
          }
          throw new Error(j?.detail || "요청이 올바르지 않습니다.");
        }

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`리뷰 저장 실패: ${res.status} ${t}`);
        }

        // 성공 → 리뷰보기 이동
        const saved = await res.json().catch(() => ({}));
        alert("후기가 저장되었습니다.");
        goReviewView({
          userId: saved.reviewed_user_id || info.other_user_id,
          roomId: ROOM_ID,
          name: saved.reviewed_user_name || info.other_user_name || displayName,
        });
      } catch (e) {
        console.error(e);
        alert(e?.message || "후기 저장 중 오류가 발생했습니다.");
      }
    });

    // 초기 카운터
    updateCounter();
  } catch (err) {
    console.error(err);
    alert("페이지 로드 중 오류가 발생했습니다.");
  }
}

/* ------------------ 뒤로가기 버튼 ------------------ */
// - 기본: 이 방의 채팅방으로
// - referrer가 review-view였다면 루프 방지로 채팅방으로
// - 최후: 채팅 리스트
document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.querySelector(".back-btn");
  if (!backBtn) return;

  const chatBackUrl =
    `../chat/chat-room.html?roomId=${ROOM_ID}&name=${encodeURIComponent(PRESET_NAME || "")}`;

  try {
    sessionStorage.setItem("REVIEW_BACK_URL", chatBackUrl);
  } catch {}

  backBtn.addEventListener("click", () => {
    try {
      const saved = sessionStorage.getItem("REVIEW_BACK_URL");
      if (saved) {
        sessionStorage.removeItem("REVIEW_BACK_URL");
        location.href = saved;
        return;
      }
    } catch {}

    if (document.referrer && !/review-view\.html/i.test(document.referrer)) {
      location.href = document.referrer;
      return;
    }

    if (ROOM_ID) {
      location.href = chatBackUrl;
      return;
    }

    location.href = "../chat/chat-list.html";
  });
});

/* ------------------ 시작 ------------------ */
document.addEventListener("DOMContentLoaded", init);
