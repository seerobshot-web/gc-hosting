import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { GlinksService } from "./glinks.service";
import { CreateGLinkDto, ReorderGLinksDto } from "./dto";

@ApiTags("glinks")
@ApiBearerAuth()
@Controller("glinks")
export class GlinksController {
  constructor(private readonly glinksService: GlinksService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateGLinkDto) {
    return this.glinksService.create(user.userId, body);
  }

  @Get()
  findByClient(
    @CurrentUser() user: AuthenticatedUser,
    @Query("clientId") clientId: string,
  ) {
    return this.glinksService.findByClient(user.userId, clientId);
  }

  @Patch("reorder")
  reorder(@CurrentUser() user: AuthenticatedUser, @Body() body: ReorderGLinksDto) {
    return this.glinksService.reorder(user.userId, body.clientId, body.orderedIds);
  }

  @Patch(":id/deactivate")
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.glinksService.deactivate(user.userId, id);
  }
}
