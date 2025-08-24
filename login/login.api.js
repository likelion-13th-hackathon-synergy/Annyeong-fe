import { startStatusbarClock } from "../assets/js/statusbar-time.js";

if (typeof startStatusbarClock === "function") {
  startStatusbarClock({ selector: ".sb-time", hour12: false, locale: "ko-KR" });
}

<<<<<<< HEAD
const BASE_URL = "http://localhost:8000"; // 프론트도 http://localhost:5500 로 열어 쓰는 걸 권장
=======
const BASE_URL = "http://localhost:8000";
const HOME = "/Annyeong-fe/home/home.html";
>>>>>>> 2ade0fe (회원가입 수정)

function getCookie(name){ const m=document.cookie.match(new RegExp("(^|; )"+name+"=([^;]*)")); return m?decodeURIComponent(m[2]):null; }
function setMetaCsrf(v){ const meta=document.querySelector('meta[name="csrf-token"]'); if(meta) meta.setAttribute("content", v||""); }
async function ensureCsrf(){
  let t=getCookie("csrftoken");
  if(!t){
    await fetch(`${BASE_URL}/users/csrf/`, { method:"GET", credentials:"include" });
    t=getCookie("csrftoken");
  }
  setMetaCsrf(t);
  return t;
}
function needsCSRF(m){ return !["GET","HEAD","OPTIONS","TRACE"].includes(String(m).toUpperCase()); }

async function httpSession(path, init={}){
  const method=(init.method||"GET").toUpperCase();
  const headers=new Headers(init.headers||{});
  if(!headers.has("Accept")) headers.set("Accept","application/json");
  if(needsCSRF(method)){
    const token=getCookie("csrftoken")||(await ensureCsrf());
    headers.set("X-CSRFToken", token);
    if(!headers.has("Content-Type")) headers.set("Content-Type","application/json");
  }
  const res=await fetch(`${BASE_URL}${path}`, { ...init, method, headers, credentials:"include" });
  const text=await res.text();
  let data=null; try{ data=text?JSON.parse(text):null; }catch{ data={raw:text}; }
  if(!res.ok){
    const message =
      (typeof data === "string" && data) ||
      data?.detail ||
      JSON.stringify(data, null, 2) ||
      `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

document.addEventListener("DOMContentLoaded", async () => {
  await ensureCsrf();

<<<<<<< HEAD
  const form = document.querySelector(".form");
  const emailEl = document.getElementById("email");
  const pwEl    = document.getElementById("password");
=======
  const qs = new URLSearchParams(location.search);                                   // ★ 추가
  const next = qs.get("next") || "/Annyeong-fe/home/home.html";                      // ★ 추가 (기본 이동 목적지)
  try {                                                                              // ★ 추가
    await httpSession("/users/profile/");                                            // ★ 추가 (이미 로그인?)
    location.replace(next);                                                          // ★ 추가 (바로 이동)
    return;                                                                          // ★ 추가
  } catch (_) { /* 미로그인 -> 폼 계속 보여줌 */ } 

  const form=document.querySelector(".form");
  const emailEl=document.getElementById("email");
  const pwEl=document.getElementById("password");
>>>>>>> 2ade0fe (회원가입 수정)

  form?.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const email = emailEl?.value.trim();
    const password = pwEl?.value;
    if(!email || !password){
      alert("이메일/비밀번호를 입력해 주세요.");
      return;
    }

    try{
      // 명세에 맞춰 username 사용
      const loginResp = await httpSession("/users/login/", {
        method: "POST",
        body: JSON.stringify({ username: email, password })
      });
      // (선택) user_id 활용 가능: loginResp.user_id

<<<<<<< HEAD
      // 세션 확인 용(선택): 자동로그인/세션이 정상이면 200, 아니면 403 가능
      // await httpSession("/users/profile/");

      window.location.href = "../profile/profile.html";
=======
        await httpSession("/users/login/", {
            method:"POST",
            body: JSON.stringify({ username: email, password })                           // ★ 변경 (기존: { email, password })
          });


      
      history.replaceState(null, "", location.pathname);

      location.replace("/Annyeong-fe/home/home.html"); 
>>>>>>> 2ade0fe (회원가입 수정)
    }catch(err){
      console.error(err);
      // 400일 때 서버가 내려준 한국어 메시지가 그대로 보입니다.
      alert(`로그인 실패:\n${err.message}`);
    }
  });
});
