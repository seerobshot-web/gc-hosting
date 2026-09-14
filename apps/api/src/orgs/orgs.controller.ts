import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OrgsService } from "./orgs.service";
import { CreateOrgDto } from "./dto";

@ApiTags("orgs")
@Controller("orgs")
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  create(@Body() dto: CreateOrgDto) {
    return this.orgsService.create(dto.name);
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
