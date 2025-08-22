//더미 데이터
const ROOMS = [
  { id: 1, name: "Sonya", mode: "구인구직", last: "동해물과 백두산이 마르고 닳도록, 하느님이 보우하사 우리나라 만세. 무궁화! 삼천리! 화려강산", time: "오후 2:26", unread: 1, profile: "../assets/images/user1.png" },
  { id: 2, name: "Yuki", mode: "서포터즈", last: "반가워요!", time: "오후 11:03", unread: 0, profile: "../assets/images/user2.png" },
  { id: 3, name: "Marco", mode: "구인구직", last: "오케이", time: "오후 9:41", unread: 2, profile: "../assets/images/user3.jpg" },
  { id: 4, name: "Sonya", mode: "구인구직", last: "동해물과 백두산이 마르고 닳도록, 하느님이 보우하사 우리나라 만세. 무궁화! 삼천리! 화려강산", time: "오후 2:26", unread: 1, profile: "../assets/images/user1.png" },
  { id: 5, name: "Yuki", mode: "서포터즈", last: "반가워요!", time: "오후 11:03", unread: 0, profile: "../assets/images/user2.png" },
  { id: 6, name: "Sonya", mode: "구인구직", last: "동해물과 백두산이 마르고 닳도록, 하느님이 보우하사 우리나라 만세. 무궁화! 삼천리! 화려강산", time: "오후 2:26", unread: 1, profile: "../assets/images/user1.png" },
  { id: 7, name: "Yuki", mode: "서포터즈", last: "반가워요!", time: "오후 11:03", unread: 1, profile: "../assets/images/user2.png" },
  { id: 8, name: "Sonya", mode: "구인구직", last: "동해물과 백두산이 마르고 닳도록, 하느님이 보우하사 우리나라 만세. 무궁화! 삼천리! 화려강산", time: "오후 2:26", unread: 1, profile: "../assets/images/user1.png" },
  { id: 9, name: "Yuki", mode: "서포터즈", last: "반가워요!", time: "오후 11:03", unread: 3, profile: "../assets/images/user2.png" },
  { id: 10, name: "Yuki", mode: "서포터즈", last: "반가워요!", time: "오후 11:03", unread: 0, profile: "../assets/images/user2.png" },
  { id: 11, name: "Sonya", mode: "구인구직", last: "동해물과 백두산이 마르고 닳도록, 하느님이 보우하사 우리나라 만세. 무궁화! 삼천리! 화려강산", time: "오후 2:26", unread: 1, profile: "../assets/images/user1.png" },
  { id: 12, name: "Yuki", mode: "서포터즈", last: "반가워요!", time: "오후 11:03", unread: 1, profile: "../assets/images/user2.png" },
  { id: 13, name: "Sonya", mode: "구인구직", last: "동해물과 백두산이 마르고 닳도록, 하느님이 보우하사 우리나라 만세. 무궁화! 삼천리! 화려강산", time: "오후 2:26", unread: 1, profile: "../assets/images/user1.png" },
  { id: 14, name: "Yuki", mode: "서포터즈", last: "반가워요!", time: "오후 11:03", unread: 3, profile: "../assets/images/user2.png" },
  { id: 15, name: "Sonya", mode: "구인구직", last: "동해물과 백두산이 마르고 닳도록, 하느님이 보우하사 우리나라 만세. 무궁화! 삼천리! 화려강산", time: "오후 2:26", unread: 1, profile: "../assets/images/user1.png" },
  { id: 16, name: "Yuki", mode: "서포터즈", last: "반가워요!", time: "오후 11:03", unread: 1, profile: "../assets/images/user2.png" },
  { id: 17, name: "Sonya", mode: "구인구직", last: "동해물과 백두산이 마르고 닳도록, 하느님이 보우하사 우리나라 만세. 무궁화! 삼천리! 화려강산", time: "오후 2:26", unread: 1, profile: "../assets/images/user1.png" },
  { id: 18, name: "Yuki", mode: "서포터즈", last: "반가워요!", time: "오후 11:03", unread: 3, profile: "../assets/images/user2.png" },


];

const listEl = document.getElementById("chat-list");

function renderRooms(rooms) {
  listEl.innerHTML = rooms.map(r => `
    <article class="tile" data-id="${r.id}" data-name="${r.name}">
      <div class="profile">
        <img src="${r.profile}" alt="${r.name} 프로필" class="profile-img">
      </div>
      <div class="chat-info">
        <div class="chat-header">
          <p><span class="name">${r.name}</span> <div class = "chat-mode-border"><span class = "chat-mode-text">${r.mode}</span></div></p>
        </div>
        <div class="chat-message">
          ${r.last}
        </div>
      </div>
      <div class="chat-info2">
        <span class="time">${r.time}</span>
        ${r.unread ? `<span class="badge">${r.unread}</span>` : ""}
      </div>
    </article>
  `).join("");

  //목록리스트에서 클릭시에 채팅방으로 이동
  listEl.querySelectorAll(".tile").forEach(t => {
    t.addEventListener("click", () => {
      const id = t.dataset.id;
      const nm = encodeURIComponent(t.dataset.name);
      location.href = `../chat/chat-room.html?roomId=${id}&name=${nm}`;
    });
  });
}

renderRooms(ROOMS);

// 드롭다운 메뉴 설정 함수
const dropdown = document.querySelector('.dropdown');
const selectedTextEl = dropdown.querySelector('.selected-menu-text');
const selectedSpace = dropdown.querySelector('.selected-space');
const arrow = document.getElementById('arrow');
const items = Array.from(dropdown.querySelectorAll('.sub-menu li'));
const links = dropdown.querySelectorAll('.sub-menu a');
// 현재 선택된 모드 보관 (초기값: 드롭다운 현재 표시 텍스트)
let currentMode = (document.querySelector('.dropdown .selected-menu-text')?.textContent || '전체').trim();

// "전체" 또는 일치하는 모드만 필터링
function getFilteredRooms(mode) {
  if (!mode || mode === '전체') return ROOMS;
  return ROOMS.filter(r => (r.mode || '').trim() === mode);
}

// 선택 모드 적용 + 렌더
function applyFilter(mode) {
  currentMode = mode.trim();
  renderRooms(getFilteredRooms(currentMode));
  refreshMenu(); // 현재 선택값 숨김 처리 유지
}

/* 현재 선택값과 같은 항목은 목록에서 숨김 */
function refreshMenu() {
  const curr = selectedTextEl.textContent.trim();
  items.forEach(li => {
    const t = li.textContent.trim();
    li.style.display = (t === curr) ? 'none' : '';
  });
}

/* 열고/닫기: show만 사용 */
selectedSpace.addEventListener('click', (e) => {
  e.stopPropagation();
  dropdown.classList.toggle('show');
  arrow.classList.toggle('arrow');
});

/* 항목 선택 → 텍스트 반영 + 닫기 + 목록 갱신 */
links.forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const t = a.textContent.trim();

    if (t !== selectedTextEl.textContent.trim()) {
      selectedTextEl.textContent = t;   // 선택한 텍스트 드롭다운에 반영
      applyFilter(t);
    } else {
      // applyFilter(t);
    }

    dropdown.classList.remove('show');
    arrow.classList.remove('arrow');
  });
});


/* 바깥 클릭 → 닫기 (중복 리스너 제거) */
document.addEventListener('click', (e) => {
  if (!dropdown.contains(e.target)) {
    dropdown.classList.remove('show');
    arrow.classList.remove('arrow');
  }
});

/* 최초 1회 적용 */
refreshMenu();
//헤더 로고 버튼
document.addEventListener('DOMContentLoaded', ()=>{
  const homeBtn = document.querySelector('.main-logo-btn');
  homeBtn.addEventListener('click', ()=>{
    location.href = `../home/home`;
  })
});
