import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { OrgsService } from "./orgs.service";
import { CreateOrgDto } from "./dto";

@ApiTags("orgs")
@ApiBearerAuth()
@Controller("orgs")
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrgDto) {
    return this.orgsService.create(user.userId, dto.name);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.orgsService.findAll(user.userId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.orgsService.findOne(user.userId, id);
  }
}
