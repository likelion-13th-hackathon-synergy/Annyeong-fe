// review/review-view.js
// - roomId는 전혀 사용하지 않음 (user_id만 필요)
// - /reviews/user/:id 로 집계 조회
// - 상단 이름: 서버 user_name 우선, 없으면 /api/users/:id 등으로 username 보조 조회

import { API_BASE, TEST_USER } from "../common/config.js";
import { loginWithSession, authedFetch } from "../common/auth.js";

const EMO = {
  "personalities_1":"👂","personalities_2":"🤩","personalities_3":"😆",
  "personalities_4":"🌟","personalities_5":"🤗","personalities_6":"😇",
  "personalities_7":"🎓","personalities_8":"🧐","personalities_9":"🤭",
  "personalities_10":"✅","personalities_11":"🏃","personalities_12":"🔒"
};

const qs = new URLSearchParams(location.search);
const TARGET_USER_ID = Number(qs.get("user_id"));

function toast(m){ alert(m); }
function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".back-btn")?.addEventListener("click", () => {
    const ref = document.referrer || "../chat/chat-list.html";
    location.href = ref;
  });
});

function normalizeItems(api){
  const rows = Array.isArray(api?.reviews) ? api.reviews : [];
  return rows.map(row => {
    const key = Object.keys(row).find(k=>k.startsWith("personalities_"));
    const label = key ? row[key] : "";
    const count = Number(row.count || 0);
    return { key, label: `${EMO[key] || "✨"} "${label}"`, count };
  });
}

function renderHeader({displayName,total_reviews,total_personality_selections}){
  const strongs = document.querySelectorAll(".strong-text");
  if (strongs[0]) strongs[0].textContent = `'${displayName}'님`;
  if (strongs[1]) strongs[1].textContent = `✔ ${Number(total_personality_selections||0)}회`;
  const gray = document.querySelector(".gray-text");
  if (gray) gray.textContent = ` ${Number(total_reviews||0)}회 참여`;
}

function renderList(items){
  const ul = document.getElementById("reviewList");
  if (!ul) return;
  ul.innerHTML = "";

  if (!items.length){
    const li = document.createElement("li");
    li.textContent = "표시할 리뷰가 없습니다.";
    ul.appendChild(li);
    return;
  }
  const max = Math.max(...items.map(i=>i.count), 1);
  items.forEach(it=>{
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.className = "review-label";
    label.textContent = it.label;
    const cnt = document.createElement("span");
    cnt.className = "review-count";
    cnt.textContent = it.count;
    li.appendChild(label); li.appendChild(cnt);
    li.style.setProperty("--w", `${(it.count/max)*85}%`);
    ul.appendChild(li);
  });
}

// 보조 이름 조회 (username 선호)
async function fetchDisplayName(userId){
  const paths = [
    `/api/users/${encodeURIComponent(userId)}/`,
    `/users/profile/?id=${encodeURIComponent(userId)}`
  ];
  for (const p of paths){
    try{
      const r = await authedFetch(p, {method:"GET"}, API_BASE);
      if (!r.ok) continue;
      const u = await r.json();
      const name =
        u?.username ||
        u?.real_name ||
        u?.nickname ||
        u?.name ||
        u?.profile?.username ||
        u?.profile?.nickname;
      if (name) return String(name);
    }catch{}
  }
  return String(userId);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!num(TARGET_USER_ID)){
    toast("유효하지 않은 접근입니다. (user_id 누락)");
    const ref = document.referrer || "../chat/chat-list.html";
    location.replace(ref);
    return;
  }

  // 로그인
  try {
    await loginWithSession(TEST_USER.username, TEST_USER.password, API_BASE);
  } catch (e) {
    console.error("[auto login failed]", e);
    toast("로그인 실패");
  }

  try{
    const res = await authedFetch(
      `/reviews/user/${encodeURIComponent(TARGET_USER_ID)}/`,
      { method:"GET", headers:{ "Content-Type":"application/json" } },
      API_BASE
    );
    if (res.status === 404){
      const msg = (await res.json().catch(()=>null))?.detail || "해당 사용자를 찾을 수 없습니다.";
      throw new Error(msg);
    }
    if (!res.ok) throw new Error(`서버 오류: ${res.status}`);

    const data = await res.json();
    const displayName = data?.user_name
      ? String(data.user_name)
      : await fetchDisplayName(TARGET_USER_ID);

    renderHeader({
      displayName,
      total_reviews: data.total_reviews,
      total_personality_selections: data.total_personality_selections,
    });
    renderList(normalizeItems(data));
  }catch(err){
    console.error("리뷰 데이터 로드 실패:", err);
    const ul = document.getElementById("reviewList");
    if (ul){
      ul.innerHTML = "";
      const li = document.createElement("li");
      li.textContent = err?.message || "리뷰 데이터를 불러오지 못했습니다.";
      ul.appendChild(li);
    }
  }
});
