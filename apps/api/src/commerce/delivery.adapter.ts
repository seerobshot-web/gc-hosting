import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { findDeal } from "@gch/commerce";

@Injectable()
export class DeliveryAdapter {
  constructor(private readonly config: ConfigService) {}
  private secret(): string {
    const secret = this.config.get<string>("COMMERCE_DELIVERY_SECRET");
    if (!secret || secret.length < 32)
      throw new ServiceUnavailableException("delivery_secret_missing");
    return secret;
  }
  private signature(orderId: string, dealId: string, expires: number): string {
    return createHmac("sha256", this.secret())
      .update(`${orderId}:${dealId}:${expires}`)
      .digest("hex");
  }
  link(orderId: string, dealId: string): string {
    const origin = this.config.get<string>("COMMERCE_API_ORIGIN");
    if (!origin || !/^https?:\/\//.test(origin))
      throw new ServiceUnavailableException("delivery_origin_missing");
    const expires = Math.floor(Date.now() / 1000) + 3600;
    return `${origin}/commerce/guides/${orderId}?expires=${expires}&signature=${this.signature(orderId, dealId, expires)}`;
  }
  valid(orderId: string, dealId: string, expires: number, signature: string): boolean {
    if (
      typeof signature !== "string" ||
      !Number.isSafeInteger(expires) ||
      expires < Date.now() / 1000 ||
      expires > Date.now() / 1000 + 3600 ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      return false;
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(this.signature(orderId, dealId, expires), "hex"),
    );
  }
  async guide(dealId: string): Promise<Buffer> {
    const filename = findDeal(dealId)?.guide;
    const folder = this.config.get<string>("COMMERCE_GUIDE_DIRECTORY");
    if (!folder || !filename) throw new ServiceUnavailableException("guide_missing");
    try {
      const base = await realpath(folder);
      const file = await realpath(join(base, filename));
      const rel = relative(base, file);
      if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`))
        throw new Error("outside guide directory");
      const bytes = await readFile(file);
      if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("not a PDF");
      return bytes;
    } catch {
      throw new NotFoundException("guide_unavailable");
    }
  }
}
