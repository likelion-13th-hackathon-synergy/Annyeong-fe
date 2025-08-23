// - 페이지 로드시 TEST_USER 자동 로그인 → /api/chat/chatrooms/ → 리스트 렌더
// - 프로필 이미지 절대경로 보정(resolveImageUrl) 추가
// - 드롭다운 필터/타일 클릭 이동/헤더 버튼 포함

import { API_BASE, TEST_USER } from "../common/config.js";
import { loginWithSession, authedFetch } from "../common/auth.js";

const listEl = document.getElementById("chat-list");
// 초기 인사 메시지 심기
async function seedIntroMessageIfNeeded(room, currentUser) {
  // 내가 요청자인데(last_message가 null 이고) 아직 메시지가 없다면
  if (room.requester?.username === currentUser && !room.last_message) {
    try {
      const fd = new FormData();
      fd.append("chatroom", room.id);
      fd.append(
        "content",
        `(요청) 새로운 인연이 시작될까요? ${currentUser} 님이 호감을 표시했어요!`
      );
      await authedFetch(
        `/api/chat/messages/`,
        { method: "POST", body: fd },
        API_BASE
      );
      console.log("초기 메시지 생성:", room.id);
    } catch (e) {
      console.warn("초기 메시지 생성 실패:", e);
    }
  }
}
// 최신순 정렬
function sortRoomsByLatest(rooms) {
  return rooms.slice().sort((a, b) => {
    const t1 = new Date(a.updated_at || 0).getTime();
    const t2 = new Date(b.updated_at || 0).getTime();
    return t2 - t1; // 최신순
  });
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
  if (!url) return "../assets/images/default-profile.png"; // 기본 아바타
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
      : safe(last?.translated_content || last?.content || ""); const time = formatListTime(r.updated_at || last.created_at);
    const unread = Number(r.unread_count || 0);

    // 프로필 우선순위: other_participant.profile_image > requester/receiver
    const rawProfile =
      other.profile_image ||
      r.requester?.profile_image ||
      r.receiver?.profile_image ||
      "";

    const profile = resolveImageUrl(rawProfile);

    return { id: r.id, name, mode, last: lastText, time, unread, profile };
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
      location.href = `../chat/chat-room.html?roomId=${id}&name=${nm}`;
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


    //최신순 정렬
    __ALL_ROOMS__ = normalizeRooms(sortRoomsByLatest(apiRooms));

    renderRooms(getFilteredRooms(currentMode));
    refreshMenu();
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p class="error">채팅방 목록을 불러오지 못했습니다. ${err?.message || ""
      }</p>`;
  }
});
