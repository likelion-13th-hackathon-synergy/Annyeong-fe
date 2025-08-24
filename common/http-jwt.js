// Annyeong-fe/common/http-jwt.js

import { BASE_URL } from "./config.js";

/**
 * JWT 토큰을 자동으로 헤더에 붙여 API 호출하는 유틸
 * @param {string} path ex) "/users/profile/"
 * @param {object} init fetch 옵션 (method, body 등)
 */
export async function httpJWT(path, init = {}) {
  const access = localStorage.getItem("accessToken");
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(init.headers || {}),
  };
  if (access) {
    headers["Authorization"] = `Bearer ${access}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    throw new Error(res.status); // 401 등 잡기
  }
  return res.json();
}
