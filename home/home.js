// ✅ 1. API에서 받아올 가상의 프로필 데이터
const mockProfiles = [
    {
        name: '🇷🇺 Sonya 24',
        location: '서울 | 한국어·러시아어',
        description: '"연세대 교환학생이에요!\n한국 친구들과 언어교환하며 공부하고 싶어요!..."', 
        image: '../assets/images/home/type-1.svg' 
    },
    {
        name: '🇷🇺 Yuki 26',
        location: '경기도 | 한국어·일본어',
        description: '"한국에서 일하는 일본인이에요!\n한국 친구들과 깊은 대화 나누고 싶어요😊"', 
        image: '../assets/images/home/type-2.svg' 
    },
    {
        name: '🇨🇳 Minjun 23',
        location: '부산 | 한국어·중국어',
        description: '"요즘 힙한 카페 투어를 좋아해요!\n해운대에서 같이 산책하고 사진 찍을 친구 구해요:)\n더미데이터를 위해 추가된 긴 텍스트~~~~"',
        image: '../assets/images/home/type-1.svg'
    }
];

let currentProfileIndex = 0;

// 구글 계정 연동 상태를 확인하는 가상의 함수
function isGoogleAccountLinked() {
  return true;
}

// ✅ 2. "더보기" 텍스트를 제어하는 함수
function handleMoreText(profile) {
    const descriptionElement = document.getElementById('profile-description');
    const fullDescription = profile.description;
    
    // 줄바꿈 문자를 포함하여 텍스트 길이를 계산
    const maxCharacters = 60;

    if (fullDescription.length > maxCharacters) {
        // 텍스트가 길면 일부만 보여주고 '더보기'를 추가
        const trimmedText = fullDescription.substring(0, maxCharacters).replace(/\n/g, '<br>');
        descriptionElement.innerHTML = `
            <span class="short-text">${trimmedText}...</span>
            <span class="full-text" style="display:none;">${fullDescription.replace(/\n/g, '<br>')}</span>
            <span class="more-text" style="cursor:pointer;">더보기</span>
        `;

        const moreBtn = descriptionElement.querySelector('.more-text');
        const shortText = descriptionElement.querySelector('.short-text');
        const fullText = descriptionElement.querySelector('.full-text');

        moreBtn.addEventListener('click', () => {
            shortText.style.display = 'none';
            fullText.style.display = 'inline';
            moreBtn.style.display = 'none'; // "더보기" 버튼 숨김
        });
    } else {
        // 텍스트가 짧으면 전체 내용을 보여줌
        descriptionElement.innerHTML = fullDescription.replace(/\n/g, '<br>');
    }
}

// ✅ 3. 프로필 카드 내용을 업데이트하는 함수
function updateProfileCard(profile) {
    const profileImage = document.getElementById('profile-image');
    const profileName = document.getElementById('profile-name');
    const profileLocation = document.getElementById('profile-location');
    const badgeContainer = document.querySelector('.badge');

    // 이름만 갱신 (badge는 그대로 유지)
    profileName.firstChild.nodeValue = profile.name + " ";
    
    profileImage.src = profile.image;
    profileLocation.textContent = profile.location;
    
    // "더보기" 로직
    handleMoreText(profile);
    
    // 뱃지 로직
    badgeContainer.innerHTML = '';

    if (isGoogleAccountLinked()) {
        const badgeImg = document.createElement('img');
        badgeImg.src = '../assets/images/home/check.svg';
        badgeImg.classList.add('google-badge');
        badgeContainer.appendChild(badgeImg);
    }
}

// 다음 프로필을 보여주는 함수
function showNextProfile() {
    currentProfileIndex = (currentProfileIndex + 1) % mockProfiles.length;
    const nextProfile = mockProfiles[currentProfileIndex];
    updateProfileCard(nextProfile);
}

// 'DOMContentLoaded' 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    updateProfileCard(mockProfiles[currentProfileIndex]);
});

// '싫어요' 버튼 클릭 이벤트 리스너
const noButton = document.getElementById('no-button');
noButton.addEventListener('click', showNextProfile);

// '좋아요' 버튼 클릭 이벤트 리스너
const yesButton = document.getElementById('yes-button');
yesButton.addEventListener('click', () => {
    console.log('다음 프로필을 보여줍니다.');
    showNextProfile();
});

// ✅ 4. 드롭다운 메뉴 설정 함수 
const dropdownMenu = document.querySelector('.dropdown-menu');
const selectedText = dropdownMenu.querySelector('.selected-text');
const subMenuLinks = dropdownMenu.querySelectorAll('.sub-menu a');
const dropdownArrow = dropdownMenu.querySelector('.dropdown-arrow');

// 드롭다운 시 화살표 이미지 변경 함수
function toggleArrow() {
    if (dropdownMenu.classList.contains('active')) {
        dropdownArrow.src = '../assets/images/home/dropdown-after.svg';
    } else {
        dropdownArrow.src = '../assets/images/home/dropdown-before.svg';
    }
}

// 4-1. 드롭다운 메뉴 클릭
dropdownMenu.addEventListener('click', function(e) {
    // 하위 메뉴 클릭 시 이벤트 버블링 방지
    if (e.target.closest('.sub-menu')) {
      return;
    }
    // 드롭다운 토글 
    this.classList.toggle('active');
    toggleArrow();
});

// 4-2. 하위 메뉴 항목 클릭 이벤트 
subMenuLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
    
      const newText = this.textContent;
      const oldText = selectedText.textContent;

      // 클릭된 항목의 텍스트를 상위 메뉴에 반영
      selectedText.textContent = newText;

      // 기존에 상단에 있던 항목을 다시 서브메뉴에 보이도록 처리함 
      subMenuLinks.forEach(subLink => {
        if (subLink.textContent === oldText) {
          subLink.parentElement.style.display = 'block';
        }
      });

      // 새로 선택된 항목을 서브메뉴에서 숨기기
      this.parentElement.style.display = 'none';

      // 메뉴를 닫기 위해 active 클래스 제거
      dropdownMenu.classList.remove('active');
      toggleArrow();
    });
});

// 4-3. 드롭다운 메뉴 외 다른 곳 클릭 시 메뉴 닫기
document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown-menu')) {
        dropdownMenu.classList.remove('active');
        toggleArrow();
    }
});

// 4-4. 마우스가 드롭다운 메뉴 영역을 벗어났을 때 메뉴 닫기
dropdownMenu.addEventListener('mouseleave', function() {
    // 드롭다운 메뉴에서 마우스가 벗어나면 active 클래스 제거하여 메뉴 닫기
    dropdownMenu.classList.remove('active');
    toggleArrow();
});