//더미 데이터
const ROOMS = [
    { id: 1, name: "Sonya", last: "동해물과 백두산이 마르고 닳도록, 하느님이 보우하사 우리나라 만세. 무궁화! 삼천리! 화려강산", time: "오후 2:26", unread: 1, profile: "../assets/images/user1.png" },
    { id: 2, name: "Yuki", last: "반가워요!", time: "오후 11:03", unread: 0, profile: "../assets/images/user2.png" },
    { id: 3, name: "Marco", last: "오케이", time: "오후 9:41", unread: 2, profile: "../assets/images/user3.jpg" },
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
          <span class="name">${r.name}</span>
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
            location.href = `../chat-room/chat-room.html?roomId=${id}&name=${nm}`;
        });
    });
}

renderRooms(ROOMS);
