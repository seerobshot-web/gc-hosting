/**
 * Domain events emitted by the provisioning orchestrator (Phase 5), the seam
 * out of provisioning the same way billing.events is the seam into it. The
 * ProvisioningService is the only emitter; downstream listeners (welcome email,
 * access grant, alerting) are the only consumers.
 *
 * Event names are stable strings — they double as the audit `action`.
 */

/** Emitted when a ResellPortal service is provisioned and the order is ACTIVE. */
export const SERVICE_PROVISIONED = "service.provisioned";

/** Emitted when provisioning exhausts its retries and the order is FAILED. */
export const SERVICE_PROVISIONING_FAILED = "service.provisioning_failed";

/** Payload for {@link SERVICE_PROVISIONED}. */
export interface ServiceProvisionedEvent {
  orderId: string;
  providerServiceId: string;
  /** The external ResellPortal service id now backing the order. */
  resellPortalId: string;
}

/** Payload for {@link SERVICE_PROVISIONING_FAILED}. */
export interface ServiceProvisioningFailedEvent {
  orderId: string;
  /** Human-readable failure reason (the last retry error message). */
  reason: string;
}
