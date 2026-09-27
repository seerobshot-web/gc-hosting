/**
 * Reversible gate for Phase 8's tenant-scoped audit read. Setting this back
 * to false instantly restores the pre-Phase-8 fail-closed 503 with no
 * other code change — the same rollback lever used for the Phase 6 writer
 * rollout allowlist. Flip it, don't revert the whole feature, on a faulty
 * cutover.
 */
export const AUDIT_READ_RESTORATION_ENABLED = true;
