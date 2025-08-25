// chat-list.js (session-guarded, no auto-login)

import { API_BASE, DEFAULT_PROFILE_IMG, TEST_AS } from "../common/config.js";
import { authedFetch } from "../common/auth.js";

/* ---------------- 전역/DOM ---------------- */
const listEl = document.getElementById("chat-list");
const dropdown = document.querySelector(".dropdown");
const selectedTextEl = dropdown?.querySelector(".selected-menu-text");
const selectedSpace = dropdown?.querySelector(".selected-space");
const arrow = document.getElementById("arrow");
const items = Array.from(dropdown?.querySelectorAll(".sub-menu li") || []);
const links = dropdown?.querySelectorAll(".sub-menu a") || [];

/* ---------------- 모드 매핑 ---------------- */
const MODE_MAP = {
  1: "서포터즈",
  2: "구인구직",
  3: "통역",
  4: "언어교환",
  5: "연애/데이팅",
};

let currentMode =
  (document.querySelector(".dropdown .selected-menu-text")?.textContent ||
    "전체").trim();
let __ALL_ROOMS__ = [];
window.__ME__ = null; // 내 정보 (세션 확인 후 세팅)

/* ---------------- 세션 가드 ---------------- */
async function getMe() {
  const base = API_BASE || "";
  const res = await fetch(`${base}/users/profile/`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(String(res.status));
  }
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

/* ---------------- 유틸 ---------------- */
const safe = (v) => (v == null ? "" : String(v));

function resolveImageUrl(url) {
  if (!url) return DEFAULT_PROFILE_IMG;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE || ""}${url}`;
  return url;
}

function formatListTime(isoString, now = new Date()) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";

  const ymdUTC = (dt) => Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const todayUTC = ymdUTC(now);
  const thatUTC = ymdUTC(d);
  const diffDays = Math.round((todayUTC - thatUTC) / 86400000);

  if (diffDays === 0) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "오후" : "오전";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${ampm} ${h12}:${m}`;
  }
  if (diffDays === 1) return "어제";
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  return `${d.getFullYear()}년`;
}

function sortRoomsByLatestNormalized(rooms) {
  return rooms.slice().sort((a, b) => {
    const t1 = new Date(a.updatedAt || 0).getTime();
    const t2 = new Date(b.updatedAt || 0).getTime();
    return t2 - t1;
  });
}

function shallowEqualRoom(a, b) {
  return (
    a.id === b.id &&
    a.last === b.last &&
    a.updatedAt === b.updatedAt &&
    Number(a.unread || 0) === Number(b.unread || 0)
  );
}

/* ---------------- API ---------------- */
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
  if (!Array.isArray(data)) throw new Error("올바르지 않은 응답 형식입니다.");
  return data;
}

/* ---------------- 정규화/렌더 ---------------- */
function normalizeRooms(apiRooms = []) {
  return apiRooms.map((r) => {
    const other = r.other_participant || {};
    const last = r.last_message || {};
    const name = safe(other.username || other.real_name || "알 수 없음");
    const mode = MODE_MAP[r.chat_mode] || "기타";
    const lastText = last?.image
      ? "이미지를 보냈습니다."
      : safe(last?.translated_content || last?.content || "");
    const updatedAt = r.updated_at || last.created_at || null;
    const time = formatListTime(updatedAt);
    const unread = Number(r.unread_count || 0);

    const rawProfile =
      other.profile_image ||
      r.requester?.profile_image ||
      r.receiver?.profile_image ||
      "";
    const profile = resolveImageUrl(rawProfile);

    return { id: r.id, name, mode, last: lastText, time, unread, profile, updatedAt };
  });
}

function renderRooms(rooms) {
  if (!listEl) return;
  listEl.innerHTML = rooms
    .map(
      (r) => `
      <article class="tile" data-id="${r.id}" data-name="${encodeURIComponent(r.name)}">
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

  listEl.querySelectorAll(".tile").forEach((t) => {
    t.addEventListener("click", () => {
      const id = t.dataset.id;
      const nm = t.dataset.name; // encodeURIComponent 적용됨
      location.href = `../chat/chat-room.html?roomId=${id}&name=${nm}&as=${encodeURIComponent(TEST_AS)}`;
    });
  });
}

/* ---------------- 필터/드롭다운 ---------------- */
function getFilteredRooms(mode) {
  if (!mode || mode === "전체") return __ALL_ROOMS__;
  return __ALL_ROOMS__.filter((r) => (r.mode || "").trim() === mode.trim());
}

function refreshMenu() {
  if (!selectedTextEl) return;
  const curr = selectedTextEl.textContent.trim();
  items.forEach((li) => {
    const t = li.textContent.trim();
    li.style.display = t === curr ? "none" : "";
  });
}

function applyFilter(mode) {
  currentMode = (mode || "").trim();
  renderRooms(getFilteredRooms(currentMode));
  refreshMenu();
  connectAllRoomWS();
}

selectedSpace?.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdown?.classList.toggle("show");
  arrow?.classList.toggle("arrow");
});

links.forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    if (!selectedTextEl) return;
    const t = a.textContent.trim();
    if (t !== selectedTextEl.textContent.trim()) {
      selectedTextEl.textContent = t;
      applyFilter(t);
    }
    dropdown?.classList.remove("show");
    arrow?.classList.remove("arrow");
  });
});

document.addEventListener("click", (e) => {
  if (!dropdown?.contains(e.target)) {
    dropdown?.classList.remove("show");
    arrow?.classList.remove("arrow");
  }
});

/* ---------------- 실시간(WS) ---------------- */
const ORIGIN = API_BASE || (location.origin);       // Vite 프록시 사용 시 location.origin == http://localhost:5173
const WS_BASE = ORIGIN.replace(/^http/i, "ws");
const socketMap = new Map();
const retryCount = new Map();

function wsUrlForRoom(roomId) {
  // vite.config.js 에 /ws 프록시가 있어야 함
  return `${WS_BASE}/ws/chat/${roomId}/`;
}

function toLastPreview(payload) {
  const isImage =
    payload?.type === "chat.image" ||
    !!payload?.image ||
    typeof payload?.image_url === "string";
  if (isImage) return "이미지를 보냈습니다.";
  return String(payload?.translated_content || payload?.content || "");
}

function applyRoomUpdate(roomId, payload) {
  const idx = __ALL_ROOMS__.findIndex((r) => Number(r.id) === Number(roomId));
  if (idx < 0) return;

  const room = __ALL_ROOMS__[idx];
  const createdAt = payload?.created_at || new Date().toISOString();
  room.updatedAt = createdAt;
  room.time = formatListTime(createdAt);
  room.last = toLastPreview(payload);

  const from = payload?.sender?.username ?? payload?.sender;
  if (from != null && window.__ME__?.username != null) {
    if (String(from) !== String(window.__ME__?.username)) {
      room.unread = Number(room.unread || 0) + 1;
    }
  }

  __ALL_ROOMS__ = sortRoomsByLatestNormalized(__ALL_ROOMS__);
  renderRooms(getFilteredRooms(currentMode));
}

function connectRoomWS(roomId) {
  if (socketMap.has(roomId)) return;
  let ws;
  try {
    ws = new WebSocket(wsUrlForRoom(roomId));
  } catch {
    scheduleReconnect(roomId);
    return;
  }
  socketMap.set(roomId, ws);

  ws.onopen = () => retryCount.set(roomId, 0);
  ws.onclose = () => {
    socketMap.delete(roomId);
    scheduleReconnect(roomId);
  };
  ws.onerror = () => {};
  ws.onmessage = (evt) => {
    if (!evt.data) return;
    let data;
    try {
      data = JSON.parse(evt.data);
    } catch {
      return;
    }
    const type = data?.type;
    if (type === "message" || type === "chat.message" || type === "chat.image") {
      applyRoomUpdate(roomId, data);
      return;
    }
    if (typeof data.message !== "undefined" || typeof data.image !== "undefined") {
      applyRoomUpdate(roomId, {
        content: data.message,
        image: data.image,
        translated_content: data.translated_content,
        created_at: data.timestamp,
        sender: { username: String(data.sender) },
      });
    }
  };
}

function scheduleReconnect(roomId) {
  const tries = Math.min((retryCount.get(roomId) || 0) + 1, 5);
  retryCount.set(roomId, tries);
  const delay = Math.min(1000 * 2 ** (tries - 1), 10000);
  setTimeout(() => connectRoomWS(roomId), delay);
}

function connectAllRoomWS() {
  __ALL_ROOMS__.forEach((r) => connectRoomWS(r.id));
}

window.addEventListener("beforeunload", () => {
  socketMap.forEach((ws) => {
    try {
      ws.close();
    } catch {}
  });
  socketMap.clear();
  if (__pollTimer__) {
    clearInterval(__pollTimer__);
    __pollTimer__ = null;
  }
});

/* ---------------- 폴링 ---------------- */
let __pollTimer__ = null;

async function pollRooms() {
  try {
    const apiRooms = await fetchChatrooms();
    const normalized = normalizeRooms(apiRooms);
    const sorted = sortRoomsByLatestNormalized(normalized);

    const changed =
      sorted.length !== __ALL_ROOMS__.length ||
      sorted.some((r, i) => !shallowEqualRoom(r, __ALL_ROOMS__[i]));

    if (changed) {
      __ALL_ROOMS__ = sorted;
      renderRooms(getFilteredRooms(currentMode));
      refreshMenu();
    }
  } catch (e) {
    console.warn("[poll] rooms fetch failed", e);
  }
}

/* ---------------- 초기화 ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  // 헤더 로고 → 홈
  const homeBtn = document.querySelector(".main-logo-btn");
  homeBtn?.addEventListener("click", () => {
    location.href = `../home/home.html`;
  });

  // 1) 세션 체크 (미로그인 → 로그인으로 보냄)
  const ok = await assertLoggedInOrRedirect();
  if (!ok) return;

  try {
    const apiRooms = await fetchChatrooms();
    __ALL_ROOMS__ = sortRoomsByLatestNormalized(normalizeRooms(apiRooms));
    renderRooms(getFilteredRooms(currentMode));
    refreshMenu();

    connectAllRoomWS();
    if (!__pollTimer__) __pollTimer__ = setInterval(pollRooms, 1000);
  } catch (err) {
    console.error(err);
    if (listEl) {
      listEl.innerHTML = `<p class="error">채팅방 목록을 불러오지 못했습니다. ${err?.message || ""}</p>`;
    }
  }
});
