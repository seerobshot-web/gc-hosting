import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ClientDto, ClientIdParamsDto, CreateClientDto, FindClientsQueryDto } from "./clients.dto";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { ClientsService } from "./clients.service";

@ApiTags("clients")
@ApiBearerAuth()
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @ApiCreatedResponse({ type: ClientDto })
  @RequirePermission("client:write")
  create(@Body() body: CreateClientDto) {
    return this.clientsService.create(body);
  }

  /** Unscoped list (no orgId) can't carry a route-level permission, so it
   *  narrows to the caller's orgs in the service instead. */
  @Get()
  @ApiOkResponse({ type: ClientDto, isArray: true })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindClientsQueryDto,
  ) {
    return this.clientsService.findAll(user.userId, query.orgId);
  }

  @Get(":clientId")
  @ApiOkResponse({ type: ClientDto })
  @RequirePermission("client:read", "client")
  findOne(@Param() params: ClientIdParamsDto) {
    return this.clientsService.findOne(params.clientId);
  }
}
