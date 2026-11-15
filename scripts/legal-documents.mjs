import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
export const unresolved = /\[(?:УКАЗАТЬ|УТВЕРДИТЬ|ОФИЦИАЛЬНЫЙ)[^\]]*\]|предполагаем(?:ый|ая)|до утверждения|оператор должен проверить/iu;
export function compileDocuments(registry, contents) {
  const types = ['terms','privacy','user_consent','guardian_consent'];
  if (Object.keys(registry).length !== 4) throw new Error('Four legal documents required');
  return types.map(type => {
    const item = registry[type];
    const content = contents[type].replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim() + '\n';
    if (!item || !/^[a-zA-Z0-9._-]{1,64}$/.test(item.version) || !['draft','approved'].includes(item.status)) throw new Error(`Invalid registry: ${type}`);
    if (!content.startsWith('# ')) throw new Error(`Missing title: ${type}`);
    if (item.status === 'approved' && (unresolved.test(content) || /draft/i.test(item.version) || !item.approvedBy?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(item.approvedAt))) throw new Error(`Approval incomplete: ${type}`);
    return { type, title: content.split('\n')[0].slice(2), version: item.version, hash: createHash('sha256').update(content).digest('hex'), status: item.status, content };
  });
}
export async function generate(check = false, release = false) {
  const registry = JSON.parse(await readFile(new URL('docs/legal-drafts/registry.json', root), 'utf8'));
  const contents = Object.fromEntries(await Promise.all(Object.entries(registry).map(async ([type,item]) => {
    if (!/^[a-z-]+\.md$/.test(item.file)) throw new Error('Invalid source path');
    return [type, await readFile(new URL(`docs/legal-drafts/${item.file}`, root), 'utf8')];
  })));
  const documents = compileDocuments(registry,contents);
  if (release && documents.some(doc => doc.status !== 'approved')) throw new Error('Legal release blocked: documents are drafts');
  const output = JSON.stringify(documents,null,2) + '\n';
  const target = new URL('backend/resources/legal-documents.json',root);
  if (check) { if (await readFile(target,'utf8') !== output) throw new Error('Legal bundle stale: npm run legal:generate'); }
  else await writeFile(target,output);
  console.log(`Legal documents: ${documents.length}; ${documents.filter(doc=>doc.status==='approved').length} approved; ${check?'verified':'generated'}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await generate(process.argv.includes("--check"),process.argv.includes("--release"));
