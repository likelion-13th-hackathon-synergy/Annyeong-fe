// 구글 계정 연동 상태를 확인하는 가상의 함수
function isGoogleAccountLinked() {
  // 실제로는 구글 로그인 API 사용해 로그인 상태를 확인하는 로직이 들어갈 예정!
  // 예시를 위해 일단 항상 true를 반환한다고 가정
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. 프로필 이미지 컨테이너 찾기
  const profileContainer = document.querySelector('.badge');
  
  // 2. 구글 계정 연동 상태 확인
  if (isGoogleAccountLinked()) {
    // 3. 뱃지 이미지 생성 
    const badgeImg = document.createElement('img');
    badgeImg.src = '../assets/images/check.svg'; // 뱃지 이미지 경로
    badgeImg.classList.add('google-badge'); // CSS 스타일링을 위한 클래스 추가
    
    // 4. 생성된 뱃지 이미지를 프로필 컨테이너에 추가
    profileContainer.appendChild(badgeImg);
  }
});


// 드롭다운 메뉴 설정 함수
const dropdownToggle = document.querySelector('.dropdown');
const selectedMenuText = dropdownToggle.querySelector('.selected-menu-text');
const subMenuLinks = dropdownToggle.querySelectorAll('.sub-menu a');

// 1. 드롭다운 메뉴 클릭 이벤트 
selectedMenuText.addEventListener('click', function(e) {
  dropdownToggle.classList.toggle('active');
});

// 1-1. 마우스가 드롭다운 영역을 벗어나면 메뉴 닫기
dropdownToggle.addEventListener('mouseleave', function() {
    dropdownToggle.classList.remove('active');
});

// 2. 하위 메뉴 항목 클릭 이벤트
subMenuLinks.forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault(); // 링크 이동 방지
            
    // 클릭된 항목의 텍스트를 가져와서 상위 메뉴에 반영
    const newText = this.textContent;
    selectedMenuText.textContent = newText + ' ▼';
            
    // 메뉴를 닫기 위해 active 클래스 제거
    dropdownToggle.classList.remove('active');
  });
});

// 3. 드롭다운 메뉴 외 다른 곳 클릭 시 메뉴 닫기
document.addEventListener('click', function(e) {
  if (!e.target.closest('.dropdown')) {
    dropdownToggle.classList.remove('active');
  }
});
