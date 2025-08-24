// i18n.js
export async function setLanguage(lang) {
    try {
        const response = await fetch(`../assets/i18n/${lang}.json`);
        if (!response.ok) throw new Error(`Failed to load ${lang}.json`);

        const langData = await response.json();
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.getAttribute('data-i18n-key');
            const text = langData[key];
            if (text) {
                if (el.tagName === 'IMG') {
                    el.alt = text;
                } else if (el.placeholder !== undefined) {
                    el.placeholder = text;
                } else {
                    el.textContent = text;
                }
            }
        });
    } catch (err) {
        console.error("다국어 파일 로딩 오류:", err);
    }
}

// 드롭다운 연결 및 초기 언어 적용까지 통합
export function initI18n() {
    const supportedLangs = ['ko', 'en'];
    const savedLang = localStorage.getItem('preferredLang');
    const initialLang = (savedLang && supportedLangs.includes(savedLang)) 
                        ? savedLang 
                        : (navigator.language.slice(0,2) || 'en');

    setLanguage(initialLang);

    const langSelect = document.getElementById('lang-select');
    if (!langSelect) return; // 드롭다운 없는 페이지는 그냥 종료

    langSelect.value = initialLang;
    langSelect.addEventListener('change', () => {
        const selectedLang = langSelect.value;
        setLanguage(selectedLang);
        localStorage.setItem('preferredLang', selectedLang);
    });
}

// DOMContentLoaded까지 포함
document.addEventListener('DOMContentLoaded', initI18n);