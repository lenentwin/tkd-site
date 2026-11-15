import documents from '../../backend/resources/legal-documents.json';
export type LegalDocumentType = 'terms' | 'privacy' | 'user_consent' | 'guardian_consent';
export type LegalDocument = {type: LegalDocumentType; title: string; version: string; hash: string; status: 'draft' | 'approved'; content: string};
export const LEGAL_DOCUMENTS = documents as LegalDocument[];
