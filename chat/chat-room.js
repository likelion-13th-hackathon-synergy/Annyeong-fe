// chat-room.js (세션 인증 버전, 자동로그인 제거)
// - HTML 구조/클래스/ID는 그대로 사용
// - 기능: 제목/배너 이름 주입, 초기 메시지 로드+읽음, 번역 토글(내/상대 모두),
//         WS 실시간 수신, 수락/거절 처리, 이미지 업로드(낙관 렌더 1개만)
// - 엔드포인트: accept/decline/mark_read/translate/upload-image 등 백엔드 urls.py에 맞춤

import { API_BASE, DEFAULT_PROFILE_IMG } from "../common/config.js";
import { authedFetch } from "../common/auth.js";
import { $, onReady, escapeHTML, toTime, scrollToBottom } from "./dom.js";

/* ------------------ URL 파라미터 ------------------ */
const params = new URL(location.href).searchParams;
const chatId = Number(params.get("roomId"));
const otherName = decodeURIComponent(params.get("name") || "상대");
let isAccepted = params.get("accepted") === "1";

let __roomPollTimer__ = null;
const SEEN_MSG_KEYS = new Set();
let LAST_SEEN_AT = null;
let LAST_SEEN_ID = null;
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

/* ------------------ 세션 & 사용자 ------------------ */
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
    window.__ME__ = me; // {id, username, ...}
    return true;
  } catch {
    const next = location.pathname + location.search;
    location.replace(`/Annyeong-fe/login/login.html?next=${encodeURIComponent(next)}`);
    return false;
  }
}
function meName() {
  return window.__ME__?.username || "me";
}

/* ------------------ 유틸 ------------------ */
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function resolveAvatar(url) {
  if (!url) return DEFAULT_PROFILE_IMG;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE || ""}${url}`;
  return url;
}
function resolveMedia(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE || ""}${url}`;
  return url;
}
function setTitleAndBannerName() {
  if (titleEl) titleEl.textContent = otherName;
  if (inviteName) inviteName.textContent = otherName;
}
function isImageFile(file) {
  if (!file) return false;
  if (file.type && ALLOWED_MIME.has(file.type)) return true;
  const name = (file.name || "").toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/.test(name);
}
function dataURLtoBlob(dataURL) {
  const [meta, b64] = dataURL.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "application/octet-stream";
  const bin = atob(b64);
  const len = bin.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}
function notifyListUpdate(payload) {
  try {
    window.dispatchEvent(
      new CustomEvent("chat:room-updated", {
        detail: {
          roomId: chatId,
          content: payload.content || "",
          created_at: payload.created_at || new Date().toISOString(),
          sender: { username: meName() },
        },
      }),
    );
  } catch {}
}
async function compressImage(file, { maxDim = 1280, quality = 0.8 } = {}) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const dw = Math.round(img.width * ratio);
  const dh = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, dw, dh);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, width: dw, height: dh, mime: "image/jpeg" };
}

/* --------- “방금 보낸 텍스트” 중복 렌더 방지 --------- */
const PENDING_TEXTS = []; // [{content, at}]
const PENDING_WINDOW_MS = 5000;
function prunePending() {
  const now = Date.now();
  while (PENDING_TEXTS.length && now - PENDING_TEXTS[0].at > PENDING_WINDOW_MS) {
    PENDING_TEXTS.shift();
  }
}
function isPendingText(content) {
  prunePending();
  const norm = (content || "").trim();
  return PENDING_TEXTS.some((p) => p.content === norm);
}
function addPendingText(content) {
  prunePending();
  PENDING_TEXTS.push({ content: (content || "").trim(), at: Date.now() });
}

/* ------------------ 날짜 디바이더 ------------------ */
let __LAST_DIVIDER_YMD__ = null;
const yoil = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n) => String(n).padStart(2, "0");
const ymdKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function formatKoreanDate(d) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${yoil[d.getDay()]}요일`;
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
  [inputEl, sendBtn, attachBtn, fileInput].forEach((el) => {
    if (el) el.disabled = !on;
  });
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

  const isMe = sender === meName();
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

  if (!imageUrl) {
    const bubble = li.querySelector(".bubble");
    const btn = bubble?.querySelector(".translate");
    btn?.addEventListener("click", async () => toggleTranslate(bubble));
  }

  listEl.appendChild(li);
  scrollToBottom(wrapperEl);
  return li;
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
          API_BASE,
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

/* ------------------ 메시지 로드/읽음 ------------------ */
async function loadMessages() {
  try {
    const res = await authedFetch(
      `/api/chat/messages/?chatroom=${chatId}`,
      { method: "GET" },
      API_BASE,
    );
    if (!res.ok) throw new Error("메시지 로드 실패");
    const msgs = await res.json();

    listEl.innerHTML = "";
    SEEN_MSG_KEYS.clear();
    __LAST_DIVIDER_YMD__ = null;

    msgs.forEach((m) => {
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

    if (msgs.length) {
      const last = msgs[msgs.length - 1];
      LAST_SEEN_AT = last.created_at || new Date().toISOString();
      LAST_SEEN_ID = last.id ?? null;
    }

    await authedFetch(`/api/chat/chatrooms/${chatId}/mark_read/`, { method: "POST" }, API_BASE);

    if (!isAccepted && msgs.length === 0) {
      applyAcceptState(false);
    } else {
      applyAcceptState(true);
    }
  } catch {
    // 조용히 패스
  }
}

/* ------------------ 방 상태 조회 ------------------ */
async function fetchRoomState(chatroomId) {
  const res = await authedFetch(`/api/chat/chatrooms/`, { method: "GET" }, API_BASE);
  if (!res.ok) throw new Error("채팅방 목록 조회 실패");
  const list = await res.json();
  const room = Array.isArray(list) ? list.find((r) => Number(r.id) === Number(chatroomId)) : null;

  if (!room) {
    return { exists: false, is_active: false, iAmRequester: false, iAmReceiver: false, room: null };
  }

  const me = meName();
  const iAmRequester = room.requester?.username === me;
  const iAmReceiver = room.receiver?.username === me;

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
  return await res.json();
}
async function sendImageFile(file) {
  if (!isAccepted) {
    renderSystem("대화를 수락하면 이미지를 보낼 수 있어요.");
    return;
  }
  if (!isImageFile(file)) {
    renderSystem("이미지 파일만 업로드 가능합니다.");
    return;
  }

  const { dataUrl } = await compressImage(file);
  const blob = dataURLtoBlob(dataUrl);

  // 1) 낙관 렌더
  const li = renderMessage({
    sender: meName(),
    timestamp: Date.now(),
    imageUrl: dataUrl,
  });

  try {
    // 2) 서버 업로드
    const msg = await sendImageOrTextViaREST({ fileOrBlob: blob, filename: file.name });
    const real = resolveMedia(msg.image);

    notifyListUpdate({
      content: "",
      created_at: msg?.created_at || new Date().toISOString(),
    });

    // 3) 같은 말풍선만 교체
    const img = li.querySelector("img.img-msg");
    const a = li.querySelector("a.img-link");
    if (img && real) img.src = real;
    if (a && real) a.href = real;
  } catch {
    // 업로드 실패 시 낙관 썸네일 유지(필요시 안내)
  }
}

/* ------------------ 텍스트 전송 ------------------ */
async function createTextMessage(chatroomId, content) {
  const form = new FormData();
  form.append("chatroom", chatroomId);
  form.append("content", content);

  const res = await authedFetch(`/api/chat/messages/`, { method: "POST", body: form }, API_BASE);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`메시지 저장 실패: ${res.status} ${t}`);
  }
  return await res.json();
}

async function sendText(text) {
  const payload = {
    message: text,
    sender_id: window.__ME__?.id,
    translated_content: null,
  };

  // WS로도 보내보고(열려있으면), REST도 시도
  if (ws && wsReady && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {}
  }
  try {
    const saved = await createTextMessage(chatId, text);
    notifyListUpdate({
      content: text,
      created_at: saved?.created_at || new Date().toISOString(),
    });
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

  addPendingText(text);

  // 낙관 렌더
  const li = renderMessage({
    message: text,
    sender: meName(),
    timestamp: new Date().toISOString(),
  });

  const key = `${new Date().toISOString()}|${meName()}|${text}`;
  SEEN_MSG_KEYS.add(key);

  // 실제 전송
  sendText(text);

  inputEl.value = "";
}

/* ------------------ WebSocket ------------------ */
let ws = null;
let wsReady = false;
let wsRetry = 0;

const ORIGIN = API_BASE || location.origin; // 프록시 사용 시 5173 오리진
const WS_BASE = ORIGIN.replace(/^http/i, "ws");
const WS_URL = `${WS_BASE}/ws/chat/${chatId}/`;

function connectWS() {
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    wsReady = true;
    wsRetry = 0;
    document.body.classList.add("ws-online");
  };
  ws.onclose = () => {
    wsReady = false;
    document.body.classList.remove("ws-online");
    scheduleReconnect();
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

    if (data.type === "message" || data.type === "chat.message" || data.type === "chat.image") {
      const mine = data.sender?.username && data.sender.username === meName();
      if (mine && typeof data.content === "string" && isPendingText(data.content)) {
        return; // 중복 스킵
      }
      renderMessage({
        message: data.content,
        sender: data.sender?.username || "unknown",
        timestamp: data.created_at || new Date().toISOString(),
        avatar: data.sender?.profile_image,
        translatedHint: data.translated_content || "",
        imageUrl: data.image || null,
      });
      return;
    }

    // Consumer가 type 없이 보내는 경우
    if (typeof data.message !== "undefined" || typeof data.image !== "undefined") {
      const isImage = !!data.image;
      const mine = String(data.sender) === String(window.__ME__?.id);
      if (mine && !isImage && typeof data.message === "string" && isPendingText(data.message)) {
        return;
      }
      renderMessage({
        message: isImage ? "" : data.message || "",
        sender: mine ? meName() : "other",
        timestamp: data.timestamp,
        avatar: null,
        translatedHint: data.translated_content || "",
        imageUrl: isImage ? data.image : null,
      });
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
    const res = await authedFetch(`/api/chat/chatrooms/${chatId}/accept/`, { method: "POST" }, API_BASE);
    if (res.ok) {
      isAccepted = true;
      applyAcceptState(true);
      await authedFetch(`/api/chat/chatrooms/${chatId}/mark_read/`, { method: "POST" }, API_BASE);
      return;
    }
    // 에러여도 UI는 일단 열어줌(테스트 편의)
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
  } catch {}
  finally {
    try {
      const key = "DECLINED_ROOM_IDS";
      const ids = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
      ids.add(Number(chatId));
      localStorage.setItem(key, JSON.stringify([...ids]));
    } catch {}
    const reviewUrl = `../review/review-write.html?roomId=${chatId}&name=${encodeURIComponent(otherName)}`;
    location.href = reviewUrl;
  }
}

/* ------------------ 폴링 ------------------ */
async function pollRoomMessages() {
  try {
    const res = await authedFetch(`/api/chat/messages/?chatroom=${chatId}`, { method: "GET" }, API_BASE);
    if (!res.ok) return;
    const msgs = await res.json();
    if (!Array.isArray(msgs) || msgs.length === 0) return;

    const newer = msgs.filter((m) => {
      if (LAST_SEEN_ID != null && m.id != null) return Number(m.id) > Number(LAST_SEEN_ID);
      if (LAST_SEEN_AT) return new Date(m.created_at) > new Date(LAST_SEEN_AT);
      return true;
    });
    if (!newer.length) return;

    newer.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    for (const m of newer) {
      const key = String(m.id ?? `${m.created_at}|${m.sender?.username}|${m.content || ""}|${m.image || ""}`);
      if (SEEN_MSG_KEYS.has(key)) continue;
      SEEN_MSG_KEYS.add(key);

      const mine = m.sender?.username && m.sender.username === meName();
      if (mine && typeof m.content === "string" && isPendingText(m.content)) continue;

      renderMessage({
        message: m.content,
        sender: m.sender?.username || "unknown",
        timestamp: m.created_at,
        avatar: m.sender?.profile_image,
        translatedHint: m.translated_content || "",
        imageUrl: m.image ? resolveMedia(m.image) : null,
      });

      LAST_SEEN_AT = m.created_at || LAST_SEEN_AT;
      LAST_SEEN_ID = m.id ?? LAST_SEEN_ID;
    }
  } catch {
    // 조용히 패스
  }
}

/* ------------------ 초기화 ------------------ */
onReady(async () => {
  // 세션 필수
  const ok = await assertLoggedInOrRedirect();
  if (!ok) return;

  setTitleAndBannerName();

  // 상단 메뉴(리뷰로 이동) 클릭 이벤트
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const q = new URLSearchParams({
        roomId: String(chatId),
        userId: String(__OTHER_USER__?.id || ""),
        name: __OTHER_USER__?.name || otherName,
      }).toString();
      location.href = `../review/review-write.html?${q}`;
    });
  }

  // 방 상태 & 상대 정보
  let state = { exists: false, is_active: false, iAmRequester: false, iAmReceiver: false };
  try {
    state = await fetchRoomState(chatId);
    if (state?.room?.other_participant) {
      __OTHER_USER__ = {
        id: state.room.other_participant.id,
        name: state.room.other_participant.username || state.room.other_participant.real_name || "상대",
      };
    }
  } catch {}

  // 메시지 로드 + 읽음
  await loadMessages();

  // 입력/배너 상태 최종 반영
  if (state.exists && state.is_active) {
    isAccepted = true;
    applyAcceptState(true);
  } else if (state.exists && !state.is_active) {
    isAccepted = false;
    applyAcceptState(false);
    if (state.iAmRequester) {
      bannerEl.hidden = true;
      bannerEl.style.display = "none";
    } else if (state.iAmReceiver) {
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrentInput();
    }
  });
  attachBtn?.addEventListener("click", () => {
    if (!isAccepted) {
      renderSystem("대화를 수락하면 이미지를 보낼 수 있어요.");
      return;
    }
    if (fileInput?.disabled) return;
    fileInput?.click();
  });
  fileInput?.addEventListener("change", async (e) => {
    if (!isAccepted) {
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    await sendImageFile(file);
    e.target.value = "";
  });

  btnAccept?.addEventListener("click", acceptRoom);
  btnDecline?.addEventListener("click", declineRoom);

  // WebSocket 연결 & 폴링 시작
  connectWS();
  if (!__roomPollTimer__) __roomPollTimer__ = setInterval(pollRoomMessages, 1500);
});

/* ------------------ 시스템 메시지 렌더 ------------------ */
function renderSystem(text) {
  renderMessage({ message: text, sender: "system", timestamp: Date.now() });
}

/* ------------------ 정리 ------------------ */
window.addEventListener("beforeunload", () => {
  if (__roomPollTimer__) {
    clearInterval(__roomPollTimer__);
    __roomPollTimer__ = null;
  }
  try {
    ws?.close();
  } catch {}
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (__roomPollTimer__) {
      clearInterval(__roomPollTimer__);
      __roomPollTimer__ = null;
    }
  } else {
    if (!__roomPollTimer__) __roomPollTimer__ = setInterval(pollRoomMessages, 1500);
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.querySelector(".back-btn");
  backBtn?.addEventListener("click", () => {
    window.location.href = "../chat/chat-list.html";
  });
});
