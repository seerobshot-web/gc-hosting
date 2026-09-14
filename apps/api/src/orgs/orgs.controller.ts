import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OrgsService } from "./orgs.service";

@ApiTags("orgs")
@Controller("orgs")
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  create(@Body("name") name: string) {
    return this.orgsService.create(name);
  }

  @Get()
  findAll() {
    return this.orgsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.orgsService.findOne(id);
  }
}
