// review/review-write.js
// - TEST_USER 자동 로그인
// - 쿼리: roomId(필수), userId(선택), name(선택)
// - 저장 성공/이미 작성 모두 review-view.html?user_id=<상대ID> 로 이동 (roomId 미포함)

import { API_BASE, TEST_USER } from "../common/config.js";
import { loginWithSession, authedFetch } from "../common/auth.js";

// ----- URL/DOM -----
const qs = new URLSearchParams(location.search);
const roomId = Number(qs.get("roomId"));         // 채팅방 id (POST용)
const hintedUserId = qs.get("userId");           // 상대 id 힌트(없어도 됨)
const hintedName   = decodeURIComponent(qs.get("name") || "상대");

const backRef = document.referrer || "../chat/chat-list.html";
const MAX = 5;
const selected = new Set();

const $titleName  = document.querySelector(".review-w-title .strong-text");
const $counterNum = document.querySelector(".selCounter");
const $done       = document.getElementById("review-send-btn");
const $opts       = document.querySelectorAll("#options .opt");

// 헤더 이름
if ($titleName) $titleName.textContent = `'${hintedName}'님`;

function toast(m){ alert(m); }
function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }

// ----- 자동 로그인 -----
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loginWithSession(TEST_USER.username, TEST_USER.password, API_BASE);
  } catch (e) {
    console.error("[auto login failed]", e);
    toast("로그인 실패");
  }
});

// ----- 카운터/옵션 -----
function updateCounter() {
  if ($counterNum) $counterNum.textContent = String(selected.size);
  if ($done) $done.disabled = selected.size === 0 || !num(roomId);
}
$opts.forEach(btn => {
  btn.addEventListener("click", () => {
    const id = num(btn.dataset.id);
    if (!id) return;

    const willAdd = !selected.has(id);
    if (willAdd && selected.size >= MAX) {
      btn.animate(
        [{transform:"translateX(0)"}, {transform:"translateX(-4px)"}, {transform:"translateX(4px)"}, {transform:"translateX(0)"}],
        {duration:180}
      );
      return;
    }
    if (willAdd) {
      selected.add(id);
      btn.dataset.checked = "true";
    } else {
      selected.delete(id);
      btn.dataset.checked = "false";
    }
    updateCounter();
  });
});
updateCounter();

// ----- 상대 ID 찾기 (userId 쿼리 우선, 없으면 room으로 역조회) -----
async function resolveOtherUserId() {
  const hinted = num(hintedUserId);
  if (hinted) return hinted;
  if (!num(roomId)) return null;

  // 우선 상세 엔드포인트 추정 → 실패 시 목록에서 찾기
  const paths = [
    `/api/chat/chatrooms/${encodeURIComponent(roomId)}/`,
    `/api/chat/chatrooms/`
  ];
  for (const p of paths) {
    try {
      const res = await authedFetch(p, { method:"GET" }, API_BASE);
      if (!res.ok) continue;
      const data = await res.json();
      const room = Array.isArray(data)
        ? data.find(r => Number(r?.id) === Number(roomId))
        : data;

      if (!room) continue;

      // 가장 확실: other_participant.id
      const otherId = room?.other_participant?.id;
      if (num(otherId)) return Number(otherId);

      // 폴백: requester/receiver 중 내가 아닌 쪽
      // (서버 세션 사용자 이름/ID를 모른다 해도, other_participant가 보통 채워짐)
      const reqId = room?.requester?.id;
      const recId = room?.receiver?.id;
      if (num(reqId) && num(recId)) {
        // 힌트가 하나라도 있으면 그 반대편을 반환
        if (hinted && hinted === reqId) return recId;
        if (hinted && hinted === recId) return reqId;
        // 힌트가 없으면 임의로 receiver를 우선
        return Number(recId);
      }
    } catch {}
  }
  return null;
}

// ----- 저장 -----
async function submitReview() {
  if (!num(roomId)) {
    toast("이 페이지는 채팅방에서만 접근할 수 있어요. (roomId 없음)");
    location.replace(backRef);
    return;
  }

  const picked = Array.from(selected).filter(n => n >= 1 && n <= 12);
  if (picked.length === 0) {
    toast("하나 이상 선택해 주세요.");
    return;
  }

  // 상대 ID 확보 (리다이렉트에 필요)
  let otherId = await resolveOtherUserId();
  if (!otherId) {
    // 그래도 못 찾으면 힌트 사용 시도
    otherId = num(hintedUserId);
  }
  if (!otherId) {
    toast("상대 정보를 찾지 못했습니다. 다시 시도해 주세요.");
    return;
  }

  try {
    const res = await authedFetch(
      `/reviews/create/${encodeURIComponent(roomId)}/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalities: picked }),
      },
      API_BASE
    );

    // 성공
    if (res.status === 201) {
      location.replace(`../review/review-view.html?user_id=${encodeURIComponent(otherId)}`);
      return;
    }

    // 실패 사유 파악
    let detail = "";
    try { detail = (await res.json())?.detail || ""; } catch {}
    if (res.status === 400 && /이미 후기를 작성/i.test(detail)) {
      toast("이미 후기를 작성하셨어요. 리뷰보기로 이동합니다.");
      location.replace(`../review/review-view.html?user_id=${encodeURIComponent(otherId)}`);
      return;
    }

    throw new Error(`리뷰 저장 실패: ${res.status} ${detail || ""}`);
  } catch (e) {
    console.error(e);
    toast("후기 저장 중 오류가 발생했습니다.");
  }
}

// ----- 뒤로가기 & 저장 버튼 -----
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".back-btn")?.addEventListener("click", () => {
    location.href = backRef;
  });
  $done?.addEventListener("click", submitReview);
});
