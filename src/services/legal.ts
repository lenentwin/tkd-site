import { z } from "zod";
import { request as clubRequest } from "./club";

export const legalDocumentTypeSchema = z.enum(["terms", "privacy", "user_consent", "guardian_consent"]);
export const legalDocumentMetadataSchema = z.object({
  type: legalDocumentTypeSchema,
  version: z.string().min(1),
  hash: z.string().regex(/^[a-f0-9]{64}$/i),
  status: z.enum(["draft", "approved"]),
  title: z.string().min(1),
});
export const legalStateSchema = z.object({
  ok: z.literal(true),
  documents: z.array(legalDocumentMetadataSchema),
  enforcement: z.boolean(),
  required: z.boolean(),
  accepted: z.array(z.object({ type: legalDocumentTypeSchema, version: z.string(), hash: z.string().regex(/^[a-f0-9]{64}$/i), confirmedAt: z.string() })),
  canAccept: z.boolean(),
});
export type LegalDocumentType = z.infer<typeof legalDocumentTypeSchema>;
export type LegalDocumentMetadata = z.infer<typeof legalDocumentMetadataSchema>;
export type LegalDocument = LegalDocumentMetadata & { content: string };
export type LegalState = z.infer<typeof legalStateSchema>;
export type LegalAcceptanceInput = Pick<LegalDocumentMetadata, "type" | "version" | "hash"> & { accepted: true };

export const accountLegalTypes = ["terms", "user_consent"] as const;
export const legalPaths: Record<LegalDocumentType, string> = {
  terms: "/legal/terms", privacy: "/legal/privacy",
  user_consent: "/legal/user-consent", guardian_consent: "/legal/guardian-consent",
};

export function pendingAccountDocuments(state: LegalState): LegalDocumentMetadata[] {
  return state.documents.filter((document) => accountLegalTypes.some((type) => type === document.type) &&
    !state.accepted.some((accepted) => accepted.type === document.type && accepted.version === document.version && accepted.hash === document.hash));
}

// The user must read the exact approved bytes described by the server, not an old cached edition.
export function matchingApprovedDocument(metadata: LegalDocumentMetadata, documents: readonly LegalDocument[]): LegalDocument | undefined {
  if (metadata.status !== "approved") return undefined;
  return documents.find((document) => document.type === metadata.type && document.status === "approved" &&
    document.version === metadata.version && document.hash === metadata.hash);
}

export const legalApi = {
  state: () => clubRequest("legal", legalStateSchema),
  accept: (documents: LegalAcceptanceInput[]) => clubRequest("legal-accept", legalStateSchema, {}, { documents }),
};
