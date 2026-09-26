import type { ResellPortalContractGapDiagnostic } from "./resellportal-contract.types";

export class ResellPortalContractGapError extends Error {
  readonly code = "RESELLPORTAL_CONTRACT_GAP";

  constructor(readonly diagnostic: ResellPortalContractGapDiagnostic) {
    super(diagnostic.summary);
    this.name = "ResellPortalContractGapError";
  }
}
