import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ClientDto, ClientIdParamsDto, CreateClientDto, FindClientsQueryDto } from "./clients.dto";
import { ClientsService } from "./clients.service";

@ApiTags("clients")
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @ApiCreatedResponse({ type: ClientDto })
  create(@Body() body: CreateClientDto) {
    return this.clientsService.create(body);
  }

  @Get()
  @ApiOkResponse({ type: ClientDto, isArray: true })
  findAll(@Query() query: FindClientsQueryDto) {
    return this.clientsService.findAll(query.orgId);
  }

  @Get(":id")
  @ApiOkResponse({ type: ClientDto })
  findOne(@Param() params: ClientIdParamsDto) {
    return this.clientsService.findOne(params.id);
  }
}
