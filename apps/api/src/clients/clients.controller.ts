import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto";

@ApiTags("clients")
@ApiBearerAuth()
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateClientDto) {
    return this.clientsService.create(user.userId, body);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query("orgId") orgId?: string,
  ) {
    return this.clientsService.findAll(user.userId, orgId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.clientsService.findOne(user.userId, id);
  }
}
