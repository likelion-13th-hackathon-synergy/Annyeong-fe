// ws.js
export function createWS(url, { onOpen, onMessage, onClose, onError } = {}) {
  let ws = null;
  let manuallyClosed = false;
  let retry = 0;
  let heartbeatTimer = null;

  const HEARTBEAT_MS = 25000;
  const MAX_BACKOFF_MS = 10000;

  function connect() {
    ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      retry = 0;
      startHeartbeat();
      onOpen && onOpen();
    });

    ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        onMessage && onMessage(data);
      } catch {
        console.warn('Non-JSON message:', evt.data);
      }
    });

    ws.addEventListener('close', (evt) => {
      stopHeartbeat();
      onClose && onClose(evt);
      if (!manuallyClosed) {
        const backoff = Math.min(MAX_BACKOFF_MS, (2 ** retry) * 500);
        retry += 1;
        setTimeout(connect, backoff);
      }
    });

    ws.addEventListener('error', (err) => {
      onError && onError(err);
      // 보통 error 뒤에 close가 옵니다.
    });
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      send({ type: 'ping', t: Date.now() });
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  function close() {
    manuallyClosed = true;
    stopHeartbeat();
    if (ws) ws.close();
  }

  connect();

  return {
    send,
    close,
    get ready() {
      return ws && ws.readyState === WebSocket.OPEN;
    },
  };
}
