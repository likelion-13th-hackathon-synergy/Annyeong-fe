// mock.js
export function startMockServer(wsUrl, roomId, otherName='상대') {
  window.__mockServers ||= {};
  if (window.__mockServers[wsUrl]) return;

  const Mock = window.MockSocket ?? window.Mock;
  if (!Mock?.Server || !Mock?.WebSocket) {
    console.error('mock-socket 전역을 찾지 못했습니다. CDN/순서 확인');
    return;
  }

  // ✅ 네이티브 → mock 으로 패치 (중복 방지)
  if (!window.__patchedMockWS) {
    window.__realWebSocket = window.WebSocket;
    window.WebSocket = Mock.WebSocket;
    window.__patchedMockWS = true;
  }

  const { Server } = Mock;
  const server = new Server(wsUrl);
  const clients = new Set();

  server.on('connection', (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type:'system', message:`Joined room ${roomId}`, timestamp:new Date().toISOString() }));

    socket.on('message', raw => {
      let obj; try { obj = JSON.parse(raw); } catch { return; }
      if (obj.type === 'ping') { socket.send(JSON.stringify({type:'pong'})); return; }
      if (obj.type === 'room.accept' || obj.type === 'room.decline') {
        clients.forEach(c => c.send(JSON.stringify({
          type:'system',
          message: obj.type === 'room.accept' ? '(요청)새로운 인연이 시작될까요? {이름}님이 호감을 표시했어요! 같은 #{공통관심사} 팬이네요! 반가워요 😄' : '상대가 대화를 거절했어요.',
          timestamp:new Date().toISOString()
        })));
        return;
      }
      if (obj.type === 'chat.message') {
        clients.forEach(c => c.send(JSON.stringify(obj)));
      }
    });

    socket.on('close', () => clients.delete(socket));
  });

  window.__mockServers[wsUrl] = server;
}
