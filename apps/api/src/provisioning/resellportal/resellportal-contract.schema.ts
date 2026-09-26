import { z } from "zod";
import type {
  CatalogAvailability,
  ProductMappingRecord,
  ProductMappingSourceEvidence,
  ResellPortalContractGapDiagnostic,
  ResellPortalProductContract,
  VerificationStatus,
  VerifiedProductMapping,
} from "./resellportal-contract.types";

export const verificationStatusSchema = z.enum([
  "pending-verification",
  "verified",
  "disabled",
]) satisfies z.ZodType<VerificationStatus>;

export const catalogAvailabilitySchema = z.enum([
  "available",
  "unavailable",
  "unknown",
]) satisfies z.ZodType<CatalogAvailability>;

export const productMappingSourceEvidenceSchema = z.enum([
  "missing-contract",
  "verified-contract",
]) satisfies z.ZodType<ProductMappingSourceEvidence>;

const nullableString = z.string().min(1).nullable();

export const resellPortalProductContractSchema = z.object({
  externalId: z.string().min(1),
  externalKey: z.string().min(1).optional(),
  name: z.string().min(1),
  billingCycles: z.array(z.string().min(1)).readonly(),
  availability: catalogAvailabilitySchema,
  rawStatus: z.string().min(1),
}) satisfies z.ZodType<ResellPortalProductContract>;

export const productMappingRecordSchema = z
  .object({
    gchSlug: z.string().min(1),
    externalProductId: nullableString,
    externalProductKey: nullableString,
    billingCycle: nullableString,
    approvedOrderDestination: nullableString,
    verificationStatus: verificationStatusSchema,
    purchaseEnabled: z.boolean(),
    sourceEvidence: productMappingSourceEvidenceSchema,
  })
  .superRefine((record, ctx) => {
    if (record.verificationStatus === "verified" && record.sourceEvidence !== "verified-contract") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceEvidence"],
        message: "Verified mappings require verified-contract evidence.",
      });
    }

    if (!record.purchaseEnabled) {
      return;
    }

    if (record.verificationStatus !== "verified") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verificationStatus"],
        message: "Purchase-enabled mappings must be verified.",
      });
    }

    if (record.sourceEvidence !== "verified-contract") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceEvidence"],
        message: "Purchase-enabled mappings require verified-contract evidence.",
      });
    }

    for (const key of ["externalProductId", "billingCycle", "approvedOrderDestination"] as const) {
      if (!record[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Purchase-enabled mappings require ${key}.`,
        });
      }
    }
  }) satisfies z.ZodType<ProductMappingRecord>;

export const verifiedProductMappingSchema = productMappingRecordSchema
  .safeExtend({
    externalProductId: z.string().min(1),
    billingCycle: z.string().min(1),
    approvedOrderDestination: z.string().min(1),
    verificationStatus: z.literal("verified"),
    purchaseEnabled: z.literal(true),
    sourceEvidence: z.literal("verified-contract"),
  }) as z.ZodType<VerifiedProductMapping>;

export const resellPortalContractGapDiagnosticSchema = z.object({
  provider: z.literal("resellportal"),
  gchSlug: z.string().min(1).optional(),
  billingCycle: z.string().min(1).optional(),
  missingFacts: z
    .array(
      z.enum([
        "product-identifier-semantics",
        "billing-cycle-semantics",
        "availability-semantics",
        "order-destination-allowlist",
        "fulfillment-status-mapping",
        "provisioning-status-mapping",
        "idempotency-requirements",
        "retry-safety",
        "enabled-products-registry",
      ]),
    )
    .readonly(),
  verifiedFacts: z.array(z.string().min(1)).readonly(),
  summary: z.string().min(1),
}) satisfies z.ZodType<ResellPortalContractGapDiagnostic>;
