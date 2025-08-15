// chat.js
import { createWS } from '../chat-room/ws.js';

// ====== 환경값 ======
const HTTP_HOST = 'localhost:8000'; // 배포시 도메인으로 변경
const WS_SCHEME = (location.protocol === 'https:') ? 'wss' : 'ws';
const WS_HOST   = HTTP_HOST; // 보통 동일 호스트/포트 사용
const WS_PATH   = (room) => `/ws/chat/${encodeURIComponent(room)}/`; // 백엔드 라우트

// ====== 유틸 ======
const $ = (sel) => document.querySelector(sel);
function escapeHTML(str = '') {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function toTime(t) {
  try {
    return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
function scrollToBottom(el) {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

// ====== DOM 참조 ======
const titleEl    = $('#chat-title');
const listEl     = $('#messages');
const inputEl    = $('#msg-input');
const sendBtn    = $('#send-btn');
const backBtn    = $('#back-btn');
const wrapperEl  = $('#chat-wrapper');

// ====== 방 이름 결정 ======
function getRoomName() {
  const url = new URL(location.href);
  return url.searchParams.get('room') || 'lobby';
}
const ROOM = getRoomName();
titleEl && (titleEl.textContent = ROOM);

// (예시) 현재 로그인 유저 이름/ID — 백엔드 연동 전 임시값
const CURRENT_USER = 'me';

// ====== 메시지 렌더링 ======
function renderMessage({ message, sender = 'unknown', timestamp = Date.now() }) {
  const isMe = sender === CURRENT_USER;
  const li = document.createElement('li');
  li.className = `msg ${isMe ? 'me' : 'other'}`;
  li.innerHTML = `
    <div class="bubble">
      <div class="text">${escapeHTML(message)}</div>
      <div class="meta">${escapeHTML(sender)} · ${toTime(timestamp)}</div>
    </div>
  `;
  listEl.appendChild(li);
  scrollToBottom(wrapperEl);
}

// ====== 연결 상태 표시(옵션: 배경에 클래스 토글) ======
function setOnline(on) {
  document.body.classList.toggle('ws-online', on);
  document.body.classList.toggle('ws-offline', !on);
}

// ====== WebSocket 연결 ======
const wsUrl = `${WS_SCHEME}://${WS_HOST}${WS_PATH(ROOM)}`;
const ws = createWS(wsUrl, {
  onOpen() {
    setOnline(true);
    // 필요하다면 최근 히스토리 요청
    // ws.send({ type: 'history', limit: 50 });
  },
  onMessage(data) {
    if (data.type === 'pong') return;
    if (data.type === 'system') {
      renderMessage({ message: data.message, sender: 'system', timestamp: data.timestamp });
      return;
    }
    // 기본 메시지
    if (typeof data.message === 'string') {
      renderMessage(data);
    }
  },
  onClose() { setOnline(false); },
  onError() { setOnline(false); },
});

// ====== 전송 핸들러 ======
function sendCurrentInput() {
  const text = (inputEl.value || '').trim();
  if (!text) return;

  const payload = {
    type: 'chat.message',
    message: text,
    sender: CURRENT_USER,
    timestamp: new Date().toISOString(),
  };

  const ok = ws.send(payload);
  if (!ok) {
    alert('연결이 불안정합니다. 잠시 후 다시 시도해주세요.');
    return;
  }

  // 낙관적 렌더링(원치 않으면 제거)
  renderMessage({ message: text, sender: CURRENT_USER, timestamp: Date.now() });
  inputEl.value = '';
  inputEl.focus();
}

sendBtn?.addEventListener('click', sendCurrentInput);
inputEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendCurrentInput();
  }
});
backBtn?.addEventListener('click', () => {
  history.length > 1 ? history.back() : (location.href = '../chat-list/chat_list.html');
});

// ====== 초기가짜메시지(개발 편의) — 원하면 삭제 ======
// renderMessage({ message: '대화방에 입장했습니다.', sender: 'system', timestamp: Date.now() });
