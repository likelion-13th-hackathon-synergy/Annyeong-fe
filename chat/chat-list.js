// - 페이지 로드시 TEST_USER 자동 로그인 → /api/chat/chatrooms/ → 리스트 렌더
// - 프로필 이미지 절대경로 보정(resolveImageUrl) 추가
// - 드롭다운 필터/타일 클릭 이동/헤더 버튼 포함

import { API_BASE, TEST_USER, TEST_AS, DEFAULT_PROFILE_IMG } from "../common/config.js";
import { loginWithSession, authedFetch } from "../common/auth.js";

const listEl = document.getElementById("chat-list");

// 최신순 정렬 (정규화된 객체의 updatedAt 기준)
function sortRoomsByLatestNormalized(rooms) {
  return rooms.slice().sort((a, b) => {
    const t1 = new Date(a.updatedAt || 0).getTime();
    const t2 = new Date(b.updatedAt || 0).getTime();
    return t2 - t1;
  });
}

// 얕은 비교: id/last/updatedAt/unread가 달라졌는지 확인
function shallowEqualRoom(a, b) {
  return (
    a.id === b.id &&
    a.last === b.last &&
    a.updatedAt === b.updatedAt &&
    Number(a.unread || 0) === Number(b.unread || 0)
  );
}
window.addEventListener("chat:room-updated", (e) => {
  const { roomId, content, created_at, sender } = e.detail || {};
  applyRoomUpdate(roomId, {
    content,
    created_at,
    sender
  });
});
let __pollTimer__ = null;

// 주기적으로 목록을 다시 가져와 변경 시에만 렌더
async function pollRooms() {
  try {
    const apiRooms = await fetchChatrooms();
    const normalized = normalizeRooms(apiRooms);
    const sorted = sortRoomsByLatestNormalized(normalized);

    // 길이 다르거나, 순서/핵심필드가 다르면 변경으로 간주
    const changed =
      sorted.length !== __ALL_ROOMS__.length ||
      sorted.some((r, i) => !shallowEqualRoom(r, __ALL_ROOMS__[i]));

    if (changed) {
      __ALL_ROOMS__ = sorted;
      renderRooms(getFilteredRooms(currentMode));
      // 필요하면 메뉴 갱신
      refreshMenu();
    }
  } catch (e) {
    // 네트워크 실패는 무시하고 다음 주기
    console.warn("[poll] rooms fetch failed", e);
  }
}

// 백엔드 chat_mode → 표시 텍스트 매핑 (필요에 맞게 수정)
const MODE_MAP = {
  1: "서포터즈",
  2: "구인구직",
  3: "통역",
  4: "언어교환",
  5: "연애/데이팅",
};

// 안전 문자열
const safe = (v) => (v == null ? "" : String(v));

// 프로필 이미지 URL 보정
function resolveImageUrl(url) {
  if (!url) return DEFAULT_PROFILE_IMG;
  // 이미 절대 URL(http/https)인 경우 그대로
  if (/^https?:\/\//i.test(url)) return url;
  // /로 시작하는 상대 경로면 API_BASE 붙이기 (예: /media/...)
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  // 그 외 상대 경로면 프로젝트 정적 경로로 간주
  return url;
}

// ISO → "오후 2:26"
function formatListTime(isoString, now = new Date()) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";

  // 날짜 단위 비교(자정 기준)
  const ymdUTC = (dt) => Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const todayUTC = ymdUTC(now);
  const thatUTC = ymdUTC(d);
  const diffDays = Math.round((todayUTC - thatUTC) / 86400000);

  // 오늘
  if (diffDays === 0) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "오후" : "오전";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${ampm} ${h12}:${m}`;
  }

  // 어제
  if (diffDays === 1) return "어제";

  // 같은 해(올해)
  if (d.getFullYear() === now.getFullYear()) {
    // 예: 2월 8일 (점 표기 원하면 `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`)
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  // 이전 해
  return `${d.getFullYear()}년`;
}


// API → 렌더용 변환
function normalizeRooms(apiRooms = []) {
  return apiRooms.map((r) => {
    const other = r.other_participant || {};
    const last = r.last_message || {};
    const name = safe(other.username || other.real_name || "알 수 없음");
    const mode = MODE_MAP[r.chat_mode] || "기타";
    const lastText = last?.image ? "이미지를 보냈습니다."
      : safe(last?.translated_content || last?.content || "");
    const updatedAt = r.updated_at || last.created_at || null;
    const time = formatListTime(updatedAt);
    const unread = Number(r.unread_count || 0);

    // 프로필 우선순위: other_participant.profile_image > requester/receiver
    const rawProfile =
      other.profile_image ||
      r.requester?.profile_image ||
      r.receiver?.profile_image ||
      "";

    const profile = resolveImageUrl(rawProfile);

    return { id: r.id, name, mode, last: lastText, time, unread, profile, updatedAt };
  });
}

// 리스트 렌더
function renderRooms(rooms) {
  listEl.innerHTML = rooms
    .map(
      (r) => `
    <article class="tile" data-id="${r.id}" data-name="${encodeURIComponent(
        r.name
      )}">
      <div class="profile">
        <img src="${r.profile}" alt="${r.name} 프로필" class="profile-img">
      </div>
      <div class="chat-info">
        <div class="chat-header">
          <p>
            <span class="name">${r.name}</span>
            <div class="chat-mode-border">
              <span class="chat-mode-text">${r.mode}</span>
            </div>
          </p>
        </div>
        <div class="chat-message">${r.last}</div>
      </div>
      <div class="chat-info2">
        <span class="time">${r.time}</span>
        ${r.unread ? `<span class="badge">${r.unread}</span>` : ""}
      </div>
    </article>`
    )
    .join("");

  // 타일 클릭 → 채팅방 이동
  listEl.querySelectorAll(".tile").forEach((t) => {
    t.addEventListener("click", () => {
      const id = t.dataset.id;
      const nm = t.dataset.name; // encodeURIComponent 이미 적용
      location.href = `../chat/chat-room.html?roomId=${id}&name=${nm}&as=${encodeURIComponent(TEST_AS)}`;
    });
  });
}

/* ---------------- 드롭다운(모드 필터) ---------------- */

const dropdown = document.querySelector(".dropdown");
const selectedTextEl = dropdown.querySelector(".selected-menu-text");
const selectedSpace = dropdown.querySelector(".selected-space");
const arrow = document.getElementById("arrow");
const items = Array.from(dropdown.querySelectorAll(".sub-menu li"));
const links = dropdown.querySelectorAll(".sub-menu a");

// 현재 모드 보관 (초기값: 드롭다운 표시 텍스트)
let currentMode =
  (document.querySelector(".dropdown .selected-menu-text")?.textContent ||
    "전체").trim();

// rooms 캐시
let __ALL_ROOMS__ = [];

// 모드 필터
function getFilteredRooms(mode) {
  if (!mode || mode === "전체") return __ALL_ROOMS__;
  return __ALL_ROOMS__.filter((r) => (r.mode || "").trim() === mode.trim());
}

function applyFilter(mode) {
  currentMode = mode.trim();
  renderRooms(getFilteredRooms(currentMode));
  refreshMenu();
  connectAllRoomWS();
}

function refreshMenu() {
  const curr = selectedTextEl.textContent.trim();
  items.forEach((li) => {
    const t = li.textContent.trim();
    li.style.display = t === curr ? "none" : "";
  });
}

selectedSpace.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdown.classList.toggle("show");
  arrow.classList.toggle("arrow");
});

links.forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    const t = a.textContent.trim();
    if (t !== selectedTextEl.textContent.trim()) {
      selectedTextEl.textContent = t;
      applyFilter(t);
    }
    dropdown.classList.remove("show");
    arrow.classList.remove("arrow");
  });
});

document.addEventListener("click", (e) => {
  if (!dropdown.contains(e.target)) {
    dropdown.classList.remove("show");
    arrow.classList.remove("arrow");
  }
});

/* ---------------- 데이터 로드 ---------------- */

async function fetchChatrooms() {
  const res = await authedFetch(
    `/api/chat/chatrooms/`,
    { method: "GET", headers: { "Content-Type": "application/json" } },
    API_BASE
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error("로그인이 필요합니다.");
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`채팅방 목록 오류: ${res.status} ${txt}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("올바르지 않은 응답 형식입니다.");
  }
  return data;
}
/* ============== 실시간(방 단위 WS) ============== */
const WS_BASE = API_BASE.replace(/^http/i, "ws");
const socketMap = new Map();            // roomId -> WebSocket
const retryCount = new Map();           // roomId -> retry tries (backoff)

function wsUrlForRoom(roomId) {
  return `${WS_BASE}/ws/chat/${roomId}/`;
}

// 이미지면 마지막 메시지 문구 대체
function toLastPreview(payload) {
  const isImage =
    payload?.type === "chat.image" ||
    !!payload?.image ||
    typeof payload?.image_url === "string";
  if (isImage) return "이미지를 보냈습니다.";
  return String(payload?.translated_content || payload?.content || "");
}

// 리스트의 한 방 정보를 갱신하고 재렌더
function applyRoomUpdate(roomId, payload) {
  const idx = __ALL_ROOMS__.findIndex(r => Number(r.id) === Number(roomId));
  if (idx < 0) return; // 목록에 없는 방이면 무시(또는 전체 새로고침)

  const room = __ALL_ROOMS__[idx];

  // 시간/정렬 기준 갱신 (정규화 객체의 updatedAt 사용)
  const createdAt = payload?.created_at || new Date().toISOString();
  room.updatedAt = createdAt;
  room.time = formatListTime(createdAt);

  // 마지막 미리보기 갱신
  room.last = toLastPreview(payload);

  // 안읽음 카운트: 내가 아닌 사람이 보낸 경우만 +1
  const from = payload?.sender?.username ?? payload?.sender;
  if (from != null && window.__ME__?.username != null) {
    if (String(from) !== String(window.__ME__?.username)) {
      room.unread = Number(room.unread || 0) + 1;
    }
  }

  // 이미 정규화된 배열을 다시 normalize하지 말 것!
  __ALL_ROOMS__ = sortRoomsByLatestNormalized(__ALL_ROOMS__);
  renderRooms(getFilteredRooms(currentMode));
}

function connectRoomWS(roomId) {
  // 중복 연결 방지
  if (socketMap.has(roomId)) return;

  const url = wsUrlForRoom(roomId);
  let ws;

  try { ws = new WebSocket(url); }
  catch { scheduleReconnect(roomId); return; }

  socketMap.set(roomId, ws);

  ws.onopen = () => {
    retryCount.set(roomId, 0);
  };

  ws.onclose = () => {
    socketMap.delete(roomId);
    scheduleReconnect(roomId);
  };

  ws.onerror = () => {
    // 조용히 무시
  };

  ws.onmessage = (evt) => {
    if (!evt.data) return;
    let data; try { data = JSON.parse(evt.data); } catch { return; }


    // 서버가 보내는 타입들 기준으로 처리
    // 예: "message", "chat.message", "chat.image"
    const type = data?.type;
    if (type === "message" || type === "chat.message" || type === "chat.image") {
      // payload에 roomId가 없을 수도 있으니 현재 roomId를 사용
      applyRoomUpdate(roomId, data);
      return;
    }

    // ② Consumer 형태(type 없음)
    if (typeof data.message !== "undefined" || typeof data.image !== "undefined") {
      applyRoomUpdate(roomId, {
        content: data.message,
        image: data.image,
        translated_content: data.translated_content,
        created_at: data.timestamp,
        sender: { username: String(data.sender) } // 최소 형태
      });
    }
  };
}

function scheduleReconnect(roomId) {
  const tries = Math.min((retryCount.get(roomId) || 0) + 1, 5);
  retryCount.set(roomId, tries);
  const delay = Math.min(1000 * 2 ** (tries - 1), 10000); // 최대 10초
  setTimeout(() => connectRoomWS(roomId), delay);
}

// 현재 목록에 보이는 모든 방들에 연결
function connectAllRoomWS() {
  __ALL_ROOMS__.forEach(r => connectRoomWS(r.id));
}

// 페이지 떠날 때 정리
window.addEventListener("beforeunload", () => {
  socketMap.forEach(ws => { try { ws.close(); } catch { } });
  socketMap.clear();

  if (__pollTimer__) { clearInterval(__pollTimer__); __pollTimer__ = null; }

});


/* ---------------- 초기화 ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
  // 헤더 로고 → 홈
  const homeBtn = document.querySelector(".main-logo-btn");
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      location.href = `../home/home`;
    });
  }

  try {
    // 자동 로그인(테스트 계정). 세션 인증이 필요 없다면 제거해도 됩니다.
    await loginWithSession(TEST_USER.username, TEST_USER.password, API_BASE);

    // 목록 불러오기
    let apiRooms = await fetchChatrooms();

    __ALL_ROOMS__ = normalizeRooms(apiRooms);

    //최신순 정렬
    __ALL_ROOMS__ = sortRoomsByLatestNormalized(__ALL_ROOMS__);
    renderRooms(getFilteredRooms(currentMode));
    refreshMenu();

    connectAllRoomWS();
    if (!__pollTimer__) {
      __pollTimer__ = setInterval(pollRooms, 1000);
    }
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p class="error">채팅방 목록을 불러오지 못했습니다. ${err?.message || ""
      }</p>`;
  }
});
