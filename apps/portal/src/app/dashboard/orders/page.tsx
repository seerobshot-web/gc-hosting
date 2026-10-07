import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { deals, catalogVersion } from "@gch/commerce";
import { CheckoutButton } from "./CheckoutButton";
import { getSession } from "@/lib/session";
import { savePrepaidIntake, startPrepaidCheckout, uploadBrandIntake } from "./actions";
interface Order {
  id: string;
  dealId: string;
  status: string;
  paidAt: string | null;
  primaryDomain: string | null;
  cpanelUsername: string | null;
}
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const base = process.env.GCH_API_URL ?? "http://localhost:3333";
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const [ordersResponse, catalogResponse] = await Promise.all([
    fetch(`${base}/commerce/orders`, { headers, cache: "no-store" }),
    fetch(`${base}/commerce/catalog`, { cache: "no-store" }),
  ]);
  const orders: Order[] = ordersResponse.ok ? await ordersResponse.json() : [];
  const catalog: { items: { id: string; available: boolean }[] } = catalogResponse.ok
    ? await catalogResponse.json()
    : { items: [] };
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Your prepaid orders</h1>
      {params.error && (
        <p role="alert">We could not complete that request. Please contact the team.</p>
      )}
      {!ordersResponse.ok && <p role="alert">Orders are temporarily unavailable.</p>}
      {deals
        .filter((d) => catalog.items.some((i) => i.id === d.id && i.available))
        .map((deal) => (
          <form key={deal.id} action={startPrepaidCheckout}>
            <input type="hidden" name="requestKey" value={randomUUID()} />
            <input type="hidden" name="dealId" value={deal.id} />
            <CheckoutButton dealId={deal.id} version={catalogVersion}>
              Order {deal.name} —{" "}
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                deal.price.cents! / 100,
              )}
            </CheckoutButton>
          </form>
        ))}
      {ordersResponse.ok && !orders.length && (
        <p className="my-6">You have no prepaid orders yet.</p>
      )}
      {orders.map((order) => (
        <article key={order.id} className="my-8 rounded-xl border p-6">
          <h2 className="text-xl font-bold">
            {deals.find((d) => d.id === order.dealId)?.name ?? "Prepaid order"}
          </h2>
          <p className="my-3">Status: {order.status.toLowerCase()}</p>
          <ol className="flex flex-wrap gap-4" aria-label="Order timeline">
            {[
              "Paid",
              "Provisioning",
              deals.find((d) => d.id === order.dealId)?.fulfillment === "human"
                ? "Delivered"
                : "Deployed",
              "Active",
            ].map((label, index) => (
              <li
                key={label}
                aria-current={
                  ["PAID", "PROVISIONING", "PROVISIONED", "ACTIVE"][index] === order.status
                    ? "step"
                    : undefined
                }
                className={
                  ["PAID", "PROVISIONING", "PROVISIONED", "ACTIVE"][index] === order.status
                    ? "font-bold underline"
                    : ""
                }
              >
                {label}
              </li>
            ))}
          </ol>
          {order.status === "HELD" && <p>Our team is reviewing your order. Access is paused.</p>}
          {["CREATED", "PAID", "PROVISIONING"].includes(order.status) && deals.find(d => d.id === order.dealId)?.items.some(item => item.startsWith("Web Hosting")) && (
            <form action={savePrepaidIntake} className="mt-6 grid gap-3">
              <input type="hidden" name="orderId" value={order.id} />
              <label>
                Primary domain
                <input
                  className="ml-3 border p-2"
                  name="primaryDomain"
                  required
                  defaultValue={order.primaryDomain ?? ""}
                />
              </label>
              <label>
                Desired cPanel username
                <input
                  className="ml-3 border p-2"
                  name="cpanelUsername"
                  required
                  defaultValue={order.cpanelUsername ?? ""}
                />
              </label>
              <button className="underline">Save activation details</button>
            </form>
          )}
          {["PAID", "PROVISIONING"].includes(order.status) &&
            deals
              .find((d) => d.id === order.dealId)
              ?.items.includes("Brand Identity Development") && (
              <form action={uploadBrandIntake} className="mt-6 grid gap-3">
                <input type="hidden" name="orderId" value={order.id} />
                <label>
                  Brand intake (PDF or PNG, up to 512 KB)
                  <input name="file" type="file" accept="application/pdf,image/png" required />
                </label>
                <button className="underline">Upload brand intake</button>
              </form>
            )}
        </article>
      ))}
      <p>
        Questions or brand intake? Email{" "}
        <a className="underline" href="mailto:admin@gloryhost.cloud">
          admin@gloryhost.cloud
        </a>
        .
      </p>
    </main>
  );
}
