import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

/**
 * Lazily constructed so the api still boots (and every non-billing route
 * works) in an environment without Stripe keys; only the first billing call
 * fails, loudly, with the missing variable named.
 */
@Injectable()
export class StripeService {
  private instance?: Stripe;

  constructor(private readonly config: ConfigService) {}

  get client(): Stripe {
    if (!this.instance) {
      const key = this.config.get<string>("STRIPE_SECRET_KEY");
      if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
      this.instance = new Stripe(key);
    }
    return this.instance;
  }

  get webhookSecret(): string {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    return secret;
  }

  get portalOrigin(): string {
    return this.config.get<string>("GCH_PORTAL_ORIGIN") ?? "http://localhost:3001";
  }
}
