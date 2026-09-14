import { randomBytes, createHash } from "crypto";
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { prisma, Role } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import { BillingService } from "../billing/billing.service";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_ROUNDS = 12;

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  async register(rawEmail: string, password: string, name?: string) {
    const email = rawEmail.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("An account with that email already exists");
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });
    await this.autoJoinByDomain(user.id, user.email);
    return this.issueTokens(user.id, user.email);
  }

  async login(rawEmail: string, password: string) {
    const email = rawEmail.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid email or password");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.autoJoinByDomain(user.id, user.email);
    return this.issueTokens(user.id, user.email);
  }

  /**
   * For an identity that exists without a password (created by the Stage 1
   * backfill) and is now claimed through an invitation link.
   */
  async setPasswordAndLogin(userId: string, password: string, name?: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        ...(name ? { name } : {}),
        lastLoginAt: new Date(),
      },
    });
    return this.issueTokens(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    // Rotate: revoke the used token, issue a new pair.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.userId, stored.user.email);
  }

  async logout(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Org.autoJoinDomain can only ever point at a DNS-verified domain (see
   * DomainsService), so matching the email's domain is sufficient proof of
   * affiliation. Never blocks sign-in: a full workspace just means no join.
   */
  private async autoJoinByDomain(userId: string, email: string) {
    const domain = email.split("@")[1];
    if (!domain) return;
    const org = await prisma.org.findUnique({ where: { autoJoinDomain: domain } });
    if (!org) return;

    const existing = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId: org.id } },
    });
    if (existing) return;

    try {
      await this.billing.assertSeatAvailable(org.id);
    } catch (err) {
      this.logger.warn(
        `Auto-join of ${email} into ${org.slug} skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    const membership = await prisma.membership.create({
      data: { userId, orgId: org.id, role: Role.MEMBER },
    });
    await this.audit.logAction({
      actor: "system:auto-join",
      action: "membership.created",
      targetType: "Membership",
      targetId: membership.id,
      metadata: { orgId: org.id, userId, role: Role.MEMBER, via: "autoJoinDomain", domain },
    });
    await this.billing.syncSeats(org.id, "system:auto-join");
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );

    const refreshToken = randomBytes(32).toString("hex");
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }
}
