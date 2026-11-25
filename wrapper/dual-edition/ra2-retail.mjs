// Same retail projection as the paired Pages RA2 launcher. No YR archives,
// loose overrides, installers or executables are read or counted as game bytes.
export const RA2_REQUIRED = ['ra2.mix', 'language.mix', 'multi.mix'];
const rootMix = /^(?:ra2|language|multi|theme|audio|conquer|cameo|cache|local|generic|isogen|temperat|snow|urban|maps[0-9]{2}|movies[0-9]{2}|expand[0-9]{2}|ecache[a-z0-9]*|elocal[a-z0-9]*)\.mix$/i;
export function isRa2RetailPath(path) {
    if (/md[0-9]*\.mix$/i.test(path)) return false;
    return rootMix.test(path) || /^mixfiles\/movies[0-9]{2}\.mix$/i.test(path);
}
export function ownedRa2Entries(files, budget = 2 * 1024 ** 3) {
    if (!files.length || files.length > 12000) throw Error('文件为空或数量超出限制');
    // Names only: File bodies are not read until Start.
    const all = files.map(file => ({
        file, name: (file.webkitRelativePath || file.name).normalize('NFC'),
    }));
    const roots = all.filter(row => /(?:^|\/)ra2\.mix$/i.test(row.name)).map(row => row.name.slice(0, -7));
    if (roots.length !== 1) throw Error(roots.length ? '请选择一个游戏目录，不要混用多套资源' : '缺少 ra2.mix，请选原版游戏目录');
    const root = roots[0], rootKey = root.toLowerCase(), names = new Set();
    let total = 0;
    const entries = all.filter(row => row.name.toLowerCase().startsWith(rootKey) &&
        isRa2RetailPath(row.name.slice(root.length))).map(row => {
        const name = row.name, path = name.slice(root.length), key = path.toLowerCase();
        if (name.length > 1024 || /[\\:\x00-\x1f\x7f]/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..') || names.has(key)) throw Error('发现重复或无效的资源路径');
        names.add(key);
        if (!Number.isSafeInteger(row.file.size) || row.file.size < 1 || row.file.size > 1024 ** 3) throw Error('资源为空或过大：' + path);
        total += row.file.size;
        if (total > budget) throw Error('原版游戏资源超过 2 GiB');
        return {path, file: row.file};
    });
    const missing = RA2_REQUIRED.filter(name => !names.has(name));
    if (missing.length) throw Error('缺少：' + missing.join('、') + '。请选包含原版档案的游戏目录');
    return entries;
}
