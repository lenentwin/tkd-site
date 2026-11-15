import type { LegalDocument } from '../src/legal/documents';
export type LegalSourceEntry = {file?: string;version: string;status: string;approvedBy: string;approvedAt: string};
export const unresolved: RegExp;
export function compileDocuments(registry: Record<string,LegalSourceEntry>,contents: Record<string,string>): LegalDocument[];
export function generate(check?: boolean,release?: boolean): Promise<void>;
