import type { Tone } from "@/components/ui";
import { getClientsForOrg, getProvisioningOrders, type ProvisioningOrder } from "./api-client";

export function orderTone(status: string): { tone: Tone; label: string } {
  switch (status) {
    case "deployed":
      return { tone: "success", label: "Active" };
    case "provisioning":
      return { tone: "warning", label: "Provisioning" };
    case "failed":
      return { tone: "danger", label: "Failed" };
    default:
      return { tone: "muted", label: status };
  }
}

/** Every provisioning order across the org's clients, newest first. */
export async function loadOrders(orgId: string, accessToken: string): Promise<ProvisioningOrder[]> {
  const clients = await getClientsForOrg(orgId, accessToken);
  const perClient = await Promise.all(
    clients.map((c) => getProvisioningOrders(c.id, accessToken).catch(() => [])),
  );
  return perClient.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
