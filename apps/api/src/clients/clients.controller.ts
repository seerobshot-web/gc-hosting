import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto";

@ApiTags("clients")
@ApiBearerAuth()
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @RequirePermission("client:write")
  create(@Body() body: CreateClientDto) {
    return this.clientsService.create(body);
  }

  /** Unscoped list (no orgId) can't carry a route-level permission, so it
   *  narrows to the caller's orgs in the service instead. */
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query("orgId") orgId?: string,
  ) {
    return this.clientsService.findAll(user.userId, orgId);
  }

  @Get(":clientId")
  @RequirePermission("client:read", "client")
  findOne(@Param("clientId") clientId: string) {
    return this.clientsService.findOne(clientId);
  }
}
