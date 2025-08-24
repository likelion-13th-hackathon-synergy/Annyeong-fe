// home.js
import { API_BASE_URL } from './config.js';
// 실제 API 연결은 이걸로 
// import { getRandomUser, likeUser, dislikeUser, getMatchPreference, setMatchPreference } from './api.js';

import { getRandomUser, likeUser, dislikeUser, getMatchPreference, setMatchPreference } from './mockApi.js'; // 테스트용 

let currentProfile = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("✅ DOMContentLoaded, 요소 연결 확인");

    const container = document.getElementById('card-container');
    const dropdownMenu = document.querySelector('.dropdown-menu'); 
    const selectedText = document.querySelector('.selected-text'); 
    const dropdownArrow = document.querySelector('.dropdown-arrow'); 
    const subMenuLinks = document.querySelectorAll('.sub-menu a');
    const yesButton = document.getElementById('yes-button');
    const noButton = document.getElementById('no-button');

    yesButton.disabled = true;
    noButton.disabled = true;

    // ======================= ✅ 랜덤 추천 + 카드 생성 + 스와이프 + 업데이트 
    // ======================= ✅ 랜덤 사용자 추천 
    async function loadNextProfile(){
        container.innerHTML = ''; // 기존 카드 제거
        try{
            const user = await getRandomUser();
            console.log("✅ getRandomUser result:", user);
            if(!user) return;
            currentProfile = user;
            currentUser = user;
            createProfileCard(user);
        } catch(err){ console.error("❌ loadNextProfile error:", err); }
    }

    // ======================= ✅ 프로필 카드 생성 
    function createProfileCard(profile){
        container.innerHTML = `
            <div class="card-wrapper">
                <div class="image-container">
                    <img class="profile-image type" src="${profile.profile_image || '../assets/images/home/type-1.svg'}">
                    <div class="card">
                        <h1 class="profile-name">${profile.real_name || profile.username}${profile.age != null ? " " + profile.age : ""} <span class="badge"></span></h1>
                        <p class="profile-location">${[profile.city, profile.nationality].filter(Boolean).join(" | ") || "위치 정보 없음"}</p>
                        <p class="profile-description">${profile.introduction || "소개글 없음."}</p>
                    </div>
                    <a href="../review/review-view.html"><img src="../assets/images/home/review.svg" class="review"></a>
                </div>
            </div>
        `;

        const cardWrapper = container.querySelector('.card-wrapper');
        let swipeLight = cardWrapper.querySelector('.swipe-light');

        yesButton.disabled = false;
        noButton.disabled = false;

        // ======================= ✅ 프로필 카드 스와이프 기능
        let startX = 0, currentX = 0, isDragging = false;

        if(!swipeLight) {
            swipeLight = document.createElement('div');
            swipeLight.className = 'swipe-light';
            document.getElementById('root').appendChild(swipeLight);
            Object.assign(swipeLight.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                zIndex: '999',
                pointerEvents: 'none',
                opacity: '0',
                transition: 'opacity 0.1s ease-in-out',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '70px 100%' // 폭 20px, 높이 100%
            });
        }

        function handleMove(x) {
            currentX = x - startX;
            cardWrapper.style.transform = `translateX(${currentX}px)`;

            // 화면 전체 불빛
            swipeLight.style.opacity = Math.min(Math.abs(currentX)/50, 1);
    
            if(currentX > 0){
                // 오른쪽 스와이프 → 초록색
                swipeLight.style.backgroundImage = `linear-gradient(to right, rgba(0,255,0,0) 0px, rgba(0,255,0,0.8) )`;
                swipeLight.style.backgroundPosition = 'right';
            } else {
                // 왼쪽 스와이프 → 빨간색
                swipeLight.style.backgroundImage = `linear-gradient(to left, rgba(255,0,0,0) 0px, rgba(255,0,0,0.8) )`;
                swipeLight.style.backgroundPosition = 'left';
            }
        }

        function handleEnd(){
            isDragging = false;
            if(Math.abs(currentX) > 100){
                cardWrapper.style.transition = 'transform 0.3s ease';
                cardWrapper.style.transform = `translateX(${currentX>0?1000:-1000}px)`;
                setTimeout(() => loadNextProfile(), 300);
            } else {
                cardWrapper.style.transition = 'transform 0.3s ease';
                cardWrapper.style.transform = 'translateX(0px)';
                setTimeout(() => { cardWrapper.style.transition = ''; }, 300);
            }
            // 불빛 초기화
            swipeLight.style.opacity = 0;
        }

        // 노트북 및 컴퓨터의 경우 
        cardWrapper.addEventListener('mousedown', e => { 
            startX = e.clientX; 
            isDragging = true; 
            cardWrapper.style.transition = ''; 
        });
        document.addEventListener('mousemove', e => { 
            if(!isDragging) return; 
            handleMove(e.clientX); 
        });

        document.addEventListener('mouseup', e => { 
            if(!isDragging) return; 
            handleEnd(); 
        });
        cardWrapper.addEventListener('mouseleave', () => { if(isDragging) handleEnd(); });

        // 모바일의 경우 
        cardWrapper.addEventListener('touchstart', e => { 
            startX = e.touches[0].clientX; 
            isDragging = true; 
            cardWrapper.style.transition = ''; 
        });

        document.addEventListener('touchmove', e => { 
            if(!isDragging) return; 
            handleMove(e.touches[0].clientX); 
        });

        document.addEventListener('touchend', e => { 
            if(!isDragging) return; 
            handleEnd(); 
        });

        updateProfileCard(profile, cardWrapper);
    }

    // ======================= ✅ 프로필 카드 내용 업데이트 
    function updateProfileCard(profile, cardElement){
        const imageEl = cardElement.querySelector('.profile-image');
        const nameEl = cardElement.querySelector('.profile-name');
        const locationEl = cardElement.querySelector('.profile-location');

        imageEl.src = profile.profile_image || '../assets/images/home/type-1.svg';
        nameEl.firstChild.nodeValue = (profile.real_name || profile.username) + " ";
        locationEl.textContent = [profile.city, profile.nationality].filter(Boolean).join(" | ") || "위치 정보 없음";

        handleMoreText(profile, cardElement);

        // ======================= ✅ 인증 뱃지 추가 
        const badgeContainer = cardElement.querySelector('.badge');
        badgeContainer.innerHTML = '';

        const verified = profile.google_verified === true || profile.google_verified === 1 || profile.google_verified === "1";
        if(verified){
            const badgeImg = document.createElement('img');
            badgeImg.src = '../assets/images/home/check.svg';
            badgeImg.classList.add('google-badge');
            badgeContainer.appendChild(badgeImg);
        }
    }

    // ======================= ✅ 채팅방 생성 요청 
    async function createChatRoom(receiverId) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/chat/chatrooms/`, {
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

            const data = await res.json();
            return data;
        } catch (err) {
            console.error("❌ createChatRoom fetch 에러:", err);
            return null;
        }
    }

    // ======================= ✅ 버튼 이벤트 (좋아요/싫어요)
    yesButton.addEventListener("click", async () => {
        if (!currentUser || !currentUser.id) {
            console.warn("⚠️ 좋아요 할 사용자가 없습니다.");
            return;
        }
        try {
            await likeUser(currentUser.id);
            await createChatRoom(currentUser.id);
        } catch (err) { console.error(err); }
        await loadNextProfile();
    });

    noButton.addEventListener("click", async () => {
        if (!currentUser || !currentUser.id) {
            console.warn("⚠️ 싫어요 할 사용자가 없습니다.");
            return;
        }
        try {
            await dislikeUser(currentUser.id);
        } catch (err) { console.error(err); }
        await loadNextProfile();
    });


    // ======================= ✅ 더보기 텍스트 제어
    function handleMoreText(profile, cardElement) {
        const descriptionElement = cardElement.querySelector('.profile-description');
        const fullDescription = profile.introduction || '';
        const maxCharacters = 50;   // short-text 글자 수
        const interval = 30;        // 줄바꿈 간격

        function insertLineBreaks(text, interval) {
            if (!text) return '';
            return text.replace(new RegExp(`(.{1,${interval}})`, 'g'), '$1<br>').replace(/<br>$/, '');
        }

        if(fullDescription.length > maxCharacters){
            const shortTextHTML = insertLineBreaks(fullDescription.substring(0, maxCharacters), interval);
            const fullTextHTML = insertLineBreaks(fullDescription, interval);

            descriptionElement.innerHTML = `
                <div class="short-text">${shortTextHTML}</div>
                <div class="full-text" style="display:none; max-height:150px; overflow-y:auto;">${fullTextHTML}</div>
                <div class="more-text" style="cursor:pointer; display:inline-block;">더보기</div>
            `;

            const moreBtn = descriptionElement.querySelector('.more-text');
            const shortText = descriptionElement.querySelector('.short-text');
            const fullText = descriptionElement.querySelector('.full-text');

            moreBtn.addEventListener('click', () => {
                shortText.style.display = 'none';
                fullText.style.display = 'block'; 
                fullText.style.whiteSpace = 'pre-wrap';   
                moreBtn.style.display = 'none';
            });
        } else {
            descriptionElement.innerHTML = `<div>${insertLineBreaks(fullDescription, interval)}</div>`;
        }
    }


    // ======================= ✅ 드롭다운 기능
    const MODE_MAP = { 
        "구인구직": 1,
        "통역": 2,
        "버디": 3,
        "연애/데이팅": 4,
        "서포터즈": 5  
    };
    const MODE_TEXT = Object.fromEntries(Object.entries(MODE_MAP).map(([text,value])=>[value,text]));

    function toggleArrow(){ 
        dropdownArrow.src = dropdownMenu.classList.contains('active') 
        ? '../assets/images/home/dropdown-after.svg' 
        : '../assets/images/home/dropdown-before.svg'; 
    }

    async function initDropdown(){
        try{
            const data = await getMatchPreference();
            if(data && data.mode){
                const modeText = MODE_TEXT[data.mode];
                if(modeText){
                    selectedText.textContent = modeText;
                    subMenuLinks.forEach(subLink => { 
                        if(subLink.textContent === modeText) subLink.parentElement.style.display = 'none'; 
                    });
                }
            } else {
                selectedText.textContent = "서포터즈";
                subMenuLinks.forEach(subLink => { 
                    if(subLink.textContent === "서포터즈") subLink.parentElement.style.display = 'none'; 
                });
            }
        } catch(err){ console.error(err); }
    }
    initDropdown();

    dropdownMenu.addEventListener('click', e => { 
        if(!e.target.closest('.sub-menu')){
            dropdownMenu.classList.toggle('active'); 
            toggleArrow(); 
        }
    });

    // 드롭다운 외부 클릭 시 닫기
    document.addEventListener('click', e => {
        if (!dropdownMenu.contains(e.target)) {
            if (dropdownMenu.classList.contains('active')) {
                dropdownMenu.classList.remove('active');
                toggleArrow();
            }
        }
    });

    subMenuLinks.forEach(link => {
        link.addEventListener('click', async e => {
            e.preventDefault();
            const newText = link.textContent;
            const oldText = selectedText.textContent;
            const mode = MODE_MAP[newText];
            await setMatchPreference(mode);
            console.log(`✅ 서버 저장 성공: ${mode}`); 

            selectedText.textContent = newText;
            subMenuLinks.forEach(subLink => { 
                if(subLink.textContent === oldText) subLink.parentElement.style.display = 'block'; 
            });
            link.parentElement.style.display = 'none';
            dropdownMenu.classList.remove('active'); 
            toggleArrow();
        });
    });

    // ======================= ✅ 
    loadNextProfile();

});