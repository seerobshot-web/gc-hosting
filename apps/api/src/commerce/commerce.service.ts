import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { encryptIntake, decryptIntake } from "./intake-crypto";
import { Cron } from "@nestjs/schedule";
import { prisma, Prisma, CommerceOrderStatus } from "@gch/database";
import { catalogVersion, checkoutBlockers, deals, findDeal, canTransition } from "@gch/commerce";
import type Stripe from "stripe";
import { CommerceStripeAdapter } from "./commerce-stripe.adapter";
import { DeliveryAdapter } from "./delivery.adapter";
import { EmailService } from "../email/email.service";

@Injectable()
export class CommerceService {
  constructor(
    private readonly config: ConfigService,
    private readonly stripe: CommerceStripeAdapter,
    private readonly delivery: DeliveryAdapter,
    private readonly email: EmailService,
  ) {}
  private blockers(dealId: string): string[] {
    const reasons = checkoutBlockers(
      findDeal(dealId),
      this.config.get("COMMERCE_ENABLED") === "true",
      (this.config.get<string>("COMMERCE_ENABLED_DEALS") ?? "").split(",").map((s) => s.trim()),
    );
    if (this.config.get("COMMERCE_POLICIES_APPROVED") !== "true")
      reasons.push("policies_unapproved");
    if (!this.config.get<string>("COMMERCE_OPS_EMAIL")) reasons.push("ops_contact_missing");
    if (!this.config.get<string>("COMMERCE_STRIPE_WEBHOOK_SECRET"))
      reasons.push("webhook_secret_missing");
    if (
      findDeal(dealId)?.items.includes("Brand Identity Development") &&
      !/^[a-fA-F0-9]{64}$/.test(this.config.get<string>("COMMERCE_INTAKE_KEY") ?? "")
    )
      reasons.push("intake_key_missing");
    if (!this.email.isConfigured) reasons.push("smtp_missing");
    if (this.config.get("COMMERCE_TAX_MODE") !== "none")
      reasons.push("tax_decision_unresolved_or_unsupported");
    if (!this.config.get<string>("STRIPE_SECRET_KEY")?.startsWith("sk_test_"))
      reasons.push("test_key_required");
    return reasons;
  }
  catalog() {
    return {
      version: catalogVersion,
      items: deals.map((deal) => ({
        id: deal.id,
        name: deal.name,
        priceCents: deal.price.cents,
        verified: deal.price.verified,
        termMonths: deal.termMonths,
        available: this.blockers(deal.id).length === 0,
      })),
    };
  }
  async checkout(userId: string, dealId: string, requestKey: string) {
    const deal = findDeal(dealId);
    const blockers = this.blockers(dealId);
    if (!deal || blockers.length) throw new ServiceUnavailableException({ reasons: blockers });
    // Pre-charge validation of the actual private PDF, signing key, origins and mail configuration.
    await this.delivery.guide(dealId);
    this.delivery.link("preflight", dealId);
    const origin = this.config.get<string>("COMMERCE_PORTAL_ORIGIN");
    if (!origin || !/^https?:\/\//.test(origin))
      throw new ServiceUnavailableException("portal_origin_missing");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.commerceOrder.findUnique({
        where: { userId_requestKey: { userId, requestKey } },
      });
      if (existing) {
        if (
          existing.dealId !== dealId ||
          existing.catalogVersion !== catalogVersion ||
          existing.status !== "CREATED"
        )
          throw new BadRequestException("request_key_already_used");
        return existing;
      }
      const created = await tx.commerceOrder.create({
        data: {
          userId,
          customerEmail: user.email,
          requestKey,
          dealId,
          catalogVersion,
          amountCents: deal.price.cents!,
        },
      });
      await this.audit(tx, created.id, "CREATED", "customer");
      return created;
    });
    const session = await this.stripe.create({
      orderId: order.id,
      dealId,
      version: order.catalogVersion,
      amountCents: order.amountCents,
      email: order.customerEmail,
      name: deal.name,
      successUrl: `${origin}/dashboard/orders`,
      cancelUrl: `${origin}/dashboard/orders`,
      ach: this.config.get("COMMERCE_ACH_ENABLED") === "true",
    });
    await prisma.commerceOrder.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });
    return { orderId: order.id, url: session.url };
  }
  async webhook(body: Buffer | undefined, signature: string | undefined) {
    if (!body || !signature) throw new BadRequestException("missing_signature_or_body");
    let event: Stripe.Event;
    try {
      event = this.stripe.verify(body, signature);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new BadRequestException("invalid_stripe_signature");
    }
    if (event.livemode) throw new BadRequestException("live_events_disabled");
    try {
      await prisma.$transaction(async (tx) => {
        // Permanent unique claim and all local effects commit or roll back together.
        await tx.commerceStripeEvent.create({ data: { id: event.id, type: event.type } });
        if (
          [
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
            "checkout.session.async_payment_failed",
          ].includes(event.type)
        ) {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.order_id;
          if (!orderId) return;
          const order = await tx.commerceOrder.findUnique({ where: { id: orderId } });
          if (!order) throw new BadRequestException("unknown_commerce_order");
          if (
            session.mode !== "payment" ||
            session.livemode ||
            session.id !== order.stripeSessionId ||
            session.client_reference_id !== order.id ||
            session.metadata?.deal_id !== order.dealId ||
            session.metadata?.catalog_version !== order.catalogVersion ||
            session.amount_total !== order.amountCents ||
            session.currency !== order.currency
          ) {
            await this.transition(tx, order.id, order.status, "HELD", "payment_binding_mismatch");
            await this.enqueue(tx, order.id);
            return;
          }
          if (event.type === "checkout.session.async_payment_failed") {
            if (order.status === "CREATED")
              await this.transition(tx, order.id, order.status, "FAILED", "async_payment_failed");
            else if (order.status !== "HELD" && order.status !== "FAILED")
              await this.transition(tx, order.id, order.status, "HELD", "async_payment_failed");
            await this.enqueue(tx, order.id);
            return;
          }
          if (session.payment_status !== "paid") return; // ACH completion alone cannot provision.
          if (order.status !== "CREATED") return;
          const paymentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;
          await this.transition(tx, order.id, order.status, "PAID");
          await tx.commerceOrder.update({
            where: { id: order.id },
            data: { paidAt: new Date(), stripePaymentId: paymentId ?? null },
          });
          await this.enqueue(tx, order.id);
        } else if (
          [
            "charge.refunded",
            "charge.dispute.created",
            "charge.dispute.updated",
            "charge.dispute.closed",
          ].includes(event.type)
        ) {
          const obj = event.data.object as Stripe.Charge | Stripe.Dispute;
          const ref = obj.payment_intent;
          const paymentId = typeof ref === "string" ? ref : ref?.id;
          if (!paymentId) return;
          const order = await tx.commerceOrder.findUnique({
            where: { stripePaymentId: paymentId },
          });
          if (!order) return;
          if (order.status !== "HELD" && order.status !== "FAILED")
            await this.transition(tx, order.id, order.status, "HELD", "refund_or_dispute_review");
          await this.enqueue(tx, order.id);
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Other unique conflicts are errors, not event replays.
        if (await prisma.commerceStripeEvent.findUnique({ where: { id: event.id } }))
          return { received: true, replay: true };
      }
      throw err;
    }
    return { received: true };
  }
  private enqueue(tx: Prisma.TransactionClient, orderId: string) {
    return tx.commerceJob.upsert({
      where: { orderId },
      create: { orderId },
      update: { state: "PENDING", alertSentAt: null },
    });
  }
  private audit(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: string,
    actor: string,
    reason?: string,
  ) {
    return tx.auditLog.create({
      data: {
        actor,
        action: "commerce.transition",
        targetType: "CommerceOrder",
        targetId: orderId,
        metadata: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
      },
    });
  }
  private async transition(
    tx: Prisma.TransactionClient,
    id: string,
    from: CommerceOrderStatus,
    to: CommerceOrderStatus,
    reason?: string,
  ) {
    if (!canTransition(from, to)) throw new BadRequestException("invalid_order_transition");
    const changed = await tx.commerceOrder.updateMany({
      where: { id, status: from },
      data: { status: to, holdReason: reason ?? null },
    });
    if (changed.count !== 1) throw new ServiceUnavailableException("order_changed_retry");
    await this.audit(tx, id, to, "commerce", reason);
  }
  async list(userId: string) {
    return prisma.commerceOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        dealId: true,
        status: true,
        createdAt: true,
        paidAt: true,
        holdReason: true,
        primaryDomain: true,
        cpanelUsername: true,
      },
    });
  }
  async intake(userId: string, id: string, primaryDomain: string, cpanelUsername: string) {
    const result = await prisma.commerceOrder.updateMany({
      where: { id, userId, status: { in: ["CREATED", "PAID", "PROVISIONING"] } },
      data: { primaryDomain, cpanelUsername },
    });
    if (result.count !== 1) throw new NotFoundException();
    return { saved: true };
  }
  async uploadIntake(userId: string, id: string, base64: string) {
    const order = await prisma.commerceOrder.findFirst({
      where: { id, userId, status: { in: ["PAID", "PROVISIONING"] } },
    });
    if (!order || !findDeal(order.dealId)?.items.includes("Brand Identity Development"))
      throw new NotFoundException();
    const file = encryptIntake(
      base64,
      `${id}:${userId}`,
      this.config.get<string>("COMMERCE_INTAKE_KEY"),
    );
    const changed = await prisma.commerceOrder.updateMany({
      where: { id, userId, status: { in: ["PAID", "PROVISIONING"] } },
      data: { brandIntakeEncrypted: file.encrypted, brandIntakeMime: file.mime },
    });
    if (changed.count !== 1) throw new NotFoundException();
    return { saved: true };
  }
  async opsIntake(id: string) {
    const order = await prisma.commerceOrder.findUnique({ where: { id } });
    if (!order?.brandIntakeEncrypted || !order.brandIntakeMime) throw new NotFoundException();
    return {
      bytes: decryptIntake(
        order.brandIntakeEncrypted,
        `${id}:${order.userId}`,
        this.config.get<string>("COMMERCE_INTAKE_KEY"),
      ),
      mime: order.brandIntakeMime,
    };
  }
  // No RP orders are made: unverified contracts can never be rescued by a switch.
  @Cron("*/5 * * * *")
  async process() {
    const jobs = await prisma.commerceJob.findMany({
      where: { state: "PENDING" },
      include: { order: true },
      take: 50,
    });
    for (const job of jobs) {
      const order = job.order;
      if (order.status === "PAID") {
        let reason = this.blockers(order.dealId)[0];
        try {
          if (!order.stripeSessionId || !(await this.stripe.paid(order.stripeSessionId)))
            reason = "payment_unverified";
        } catch {
          reason = "payment_verification_unavailable";
        }
        if (order.catalogVersion !== catalogVersion) reason = "catalog_version_mismatch";
        if (findDeal(order.dealId)?.fulfillment !== "human") reason = "rp_contract_unresolved";
        await prisma.$transaction(async (tx) => {
          await this.transition(tx, order.id, "PAID", reason ? "HELD" : "PROVISIONING", reason);
        });
      }
      // Alerts are durable and at-least-once. SMTP failures leave the job retryable.
      if (!job.alertSentAt) {
        const to = this.config.get<string>("COMMERCE_OPS_EMAIL");
        if (!to) throw new ServiceUnavailableException("ops_contact_missing");
        await this.email.sendRequired({
          to,
          subject: "GCH order requires review",
          text: `Review prepaid order ${order.id} in the operations API.`,
          html: `<p>Review prepaid order ${order.id} in the operations API.</p>`,
        });
      }
      await prisma.commerceJob.update({
        where: { orderId: order.id },
        data: { alertSentAt: new Date(), state: "AWAITING_REVIEW" },
      });
    }
  }
  async opsList() {
    return prisma.commerceOrder.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      select: { id: true, dealId: true, status: true, holdReason: true, createdAt: true },
    });
  }
  async completeHuman(id: string, actor: string) {
    const order = await prisma.commerceOrder.findUnique({ where: { id } });
    if (
      !order ||
      findDeal(order.dealId)?.fulfillment !== "human" ||
      order.status !== "PROVISIONING"
    )
      throw new BadRequestException("not_awaiting_human_fulfillment");
    if (this.blockers(order.dealId).length)
      throw new ServiceUnavailableException("commerce_disabled");
    if (!order.stripeSessionId || !(await this.stripe.paid(order.stripeSessionId)))
      throw new ServiceUnavailableException("payment_unverified");
    await this.delivery.guide(order.dealId);
    await prisma.$transaction(async (tx) => {
      await this.transition(tx, id, "PROVISIONING", "PROVISIONED");
      await this.audit(tx, id, "human_fulfillment_confirmed", actor);
      await this.transition(tx, id, "PROVISIONED", "ACTIVE");
      await tx.commerceJob.update({ where: { orderId: id }, data: { state: "DELIVERY_PENDING" } });
    });
    return { confirmed: true };
  }
  @Cron("* * * * *")
  async deliver() {
    const jobs = await prisma.commerceJob.findMany({
      where: { state: { in: ["DELIVERY_PENDING", "AWAITING_REVIEW"] } },
      include: { order: true },
      take: 50,
    });
    for (const job of jobs) {
      const { order } = job;
      if (!["PROVISIONING", "ACTIVE"].includes(order.status) || this.blockers(order.dealId).length)
        continue;
      if (order.status === "PROVISIONING" && job.deliverySentAt) continue;
      if (!order.stripeSessionId || !(await this.stripe.paid(order.stripeSessionId))) continue;
      await this.delivery.guide(order.dealId);
      const link = this.delivery.link(order.id, order.dealId);
      const message =
        order.status === "ACTIVE"
          ? "Your service is ready."
          : "Your payment is confirmed. Please complete the intake in your guide so our team can begin your work.";
      await this.email.sendRequired({
        to: order.customerEmail,
        subject: "Your GCH activation guide",
        text: `${message} Download your guide (expires in one hour): ${link}`,
        html: `<p>${message}</p><p><a href="${link.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">Download your activation guide</a> (expires in one hour).</p>`,
      });
      await prisma.commerceJob.update({
        where: { orderId: order.id },
        data: {
          state: order.status === "ACTIVE" ? "DONE" : "AWAITING_REVIEW",
          deliverySentAt: new Date(),
        },
      });
    }
  }
  async guide(id: string, expires: number, signature: string) {
    const order = await prisma.commerceOrder.findUnique({ where: { id } });
    if (
      !order ||
      !["PROVISIONING", "PROVISIONED", "ACTIVE"].includes(order.status) ||
      !this.delivery.valid(id, order.dealId, expires, signature)
    )
      throw new NotFoundException();
    return this.delivery.guide(order.dealId);
  }
}
