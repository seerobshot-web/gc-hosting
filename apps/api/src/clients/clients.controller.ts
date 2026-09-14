import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ClientsService, CreateClientInput } from "./clients.service";

@ApiTags("clients")
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() body: CreateClientInput) {
    return this.clientsService.create(body);
  }

  @Get()
  findAll(@Query("orgId") orgId?: string) {
    return this.clientsService.findAll(orgId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.clientsService.findOne(id);
  }
}
