// - HTML 구조/클래스/ID는 그대로 사용
// - 기능: 제목/배너 이름 주입, 초기 메시지 로드+읽음, 번역 토글(내/상대 모두), WS 실시간 수신, 수락/거절 처리
// - 이미지 업로드: 낙관 렌더 1개만 그리고 응답 오면 같은 말풍선의 src/href 교체(중복 방지)
// - 엔드포인트: accept/decline/mark_read/translate/upload-image 백엔드 urls.py에 맞춤

import { API_BASE, TEST_USER } from "../common/config.js";
import { loginWithSession, authedFetch } from "../common/auth.js";
import { $, onReady, escapeHTML, toTime, scrollToBottom } from "./dom.js";

/* ------------------ URL 파라미터 ------------------ */
const params = new URL(location.href).searchParams;
const chatId = Number(params.get("roomId"));              // 채팅방 ID
const otherName = decodeURIComponent(params.get("name") || "상대");
let isAccepted = params.get("accepted") === "1";            // 쿼리로 수락 상태 받은 경우만 true

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

const CURRENT_USER = TEST_USER.username;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/* ------------------ 유틸 ------------------ */
function resolveAvatar(url) {
  if (!url) return "../assets/images/chat/profile_default.png";
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
      renderMessage({
        message: m.content,
        sender: m.sender?.username || "unknown",
        timestamp: m.created_at,
        avatar: m.sender?.profile_image,
        translatedHint: m.translated_content || "",
        imageUrl: m.image ? resolveMedia(m.image) : null,
      });
    });

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
  // 1) 실시간 전파(WS가 열려 있으면)
  if (ws && wsReady && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "message", chatroom: chatId, content: text }));
  }

  // 2) 영속 저장(항상 시도)  ← 핵심!
  //    실패해도 UI는 유지하지만 콘솔에 오류 출력
  try {
    const saved = await createTextMessage(chatId, text);
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

  // 낙관 렌더: 바로 말풍선 그리기 (내 메시지도 번역 토글됨)
  renderMessage({
    message: text,
    sender: CURRENT_USER,
    timestamp: new Date().toISOString(),
  });

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

    if (data.type === "message" || data.type === "chat.message") {
      renderMessage({
        message: data.content,
        sender: data.sender?.username || "unknown",
        timestamp: data.created_at || new Date().toISOString(),
        avatar: data.sender?.profile_image,
        translatedHint: data.translated_content || "",
      });
      return;
    }

    if (data.type === "chat.image" && data.image) {
      renderMessage({
        sender: data.sender?.username || "unknown",
        timestamp: data.created_at || new Date().toISOString(),
        avatar: data.sender?.profile_image,
        imageUrl: data.image, // 서버가 절대/상대 경로 중 뭐든 오면 renderMessage에서 보정
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
    location.href = `../chat/chat-list.html?ts=${Date.now()}`;
  }
}

/* ------------------ 초기화 ------------------ */
onReady(async () => {
  setTitleAndBannerName();
  await loginWithSession(TEST_USER.username, TEST_USER.password, API_BASE);

  // 방 상태
  let state = { exists: false, is_active: false, iAmRequester: false, iAmReceiver: false };
  try { state = await fetchRoomState(chatId); } catch { }

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
});

/* ------------------ 시스템 메시지 도우미 ------------------ */
function renderSystem(text) { renderMessage({ message: text, sender: "system", timestamp: Date.now() }); }
