export function createWS(url, { onOpen, onMessage, onClose, onError } = {}) {
  let ws=null, retry=0, heartbeat=null;

  function connect(){
    ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      retry=0;
      // 핑 주기
      heartbeat = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type:"ping", t: Date.now() }));
      }, 20000);
      onOpen && onOpen();
    });

    ws.addEventListener("message", (e) => {
      try { onMessage && onMessage(JSON.parse(e.data)); } catch {}
    });

    ws.addEventListener("close", () => {
      clearInterval(heartbeat); heartbeat=null;
      onClose && onClose();
      setTimeout(connect, Math.min(10000, 500 * (2 ** retry++)));
    });

    ws.addEventListener("error", (err) => { onError && onError(err); });
  }
  connect();

  return {
    send(obj){
      if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(obj)); return true; }
      return false;
    },
    get ready(){ return ws && ws.readyState === WebSocket.OPEN; }
  };
}
