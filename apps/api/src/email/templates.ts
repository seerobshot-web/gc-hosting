import type { Mail } from "./email.service";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#F6F2E7;color:#2C231C;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #C9C0AF;border-radius:8px;padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${bodyHtml}
<p style="margin-top:28px;font-size:12px;color:#2C231C99">Glory Cloud Hosts</p></div></body></html>`;
}

export function invitationEmail(opts: {
  to: string;
  orgName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
}): Mail {
  const when = opts.expiresAt.toUTCString();
  return {
    to: opts.to,
    subject: `${opts.inviterName} invited you to ${opts.orgName}`,
    text: `${opts.inviterName} has invited you to join ${opts.orgName} as ${opts.role.toLowerCase()}.\n\nAccept: ${opts.acceptUrl}\n\nThis link expires ${when}. If you weren't expecting it, ignore this email.`,
    html: layout(
      `You're invited to ${opts.orgName}`,
      `<p>${esc(opts.inviterName)} has invited you to join <strong>${esc(opts.orgName)}</strong> as <strong>${esc(opts.role.toLowerCase())}</strong>.</p>
<p><a href="${esc(opts.acceptUrl)}" style="display:inline-block;background:#A83E1B;color:#F6F2E7;padding:10px 18px;border-radius:6px;text-decoration:none">Accept invitation</a></p>
<p style="font-size:13px;color:#2C231C99">This link expires ${esc(when)}. If you weren't expecting it, you can ignore this email.</p>`,
    ),
  };
}

export function paymentFailedEmail(opts: {
  to: string;
  orgName: string;
  amountDueCents: number;
  currency: string;
  billingUrl: string;
}): Mail {
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: opts.currency.toUpperCase(),
  }).format(opts.amountDueCents / 100);
  return {
    to: opts.to,
    subject: `Payment failed for ${opts.orgName}`,
    text: `We couldn't collect ${amount} for ${opts.orgName}'s subscription. Update the payment method to keep the workspace active: ${opts.billingUrl}`,
    html: layout(
      "Payment failed",
      `<p>We couldn't collect <strong>${esc(amount)}</strong> for <strong>${esc(opts.orgName)}</strong>'s subscription.</p>
<p><a href="${esc(opts.billingUrl)}" style="display:inline-block;background:#A83E1B;color:#F6F2E7;padding:10px 18px;border-radius:6px;text-decoration:none">Update payment method</a></p>`,
    ),
  };
}
