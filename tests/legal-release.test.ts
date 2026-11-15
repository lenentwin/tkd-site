import { describe, expect, it } from 'vitest';
import { compileDocuments } from '../scripts/legal-documents.mjs';
import { createHash } from 'node:crypto';
const types=['terms','privacy','user_consent','guardian_consent'];
const contents=Object.fromEntries(types.map(type=>[type,`# ${type}\r\n\r\nSynthetic legal text.\r\n`]));
function registry(status='draft') {return Object.fromEntries(types.map(type=>[type,{version:status==='draft'?'draft.1':'approved.1',status,approvedBy:status==='approved'?'Synthetic test authority':'',approvedAt:status==='approved'?'2026-11-15':''}]));}
describe('Legal release safeguards',()=>{
  it('normalizes full sources before fingerprinting without approving drafts',()=>{
    const result=compileDocuments(registry(),contents);
    expect(result).toHaveLength(4);expect(result.every(d=>d.status==='draft')).toBe(true);
    for(const document of result){expect(document.content).not.toContain('\r');expect(document.hash).toBe(createHash('sha256').update(document.content).digest('hex'));}
  });
  it('rejects approval of placeholders and unresolved source notes',()=>{
    for(const pending of ['[УТВЕРДИТЬ СРОК]','Предполагаемый оператор','До утверждения необходимо определить','Оператор должен проверить логи']){
      expect(()=>compileDocuments(registry('approved'),{...contents,terms:`# Terms\n${pending}`})).toThrow('Approval incomplete');
    }
  });
  it('requires real approval metadata and final version identifiers',()=>{
    for(const changes of [{approvedBy:''},{approvedAt:''},{version:'2026-draft.2'}]){const r=registry('approved');Object.assign(r.terms,changes);expect(()=>compileDocuments(r,contents)).toThrow();}
    expect(compileDocuments(registry('approved'),contents).every(d=>d.status==='approved')).toBe(true);
  });
});
