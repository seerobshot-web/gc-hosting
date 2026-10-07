import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  ForbiddenException,
} from "@nestjs/common";
import { prisma } from "@gch/database";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { IsString, Matches, MaxLength } from "class-validator";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Public } from "../auth/public.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { CommerceService } from "./commerce.service";

class CheckoutDto {
  @IsString() @MaxLength(100) dealId!: string;
  @Matches(/^[a-zA-Z0-9_-]{16,100}$/) requestKey!: string;
}
class IntakeDto {
  @Matches(/^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,63}$/) primaryDomain!: string;
  @Matches(/^[a-z][a-z0-9]{0,15}$/) cpanelUsername!: string;
}
class UploadDto {
  @IsString() @MaxLength(699052) base64!: string;
}
@Controller("commerce")
export class CommerceController {
  constructor(
    private readonly service: CommerceService,
    private readonly config: ConfigService,
  ) {}
  @Public() @Get("catalog") catalog() {
    return this.service.catalog();
  }
  @Post("checkout")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return this.service.checkout(user.userId, dto.dealId, dto.requestKey);
  }
  @Public()
  @Post("webhook")
  webhook(@Req() req: FastifyRequest & { rawBody?: Buffer }) {
    const signature = req.headers["stripe-signature"];
    return this.service.webhook(req.rawBody, typeof signature === "string" ? signature : undefined);
  }
  @Get("orders") orders(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.userId);
  }
  @Patch("orders/:id/intake") intake(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: IntakeDto,
  ) {
    return this.service.intake(user.userId, id, dto.primaryDomain, dto.cpanelUsername);
  }
  @Post("orders/:id/brand-intake")
  upload(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UploadDto) {
    return this.service.uploadIntake(user.userId, id, dto.base64);
  }
  private async ops(user: AuthenticatedUser) {
    const allowed = (this.config.get<string>("COMMERCE_OPS_USER_IDS") ?? "")
      .split(",")
      .map((s) => s.trim());
    if (
      !allowed.includes(user.userId) ||
      !(await prisma.user.findUnique({ where: { id: user.userId } }))
    )
      throw new ForbiddenException();
  }
  @Get("ops/orders") async opsOrders(@CurrentUser() user: AuthenticatedUser) {
    await this.ops(user);
    return this.service.opsList();
  }
  @Post("ops/orders/:id/confirm-human-delivery") async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    await this.ops(user);
    return this.service.completeHuman(id, user.userId);
  }
  @Get("ops/orders/:id/brand-intake")
  async opsIntake(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() reply: FastifyReply,
  ) {
    await this.ops(user);
    const file = await this.service.opsIntake(id);
    return reply
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Disposition", 'attachment; filename="brand-intake"')
      .type(file.mime)
      .send(file.bytes);
  }
  @Public()
  @Get("guides/:id")
  async guide(
    @Param("id") id: string,
    @Query("expires") expires: string,
    @Query("signature") signature: string,
    @Res() reply: FastifyReply,
  ) {
    const bytes = await this.service.guide(id, Number(expires), signature ?? "");
    return reply
      .header("Cache-Control", "private, no-store")
      .header("Referrer-Policy", "no-referrer")
      .header("Content-Disposition", 'attachment; filename="GCH-activation-guide.pdf"')
      .type("application/pdf")
      .send(bytes);
  }
}
