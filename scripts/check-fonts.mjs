import { readFile } from "node:fs/promises";

function supports(buffer, point) {
  const tables = buffer.readUInt16BE(4);
  let cmap = 0;
  for (let index = 0; index < tables; index++) {
    const offset = 12 + index * 16;
    if (buffer.toString("ascii", offset, offset + 4) === "cmap")
      cmap = buffer.readUInt32BE(offset + 8);
  }
  if (!cmap) return false;
  const count = buffer.readUInt16BE(cmap + 2);
  for (let index = 0; index < count; index++) {
    const start = cmap + buffer.readUInt32BE(cmap + 4 + index * 8 + 4);
    const format = buffer.readUInt16BE(start);
    if (format === 12) {
      const groups = buffer.readUInt32BE(start + 12);
      for (let group = 0; group < groups; group++) {
        const offset = start + 16 + group * 12;
        const first = buffer.readUInt32BE(offset),
          last = buffer.readUInt32BE(offset + 4);
        if (point >= first && point <= last)
          return buffer.readUInt32BE(offset + 8) + point - first !== 0;
      }
    }
    if (format === 4 && point <= 0xffff) {
      const segments = buffer.readUInt16BE(start + 6) / 2;
      const ends = start + 14,
        starts = ends + segments * 2 + 2,
        deltas = starts + segments * 2,
        ranges = deltas + segments * 2;
      for (let segment = 0; segment < segments; segment++) {
        if (
          point < buffer.readUInt16BE(starts + segment * 2) ||
          point > buffer.readUInt16BE(ends + segment * 2)
        )
          continue;
        const range = buffer.readUInt16BE(ranges + segment * 2),
          delta = buffer.readInt16BE(deltas + segment * 2);
        const glyph =
          range === 0
            ? point
            : buffer.readUInt16BE(
                ranges +
                  segment * 2 +
                  range +
                  2 * (point - buffer.readUInt16BE(starts + segment * 2)),
              );
        return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
      }
    }
  }
  return false;
}
const characters = [
  ..."АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя",
];
for (const name of ["Regular", "Bold", "Book", "ExpandedBold"]) {
  const font = await readFile(
    new URL(`../Fonts/BebasNeuePro-${name}.ttf`, import.meta.url),
  );
  const missing = characters.filter(
    (character) => !supports(font, character.codePointAt(0)),
  );
  console.log(
    `${name}: ${characters.length - missing.length}/${characters.length} Cyrillic letters; missing: ${missing.join("") || "none"}`,
  );
  if (missing.length) process.exitCode = 1;
}
