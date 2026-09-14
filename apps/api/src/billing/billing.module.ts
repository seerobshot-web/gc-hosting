import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { StripeService } from "./stripe.service";
import { BillingService } from "./billing.service";
import { StripeWebhookService } from "./stripe-webhook.service";
import { BillingController } from "./billing.controller";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({
  imports: [AuditModule],
  providers: [StripeService, BillingService, StripeWebhookService],
  controllers: [BillingController, StripeWebhookController],
  exports: [BillingService],
})
export class BillingModule {}
