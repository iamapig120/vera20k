/* Same-origin HTTPS transport for the serial VERA lobby worker. */
(() => {

globalThis.veraLobbyRequest = async function(path, token, body, limit) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 12000);
    try {
        if (!path.startsWith('/v1/')) throw new Error('invalid path');
        const headers = {'Accept': 'application/json'};
        if (token) headers.Authorization = 'Bearer ' + token;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const response = await fetch((globalThis.veraGatewayBase?.() || '') + path, {
            method: body === undefined ? 'GET' : 'POST', headers,
            body, credentials: 'omit', redirect: 'error', cache: 'no-store',
            signal: abort.signal
        });
        const endpoint = ['/v1/events', '/v1/commands', '/v1/accounts', '/v1/sessions', '/v1/channels', '/v1/maps'].find(route => path.startsWith(route)) || '/v1/other';
        if (response.status === 401) {
            console.warn(`Lobby HTTP failure: status=401, endpoint=${endpoint}, cursor_lost=false`);
            return JSON.stringify([401, '']);
        }
        const reader = response.body.getReader();
        let length = 0;
        const chunks = [];
        for (;;) {
            const {done, value} = await reader.read();
            if (done) break;
            length += value.length;
            if (length > limit) { abort.abort(); throw new Error('body too large'); }
            chunks.push(value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
        if (response.status >= 400) {
            let lost = false;
            try { lost = ['invalid_cursor', 'history_expired'].includes(JSON.parse(text)?.error?.code); } catch {}
            console.warn(`Lobby HTTP failure: status=${response.status}, endpoint=${endpoint}, cursor_lost=${lost}`);
        }
        return JSON.stringify([response.status, text]);
    } finally { clearTimeout(timer); }
};
globalThis.veraLobbyDelay = function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};
})();
