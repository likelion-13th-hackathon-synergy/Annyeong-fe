export const HTTP_ORIGIN = 'http://localhost:8000';
export const WS_ORIGIN   = 'ws://localhost:8000';

export function wsUrlForRoom(roomName) {
  const proto = (WS_ORIGIN.startsWith('wss') || location.protocol === 'https:') ? 'wss' : 'ws';
  const base  = WS_ORIGIN.replace(/^ws(s)?:\/\//, '');
  return `${proto}://${base}/ws/chat/${encodeURIComponent(roomName)}/`;
}