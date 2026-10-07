import { Module } from "@nestjs/common";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { CommerceStripeAdapter } from "./commerce-stripe.adapter";
import { DeliveryAdapter } from "./delivery.adapter";
@Module({
  controllers: [CommerceController],
  providers: [CommerceService, CommerceStripeAdapter, DeliveryAdapter],
})
export class CommerceModule {}
