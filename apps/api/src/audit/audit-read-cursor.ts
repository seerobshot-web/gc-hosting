/**
 * Opaque keyset cursor for the tenant-scoped audit read (Phase 8), matching
 * the `(orgId, createdAt, id) / ORDER BY createdAt DESC, id DESC` design
 * approved in AUDIT-PHASE3-APPROVAL-RECORD.md. Encodes only createdAt and
 * id — never orgId or any other value a caller could use to probe another
 * tenant's rows.
 */
export interface AuditReadCursor {
  createdAt: Date;
  id: string;
}

const SEPARATOR = "|";

export function encodeAuditReadCursor(cursor: AuditReadCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}${SEPARATOR}${cursor.id}`, "utf8").toString(
    "base64url",
  );
}

/** Returns null for anything malformed — the caller must treat that as an
 *  invalid request, never as "start from the beginning" silently. */
export function decodeAuditReadCursor(raw: string): AuditReadCursor | null {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const separatorIndex = decoded.indexOf(SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === decoded.length - 1) return null;
  const iso = decoded.slice(0, separatorIndex);
  const id = decoded.slice(separatorIndex + 1);
  if (!id.trim()) return null;
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}
