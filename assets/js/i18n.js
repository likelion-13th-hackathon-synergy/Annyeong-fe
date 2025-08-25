// assets/js/i18n.js
const STORE_KEY = "preferredLang";
const SUPPORTED = ["ko", "en"];
// 사전 폴더를 모듈 기준으로 안전하게 계산 (페이지 경로와 무관)
function dictUrl(lang) {
  return new URL(`../i18n/${lang}.json`, import.meta.url).href;
 }
let current = null;
const cache = {};  // 언어별 JSON 캐시

function detect() {
  const nav = (navigator.language || "en").slice(0, 2);
  return SUPPORTED.includes(nav) ? nav : "en";
}

export function getLang() {
  return current || localStorage.getItem(STORE_KEY) || detect();
}

export async function initI18n() {
  const saved = localStorage.getItem(STORE_KEY);
  const initial = saved && SUPPORTED.includes(saved) ? saved : detect();
  await setLanguage(initial, { persist: false });
}

export async function toggleLang() {
  const next = getLang() === "ko" ? "en" : "ko";
  await setLanguage(next);
  return next;
}

export async function setLanguage(lang, { persist = true } = {}) {
  if (!SUPPORTED.includes(lang)) lang = "en";
  if (persist) localStorage.setItem(STORE_KEY, lang);
  current = lang;

  if (!cache[lang]) {
    const res = await fetch(dictUrl(lang), { cache: "no-store" });
     cache[lang] = res.ok ? await res.json() : {};
   }
  document.documentElement.lang = lang;
  applyTranslations(cache[lang]);
}

export function applyTranslations(dict, root = document) {
  root.querySelectorAll("[data-i18n-key]").forEach(el => {
    const key = el.getAttribute("data-i18n-key");
    const val = dict[key];
    if (val == null) return;

    // 특정 속성에 넣고 싶으면 data-i18n-attr="placeholder|title|aria-label" 등
    const targetAttr = el.getAttribute("data-i18n-attr");
    if (targetAttr) {
      el.setAttribute(targetAttr, val);
      return;
    }

    if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && "placeholder" in el) {
      el.placeholder = val;
    } else if (el.tagName === "IMG") {
      el.alt = val;
    } else {
      el.textContent = val;
    }
  });
}
