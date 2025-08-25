// home.js (목업 + 스와이프/채팅 + overlay absolute 기준)
import { API_BASE_URL } from './config.js';
// 실제 API 연결은 이걸로
// import { getRandomUser, likeUser, dislikeUser, getMatchPreference, setMatchPreference } from './api.js';

// 테스트용 목업
import { getRandomUser, likeUser, dislikeUser, getMatchPreference, setMatchPreference } from './mockApi.js';

let currentProfile = null;
let currentUser = null;

/* ============ 세션 가드: 로그인 안 되어 있으면 로그인 페이지로 ============ */
async function assertLoggedInOrRedirect() {
  const base = API_BASE_URL || "";
  try {
    const res = await fetch(`${base}/users/profile/`, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      const next = location.pathname + location.search;
      location.replace(`/Annyeong-fe/login/login.html?next=${encodeURIComponent(next)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("세션 확인 실패:", e);
    const next = location.pathname + location.search;
    location.replace(`/Annyeong-fe/login/login.html?next=${encodeURIComponent(next)}`);
    return false;
  }
}

/* ============ 유틸 ============ */
function req(sel, name) {
  const el = document.querySelector(sel);
  if (!el) console.error(`❌ 필수 요소(${name})를 찾지 못했습니다. selector="${sel}"`);
  return el;
}

function makeOverlay() {
  const appWrapper = document.querySelector('.app-wrapper');
  let overlay = appWrapper.querySelector('#swipe-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'swipe-overlay';
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '100',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.1s ease-in-out',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '70px 100%',
    });
    appWrapper.appendChild(overlay);
  }
  return overlay;
}

/* ============ 카드 내용 업데이트 ============ */
function updateProfileCard(profile, cardElement) {
  const imageEl = cardElement.querySelector('.profile-image');
  const nameEl = cardElement.querySelector('.profile-name');
  const locationEl = cardElement.querySelector('.profile-location');

  if (imageEl) imageEl.src = profile.profile_image || '../assets/images/home/type-1.svg';
  if (nameEl && nameEl.firstChild) nameEl.firstChild.nodeValue = ((profile.real_name || profile.username) ?? '') + ' ';
  if (locationEl) locationEl.textContent = [profile.city, profile.nationality].filter(Boolean).join(" | ") || "위치 정보 없음";

  handleMoreText(profile, cardElement);

  // 인증 배지
  const badgeContainer = cardElement.querySelector('.badge');
  if (badgeContainer) {
    badgeContainer.innerHTML = '';
    const verified = profile.google_verified === true || profile.google_verified === 1 || profile.google_verified === "1";
    if (verified) {
      const badgeImg = document.createElement('img');
      badgeImg.src = '../assets/images/home/check.svg';
      badgeImg.classList.add('google-badge');
      badgeImg.alt = '인증';
      badgeContainer.appendChild(badgeImg);
    }
  }
}

/* ============ 더보기 텍스트 ============ */
function handleMoreText(profile, cardElement) {
  const descriptionElement = cardElement.querySelector('.profile-description');
  if (!descriptionElement) return;

  const fullDescription = profile.introduction || '';
  const maxCharacters = 50;
  const interval = 30;

  function insertLineBreaks(text, interval) {
    if (!text) return '';
    return text.replace(new RegExp(`(.{1,${interval}})`, 'g'), '$1<br>').replace(/<br>$/, '');
  }

  if (fullDescription.length > maxCharacters) {
    const shortTextHTML = insertLineBreaks(fullDescription.substring(0, maxCharacters), interval);
    const fullTextHTML  = insertLineBreaks(fullDescription, interval);

    descriptionElement.innerHTML = `
      <div class="short-text">${shortTextHTML}</div>
      <div class="full-text" style="display:none; max-height:150px; overflow-y:auto;">${fullTextHTML}</div>
      <button type="button" class="more-text" style="cursor:pointer; display:inline-block; background:none; border:0; color:#3b82f6">더보기</button>
    `;

    const moreBtn  = descriptionElement.querySelector('.more-text');
    const shortTxt = descriptionElement.querySelector('.short-text');
    const fullTxt  = descriptionElement.querySelector('.full-text');

    moreBtn?.addEventListener('click', () => {
      if (shortTxt) shortTxt.style.display = 'none';
      if (fullTxt) { fullTxt.style.display = 'block'; fullTxt.style.whiteSpace = 'pre-wrap'; }
      if (moreBtn) moreBtn.style.display = 'none';
    });
  } else descriptionElement.innerHTML = `<div>${insertLineBreaks(fullDescription, interval)}</div>`;
}

/* ============ 메인 ============ */
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await assertLoggedInOrRedirect();
  if (!ok) return;

  const container     = req('#card-container', '카드 컨테이너');
  const dropdownMenu  = req('.dropdown-menu', '드롭다운 메뉴');
  const selectedText  = req('.selected-text', '드롭다운 표시 텍스트');
  const dropdownArrow = req('.dropdown-arrow', '드롭다운 화살표');
  const yesButton     = req('#yes-button', '예 버튼');
  const noButton      = req('#no-button', '아니오 버튼');

  if (!container || !dropdownMenu || !selectedText || !dropdownArrow || !yesButton || !noButton) return;

  yesButton.disabled = true;
  noButton.disabled = true;

  /* ============ 랜덤 사용자 로드 ============ */
  async function loadNextProfile() {
    container.innerHTML = '';
    try {
      const user = await getRandomUser();
      console.log("✅ getRandomUser:", user);
      if (!user) {
        container.innerHTML = `<p style="padding:16px">추천할 사용자가 없습니다.</p>`;
        yesButton.disabled = true;
        noButton.disabled = true;
        return;
      }
      currentProfile = user;
      currentUser = user;
      createProfileCard(user);
      yesButton.disabled = false;
      noButton.disabled = false;
    } catch (err) {
      console.error("❌ loadNextProfile 에러:", err);
      container.innerHTML = `<p style="padding:16px">카드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>`;
      yesButton.disabled = true;
      noButton.disabled = true;
    }
  }

  /* ============ 카드 생성 + 스와이프 ============ */
  function createProfileCard(profile) {
    container.innerHTML = `
      <div class="card-wrapper" style="touch-action: pan-y;">
        <div class="image-container">
          <img class="profile-image type" src="${profile.profile_image || '../assets/images/home/type-1.svg'}" alt="">
          <div class="card">
            <h1 class="profile-name">${(profile.real_name || profile.username) ?? ''}${profile.age != null ? ' ' + profile.age : ''} <span class="badge"></span></h1>
            <p class="profile-location">${[profile.city, profile.nationality].filter(Boolean).join(" | ") || "위치 정보 없음"}</p>
            <p class="profile-description">${profile.introduction || "소개글 없음."}</p>
          </div>
          <a href="../review/review-view.html"><img src="../assets/images/home/review.svg" class="review" alt="리뷰 이동"></a>
        </div>
      </div>
    `;

    const cardWrapper = container.querySelector('.card-wrapper');
    if (!cardWrapper) return;

    const overlay = makeOverlay();

    let startX = 0, currentX = 0, isDragging = false;

    function handleMove(x) {
      currentX = x - startX;
      cardWrapper.style.transform = `translateX(${currentX}px)`;
      overlay.style.opacity = String(Math.min(Math.abs(currentX) / 50, 1));
      if (currentX > 0) {
        overlay.style.backgroundImage = `linear-gradient(to right, rgba(0,255,0,0) 0px, rgba(0,255,0,0.8))`;
        overlay.style.backgroundPosition = 'right';
      } else {
        overlay.style.backgroundImage = `linear-gradient(to left, rgba(255,0,0,0) 0px, rgba(255,0,0,0.8))`;
        overlay.style.backgroundPosition = 'left';
      }
    }

    function commitSwipeOrReset() {
      isDragging = false;
      if (Math.abs(currentX) > 100) {
        cardWrapper.style.transition = 'transform 0.3s ease';
        cardWrapper.style.transform = `translateX(${currentX > 0 ? 1000 : -1000}px)`;

        const base = API_BASE_URL || "";
        if (currentX > 0 && currentUser && currentUser.id) {
          likeUser(currentUser.id)
            .then(() => createChatRoom(currentUser.id))
            .catch(err => console.error("스와이프 좋아요/채팅 생성 에러:", err));
        } else if (currentX < 0 && currentUser && currentUser.id) {
          dislikeUser(currentUser.id)
            .catch(err => console.error("스와이프 싫어요 에러:", err));
        }

        setTimeout(() => { overlay.style.opacity = '0'; loadNextProfile(); }, 280);
      } else {
        cardWrapper.style.transition = 'transform 0.3s ease';
        cardWrapper.style.transform = 'translateX(0px)';
        setTimeout(() => { cardWrapper.style.transition = ''; overlay.style.opacity = '0'; }, 300);
      }
    }

    // 마우스
    cardWrapper.addEventListener('mousedown', (e) => { startX = e.clientX; isDragging = true; cardWrapper.style.transition = ''; });
    cardWrapper.addEventListener('mousemove', (e) => { if (!isDragging) return; handleMove(e.clientX); });
    cardWrapper.addEventListener('mouseup', () => { if (!isDragging) return; commitSwipeOrReset(); });
    cardWrapper.addEventListener('mouseleave', () => { if (!isDragging) return; commitSwipeOrReset(); });

    // 터치
    cardWrapper.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (!t) return; startX = t.clientX; isDragging = true; cardWrapper.style.transition = ''; }, { passive: true });
    cardWrapper.addEventListener('touchmove', (e) => { if (!isDragging) return; const t = e.touches[0]; if (!t) return; handleMove(t.clientX); }, { passive: true });
    cardWrapper.addEventListener('touchend', () => { if (!isDragging) return; commitSwipeOrReset(); });

    updateProfileCard(profile, cardWrapper);
  }

  /* ============ 채팅방 생성 ============ */
  async function createChatRoom(receiverId) {
    try {
      const base = API_BASE_URL || "";
      const res = await fetch(`${base}/api/chat/chatrooms/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({ receiver_id: receiverId })
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`❌ HTTP ${res.status} error for chatrooms:`, text);
        return null;
      }
      return await res.json();
    } catch (err) { console.error("❌ createChatRoom fetch 에러:", err); return null; }
  }

  /* ============ 버튼 이벤트 ============ */
  yesButton.addEventListener("click", async () => {
    if (!currentUser || !currentUser.id) { console.warn("⚠️ 좋아요 할 사용자가 없습니다."); return; }
    try { await likeUser(currentUser.id); await createChatRoom(currentUser.id); } catch (err) { console.error("좋아요/채팅 생성 중 에러:", err); }
    await loadNextProfile();
  });

  noButton.addEventListener("click", async () => {
    if (!currentUser || !currentUser.id) { console.warn("⚠️ 싫어요 할 사용자가 없습니다."); return; }
    try { await dislikeUser(currentUser.id); } catch (err) { console.error("싫어요 중 에러:", err); }
    await loadNextProfile();
  });

  /* ============ 드롭다운 ============ */
  const subMenuLinks = document.querySelectorAll('.sub-menu a');
  const MODE_MAP = { "구인구직": 1, "통역": 2, "버디": 3, "연애/데이팅": 4, "서포터즈": 5 };
  const MODE_TEXT = Object.fromEntries(Object.entries(MODE_MAP).map(([text,val])=>[val,text]));

  function toggleArrow() { dropdownArrow.src = dropdownMenu.classList.contains('active') ? '../assets/images/home/dropdown-after.svg' : '../assets/images/home/dropdown-before.svg'; }

  async function initDropdown() {
    try {
      const data = await getMatchPreference();
      if (data && data.mode) {
        const modeText = MODE_TEXT[data.mode];
        if (modeText) {
          selectedText.textContent = modeText;
          subMenuLinks.forEach(a => { if (a.textContent === modeText) a.parentElement.style.display = 'none'; });
        }
      } else {
        selectedText.textContent = "서포터즈";
        subMenuLinks.forEach(a => { if (a.textContent === "서포터즈") a.parentElement.style.display = 'none'; });
      }
    } catch (err) { console.error("드롭다운 초기화 에러:", err); }
  }
  await initDropdown();

  dropdownMenu.addEventListener('click', (e) => { if (!e.target.closest('.sub-menu')) { dropdownMenu.classList.toggle('active'); toggleArrow(); } });
  document.addEventListener('click', (e) => { if (!dropdownMenu.contains(e.target) && dropdownMenu.classList.contains('active')) { dropdownMenu.classList.remove('active'); toggleArrow(); } });
  subMenuLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const newText = link.textContent;
      const oldText = selectedText.textContent;
      const mode = MODE_MAP[newText];
      try { await setMatchPreference(mode); console.log(`✅ 서버 저장 성공: ${mode}`); } catch (err) { console.error("매칭 모드 저장 실패:", err); }
      selectedText.textContent = newText;
      subMenuLinks.forEach(a => { if (a.textContent === oldText) a.parentElement.style.display = 'block'; });
      link.parentElement.style.display = 'none';
      dropdownMenu.classList.remove('active');
      toggleArrow();
    });
  });

  /* ============ 최초 로드 ============ */
  loadNextProfile();
});
