document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.querySelector("#startBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "../login/login.html";
    });
  }
});