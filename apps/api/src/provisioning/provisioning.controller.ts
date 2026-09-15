import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  PlaceOrderDto,
  ProvisioningClientParamsDto,
  ProvisioningOrderDto,
} from "./provisioning.dto";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { ProvisioningService } from "./provisioning.service";

@ApiTags("provisioning")
@ApiBearerAuth()
@Controller("provisioning")
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post("orders")
  @ApiCreatedResponse({ type: ProvisioningOrderDto })
  @RequirePermission("provisioning:write", "client")
  placeOrder(@Body() body: PlaceOrderDto) {
    return this.provisioningService.placeOrder(body);
  }

  @Get("orders/:clientId")
  @ApiOkResponse({ type: ProvisioningOrderDto, isArray: true })
  @RequirePermission("provisioning:read", "client")
  findByClient(@Param() params: ProvisioningClientParamsDto) {
    return this.provisioningService.findByClient(params.clientId);
  }
}
