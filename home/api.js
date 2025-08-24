// api.js
import { API_BASE_URL } from './config.js';

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

async function parseResponse(response) {
  // 204 또는 명시적 Content-Length: 0 처리
  if (response.status === 204) return null;
  const len = response.headers.get("content-length");
  if (len === "0") return null;

  const ctype = (response.headers.get("content-type") || "").toLowerCase();

  // JSON이면 JSON으로, 아니면 텍스트로
  if (ctype.includes("application/json")) {
    // 서버가 빈 문자열인데 content-type만 JSON으로 주는 특수 케이스 방지
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      // 잘못된 JSON이 올 수 있으니 텍스트 그대로 반환
      return text;
    }
  } else {
    // 이미지/텍스트 등 다양한 케이스가 있지만, 여기선 텍스트 우선
    return await response.text();
  }
}

export async function fetchWithSession(url, options = {}) {
  const csrftoken = getCookie("csrftoken");

  const merged = {
    credentials: "include",
    // method 기본값은 fetch가 넣어줌(GET)
    headers: {
      "Content-Type": "application/json",
      ...(csrftoken ? { "X-CSRFToken": csrftoken } : {}),
      ...(options.headers || {}),
    },
    ...options,
  };

  const response = await fetch(url, merged);

  const data = await parseResponse(response);

  if (!response.ok) {
    // 상위에서 상태/본문을 활용할 수 있게 에러 객체에 붙여줌
    const err = new Error(`HTTP ${response.status} for ${url}`);
    err.status = response.status;
    err.body = data;
    throw err;
  }

  return data;
}

// API 함수
// 매칭 모드 조회
export async function getMatchPreference() {
    return fetchWithSession(`${API_BASE_URL}/api/match/preference/`, { method: "GET" });
}

// 매칭 모드 설정
export async function setMatchPreference(mode) {
    console.log("mode set: ", mode);
    return fetchWithSession(`${API_BASE_URL}/api/match/preference/`, { method: "PUT", body: JSON.stringify({ mode }) });
}

// 사용자 추천 (랜덤 사용자 조회)
export async function getRandomUser() {
    return fetchWithSession(`${API_BASE_URL}/api/match/random-user/`, { method: "GET" });
}

// 매칭 요청 (좋아요)
export async function likeUser(userId) {
    console.log("liked user: ", userId);
    return fetchWithSession(`${API_BASE_URL}/api/match/like/${userId}/`, { method: "POST" });
}

// 매칭 생략 (싫어요)
export async function dislikeUser(userId) {
    console.log("disliked user: ", userId);
    return fetchWithSession(`${API_BASE_URL}/api/match/dislike/${userId}/`, { method: "POST" });
}