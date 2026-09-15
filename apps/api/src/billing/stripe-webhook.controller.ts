import { Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { Public } from "../auth/public.decorator";
import { StripeWebhookService } from "./stripe-webhook.service";

/**
 * Authenticated by Stripe's signature over the raw body, not by a bearer
 * token — hence @Public(). `rawBody` is populated because main.ts creates
 * the app with `{ rawBody: true }`; the parsed JSON body is never used here.
 */
@ApiExcludeController()
@Controller("webhooks")
export class StripeWebhookController {
  constructor(private readonly webhooks: StripeWebhookService) {}

  @Public()
  @Post("stripe")
  @HttpCode(200)
  handle(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers("stripe-signature") signature?: string,
  ) {
    return this.webhooks.handle(req.rawBody, signature);
  }
}
