// api.js (세션 기반 로그인 버전)
import { API_BASE_URL } from './config.js';

// ------------------------
// 쿠키 가져오기
// ------------------------
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// ------------------------
// 응답 처리
// ------------------------
async function parseResponse(response) {
    // 204 또는 Content-Length: 0 처리
    if (response.status === 204) return null;
    const len = response.headers.get("content-length");
    if (len === "0") return null;

    const ctype = (response.headers.get("content-type") || "").toLowerCase();

    if (ctype.includes("application/json")) {
        const text = await response.text();
        if (!text) return null;
        try { return JSON.parse(text); } 
        catch { return text; }
    } else {
        return await response.text();
    }
}

// ------------------------
// fetchWithSession (세션 기반 요청)
// ------------------------
export async function fetchWithSession(url, options = {}) {
    const csrftoken = getCookie("csrftoken");

    const merged = {
        credentials: "include", // 쿠키 포함
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
        const err = new Error(`HTTP ${response.status} for ${url}`);
        err.status = response.status;
        err.body = data;
        throw err;
    }

    return data;
}

// ------------------------
// API 함수
// ------------------------

// 매칭 모드 조회
export async function getMatchPreference() {
    return fetchWithSession(`${API_BASE_URL}/api/match/preference/`, { method: "GET" });
}

// 매칭 모드 설정
export async function setMatchPreference(mode) {
    return fetchWithSession(`${API_BASE_URL}/api/match/preference/`, { 
        method: "PUT", 
        body: JSON.stringify({ mode }) 
    });
}

// 사용자 추천 (랜덤 사용자 조회)
export async function getRandomUser() {
    return fetchWithSession(`${API_BASE_URL}/api/match/random-user/`, { method: "GET" });
}

// 매칭 요청 (좋아요)
export async function likeUser(userId) {
    return fetchWithSession(`${API_BASE_URL}/api/match/like/${userId}/`, { method: "POST" });
}

// 매칭 생략 (싫어요)
export async function dislikeUser(userId) {
    return fetchWithSession(`${API_BASE_URL}/api/match/dislike/${userId}/`, { method: "POST" });
}
