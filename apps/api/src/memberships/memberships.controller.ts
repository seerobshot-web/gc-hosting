import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { MembershipsService } from "./memberships.service";
import { AddMemberDto, ChangeRoleDto } from "./dto";

@ApiTags("memberships")
@ApiBearerAuth()
@Controller("orgs/:orgId/memberships")
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param("orgId") orgId: string) {
    return this.memberships.list(user.userId, orgId);
  }

  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orgId") orgId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.memberships.add(user.userId, orgId, dto.email, dto.role);
  }

  @Patch(":id")
  changeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.memberships.changeRole(user.userId, orgId, id, dto.role);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orgId") orgId: string,
    @Param("id") id: string,
  ) {
    await this.memberships.remove(user.userId, orgId, id);
  }
}
