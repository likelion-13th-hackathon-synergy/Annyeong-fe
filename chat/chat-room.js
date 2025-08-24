// - HTML 구조/클래스/ID는 그대로 사용
// - 기능: 제목/배너 이름 주입, 초기 메시지 로드+읽음, 번역 토글(내/상대 모두), WS 실시간 수신, 수락/거절 처리
// - 이미지 업로드: 낙관 렌더 1개만 그리고 응답 오면 같은 말풍선의 src/href 교체(중복 방지)
// - 엔드포인트: accept/decline/mark_read/translate/upload-image 백엔드 urls.py에 맞춤

import { API_BASE, TEST_USER, TEST_AS, DEFAULT_PROFILE_IMG } from "../common/config.js";
import { loginWithSession, authedFetch } from "../common/auth.js";
import { $, onReady, escapeHTML, toTime, scrollToBottom } from "./dom.js";

/* ------------------ URL 파라미터 ------------------ */
const params = new URL(location.href).searchParams;
const chatId = Number(params.get("roomId"));              // 채팅방 ID
const otherName = decodeURIComponent(params.get("name") || "상대");
let isAccepted = params.get("accepted") === "1";            // 쿼리로 수락 상태 받은 경우만 true
let __roomPollTimer__ = null;
const SEEN_MSG_KEYS = new Set();   // 중복 방지
let LAST_SEEN_AT = null;           // ISO string
let LAST_SEEN_ID = null;           // 백엔드가 id 제공 시
let __OTHER_USER__ = null;
/* ------------------ DOM ------------------ */
const listEl = $("#messages");
const inputEl = $("#msg-input");
const sendBtn = $("#send-btn");
const fileInput = $("#file-input");
const attachBtn = $("#attach-btn");
const bannerEl = $("#invite-banner");
const btnAccept = $("#btn-accept");
const btnDecline = $("#btn-decline");
const wrapperEl = $("#chat-wrapper");
const titleEl = $("#chat-title");
const inviteName = $("#invite-name");
const menuBtn = document.getElementById("chat-menu-btn");

const CURRENT_USER = TEST_USER.username;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
// --- 내 메시지 중복 방지(텍스트) ---
const PENDING_TEXTS = []; // [{content: string, at: number}]
const PENDING_WINDOW_MS = 5000; // 5초 안에 같은 내용이 재도착하면 중복으로 간주
function prunePending() {
  const now = Date.now();
  while (PENDING_TEXTS.length && now - PENDING_TEXTS[0].at > PENDING_WINDOW_MS) {
    PENDING_TEXTS.shift();
  }
}
function isPendingText(content) {
  prunePending();
  const norm = (content || "").trim();
  return PENDING_TEXTS.some(p => p.content === norm);
}
function addPendingText(content) {
  prunePending();
  PENDING_TEXTS.push({ content: (content || "").trim(), at: Date.now() });
}
if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    // 프론트 정적 페이지로 이동 (이 페이지에서 실제 POST는 백엔드 /reviews/create/<chat_room_id>/ 로 보냄)
    const q = new URLSearchParams({
      roomId: String(chatId),
      userId: String(__OTHER_USER__?.id || ""),
      name: __OTHER_USER__?.name || otherName
    }).toString();
    location.href = `../review/review-write.html?${q}`;
  });
}
/* ------------------ 유틸 ------------------ */
function resolveAvatar(url) {
  if (!url) return DEFAULT_PROFILE_IMG;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}
function resolveMedia(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}
function setTitleAndBannerName() {
  if (titleEl) titleEl.textContent = otherName;
  if (inviteName) inviteName.textContent = otherName;
}
function isImageFile(file) {
  if (!file) return false;
  if (file.type && ALLOWED_MIME.has(file.type)) return true;
  const name = (file.name || '').toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/.test(name);
}
function dataURLtoBlob(dataURL) {
  const [meta, b64] = dataURL.split(',');
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'application/octet-stream';
  const bin = atob(b64);
  const len = bin.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}
function notifyListUpdate(payload) {
  try {
    window.dispatchEvent(new CustomEvent("chat:room-updated", {
      detail: {
        roomId: chatId,
        content: payload.content || "",
        created_at: payload.created_at || new Date().toISOString(),
        // 리스트에서 비교할 때 username을 쓰고 있어서 username을 확실히 넣어줌
        sender: { username: (window.__ME__?.username || CURRENT_USER) }
      }
    }));
  } catch { }
}

async function compressImage(file, { maxDim = 1280, quality = 0.8 } = {}) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  let { width, height } = img;
  const ratio = Math.min(1, maxDim / Math.max(width, height));
  const dw = Math.round(width * ratio);
  const dh = Math.round(height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = dw; canvas.height = dh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, dw, dh);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, width: dw, height: dh, mime: 'image/jpeg' };
}

// 텍스트 메시지 영속 저장(REST)
async function createTextMessage(chatroomId, content) {
  const form = new FormData();
  form.append("chatroom", chatroomId);
  form.append("content", content);

  const res = await authedFetch(
    `/api/chat/messages/`,
    {
      method: "POST",
      body: form
    },
    API_BASE
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`메시지 저장 실패: ${res.status} ${t}`);
  }
  return await res.json();
}

// ===== 날짜 디바이더 유틸 =====
let __LAST_DIVIDER_YMD__ = null;

function pad(n) { return String(n).padStart(2, "0"); }
function ymdKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatKoreanDate(d) {
  const yoil = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${yoil}요일`;
}

function maybeInsertDateDivider(dateObj) {
  const key = ymdKey(dateObj);
  if (key === __LAST_DIVIDER_YMD__) return;

  __LAST_DIVIDER_YMD__ = key;

  const li = document.createElement("li");
  li.className = "date-divider";
  li.innerHTML = `
    <span class="pill">
      <span class="cal">
        <!-- 작은 달력 아이콘 (SVG) -->
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v12a2
                   2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12
                   8H5v8a0 0 0 0 0 0 0h14a0 0 0 0 0 0 0v-8ZM19 6H5v2h14V6Z"/>
        </svg>
      </span>
      <span>${formatKoreanDate(dateObj)}</span>
    </span>
  `;
  listEl.appendChild(li);
}


/* ------------------ 입력/배너 상태 ------------------ */
function applyAcceptState(on) {
  [inputEl, sendBtn, attachBtn, fileInput].forEach(el => { if (el) el.disabled = !on; });
  if (!bannerEl) return;
  if (on) {
    bannerEl.hidden = true;
    bannerEl.style.display = "none";
    bannerEl.setAttribute("aria-hidden", "true");
  } else {
    bannerEl.hidden = false;
    bannerEl.style.display = "";
    bannerEl.removeAttribute("aria-hidden");
  }
}

/* ------------------ 렌더 ------------------ */
function renderMessage({ message, sender = "unknown", timestamp, avatar, translatedHint, imageUrl }) {

  const when = timestamp ? new Date(timestamp) : new Date();
  maybeInsertDateDivider(when);

  const isMe = sender === CURRENT_USER;
  const li = document.createElement("li");
  li.className = `msg ${isMe ? "me" : "other"}`;

  const avatarHtml = !isMe
    ? `<img class="avatar" src="${escapeHTML(resolveAvatar(avatar))}" alt="${escapeHTML(sender)}" />`
    : "";
  const nameHtml = !isMe ? `<div class="name">${escapeHTML(sender)}</div>` : "";

  let bodyHtml = "";
  if (imageUrl) {
    const fixed = resolveMedia(imageUrl);
    bodyHtml = `
      <div class="bubble">
        <a class="img-link" href="${escapeHTML(fixed)}" target="_blank" rel="noopener noreferrer">
          <img class="img-msg" src="${escapeHTML(fixed)}" alt="image" />
        </a>
        <span class="tail">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="14" viewBox="0 0 13 14" fill="none">
            <path d="M1.63227 1.2761C5.91261 3.11151 10.0495 4.18948 11.8179 3C11.8179 3 10.6358 15.3683 9.0679 12.9342C7.56627 10.6029 4.29243 5.91811 1.38292 1.57308C1.27146 1.40664 1.44817 1.19716 1.63227 1.2761Z" fill="white" stroke="white"/>
          </svg>
        </span>
      </div>`;
  } else {
    const originalText = String(message ?? "");
    const translatedStr = translatedHint ? String(translatedHint) : "";
    bodyHtml = `
      <div class="bubble" data-state="orig"
           data-original="${escapeHTML(originalText)}"
           data-translated="${escapeHTML(translatedStr)}">
        <div class="text">${escapeHTML(originalText)}</div>
        <div class="actions"><button type="button" class="translate">번역보기</button></div>
        <span class="tail">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="14" viewBox="0 0 13 14" fill="none">
            <path d="M1.63227 1.2761C5.91261 3.11151 10.0495 4.18948 11.8179 3C11.8179 3 10.6358 15.3683 9.0679 12.9342C7.56627 10.6029 4.29243 5.91811 1.38292 1.57308C1.27146 1.40664 1.44817 1.19716 1.63227 1.2761Z" fill="white" stroke="white"/>
          </svg>
        </span>
      </div>`;
  }

  li.innerHTML = `
    ${avatarHtml}
    <div style="display:flex;flex-direction:column;gap:4px;max-width:80%;">
      ${nameHtml}
      ${bodyHtml}
    </div>
    <div class="meta">${toTime(when)}</div>
  `;

  // 텍스트 메시지 번역 토글(내 메시지 포함)
  if (!imageUrl) {
    const bubble = li.querySelector(".bubble");
    const btn = bubble?.querySelector(".translate");
    btn?.addEventListener("click", async () => toggleTranslate(bubble));
  }

  listEl.appendChild(li);
  scrollToBottom(wrapperEl);
  return li; // ← 낙관 렌더 업데이트를 위해 반환
}

/* ------------------ 번역 토글 ------------------ */
async function toggleTranslate(bubbleEl) {
  if (!bubbleEl) return;
  const textEl = bubbleEl.querySelector(".text");
  const btn = bubbleEl.querySelector(".translate");
  const state = bubbleEl.dataset.state || "orig";
  const original = bubbleEl.dataset.original ?? "";
  let translated = bubbleEl.dataset.translated ?? "";

  if (state === "orig") {
    if (!translated) {
      try {
        const res = await authedFetch(
          `/api/chat/translate/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: original }),
          },
          API_BASE
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        translated = data?.translated_text || "";
        bubbleEl.dataset.translated = translated;
      } catch {
        return;
      }
    }
    textEl.textContent = translated || original;
    bubbleEl.dataset.state = "translated";
    if (btn) btn.textContent = "원문보기";
  } else {
    textEl.textContent = original;
    bubbleEl.dataset.state = "orig";
    if (btn) btn.textContent = "번역보기";
  }
}

/* ------------------ 메시지/읽음 ------------------ */
async function loadMessages() {
  try {
    const res = await authedFetch(
      `/api/chat/messages/?chatroom=${chatId}`,
      { method: "GET" },
      API_BASE
    );
    if (!res.ok) throw new Error("메시지 로드 실패");
    const msgs = await res.json();

    listEl.innerHTML = "";
    msgs.forEach(m => {
      // 중복방지 키(가능하면 메시지 id가 가장 좋음)
      const key = String(m.id ?? `${m.created_at}|${m.sender?.username}|${m.content || ""}|${m.image || ""}`);
      SEEN_MSG_KEYS.add(key);

      renderMessage({
        message: m.content,
        sender: m.sender?.username || "unknown",
        timestamp: m.created_at,
        avatar: m.sender?.profile_image,
        translatedHint: m.translated_content || "",
        imageUrl: m.image ? resolveMedia(m.image) : null,
      });
    });
    // 마지막 기준점 기록
    if (msgs.length) {
      const last = msgs[msgs.length - 1];
      LAST_SEEN_AT = last.created_at || new Date().toISOString();
      LAST_SEEN_ID = last.id ?? null;
    }
    // 읽음 처리
    await authedFetch(
      `/api/chat/chatrooms/${chatId}/mark_read/`,
      { method: "POST" },
      API_BASE
    );

    // 배너 노출 조건: 미수락 && 과거 메시지 0개일 때만
    if (!isAccepted && msgs.length === 0) {
      applyAcceptState(false);     // 입력 비활성 + 배너 표시
    } else {
      applyAcceptState(true);      // 입력 활성 + 배너 숨김
    }
  } catch {
    // 실패해도 UI는 건드리지 않음
  }
}

// 로그인 사용자가 참여 중인 chatId의 상태 + 내 역할 계산(강건판)
async function fetchRoomState(chatroomId) {
  const res = await authedFetch(`/api/chat/chatrooms/`, { method: "GET" }, API_BASE);
  if (!res.ok) throw new Error("채팅방 목록 조회 실패");
  const list = await res.json();
  const room = Array.isArray(list) ? list.find(r => Number(r.id) === Number(chatroomId)) : null;

  if (!room) {
    console.warn("[room-state] 방 없음 or 권한 없음", { chatroomId });
    return { exists: false, is_active: false, iAmRequester: false, iAmReceiver: false, room: null };
  }

  const otherId = room.other_participant?.id;
  const requesterId = room.requester?.id;
  const receiverId = room.receiver?.id;

  let iAmRequester = (otherId === receiverId);
  let iAmReceiver = (otherId === requesterId);

  const me = TEST_USER?.username;
  if (!(iAmRequester || iAmReceiver) && me) {
    if (room.requester?.username === me) iAmRequester = true;
    if (room.receiver?.username === me) iAmReceiver = true;
  }
  if (iAmRequester && iAmReceiver) {
    iAmRequester = !!(room.requester?.username === me);
    iAmReceiver = !!(room.receiver?.username === me);
  } else if (!iAmRequester && !iAmReceiver && me) {
    iAmRequester = !!(room.requester?.username === me);
    iAmReceiver = !!(room.receiver?.username === me);
  }

  return {
    exists: true,
    is_active: !!room.is_active,
    iAmRequester,
    iAmReceiver,
    room,
  };
}

/* ------------------ 업로드 (낙관 렌더 1개만) ------------------ */
async function sendImageOrTextViaREST({ text, fileOrBlob, filename }) {
  const form = new FormData();
  form.append("chatroom", chatId);
  if (text) form.append("content", text);
  if (fileOrBlob) form.append("image", fileOrBlob, filename || "image.jpg");

  const res = await authedFetch(`/api/chat/upload-image/`, { method: "POST", body: form }, API_BASE);
  if (!res.ok) throw new Error("upload failed");
  return await res.json(); // 렌더는 호출한 쪽에서
}
async function sendImageFile(file) {
  if (!isAccepted) { renderSystem('대화를 수락하면 이미지를 보낼 수 있어요.'); return; }
  if (!isImageFile(file)) { renderSystem('이미지 파일만 업로드 가능합니다.'); return; }

  const { dataUrl } = await compressImage(file);
  const blob = dataURLtoBlob(dataUrl);

  // 1) 낙관 렌더 1개
  const li = renderMessage({
    sender: CURRENT_USER,
    timestamp: Date.now(),
    imageUrl: dataUrl
  });

  try {
    // 2) 서버 업로드
    const msg = await sendImageOrTextViaREST({ fileOrBlob: blob, filename: file.name });
    const real = resolveMedia(msg.image);
    // ... img/src 교체 코드 ...
    notifyListUpdate({
      content: "",          // 이미지는 미리보기 문구로 대체되므로 빈 문자열
      created_at: msg?.created_at || new Date().toISOString()
    });
    // 3) 같은 말풍선의 img/src/href만 교체 → 중복 렌더 방지
    const img = li.querySelector("img.img-msg");
    const a = li.querySelector("a.img-link");
    if (img && real) img.src = real;
    if (a && real) a.href = real;
  } catch {
    // 실패 시 낙관 썸네일 유지(필요하면 안내 렌더)
  }
}

/* ------------------ 번역/전송/WS ------------------ */
async function sendText(text) {

  const payload = {
    // 서버 Consumer가 기대하는 키 이름
    message: text,
    sender_id: window.__ME__?.id,   // 아래 3) 참고. 로그인 후 내 id 보관
    translated_content: null
  };
  // 1) 실시간 전파(WS가 열려 있으면)
  if (ws && wsReady && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  } else {
    await sendImageOrTextViaREST({ text });
  }

  // 2) 영속 저장(항상 시도)  ← 핵심!
  //    실패해도 UI는 유지하지만 콘솔에 오류 출력
  try {
    const saved = await createTextMessage(chatId, text);
    notifyListUpdate({
      content: text,
      created_at: saved?.created_at || new Date().toISOString()
    });
    // 원하면 낙관렌더 말풍선의 meta를 서버 시간으로 업데이트 가능:
    // 마지막 말풍선 찾아 시간 교체 등 (선택)
  } catch (e) {
    console.error(e);
  }
}

function sendCurrentInput() {
  const text = (inputEl?.value || "").trim();
  if (!text) return;
  if (!isAccepted) {
    renderSystem("대화를 수락하면 메시지를 보낼 수 있어요.");
    return;
  }
  // 방금 보낸 텍스트 기억 (중복 렌더 억제용)
  addPendingText(text);
  // 낙관 렌더: 바로 말풍선 그리기 (내 메시지도 번역 토글됨)
  const li = renderMessage({
    message: text,
    sender: CURRENT_USER,
    timestamp: new Date().toISOString(),
  });
  // 중복 방지 키 선등록 (id는 아직 없으니 time+sender+content 사용)
  const key = `${new Date().toISOString()}|${CURRENT_USER}|${text}`;
  SEEN_MSG_KEYS.add(key);
  // 실시간 전송 + DB 저장
  sendText(text);

  inputEl.value = "";
}

/* ------------------ WebSocket ------------------ */
let ws = null;
let wsReady = false;
let wsRetry = 0;

const WS_BASE = API_BASE.replace(/^http/i, "ws");
const WS_URL = `${WS_BASE}/ws/chat/${chatId}/`;

function connectWS() {
  try { ws = new WebSocket(WS_URL); } catch { scheduleReconnect(); return; }

  ws.onopen = () => { wsReady = true; wsRetry = 0; document.body.classList.add("ws-online"); };
  ws.onclose = () => { wsReady = false; document.body.classList.remove("ws-online"); scheduleReconnect(); };
  ws.onerror = () => { /* 조용히 무시 */ };

  ws.onmessage = (evt) => {
    if (!evt.data) return;
    let data; try { data = JSON.parse(evt.data); } catch { return; }

    if (data.type === "message" || data.type === "chat.message" || data.type === "chat.image") {
      // 내가 보낸 텍스트인지 검사 → 중복 차단
      const mine = (data.sender?.username && data.sender.username === (window.__ME__?.username || CURRENT_USER));
      if (mine && typeof data.content === "string" && isPendingText(data.content)) {
        // 중복으로 보고 스킵 (원하면 마지막 말풍선 meta만 갱신 가능)
        return;
      }
      renderMessage({
        message: data.content,
        sender: data.sender?.username || "unknown",
        timestamp: data.created_at || new Date().toISOString(),
        avatar: data.sender?.profile_image,
        translatedHint: data.translated_content || "",
        imageUrl: data.image || null
      });
      return;
    }

    // ② 당신의 Consumer 형태(type 없음, sender=숫자, message/timestamp)
    if (typeof data.message !== "undefined" || typeof data.image !== "undefined") {
      const isImage = !!data.image;
      const mine = String(data.sender) === String(window.__ME__?.id);
      if (mine && !isImage && typeof data.message === "string" && isPendingText(data.message)) {
        return; // 중복 스킵
      }
      renderMessage({
        message: isImage ? "" : (data.message || ""),
        sender: (String(data.sender) === String(window.__ME__?.id)) ? window.__ME__?.username : "other",
        timestamp: data.timestamp,
        avatar: null, // 필요하면 캐시해둔 상대 프로필 URL 주입
        translatedHint: data.translated_content || "",
        imageUrl: isImage ? data.image : null,
      });
      return;
    }
  };
}
function scheduleReconnect() {
  wsRetry = Math.min(wsRetry + 1, 5);
  const delay = Math.min(1000 * 2 ** (wsRetry - 1), 10000);
  setTimeout(connectWS, delay);
}

/* ------------------ 수락/거절 ------------------ */
async function acceptRoom() {
  try {
    const res = await authedFetch(
      `/api/chat/chatrooms/${chatId}/accept/`,
      { method: "POST" },
      API_BASE
    );

    if (res.ok) {
      isAccepted = true;
      applyAcceptState(true);
      await authedFetch(`/api/chat/chatrooms/${chatId}/mark_read/`, { method: "POST" }, API_BASE);
      return;
    }

    // 서버 에러여도 테스트 편의상 UI는 닫아줌
    isAccepted = true;
    applyAcceptState(true);
  } catch {
    isAccepted = true;
    applyAcceptState(true);
  }
}
async function declineRoom() {
  try {
    alert("방이 삭제됩니다.");
    await authedFetch(`/api/chat/chatrooms/${chatId}/decline/`, { method: "POST" }, API_BASE);
  } catch { }
  finally {
    try {
      const key = "DECLINED_ROOM_IDS";
      const ids = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
      ids.add(Number(chatId));
      localStorage.setItem(key, JSON.stringify([...ids]));
    } catch { }
    const reviewUrl = `../review/review-write.html?roomId=${roomId}&name=${encodeURIComponent(otherName)}`;
    location.href = reviewUrl;
  }
}

/* ------------------ 초기화 ------------------ */
onReady(async () => {
  setTitleAndBannerName();
  await loginWithSession(TEST_USER.username, TEST_USER.password, API_BASE);
  try {
    window.__ME__ = await fetchMe(API_BASE);   // { id, username, ...}
  } catch { window.__ME__ = { id: null, username: TEST_USER.username }; }
  // 방 상태
  let state = { exists: false, is_active: false, iAmRequester: false, iAmReceiver: false };
  try {
    state = await fetchRoomState(chatId);
    if (state?.room?.other_participant) {
      __OTHER_USER__ = {
        id: state.room.other_participant.id,
        name: state.room.other_participant.username || state.room.other_participant.real_name || "상대"
      };
    }
  } catch { }

  // 메시지 로드
  let msgCount = 0;
  try {
    const res = await authedFetch(`/api/chat/messages/?chatroom=${chatId}`, { method: "GET" }, API_BASE);
    if (res.ok) {
      const msgs = await res.json();
      msgCount = Array.isArray(msgs) ? msgs.length : 0;

      listEl.innerHTML = "";
      msgs.forEach(m => {
        renderMessage({
          message: m.content,
          sender: m.sender?.username || "unknown",
          timestamp: m.created_at,
          avatar: m.sender?.profile_image,
          translatedHint: m.translated_content || "",
          imageUrl: m.image ? resolveMedia(m.image) : null,
        });
      });

      await authedFetch(`/api/chat/chatrooms/${chatId}/mark_read/`, { method: "POST" }, API_BASE);
    }
  } catch { }

  // 최종 상태 결정
  if (state.exists && state.is_active) {
    isAccepted = true;
    applyAcceptState(true);               // 배너 끔 + 입력 가능
  } else if (state.exists && !state.is_active) {
    isAccepted = false;
    applyAcceptState(false);              // 기본: 입력 비활성
    if (state.iAmRequester) {
      // 내가 요청자 → 배너 숨김, 입력 비활성(초기 자동 메시지 제외)
      bannerEl.hidden = true;
      bannerEl.style.display = "none";
    } else if (state.iAmReceiver) {
      // 내가 수신자 → 배너 표시, 입력 비활성
      bannerEl.hidden = false;
      bannerEl.style.display = "";
    }
  } else {
    isAccepted = false;
    applyAcceptState(false);
  }

  // 이벤트
  sendBtn?.addEventListener("click", sendCurrentInput);
  inputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCurrentInput(); }
  });
  attachBtn?.addEventListener('click', () => {
    if (!isAccepted) { renderSystem('대화를 수락하면 이미지를 보낼 수 있어요.'); return; }
    if (fileInput?.disabled) return;
    fileInput?.click();
  });
  fileInput?.addEventListener("change", async (e) => {
    if (!isAccepted) { e.target.value = ""; return; }
    const file = e.target.files?.[0];
    if (!file) return;
    await sendImageFile(file);
    e.target.value = "";
  });

  btnAccept?.addEventListener("click", acceptRoom);
  btnDecline?.addEventListener("click", declineRoom);

  // WebSocket 연결
  connectWS();
  // --- Polling start (채팅방) ---
  if (!__roomPollTimer__) {
    __roomPollTimer__ = setInterval(pollRoomMessages, 500);
  }
});

/* ------------------ 시스템 메시지 도우미 ------------------ */
function renderSystem(text) { renderMessage({ message: text, sender: "system", timestamp: Date.now() }); }
// 페이지 떠날 때 폴링 정지
window.addEventListener("beforeunload", () => {
  if (__roomPollTimer__) { clearInterval(__roomPollTimer__); __roomPollTimer__ = null; }
});
document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.querySelector(".back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "../chat/chat-list.html";
    });
  }
});
// 탭 가시성에 따라 일시정지/재개
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (__roomPollTimer__) { clearInterval(__roomPollTimer__); __roomPollTimer__ = null; }
  } else {
    if (!__roomPollTimer__) __roomPollTimer__ = setInterval(pollRoomMessages, 1500);
  }
});
async function pollRoomMessages() {
  try {
    const res = await authedFetch(
      `/api/chat/messages/?chatroom=${chatId}`,
      { method: "GET" },
      API_BASE
    );
    if (!res.ok) return; // 조용히 패스
    const msgs = await res.json();
    if (!Array.isArray(msgs) || msgs.length === 0) return;

    // 기준점 이후만 뽑기
    const newer = msgs.filter(m => {
      // 1) id 비교가 가능하면 id 우선
      if (LAST_SEEN_ID != null && m.id != null) return Number(m.id) > Number(LAST_SEEN_ID);
      // 2) 아니면 created_at 비교
      if (LAST_SEEN_AT) return new Date(m.created_at) > new Date(LAST_SEEN_AT);
      return true;
    });

    if (!newer.length) return;

    // 시간 순서대로 오래된 것부터 렌더
    newer.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    for (const m of newer) {
      const key = String(m.id ?? `${m.created_at}|${m.sender?.username}|${m.content || ""}|${m.image || ""}`);
      if (SEEN_MSG_KEYS.has(key)) continue; // 이미 렌더한 건 스킵(WS/낙관렌더 중복 방지)
      SEEN_MSG_KEYS.add(key);
      // 내가 보낸 텍스트면 중복 스킵
      const mine = (m.sender?.username && m.sender.username === (window.__ME__?.username || CURRENT_USER));
      if (mine && typeof m.content === "string" && isPendingText(m.content)) {
        continue;
      }
      renderMessage({
        message: m.content,
        sender: m.sender?.username || "unknown",
        timestamp: m.created_at,
        avatar: m.sender?.profile_image,
        translatedHint: m.translated_content || "",
        imageUrl: m.image ? resolveMedia(m.image) : null,
      });

      // 기준점 업데이트
      LAST_SEEN_AT = m.created_at || LAST_SEEN_AT;
      LAST_SEEN_ID = m.id ?? LAST_SEEN_ID;
    }
  } catch (_) {
    // 네트워크 에러는 조용히 무시
  }
}

