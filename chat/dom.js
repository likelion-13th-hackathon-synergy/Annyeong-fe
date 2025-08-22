// dom.js
export const $ = (sel) => document.querySelector(sel);

export function escapeHTML(str = "") {
  return str.replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
}

export function toTime(t) {
  try { return new Date(t).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
  catch { return ""; }
}

export function scrollToBottom(el) {
  if (el) el.scrollTop = el.scrollHeight;
}

// ✅ 누락된 onReady 함수 추가
export function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}
