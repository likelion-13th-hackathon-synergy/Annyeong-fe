// ws.js
export function createWS(url, { onOpen, onMessage, onClose, onError } = {}) {
  let ws = null;
  let retry = 0;

  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => { retry=0; onOpen && onOpen(); };
    ws.onmessage = (e) => { try { onMessage && onMessage(JSON.parse(e.data)); } catch {} };
    ws.onclose = () => {
      onClose && onClose();
      setTimeout(connect, Math.min(10000, (2 ** retry) * 500));
      retry++;
    };
    ws.onerror = (e) => { onError && onError(e); };
  }

  connect();

   function send(obj){
    if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(obj)); return true; }
    return false;
  }

  return {
    send,
    get ready(){ return ws && ws.readyState === WebSocket.OPEN; }  // ← 이거!
  };
}
