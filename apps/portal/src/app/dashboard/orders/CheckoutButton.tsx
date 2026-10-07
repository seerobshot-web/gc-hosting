"use client";
export function CheckoutButton({
  dealId,
  version,
  children,
}: {
  dealId: string;
  version: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className="my-4 underline"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("gch:conversion", {
            detail: { event: "checkout_requested", deal_id: dealId, catalog_version: version },
          }),
        )
      }
    >
      {children}
    </button>
  );
}
