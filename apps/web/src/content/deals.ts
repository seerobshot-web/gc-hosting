import { deals } from "@gch/commerce";
const products = deals.map((deal) => ({
  "@type": "Product",
  name: deal.name,
  description: deal.items.join(", "),
  ...(deal.price.cents !== null && deal.price.verified
    ? {
        offers: {
          "@type": "Offer",
          price: (deal.price.cents / 100).toFixed(2),
          priceCurrency: "USD",
          availability: "https://schema.org/OutOfStock",
        },
      }
    : {}),
}));
export const structuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": products,
}).replaceAll(String.fromCharCode(60), "\\u003c");
export const toolLinks: Record<string, string> = {
  "Web Hosting (Starter)": "web-hosting",
  "Web Hosting (Business)": "web-hosting",
  "Link in Bio": "link-in-bio",
  "Appointment Booking": "appointment-booking",
  "Social Media Automation": "social-media-automation",
  "Business Website": "business-website",
  "Managed SEO": "managed-seo",
  "Reputation Management": "reputation-reviews",
};
