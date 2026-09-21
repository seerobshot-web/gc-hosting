import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { GlinksHttpClient } from "./glinks-http.client";

/** Requests older/newer than this are rejected even with a valid signature. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Verifies inbound calls from the legacy GLINKS VPS the same way
 * GlinksHttpClient signs outbound ones (see docs/architecture/GLINKS-INTEGRATION.md):
 * `X-Internal-Token` must equal HMAC-SHA256(`${timestamp}:${rawBody}`, shared
 * secret), and `X-Timestamp` must fall within a bounded replay window. Attach
 * with `@UseGuards(GlinksInternalGuard)` on any route GLINKS calls back into;
 * it does not check bearer auth, so pair it with `@Public()`.
 */
@Injectable()
export class GlinksInternalGuard implements CanActivate {
  constructor(private readonly glinksHttpClient: GlinksHttpClient) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<FastifyRequest>>();

    const timestamp = firstHeader(req.headers["x-timestamp"]);
    const token = firstHeader(req.headers["x-internal-token"]);
    if (!timestamp || !token) {
      throw new UnauthorizedException("Missing X-Timestamp/X-Internal-Token headers");
    }
    if (!/^\d+$/.test(timestamp)) {
      throw new UnauthorizedException("X-Timestamp must be a unix-millis integer");
    }
    if (Math.abs(Date.now() - Number(timestamp)) > MAX_CLOCK_SKEW_MS) {
      throw new UnauthorizedException("X-Timestamp is outside the allowed replay window");
    }

    const body = req.rawBody ? req.rawBody.toString("utf8") : "";
    if (!this.glinksHttpClient.verify(timestamp, body, token)) {
      throw new UnauthorizedException("Invalid X-Internal-Token signature");
    }

    return true;
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
