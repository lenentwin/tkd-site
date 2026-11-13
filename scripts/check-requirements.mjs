import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const source = await readFile(
  new URL("../docs/sources/Prompt.md", import.meta.url),
);
const checklist = await readFile(
  new URL("../REQUIREMENTS_CHECKLIST.md", import.meta.url),
  "utf8",
);
const audit = await readFile(
  new URL("../SUBAGENT_REQUIREMENTS_REVIEW.md", import.meta.url),
  "utf8",
);
const lines = source.toString("utf8").split(/\r?\n/);
if (lines.at(-1) === "") lines.pop();
const sections = lines.flatMap((line, index) => {
  const match = line.match(/^\\# (\d+)\. (.+)$/);
  return match
    ? [{ number: Number(match[1]), title: match[2], start: index + 1 }]
    : [];
});
assert.equal(sections.length, 39);
for (const [index, section] of sections.entries()) {
  assert.equal(section.number, index + 1);
  const end = sections[index + 1]?.start - 1 || lines.length;
  assert.ok(
    checklist.includes(
      `## ${section.number}. ${section.title} — строки ${section.start}–${end}`,
    ),
    `Checklist section ${section.number} missing`,
  );
  assert.ok(
    audit.includes(
      `| ${section.number} | ${section.title} | ${section.start}–${end} |`,
    ),
    `Subagent section ${section.number} missing`,
  );
}
assert.equal(lines.length, 4270);
assert.equal(source.length, 110692);
const hash = createHash("sha256").update(source).digest("hex").toUpperCase();
assert.equal(
  hash,
  "1EA1CD33838A558DF8688B2B6B8CD109C706D43CAE7E7EDAB7B17E8A4DF99C7A",
);
if (process.argv[2])
  assert.equal(
    createHash("sha256")
      .update(await readFile(process.argv[2]))
      .digest("hex")
      .toUpperCase(),
    hash,
  );
console.log(
  JSON.stringify({
    bytes: source.length,
    lines: lines.length,
    sections: sections.length,
    checklist: "39/39",
    independentAudit: "39/39",
    finalSection: [4201, 4270],
    sha256: hash,
  }),
);
