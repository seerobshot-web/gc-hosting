import { ResellPortalContractGapError } from "./resellportal-contract-gap.error";
import { verifiedProductMappingSchema } from "./resellportal-contract.schema";
import { resellPortalProductMappings } from "./resellportal-mapping.registry";
import type {
  ContractGapFact,
  ProductMappingRecord,
  ResellPortalContractGapDiagnostic,
  ResellPortalProductContract,
  VerifiedProductMapping,
} from "./resellportal-contract.types";

const defaultMissingFacts = [
  "product-identifier-semantics",
  "billing-cycle-semantics",
  "availability-semantics",
  "order-destination-allowlist",
  "fulfillment-status-mapping",
  "provisioning-status-mapping",
  "idempotency-requirements",
  "retry-safety",
] as const satisfies readonly ContractGapFact[];

const verifiedFacts = [
  "Mappings are resolved server-side from a static registry.",
  "Public tools remain non-purchasable until a verified mapping is explicitly enabled.",
  "Checkout guards do not trust browser-supplied external product identifiers or destinations.",
] as const;

interface MappingAssertionOptions {
  registry?: readonly ProductMappingRecord[];
  observedContract?: ResellPortalProductContract;
}

export function getProductMapping(
  gchSlug: string,
  registry: readonly ProductMappingRecord[] = resellPortalProductMappings,
): ProductMappingRecord | undefined {
  return registry.find((mapping) => mapping.gchSlug === gchSlug);
}

export function createResellPortalContractGapDiagnostic(
  summary: string,
  missingFacts: readonly ContractGapFact[],
  context: { gchSlug?: string; billingCycle?: string } = {},
): ResellPortalContractGapDiagnostic {
  return {
    provider: "resellportal",
    ...context,
    missingFacts: [...new Set(missingFacts)],
    verifiedFacts,
    summary,
  };
}

export function assertVerifiedPurchaseMapping(
  gchSlug: string,
  billingCycle: string,
  options: MappingAssertionOptions = {},
): VerifiedProductMapping {
  const mapping = getProductMapping(gchSlug, options.registry);
  if (!mapping) {
    throw new ResellPortalContractGapError(
      createResellPortalContractGapDiagnostic(
        `No approved product mapping exists for slug "${gchSlug}".`,
        [
          "enabled-products-registry",
          "product-identifier-semantics",
          "billing-cycle-semantics",
          "order-destination-allowlist",
        ],
        { gchSlug, billingCycle },
      ),
    );
  }

  if (mapping.verificationStatus === "pending-verification") {
    throw new ResellPortalContractGapError(
      createResellPortalContractGapDiagnostic(
        `Product mapping for slug "${gchSlug}" is still pending contract verification.`,
        defaultMissingFacts,
        { gchSlug, billingCycle },
      ),
    );
  }

  if (mapping.verificationStatus === "disabled" || !mapping.purchaseEnabled) {
    throw new ResellPortalContractGapError(
      createResellPortalContractGapDiagnostic(
        `Product mapping for slug "${gchSlug}" is disabled for purchase.`,
        ["enabled-products-registry"],
        { gchSlug, billingCycle },
      ),
    );
  }

  const missingFacts: ContractGapFact[] = [];
  if (!mapping.externalProductId) {
    missingFacts.push("product-identifier-semantics");
  }
  if (!mapping.billingCycle || mapping.billingCycle !== billingCycle) {
    missingFacts.push("billing-cycle-semantics");
  }
  if (!mapping.approvedOrderDestination) {
    missingFacts.push("order-destination-allowlist");
  }

  const contract = options.observedContract;
  if (contract) {
    if (contract.availability !== "available") {
      missingFacts.push("availability-semantics");
    }
    if (mapping.externalProductId && mapping.externalProductId !== contract.externalId) {
      missingFacts.push("product-identifier-semantics");
    }
    if (!contract.billingCycles.includes(billingCycle)) {
      missingFacts.push("billing-cycle-semantics");
    }
    if (contract.externalKey && mapping.externalProductKey !== contract.externalKey) {
      missingFacts.push("product-identifier-semantics");
    }
    if (!contract.externalKey && mapping.externalProductKey) {
      missingFacts.push("product-identifier-semantics");
    }
  }

  if (missingFacts.length > 0) {
    throw new ResellPortalContractGapError(
      createResellPortalContractGapDiagnostic(
        `Product mapping for slug "${gchSlug}" is incomplete for billing cycle "${billingCycle}".`,
        missingFacts,
        { gchSlug, billingCycle },
      ),
    );
  }

  return verifiedProductMappingSchema.parse(mapping);
}

export function isPurchaseEnabled(
  gchSlug: string,
  billingCycle?: string,
  registry: readonly ProductMappingRecord[] = resellPortalProductMappings,
): boolean {
  const mapping = getProductMapping(gchSlug, registry);
  if (!mapping) return false;
  if (!mapping.purchaseEnabled || mapping.verificationStatus !== "verified") return false;
  if (!mapping.externalProductId || !mapping.billingCycle || !mapping.approvedOrderDestination) {
    return false;
  }
  return billingCycle ? mapping.billingCycle === billingCycle : true;
}
