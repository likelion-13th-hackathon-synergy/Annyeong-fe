export function startStatusbarClock({ selector = '.sb-time', hour12 = false, locale = 'ko-KR' } = {}) {
    const els = Array.from(document.querySelectorAll(selector));
    if (!els.length) return () => {};
  
    // hour12가 'auto'면 시스템 12/24h 선호를 따르고, 아니면 명시값을 사용
    const prefers12h = (hour12 === 'auto')
      ? new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12
      : !!hour12;
  
    const fmt = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: prefers12h, // false면 24시간제, AM/PM 텍스트 없음
    });
  
    const update = () => {
      const txt = fmt.format(new Date());
      els.forEach(el => { el.textContent = txt; });
    };
  
    let t1 = null, t2 = null;
    const schedule = () => {
      update();
      const now = new Date();
      const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      t1 = setTimeout(() => {
        update();
        t2 = setInterval(update, 60_000);
      }, msToNextMinute);
    };
  
    schedule();
  
    // 탭 복귀 시 시계 재동기화
    const onVis = () => {
      if (!document.hidden) {
        clearTimeout(t1); clearInterval(t2);
        schedule();
      }
    };
    document.addEventListener('visibilitychange', onVis);
  
    // 정리 함수 반환(필요하면 호출)
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(t1); clearInterval(t2);
    };
  }
  