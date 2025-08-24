const BASE_URL = "http://localhost:8000";


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


document.addEventListener("DOMContentLoaded", async ()=>{
  await ensureCsrf();

  const form=document.querySelector(".form");
  const nameEl=document.getElementById("name");
  const nationEl=document.getElementById("nation");
  const emailEl=document.getElementById("email");
  const pwEl=document.getElementById("pw");
  const pw2El=document.getElementById("pw2");

  form?.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const name=nameEl?.value.trim();
    const nation=nationEl?.value;
    const email=emailEl?.value.trim();
    const password=pwEl?.value;
    const password2=pw2El?.value;

    if(!name||!email||!password||!password2){ alert("모든 필드를 입력해 주세요."); return; }
    if(password!==password2){ alert("비밀번호가 일치하지 않습니다."); return; }

    try{
  
        await httpSession("/users/signup/", {
            method: "POST",
            body: JSON.stringify({
              username: email,                    
              password,                           
              real_name: name,                   
              user_type: nation === "kr" ? "korean" : "foreigner", 
              email,                           
              
            }),
          });


      await httpSession("/users/profile/");

      window.location.href="/Annyeong-fe/profile/profile.html";
    }catch(err){
      console.error(err);
      alert(`회원가입 실패: ${err.message}`);
    }
  });
});
