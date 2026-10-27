/* Datagram transport only; the engine owns relay credentials and reliability. */
(() => {
  const sockets = new Map();
  let next = 1;
  globalThis.veraSocketOpen = channel => {
    if (!['primary', 'alternate'].includes(channel) || !['http:', 'https:'].includes(location.protocol)) {
      throw new Error('Open the game through the Web gateway');
    }
    const base = globalThis.veraGatewayBase?.() || location.href;
    const url = new URL(`/game/${channel}`, base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    const state = {ws, packets: [], failed: false};
    const id = next++;
    sockets.set(id, state);
    ws.onmessage = ({data}) => {
      if (!(data instanceof ArrayBuffer) || data.byteLength > 2048) { state.failed = true; ws.close(); return; }
      if (state.packets.length < 256) state.packets.push(new Uint8Array(data));
    };
    ws.onerror = ws.onclose = () => { state.failed = true; };
    return id;
  };
  globalThis.veraSocketSend = (id, bytes) => {
    const state = sockets.get(id);
    if (!state || state.failed) return 2;
    if (state.ws.readyState !== WebSocket.OPEN || state.ws.bufferedAmount > 262144) return 1;
    if (bytes.length > 2048) return 2;
    try { state.ws.send(bytes); return 0; } catch { state.failed = true; return 2; }
  };
  globalThis.veraSocketReceive = id => {
    const state = sockets.get(id);
    if (!state) return undefined;
    return state.packets.shift() ?? (state.failed ? undefined : null);
  };
  globalThis.veraSocketClose = id => {
    const state = sockets.get(id);
    if (!state) return;
    sockets.delete(id);
    state.ws.onmessage = state.ws.onerror = state.ws.onclose = null;
    state.ws.close();
  };
})();
