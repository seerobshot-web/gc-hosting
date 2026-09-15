import { createHash, randomBytes } from "crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvitationStatus, prisma, Role } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import { BillingService } from "../billing/billing.service";
import { EmailService } from "../email/email.service";
import { invitationEmail } from "../email/templates";
import type { TenantContext } from "../rbac/tenant.decorator";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const inviteSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
  invitedBy: { select: { id: true, email: true, name: true } },
};

@Injectable()
export class InvitationsService {
  constructor(
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly email: EmailService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  list(tenant: TenantContext) {
    return prisma.invitation.findMany({
      where: { orgId: tenant.orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: inviteSelect,
    });
  }

  async create(tenant: TenantContext, rawEmail: string, role: Role) {
    const email = rawEmail.trim().toLowerCase();
    if (role === Role.OWNER && tenant.membership.role !== Role.OWNER) {
      throw new ForbiddenException("Only an OWNER can invite another OWNER");
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const member = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: existingUser.id, orgId: tenant.orgId } },
      });
      if (member) throw new ConflictException("That person is already a member");
    }

    const pending = await prisma.invitation.findFirst({
      where: { orgId: tenant.orgId, email, status: InvitationStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException("An invitation for that email is already pending — resend it instead");
    }

    // A seat is consumed on accept, but refusing now avoids inviting someone
    // into a workspace that can't take them.
    await this.billing.assertSeatAvailable(tenant.orgId);

    const token = randomBytes(32).toString("hex");
    const invitation = await prisma.invitation.create({
      data: {
        orgId: tenant.orgId,
        email,
        role,
        invitedByUserId: tenant.membership.userId,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: inviteSelect,
    });

    await this.deliver(invitation.id, token);
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "invitation.sent",
      targetType: "Invitation",
      targetId: invitation.id,
      metadata: { orgId: tenant.orgId, email, role },
    });
    return invitation;
  }

  /** Rotates the token (the old link stops working) and re-emails. */
  async resend(tenant: TenantContext, id: string) {
    const invitation = await this.findInOrg(tenant.orgId, id);
    if (invitation.status !== InvitationStatus.PENDING && invitation.status !== InvitationStatus.EXPIRED) {
      throw new BadRequestException(`Cannot resend an invitation that is ${invitation.status.toLowerCase()}`);
    }
    const token = randomBytes(32).toString("hex");
    const updated = await prisma.invitation.update({
      where: { id },
      data: {
        tokenHash: hash(token),
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: inviteSelect,
    });
    await this.deliver(id, token);
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "invitation.resent",
      targetType: "Invitation",
      targetId: id,
      metadata: { orgId: tenant.orgId },
    });
    return updated;
  }

  async revoke(tenant: TenantContext, id: string) {
    const invitation = await this.findInOrg(tenant.orgId, id);
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Cannot revoke an invitation that is ${invitation.status.toLowerCase()}`);
    }
    await prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED },
    });
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "invitation.revoked",
      targetType: "Invitation",
      targetId: id,
      metadata: { orgId: tenant.orgId, email: invitation.email },
    });
  }

  /** What the public accept page needs to render — no auth, token is the credential. */
  async preview(token: string) {
    const invitation = await this.findLiveByToken(token);
    const user = await prisma.user.findUnique({ where: { email: invitation.email } });
    return {
      orgName: invitation.org.name,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invitedBy.name ?? invitation.invitedBy.email,
      expiresAt: invitation.expiresAt,
      hasAccount: Boolean(user?.passwordHash),
    };
  }

  /**
   * Three ways in, all ending in the same Membership:
   *  - a signed-in user whose email matches (bearer token) — no password
   *  - an existing account — password verifies via AuthService.login
   *  - a brand-new person — password creates the account via register
   */
  async accept(token: string, input: { password?: string; name?: string }, bearerUserId?: string) {
    const invitation = await this.findLiveByToken(token);
    const email = invitation.email;

    let userId: string;
    let tokens: Awaited<ReturnType<AuthService["login"]>> | null = null;

    if (bearerUserId) {
      const user = await prisma.user.findUnique({ where: { id: bearerUserId } });
      if (!user || user.email !== email) {
        throw new ForbiddenException(`This invitation is for ${email} — sign in with that account`);
      }
      userId = user.id;
    } else {
      if (!input.password) throw new UnauthorizedException("Password required");
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing?.passwordHash) {
        tokens = await this.auth.login(email, input.password);
        userId = existing.id;
      } else if (existing) {
        // Backfilled identity that never set a password: claim it now.
        tokens = await this.auth.setPasswordAndLogin(existing.id, input.password, input.name);
        userId = existing.id;
      } else {
        tokens = await this.auth.register(email, input.password, input.name);
        userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
      }
    }

    const already = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId: invitation.orgId } },
    });
    if (!already) {
      await this.billing.assertSeatAvailable(invitation.orgId);
      await prisma.membership.create({
        data: { userId, orgId: invitation.orgId, role: invitation.role },
      });
    }
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    });
    await this.audit.logAction({
      actor: `user:${userId}`,
      action: "invitation.accepted",
      targetType: "Invitation",
      targetId: invitation.id,
      metadata: { orgId: invitation.orgId, role: invitation.role },
    });
    await this.billing.syncSeats(invitation.orgId, `user:${userId}`);

    return { orgId: invitation.orgId, orgSlug: invitation.org.slug, role: invitation.role, tokens };
  }

  private async deliver(invitationId: string, token: string) {
    const invitation = await prisma.invitation.findUniqueOrThrow({
      where: { id: invitationId },
      include: { org: true, invitedBy: true },
    });
    const origin = this.config.get<string>("GCH_PORTAL_ORIGIN") ?? "http://localhost:3001";
    await this.email.send(
      invitationEmail({
        to: invitation.email,
        orgName: invitation.org.name,
        inviterName: invitation.invitedBy.name ?? invitation.invitedBy.email,
        role: invitation.role,
        acceptUrl: `${origin}/invite/${token}`,
        expiresAt: invitation.expiresAt,
      }),
    );
  }

  private async findInOrg(orgId: string, id: string) {
    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation || invitation.orgId !== orgId) {
      throw new NotFoundException(`Invitation ${id} not found`);
    }
    return invitation;
  }

  private async findLiveByToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hash(token) },
      include: { org: true, invitedBy: true },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.status === InvitationStatus.PENDING && invitation.expiresAt.getTime() < Date.now()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new GoneException("This invitation has expired — ask for a new one");
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new GoneException(`This invitation was already ${invitation.status.toLowerCase()}`);
    }
    return invitation;
  }
}
