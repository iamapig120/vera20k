export function veraFetchFont(path) {
        return fetch(new URL(`../../fonts/${path}`, import.meta.url)).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.arrayBuffer();
        }).then((buffer) => new Uint8Array(buffer));
    }