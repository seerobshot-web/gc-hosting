/**
 * Phase 10 — Hostinger adapter boundary.
 *
 * CONTRACT GAP, not a partial implementation: no `@hostinger/sdk` package
 * (pinned at 1.54.1, per the plan) is present anywhere in this repository's
 * package manifests. There is no generated client to inspect and no method
 * this file can honestly claim is real, so nothing beyond this stub exists.
 * Adding a guessed method here would be exactly the "invented upstream
 * state" every phase of this plan treats as prohibited.
 *
 * To close this gap: add the pinned `@hostinger/sdk` dependency, run
 * whatever generates its client, inspect the generated method names and
 * signatures, and only then extend `HostingerAdapter` with methods that
 * exist verbatim in that generated output.
 */
export interface HostingerContractGap {
  reason: string;
  missingFacts: readonly string[];
}

export const hostingerAdapterContractGap: HostingerContractGap = {
  reason: "No @hostinger/sdk dependency exists in any package.json in this repository.",
  missingFacts: [
    "Whether @hostinger/sdk 1.54.1 is available to install here",
    "The generated client's actual exported methods and signatures",
    "Authentication method the generated client expects",
    "Which Hostinger operations (if any) this integration needs",
  ],
};

/**
 * Empty by design — see the contract gap above. Do not add a method here
 * without first inspecting the actual generated `@hostinger/sdk` output;
 * this type exists only so a future implementation has a named place to
 * grow into once that inspection has happened. `Record<string, never>`
 * (not an empty interface) so it can't be satisfied by an arbitrary value.
 */
export type HostingerAdapter = Record<string, never>;
// Add only methods confirmed in generated SDK types, replacing this alias
// with an interface once at least one real method exists.
