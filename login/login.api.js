import { startStatusbarClock } from "/Annyeong-fe/assets/js/statusbar-time.js";

if (typeof startStatusbarClock === "function") {

  startStatusbarClock({ selector: ".sb-time", hour12: false, locale: "ko-KR" });
}

const BASE_URL = "http://localhost:8000"; // 프론트도 http://localhost:5500 로 열어 쓰는 걸 권장

function getCookie(name){ const m=document.cookie.match(new RegExp("(^|; )"+name+"=([^;]*)")); return m?decodeURIComponent(m[2]):null; }
function setMetaCsrf(v){ const meta=document.querySelector('meta[name="csrf-token"]'); if(meta) meta.setAttribute("content", v||""); }
async function ensureCsrf(){
  let t=getCookie("csrftoken");
  if(!t){
    await fetch(`${BASE_URL}/users/csrf/`, { method:"GET", credentials:"include" }); // ★
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
  const text=await res.text(); let data=null; try{ data=text?JSON.parse(text):null; }catch{ data={raw:text}; }
  if(!res.ok) throw new Error((data&&(data.error||data.detail))||`HTTP ${res.status}`);
  return data;
}

document.addEventListener("DOMContentLoaded", async () => {
  await ensureCsrf();

  const form = document.querySelector(".form");
  const emailEl = document.getElementById("email");
  const pwEl    = document.getElementById("password");

  form?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const email=emailEl?.value.trim();
    const password=pwEl?.value;
    if(!email||!password){ alert("이메일/비밀번호를 입력해 주세요."); return; }

    try{

      await httpSession("/users/login/", { method:"POST", body: JSON.stringify({ email, password }) });


      await httpSession("/users/profile/");

      window.location.href="/Annyeong-fe/profile/profile.html";
    }catch(err){
      console.error(err);
      alert(`로그인 실패: ${err.message}`);
    }
  });
});
