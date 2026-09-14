import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  PlaceOrderDto,
  ProvisioningClientParamsDto,
  ProvisioningOrderDto,
} from "./provisioning.dto";
import { ProvisioningService } from "./provisioning.service";

@ApiTags("provisioning")
@Controller("provisioning")
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post("orders")
  @ApiCreatedResponse({ type: ProvisioningOrderDto })
  placeOrder(@Body() body: PlaceOrderDto) {
    return this.provisioningService.placeOrder(body);
  }

  @Get("orders/:clientId")
  @ApiOkResponse({ type: ProvisioningOrderDto, isArray: true })
  findByClient(@Param() params: ProvisioningClientParamsDto) {
    return this.provisioningService.findByClient(params.clientId);
  }
}
