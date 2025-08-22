// chat-room.js
import { createWS } from './ws.js';
import { $, onReady, escapeHTML, toTime, scrollToBottom } from './dom.js';
import { buildWsUrl, getQueryParam } from './config.js';
import { startMockServer } from './mock.js';

// =========================
// URL/상태
// =========================
const before = document.referrer;

const roomId = getQueryParam('roomId', '1');
const otherName = getQueryParam('name', '상대');
const USE_MOCK = getQueryParam('mock', '0') === '1';
const acceptedInit = getQueryParam('accepted', '0') === '1';

let isAccepted = acceptedInit;
const CURRENT_USER = 'me';                 // TODO: 실제 로그인 유저로 교체
let ws;                                    // createWS 핸들 저장

// 브라우저 탭 고유 clientId (echo 무시용)
const clientId = localStorage.getItem('clientId') || (() => {
  const id = 'c_' + Math.random().toString(36).slice(2);
  localStorage.setItem('clientId', id);
  return id;
})();

// =========================
/** DOM */
// =========================
const titleEl = $('#chat-title');
const listEl = $('#messages');
const inputEl = $('#msg-input');
const sendBtn = $('#send-btn');
const backBtn = $('#back-btn');
const wrapperEl = $('#chat-wrapper');
const bannerEl = $('#invite-banner');
const inviteName = $('#invite-name');
const btnAccept = $('#btn-accept');
const btnDecline = $('#btn-decline');
const attachBtn = $('#attach-btn');
const fileInput = $('#file-input');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);


titleEl && (titleEl.textContent = otherName);
inviteName && (inviteName.textContent = otherName);

// =========================
/** 연결 상태 UI */
// =========================
function setOnline(on) {
  document.body.classList.toggle('ws-online', on);
  document.body.classList.toggle('ws-offline', !on);
}

// =========================
/** 번역 (데모) */
// =========================
async function translateText(text) {
  // 실제 번역 API 붙이면 여기만 교체
  return `번역: ${text}`;
}

// =========================
/** 메시지 렌더 */
// =========================
function renderMessage({ message, sender = 'unknown', timestamp = Date.now(), avatar, imageUrl }) {
  const isMe = sender === CURRENT_USER;

  const li = document.createElement('li');
  li.className = `msg ${isMe ? 'me' : 'other'}`;

  const avatarHtml = !isMe
    ? `<img class="avatar" src="${escapeHTML(avatar || '../assets/images/chat/profile_default.png')}" alt="${escapeHTML(sender)}" />`
    : '';
  const nameHtml = !isMe ? `<div class="name">${escapeHTML(sender)}</div>` : '';

  // 본문(텍스트 or 이미지)
  let bodyHtml = '';
  if (imageUrl) {
  bodyHtml = `
    <a href="${escapeHTML(imageUrl)}" target="_blank" rel="noopener noreferrer">
      <img class="img-msg" src="${escapeHTML(imageUrl)}" alt="image" />
    </a>
  `;
} else {
    bodyHtml = `
      <div class="text">${escapeHTML(message || '')}</div>
      <div class="actions"><span class="translate">번역보기</span></div>
    `;
  }

  li.innerHTML = `
    ${avatarHtml}
    <div style="display:flex; flex-direction:column; gap:4px; max-width:80%;">
      ${nameHtml}
      <div class="bubble">
        ${bodyHtml}
        <span class="tail">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="14" viewBox="0 0 13 14" fill="none">
            <path d="M1.63227 1.2761C5.91261 3.11151 10.0495 4.18948 11.8179 3C11.8179 3 10.6358 15.3683 9.0679 12.9342C7.56627 10.6029 4.29243 5.91811 1.38292 1.57308C1.27146 1.40664 1.44817 1.19716 1.63227 1.2761Z" fill="white" stroke="white"/>
          </svg>
        </span>
      </div>
    </div>
    <div class="meta">${toTime(timestamp)}</div>
  `;

  // 텍스트일 때만 번역 토글
  if (!imageUrl) {
    const textEl = li.querySelector('.text');
    const trEl = li.querySelector('.translate');
    let translated = false;
    const original = message || '';
    trEl?.addEventListener('click', async () => {
      if (!translated) {
        textEl.textContent = await translateText(original);
        trEl.textContent = '원문보기';
        translated = true;
      } else {
        textEl.textContent = original;
        trEl.textContent = '번역보기';
        translated = false;
      }
    });
  }

  listEl.appendChild(li);
  scrollToBottom(wrapperEl);
}


// 시스템 메시지 단축
function renderSystem(text) {
  renderMessage({ message: text, sender: 'system', timestamp: Date.now() });
}

//파일이 이미지인지 확인
function isImageFile(file) {
  if (!file) return false;
  if (file.type && ALLOWED_MIME.has(file.type)) return true;
  // 일부 브라우저가 type을 비우는 경우 확장자로 보조 판단
  const name = (file.name || '').toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/.test(name);
}

// =========================
/** 입력 제어 */
// =========================
function applyAcceptState(on) {
  [inputEl, sendBtn, attachBtn, fileInput].forEach(el => { if (el) el.disabled = !on; });
  if (bannerEl) {
    if (on) {
      bannerEl.setAttribute('hidden', '');
      bannerEl.style.display = 'none';
      bannerEl.classList.add('is-hidden');
    } else {
      bannerEl.removeAttribute('hidden');
      bannerEl.style.display = '';
      bannerEl.classList.remove('is-hidden');
    }
  }
}

function canSend() { return isAccepted; }

function sendCurrentInput() {
  if (!canSend()) { renderSystem('대화를 수락하면 메시지를 보낼 수 있어요.'); return; }

  const text = (inputEl?.value || '').trim();
  if (!text) return;

  if (!ws?.ready) { renderSystem('연결 중입니다. 잠시만요…'); return; }

  const payload = {
    type: 'chat.message',
    message: text,
    sender: CURRENT_USER,
    timestamp: new Date().toISOString(),
    clientId,
    msgId: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2),
  };

  ws.send(payload); // ready 확인 후 전송
  // 낙관 렌더 (echo는 onMessage에서 clientId로 무시)
  renderMessage({ message: text, sender: CURRENT_USER, timestamp: Date.now() });
  inputEl.value = '';
  inputEl.focus();
}

// =========================
/** 시작 */
// =========================
(async function start() {
  const wsUrl = buildWsUrl(roomId);

  if (USE_MOCK) {
    // mock 서버: 첫 인사/accept/decline 브로드캐스트 지원
    await startMockServer(wsUrl, roomId, otherName);
  }

  ws = createWS(wsUrl, {
    onOpen() { setOnline(true); },
    onClose() { setOnline(false); },
    onError() { setOnline(false); },
    onMessage(data) {
      if (data.type === 'pong') return;
      if (data.clientId && data.clientId === clientId) return;

      if (data.type === 'system') {
        if (typeof data.message === 'string' && /^Joined\s+room/i.test(data.message)) return;
        renderMessage({ message: data.message, sender: 'system', timestamp: data.timestamp });
        return;
      }

      if (data.type === 'room.accept') return;
      if (data.type === 'room.decline') return;

      // ✨ 이미지 수신
      if (data.type === 'chat.image' && data.image?.dataUrl) {
        renderMessage({
          sender: data.sender,
          timestamp: data.timestamp,
          imageUrl: data.image.dataUrl
        });
        return;
      }

      // 텍스트 수신
      if (typeof data.message === 'string') renderMessage(data);
    }
    ,
  });

  // 초기 상태 반영
  applyAcceptState(isAccepted);
  if (!isAccepted && bannerEl) bannerEl.hidden = false;

  // 이벤트
  onReady(() => {
    sendBtn?.addEventListener('click', sendCurrentInput);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCurrentInput();
      }
    });

    backBtn?.addEventListener('click', () => {
      history.length > 1 ? history.back() : (location.href = '../chat/chat-list.html');
    });

    btnAccept?.addEventListener('click', () => {
      isAccepted = true;
      applyAcceptState(true);
      ws?.send({ type: 'room.accept', roomId, by: CURRENT_USER, at: new Date().toISOString(), clientId });
    });

    btnDecline?.addEventListener('click', () => {
      ws?.send({ type: 'room.decline', roomId, by: CURRENT_USER, at: new Date().toISOString(), clientId });
      renderSystem('대화 요청을 거절했어요.');
      setTimeout(() => {
        history.length > 1 ? history.back() : (location.href = '../chat/chat-list.html');
      }, 400);
    });
  });
})();


document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.querySelector('.chat-btn');
  // 뒤로 가기 버튼 클릭 시
  backBtn.addEventListener('click', () => {
    window.location.href = '/review/review-write';
  });
});

//뒤로 가기 버튼
document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.querySelector('.back-btn');
  backBtn.addEventListener('click', () => {
    window.location.href = before;
  })
});


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

  // JPEG로 내보내되, 원본이 png/gif라면 그대로 jpeg로 통일(용량 절감)
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, width: dw, height: dh, mime: 'image/jpeg' };
}


async function sendImageFile(file) {
  if (!canSend()) { renderSystem('대화를 수락하면 이미지를 보낼 수 있어요.'); return; }
  if (!ws?.ready) { renderSystem('연결 중입니다. 잠시만요…'); return; }
  if (!isImageFile(file)) { renderSystem('이미지 파일만 업로드 가능합니다.'); return; }

  // 압축/리사이즈
  const { dataUrl, width, height, mime } = await compressImage(file);

  const nowIso = new Date().toISOString();
  const tempId = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2);

  const payload = {
    type: 'chat.image',
    sender: CURRENT_USER,
    timestamp: nowIso,
    clientId,
    msgId: tempId,
    image: {
      name: file.name,
      mime,
      width,
      height,
      dataUrl,     // Base64 Data URL
    },
  };

  // 낙관적 렌더
  renderMessage({
    sender: CURRENT_USER,
    timestamp: Date.now(),
    imageUrl: dataUrl
  });

  ws.send(payload);
}

attachBtn?.addEventListener('click', () => {
  if (!canSend()) { renderSystem('대화를 수락하면 이미지를 보낼 수 있어요.'); return; }
  if (fileInput?.disabled) return;
  fileInput?.click();
});

fileInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!isImageFile(file)) {
    alert('이미지 파일(JPG/PNG/WEBP/GIF)만 업로드할 수 있습니다.');
    e.target.value = '';
    return;
  }
  try {
    await sendImageFile(file);
  } finally {
    e.target.value = ''; // 같은 파일 재선택 허용
  }
});

// 페이지 기본 드롭 동작(브라우저가 파일을 열어버림) 막기
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
  document.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); })
);

// 래퍼에만 드롭 허용
wrapperEl?.addEventListener('drop', async (e) => {
  if (!canSend()) { alert('대화를 수락하면 이미지를 보낼 수 있어요.'); return; }
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;

  if (!isImageFile(file)) {
    alert('이미지 파일(JPG/PNG/WEBP/GIF)만 업로드할 수 있어요.');
    return;
  }
  await sendImageFile(file);
});