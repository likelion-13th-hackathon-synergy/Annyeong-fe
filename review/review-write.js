const before = document.referrer;

const MAX = 5; //최대 다섯개 선택 가능
const selected = new Set();
const $options = document.querySelectorAll('#options .opt');
const $counter = document.getElementById('selCounter');
const $done = document.getElementById('review-send-btn');

function updateCounter() {
  $counter.textContent = `${selected.size}/${MAX}`;
  $done.disabled = selected.size === 0;
}

$options.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = Number(btn.dataset.id);
    const willSelect = !selected.has(id);

    if (willSelect && selected.size >= MAX) {
      btn.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(0)' }
        ],
        { duration: 200 }
      );
      return;
    }

    if (willSelect) {
      selected.add(id);
      btn.dataset.checked = 'true';
    } else {
      selected.delete(id);
      btn.dataset.checked = 'false';
    }
    updateCounter();
  });
});

/*$done.addEventListener('click', () => {
  const payload = {
    target_id: 'user:sonya',
    option_ids: Array.from(selected)
  };
  console.log(payload);
  alert(`선택 완료: ${payload.option_ids.join(', ')}`);
});
*/
updateCounter();

//뒤로 가기 버튼
document.addEventListener('DOMContentLoaded', ()=>{
  const backBtn = document.querySelector('.back-btn');
  backBtn.addEventListener('click', ()=>{
    window.location.href = before;
  })
});