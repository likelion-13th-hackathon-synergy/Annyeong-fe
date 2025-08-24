// mockApi.js
// 백엔드 서버 없이 하는 테스트용 데이터 반환

const MOCK_USERS = [
  {
    id: 1,
    username: "testuser1",
    real_name: "홍길동",
    age: 25,
    city: "서울",
    nationality: "대한민국",
    introduction: "안녕하세요! 저는 테스트 유저 1번입니다.",
    profile_image: "../assets/images/home/type-1.svg",
    google_verified: true,
  },
  {
    id: 2,
    username: "testuser2",
    real_name: "John Doe",
    age: 30,
    city: "부산",
    nationality: "미국",
    introduction: "Hello! This is mock user 2.",
    profile_image: "../assets/images/home/type-1.svg",
    google_verified: false,
  },
  {
    id: 3,
    username: "testuser3",
    real_name: "김춘추",
    age: 28,
    city: "일본",
    nationality: "한국",
    introduction: "안녕하세요! 테스트 유저 3번입니다.",
    profile_image: "../assets/images/home/type-1.svg",
    google_verified: true,
  }
];

let currentIndex = 0;

export async function getMatchPreference() {
  console.log("✅ mock getMatchPreference 호출됨");
  return Promise.resolve({ mode: 3 }); // 버디 모드
}

export async function setMatchPreference(mode) {
  console.log("✅ mock setMatchPreference:", mode);
  return Promise.resolve({ success: true });
}

export async function getRandomUser() {
  console.log("✅ mock getRandomUser 호출됨");
  if (MOCK_USERS.length === 0) {
    return Promise.resolve({ detail: "추천할 사용자가 존재하지 않습니다." });
  }
  const user = MOCK_USERS[currentIndex % MOCK_USERS.length];
  currentIndex++;
  return Promise.resolve(user);
}

export async function likeUser(userId) {
  console.log(`✅ mock likeUser: ${userId}`);
  return Promise.resolve({ success: true });
}

export async function dislikeUser(userId) {
  console.log(`✅ mock dislikeUser: ${userId}`);
  return Promise.resolve({ success: true });
}
