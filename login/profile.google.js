// /profile/profile.google.js
// Vite 프록시 전제: /users/* 는 5173 → 8000으로 프록시
const BASE_URL = ""; // 절대 URL 쓰지 마세요 (프록시 사용)
const HOME = "/home/home.html";

// 공통 유틸
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}
async function ensureCsrf() {
  let t = getCookie("csrftoken");
  if (!t) {
    await fetch(`/users/csrf/`, { credentials: "include" });
  }
}
async function fetchJSON(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  // POST 등에는 CSRF 헤더(여기서는 GET만 쓸 거라 사실상 필요 없음)
  return fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: "include" })
    .then(async (res) => {
      const txt = await res.text();
      let data;
      try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
      if (!res.ok) {
        const msg = data?.detail || JSON.stringify(data) || `HTTP ${res.status}`;
        const err = new Error(msg); err.status = res.status; err.payload = data; throw err;
      }
      return data;
    });
}

// 팝업 도우미
function openCenteredPopup(url, name = "google_oauth", w = 520, h = 700) {
  const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : screen.left;
  const dualScreenTop  = window.screenTop  !== undefined ? window.screenTop  : screen.top;
  const width  = window.innerWidth  || document.documentElement.clientWidth  || screen.width;
  const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const systemZoom = width / window.screen.availWidth;
  const left = (width - w) / 2 / systemZoom + dualScreenLeft;
  const top  = (height - h) / 2 / systemZoom + dualScreenTop;
  const features = `scrollbars=yes, width=${w/ systemZoom}, height=${h/ systemZoom}, top=${top}, left=${left}`;
  return window.open(url, name, features);
}

// google_verified 변화 대기
async function waitForGoogleVerify({ intervalMs = 1200, timeoutMs = 120000 } = {}) {
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("구글 인증 시간이 초과되었습니다. 다시 시도해 주세요.");
    }
    try {
      const data = await fetchJSON(`/users/profile/preview/`); // { google_verified: boolean, ... }
      if (data?.google_verified === true) return data;
    } catch (e) {
      // 401이면 로그인 만료
      if (e.status === 401) throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      // 그 외 오류는 잠시 후 재시도
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// 메인: 구글 연결 시작
export async function startGoogleConnectFlow({ onDone } = {}) {
  try {
    await ensureCsrf();

    // 로그인 확인
    try {
      await fetchJSON(`/users/profile/`);
    } catch (e) {
      if (e.status === 401) {
        const here = location.pathname + location.search;
        location.href = `/login/login.html?next=${encodeURIComponent(here)}`;
        return;
      }
      throw e;
    }

    // 서버에서 구글 시작 URL 받기 (백엔드: 인증된 사용자만 허용)
    const start = await fetchJSON(`/users/auth/google/`); // {"redirect_url": "..."}
    const redirectUrl = start?.redirect_url;
    if (!redirectUrl) {
      alert("구글 인증 시작 URL을 받지 못했습니다.");
      return;
    }

    // 팝업 열기 → 사용자는 구글/콜백(JSON) 화면을 팝업에서 보게 됨
    const popup = openCenteredPopup(redirectUrl);

    // 부모창에서 google_verified가 true 될 때까지 폴링
    let preview;
    try {
      preview = await waitForGoogleVerify({});
    } finally {
      // 팝업 닫기 시도 (크로스오리진이라도 close()는 가능)
      try { popup && !popup.closed && popup.close(); } catch {}
    }

    // UI 반영 또는 이동
    if (typeof onDone === "function") {
      onDone(preview);
    } else {
      // 기본: 홈으로
      location.replace(HOME);
    }
  } catch (err) {
    console.error(err);
    alert(err.message || "구글 인증 중 오류가 발생했습니다.");
  }
}
