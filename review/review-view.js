const dummyCounts = [
  426, 416, 343, 177, 122, 121, 96, 80,
  63, 52, 37, 24, 20, 18, 15, 10
];

const listEl = document.getElementById('reviewList');
const items = Array.from(listEl.querySelectorAll('li'));
const maxCount = Math.max(...dummyCounts, 1);

// 각 li 항목에 라벨과 카운트 삽입 + 막대 채움 비율 설정
items.forEach((li, idx) => {
  const count = dummyCounts[idx];
  const labelText = li.textContent.trim();

  // li 내용 비우고 다시 채움
  li.textContent = '';
  const labelSpan = document.createElement('span');
  labelSpan.className = 'review-label';
  labelSpan.textContent = labelText;

  const countSpan = document.createElement('span');
  countSpan.className = 'review-count';
  countSpan.textContent = count;

  li.appendChild(labelSpan);
  li.appendChild(countSpan);

  const pct = (count / maxCount) * 85;
  li.style.setProperty('--w', pct + '%');
});