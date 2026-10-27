import {deflateRawSync, crc32} from 'node:zlib';
import {writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const gameNames = ['ra2.mix','ra2md.mix','mapsmd03.mix','movmd03.mix'];
export const gameEntries = gameNames.map(name => ({name: `演示资源/${name}`, text: `SYNTHETIC TEST ONLY: ${name}`}));
export function zip(entries) {
  let offset = 0; const locals = [], central = [];
  for (const entry of entries) {
    const name = entry.nameBytes || Buffer.from(entry.name), bytes = Buffer.from(entry.text ?? ''), method = entry.method ?? 8;
    const packed = method === 8 ? deflateRawSync(bytes) : bytes, crc = crc32(bytes), flags = entry.flags ?? 0x800;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(entry.declared ?? bytes.length, 22); local.writeUInt16LE(name.length, 26);
    const header = Buffer.alloc(46); header.writeUInt32LE(0x02014b50); header.writeUInt16LE(0x0314, 4); header.writeUInt16LE(20, 6);
    header.writeUInt16LE(flags, 8); header.writeUInt16LE(method, 10); header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(packed.length, 20); header.writeUInt32LE(entry.declared ?? bytes.length, 24); header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE((entry.attrs ?? 0) >>> 0, 38); header.writeUInt32LE(offset, 42);
    locals.push(local, name, packed); central.push(header, name); offset += local.length + name.length + packed.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
if (process.argv.includes('--write')) {
  const folder = fileURLToPath(new URL('./fixtures/', import.meta.url)); mkdirSync(folder, {recursive: true});
  writeFileSync(`${folder}/valid.zip`, zip([{name:'演示资源/'}, ...gameEntries]));
  writeFileSync(`${folder}/replacement.zip`, zip(gameEntries.map(e => ({...e, text:`REPLACEMENT ${e.name}`}))));
  writeFileSync(`${folder}/traversal.zip`, zip([{name:'../ra2.mix',text:'unsafe'}, ...gameEntries]));
  writeFileSync(`${folder}/missing.zip`, zip([{name:'readme.txt',text:'No retail assets included.'}]));
  const damaged = zip(gameEntries); damaged[30 + Buffer.byteLength(gameEntries[0].name) + 2] ^= 0xff;
  writeFileSync(`${folder}/corrupt.zip`, damaged);
  const gameFolder = `${folder}/folder-game`; mkdirSync(gameFolder, {recursive: true});
  for (const name of gameNames) writeFileSync(`${gameFolder}/${name}`, `SYNTHETIC TEST ONLY: ${name}`);
  console.log('Synthetic fixtures written; contain no retail game data.');
}
