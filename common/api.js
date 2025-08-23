import { BASE_HTTP } from "../chat/config.js";
import { getToken } from "..common/auth.js";

export async function authFetch(path, { method="GET", body, headers={} } = {}) {
  const token = getToken();
  const h = new Headers(headers);
  if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (token) h.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE_HTTP}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    credentials: token ? "same-origin" : "include", // 토큰 없으면 쿠키 기대
  });

  if (res.status === 401) throw new Error("401 Unauthorized");
  if (res.status === 403) throw new Error("403 Forbidden");
  return res;
}
